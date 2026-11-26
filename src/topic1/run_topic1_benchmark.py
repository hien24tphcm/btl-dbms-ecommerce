"""
src/topic1/run_topic1_benchmark.py
Automated Dual-DBMS Benchmark, Storage Introspection & Chart Generator for Topic 1
(Data Storage & Schema Design: MS SQL Server 2025 vs. Neo4j 5.26 Community LTS)

Outputs:
  - docs/tasks/topic1_results.csv
  - docs/tasks/topic1_neo4j_stores.csv
  - docs/tasks/topic1_page_internals.txt
  - docs/tasks/figures/topic1_storage_comparison.png
  - docs/tasks/figures/topic1_evolution_query.png
  - docs/tasks/figures/topic1_neo4j_store_breakdown.png
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
TOPIC1_DIR = Path(__file__).resolve().parent
MSSQL_DIR = TOPIC1_DIR / "mssql"
NEO4J_DIR = TOPIC1_DIR / "neo4j"
OUT_DIR = WORKSPACE_ROOT / "docs" / "tasks"
FIG_DIR = OUT_DIR / "figures"

EXPECTED_BLACK_COUNT = 8000
EXPECTED_EVOLVED_COUNT = 10000
EXPECTED_TOTAL_VARIANTS = 50000
EXPECTED_TOTAL_PRODUCTS = 10000


def load_env_config() -> Dict[str, str]:
    env: Dict[str, str] = {}
    env_file = WORKSPACE_ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for key in ["MSSQL_SA_PASSWORD", "MSSQL_HOST", "MSSQL_PORT", "NEO4J_PASSWORD", "NEO4J_CONTAINER"]:
        if key in os.environ:
            env[key] = os.environ[key]
    env.setdefault("MSSQL_SA_PASSWORD", "Password_123#")
    env.setdefault("MSSQL_HOST", "localhost")
    env.setdefault("MSSQL_PORT", "1433")
    env.setdefault("NEO4J_PASSWORD", "Neo4jSecurePass2025!")
    env.setdefault("NEO4J_CONTAINER", "ecommerce_neo4j")
    return env


def parse_pipe_tables(output: str) -> List[List[Dict[str, str]]]:
    """Parse one or more `sqlcmd -W -s "|"` result tables into lists of row dicts."""
    lines = output.splitlines()
    tables: List[List[Dict[str, str]]] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if i + 1 < len(lines):
            sep = lines[i + 1].strip()
            sep_parts = [p.strip() for p in sep.split("|")]
            if sep_parts and all(p and set(p) == {"-"} for p in sep_parts):
                headers = [h.strip() for h in line.split("|")]
                i += 2
                rows: List[Dict[str, str]] = []
                while i < len(lines):
                    cur = lines[i].strip()
                    if (
                        not cur
                        or cur.startswith("(")
                        or cur.startswith("===")
                        or cur.startswith("Msg ")
                        or cur.startswith("Table ")
                        or cur.startswith("SQL Server ")
                    ):
                        break
                    if i + 1 < len(lines):
                        cur_cols = cur.split("|")
                        next_parts = [p.strip() for p in lines[i + 1].strip().split("|")]
                        if (
                            len(next_parts) == len(cur_cols)
                            and next_parts
                            and all(p and set(p) == {"-"} for p in next_parts)
                        ):
                            break
                    if "|" not in cur and len(headers) > 1:
                        break
                    vals = [v.strip() for v in lines[i].split("|")]
                    if len(vals) == len(headers):
                        rows.append(dict(zip(headers, vals)))
                    i += 1
                tables.append(rows)
                continue
        i += 1
    return tables


class MssqlRunner:
    def __init__(self, env: Dict[str, str]) -> None:
        self.env = env
        self.mode = self._detect_mode()

    def _detect_mode(self) -> str:
        probes = [
            ("local_win", ["sqlcmd", "-S", self.env["MSSQL_HOST"], "-E", "-C", "-Q", "SELECT 1"]),
            (
                "local_sa",
                ["sqlcmd", "-S", self.env["MSSQL_HOST"], "-U", "sa", "-P", self.env["MSSQL_SA_PASSWORD"], "-C", "-Q", "SELECT 1"],
            ),
            (
                "docker",
                [
                    "docker", "exec", "-i", "ecommerce_mssql",
                    "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost",
                    "-U", "sa", "-P", self.env["MSSQL_SA_PASSWORD"], "-C", "-Q", "SELECT 1",
                ],
            ),
        ]
        for mode, cmd in probes:
            try:
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if res.returncode == 0:
                    return mode
            except Exception:
                continue
        raise RuntimeError("Cannot connect to MS SQL Server via Windows Auth, SA Auth, or Docker.")

    def _base_cmd(self, database: Optional[str] = None) -> List[str]:
        if self.mode == "local_win":
            cmd = ["sqlcmd", "-S", self.env["MSSQL_HOST"], "-E", "-C", "-W", "-s", "|", "-f", "65001", "-b"]
        elif self.mode == "local_sa":
            cmd = [
                "sqlcmd", "-S", self.env["MSSQL_HOST"], "-U", "sa",
                "-P", self.env["MSSQL_SA_PASSWORD"], "-C", "-W", "-s", "|", "-f", "65001", "-b",
            ]
        else:
            cmd = [
                "docker", "exec", "-i", "ecommerce_mssql",
                "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost",
                "-U", "sa", "-P", self.env["MSSQL_SA_PASSWORD"], "-C", "-W", "-s", "|", "-b",
            ]
        if database:
            cmd.extend(["-d", database])
        return cmd

    def run_sql(self, sql_text: str, database: Optional[str] = None, timeout: int = 180) -> str:
        cmd = self._base_cmd(database=database)
        res = subprocess.run(
            cmd,
            input=sql_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        combined = (res.stdout or "") + ("\n" + res.stderr if res.stderr else "")
        if res.returncode != 0:
            raise RuntimeError(f"MSSQL execution failed (exit {res.returncode}):\n{combined[-1500:]}")
        return combined

    def run_file(self, sql_path: Path, database: Optional[str] = None, timeout: int = 180) -> str:
        return self.run_sql(sql_path.read_text(encoding="utf-8"), database=database, timeout=timeout)


class Neo4jRunner:
    def __init__(self, env: Dict[str, str]) -> None:
        self.container = env["NEO4J_CONTAINER"]
        self.password = env["NEO4J_PASSWORD"]

    def run_cypher(
        self,
        cypher_text: str,
        fmt: str = "plain",
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 180,
    ) -> str:
        cmd = [
            "docker", "exec", "-i", self.container,
            "cypher-shell", "-u", "neo4j", "-p", self.password,
            "--format", fmt,
        ]
        if params:
            for k, v in params.items():
                cmd.extend(["-P", f"{k}=>{v}"])
        res = subprocess.run(
            cmd,
            input=cypher_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        combined = (res.stdout or "") + ("\n" + res.stderr if res.stderr else "")
        if res.returncode != 0:
            raise RuntimeError(f"Neo4j cypher-shell failed (exit {res.returncode}):\n{combined[-1500:]}")
        return combined

    def run_file(
        self,
        cypher_path: Path,
        fmt: str = "plain",
        params: Optional[Dict[str, Any]] = None,
        timeout: int = 180,
    ) -> str:
        return self.run_cypher(cypher_path.read_text(encoding="utf-8"), fmt=fmt, params=params, timeout=timeout)

    def restart_and_wait(self, max_wait_s: int = 90) -> None:
        """Force a clean checkpoint flush to physical store files on Community Edition."""
        subprocess.run(["docker", "restart", self.container], check=True, capture_output=True, text=True, timeout=60)
        deadline = time.time() + max_wait_s
        while time.time() < deadline:
            try:
                out = self.run_cypher("RETURN 1 AS ok;", timeout=10)
                if "1" in out:
                    return
            except Exception:
                pass
            time.sleep(2)
        raise TimeoutError(f"Neo4j container '{self.container}' did not become ready within {max_wait_s}s after restart.")

    def snapshot_stores(self) -> Dict[str, Any]:
        cmd = [
            "docker", "exec", self.container,
            "bash", "-c", "find /data/databases/neo4j -type f -exec stat -c '%s %n' {} + | sort -k2",
        ]
        res = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=20)
        files: Dict[str, int] = {}
        buckets: Dict[str, int] = {
            "nodestore": 0,
            "relationshipstore": 0,
            "relationshipgroupstore": 0,
            "propertystore_fixed": 0,
            "propertystore_strings": 0,
            "schema_indexes": 0,
            "metadata_counts": 0,
        }
        total_bytes = 0
        for line in res.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            size_str, fpath = line.split(" ", 1)
            size = int(size_str)
            rel_path = fpath.replace("/data/databases/neo4j/", "")
            files[rel_path] = size
            total_bytes += size

            if rel_path.startswith("schema/"):
                buckets["schema_indexes"] += size
            elif rel_path.startswith("neostore.nodestore.db"):
                buckets["nodestore"] += size
            elif rel_path.startswith("neostore.relationshipstore.db"):
                buckets["relationshipstore"] += size
            elif rel_path.startswith("neostore.relationshipgroupstore."):
                buckets["relationshipgroupstore"] += size
            elif rel_path.startswith("neostore.propertystore.db.strings"):
                buckets["propertystore_strings"] += size
            elif rel_path.startswith("neostore.propertystore.db"):
                buckets["propertystore_fixed"] += size
            else:
                buckets["metadata_counts"] += size

        return {"total_bytes": total_bytes, "buckets": buckets, "files": files}


def parse_cypher_timing_ms(output: str) -> float:
    """Extract Neo4j server query execution timing from cypher-shell footer."""
    m = re.search(
        r"ready to start consuming query after\s+(\d+)\s+ms,\s+results consumed after another\s+(\d+)\s+ms",
        output,
        re.IGNORECASE,
    )
    if m:
        return float(int(m.group(1)) + int(m.group(2)))
    m2 = re.search(r'"PROFILE".*?\|\s*(\d+)\s*\|\s*(\d+)\s*\|', output)
    if m2:
        return float(int(m2.group(1)))
    return 0.0


def parse_cypher_db_hits(output: str) -> int:
    m = re.search(r"Total database accesses:\s*(\d+)", output, re.IGNORECASE)
    return int(m.group(1)) if m else 0


def parse_verbose_single_int(output: str) -> int:
    m = re.search(r"\|\s*[a-zA-Z0-9_]+\s*\|\s*\n\+[-+]+\+\s*\n\|\s*(\d+)\s*\|", output)
    if m:
        return int(m.group(1))
    raise ValueError(f"Could not extract integer result from verbose cypher-shell output:\n{output}")


def parse_statistics_io(output: str) -> Dict[str, int]:
    """Extract logical reads per table from SET STATISTICS IO ON output."""
    reads: Dict[str, int] = {}
    for m in re.finditer(r"Table '([^']+)'.*?logical reads\s+(\d+)", output, re.IGNORECASE):
        tbl = m.group(1)
        val = int(m.group(2))
        reads[tbl] = reads.get(tbl, 0) + val
    return reads


def clean_neo4j_t1(neo: Neo4jRunner) -> None:
    """Delete any prior T1* nodes in safe batches."""
    while True:
        out = neo.run_cypher(
            "MATCH (n) WHERE any(l IN labels(n) WHERE l STARTS WITH 'T1') "
            "WITH n LIMIT 5000 DETACH DELETE n RETURN count(n) AS deleted;"
        )
        deleted = int(out.splitlines()[-1].strip())
        if deleted == 0:
            break


def run_mssql_pipeline(mssql: MssqlRunner) -> Dict[str, Any]:
    print("[MSSQL] 1/5 Creating Topic1_StorageLab schema (01_lab_schema.sql)...")
    mssql.run_file(MSSQL_DIR / "01_lab_schema.sql", timeout=120)

    print("[MSSQL] 2/5 Generating 10,000 products x 5 variants = 50,000 variants (02_generate_data.sql)...")
    t0 = time.perf_counter()
    gen_out = mssql.run_file(MSSQL_DIR / "02_generate_data.sql", timeout=900)
    gen_elapsed_s = time.perf_counter() - t0
    gen_tables = parse_pipe_tables(gen_out)
    print(f"        Data generated in {gen_elapsed_s:.2f}s -> {gen_tables[-1][0] if gen_tables else ''}")

    print("[MSSQL] 3/5 Measuring baseline physical storage & allocation units (03_measure_storage.sql)...")
    store_out = mssql.run_file(MSSQL_DIR / "03_measure_storage.sql", timeout=120)
    store_tables = parse_pipe_tables(store_out)
    per_table_rows = store_tables[0]
    model_storage_rows = store_tables[1]

    print("[MSSQL] 4/5 Running Schema Evolution + Queries (d)/(a)/(c) (04_schema_evolution.sql)...")
    evo_out = mssql.run_file(MSSQL_DIR / "04_schema_evolution.sql", timeout=240)
    evo_tables = parse_pipe_tables(evo_out)
    bench_rows = evo_tables[0]
    io_reads = parse_statistics_io(evo_out)

    print("[MSSQL] 5/5 Inspecting ECommerceDB 8KB Page Internals & Schema-on-Write (05_page_internals.sql)...")
    page_out = mssql.run_file(MSSQL_DIR / "05_page_internals.sql", timeout=120)

    return {
        "per_table": per_table_rows,
        "storage": model_storage_rows,
        "bench": bench_rows,
        "io_reads": io_reads,
        "page_internals": page_out,
    }


def run_neo4j_pipeline(neo: Neo4jRunner, fresh_neo4j: bool) -> Dict[str, Any]:
    out_check = neo.run_cypher(
        "MATCH (n) WHERE any(l IN labels(n) WHERE l STARTS WITH 'T1') RETURN count(n) AS cnt;"
    )
    existing_t1 = int(out_check.splitlines()[-1].strip())

    if existing_t1 > 0 and fresh_neo4j:
        print(f"[Neo4j] --fresh-neo4j requested: cleaning {existing_t1} existing T1* nodes...")
        clean_neo4j_t1(neo)
        neo.restart_and_wait()
        existing_t1 = 0

    stores_csv_path = OUT_DIR / "topic1_neo4j_stores.csv"
    need_load = existing_t1 == 0
    store_snapshots: Dict[str, Dict[str, Any]] = {}

    if need_load:
        print("[Neo4j] 1/5 Capturing clean Baseline store sizes...")
        neo.run_file(NEO4J_DIR / "01_constraints_and_cleanup.cypher")
        neo.restart_and_wait()
        baseline_snap = neo.snapshot_stores()
        store_snapshots["Baseline"] = baseline_snap
        print(f"        Baseline store size: {baseline_snap['total_bytes'] / (1024*1024):.4f} MB")

        print("[Neo4j] 2/5 Loading N1 (50,000 Variant nodes with inline/dynamic properties)...")
        n1_cypher = (NEO4J_DIR / "02_generate_N1_properties.cypher").read_text(encoding="utf-8")
        for start_p in range(1, EXPECTED_TOTAL_PRODUCTS + 1, 2000):
            end_p = min(start_p + 1999, EXPECTED_TOTAL_PRODUCTS)
            neo.run_cypher(n1_cypher, params={"start_p": start_p, "end_p": end_p}, timeout=180)
        neo.restart_and_wait()
        after_n1_snap = neo.snapshot_stores()
        store_snapshots["After_N1"] = after_n1_snap
        print(f"        After N1 store size: {after_n1_snap['total_bytes'] / (1024*1024):.4f} MB "
              f"(Delta = {(after_n1_snap['total_bytes'] - baseline_snap['total_bytes']) / (1024*1024):.4f} MB)")

        print("[Neo4j] 3/5 Loading N2 (50,000 Variant nodes + 260,000 shared Graph-EAV edges)...")
        n2_cypher = (NEO4J_DIR / "03_generate_N2_graph_eav.cypher").read_text(encoding="utf-8")
        for start_p in range(1, EXPECTED_TOTAL_PRODUCTS + 1, 2000):
            end_p = min(start_p + 1999, EXPECTED_TOTAL_PRODUCTS)
            neo.run_cypher(n2_cypher, params={"start_p": start_p, "end_p": end_p}, timeout=240)
        neo.restart_and_wait()
        after_n2_snap = neo.snapshot_stores()
        store_snapshots["After_N2"] = after_n2_snap
        print(f"        After N2 store size: {after_n2_snap['total_bytes'] / (1024*1024):.4f} MB "
              f"(Delta = {(after_n2_snap['total_bytes'] - after_n1_snap['total_bytes']) / (1024*1024):.4f} MB)")

        # Compute clean deltas per bucket
        n1_delta_buckets = {
            k: max(0, after_n1_snap["buckets"][k] - baseline_snap["buckets"][k])
            for k in baseline_snap["buckets"]
        }
        n2_delta_buckets = {
            k: max(0, after_n2_snap["buckets"][k] - after_n1_snap["buckets"][k])
            for k in baseline_snap["buckets"]
        }
        n1_delta_bytes = max(0, after_n1_snap["total_bytes"] - baseline_snap["total_bytes"])
        n2_delta_bytes = max(0, after_n2_snap["total_bytes"] - after_n1_snap["total_bytes"])
    else:
        print(f"[Neo4j] Existing T1* graph detected ({existing_t1} nodes); skipping reload (pass --fresh-neo4j to rebuild).")
        baseline_snap = neo.snapshot_stores()
        n1_delta_bytes = 0
        n2_delta_bytes = 0
        n1_delta_buckets = {k: 0 for k in baseline_snap["buckets"]}
        n2_delta_buckets = {k: 0 for k in baseline_snap["buckets"]}
        if stores_csv_path.is_file():
            with stores_csv_path.open("r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    b = row["bucket"]
                    if b == "TOTAL":
                        n1_delta_bytes = int(row["n1_delta_bytes"])
                        n2_delta_bytes = int(row["n2_delta_bytes"])
                    elif b in n1_delta_buckets:
                        n1_delta_buckets[b] = int(row["n1_delta_bytes"])
                        n2_delta_buckets[b] = int(row["n2_delta_bytes"])

    # Verify node counts
    n1_cnt = int(neo.run_cypher("MATCH (v:T1VariantProp) RETURN count(v);").splitlines()[-1].strip())
    n2_cnt = int(neo.run_cypher("MATCH (v:T1VariantGraph) RETURN count(v);").splitlines()[-1].strip())
    assert n1_cnt == EXPECTED_TOTAL_VARIANTS, f"Expected {EXPECTED_TOTAL_VARIANTS} T1VariantProp, got {n1_cnt}"
    assert n2_cnt == EXPECTED_TOTAL_VARIANTS, f"Expected {EXPECTED_TOTAL_VARIANTS} T1VariantGraph, got {n2_cnt}"

    print("[Neo4j] 4/5 Running Schema Evolution & Queries (d)/(a)/(c)...")
    t0 = time.perf_counter()
    evo_n1_out = neo.run_cypher(
        "MATCH (v:T1VariantProp {category: 'Smartphones'}) SET v.battery_mAh = 5000 RETURN count(v) AS cnt;",
        fmt="verbose",
    )
    evo_n1_wall_ms = (time.perf_counter() - t0) * 1000.0
    evo_n1_srv_ms = parse_cypher_timing_ms(evo_n1_out) or evo_n1_wall_ms
    evo_n1_cnt = parse_verbose_single_int(evo_n1_out)

    t0 = time.perf_counter()
    evo_n2_out = neo.run_cypher(
        "MERGE (a:T1AttrValue {name: 'battery_mAh', value: '5000'}) "
        "WITH a MATCH (v:T1VariantGraph {category: 'Smartphones'}) "
        "MERGE (v)-[:T1_HAS_ATTR]->(a) RETURN count(v) AS cnt;",
        fmt="verbose",
    )
    evo_n2_wall_ms = (time.perf_counter() - t0) * 1000.0
    evo_n2_srv_ms = parse_cypher_timing_ms(evo_n2_out) or evo_n2_wall_ms
    evo_n2_cnt = parse_verbose_single_int(evo_n2_out)

    # Warmup Query (d)
    neo.run_cypher("MATCH (v:T1VariantProp) WHERE v.color = 'Black' RETURN count(v);")
    neo.run_cypher("MATCH (:T1AttrValue {name: 'color', value: 'Black'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph) RETURN count(v);")

    # 3 timed runs + PROFILE
    n1_times, n2_times = [], []
    n1_hits, n2_hits = 0, 0
    n1_black, n2_black = 0, 0
    for _ in range(3):
        o1 = neo.run_cypher("PROFILE MATCH (v:T1VariantProp) WHERE v.color = 'Black' RETURN count(v) AS cnt;", fmt="verbose")
        n1_times.append(parse_cypher_timing_ms(o1))
        n1_hits = parse_cypher_db_hits(o1)
        n1_black = parse_verbose_single_int(o1)

        o2 = neo.run_cypher(
            "PROFILE MATCH (a:T1AttrValue {name: 'color', value: 'Black'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph) RETURN count(v) AS cnt;",
            fmt="verbose",
        )
        n2_times.append(parse_cypher_timing_ms(o2))
        n2_hits = parse_cypher_db_hits(o2)
        n2_black = parse_verbose_single_int(o2)

    # Query (a) Insert & Query (c) Update
    qa_out = neo.run_cypher(
        "MATCH (p:T1Product {product_id: 1}) "
        "CREATE (p)-[:T1_HAS_VARIANT]->(tv:T1VariantProp {variant_id: 999999, product_id: 1, category: 'Smartphones', sku: 'SKU-DEMO-IP68', price: 1199.0, stock_qty: 15, color: 'Black', waterproof_ip: 'IP68'}) "
        "WITH tv DETACH DELETE tv RETURN 1 AS ok;",
        fmt="verbose",
    )
    qa_ms = parse_cypher_timing_ms(qa_out)

    qc_out = neo.run_cypher(
        "MATCH (v:T1VariantProp {variant_id: 1}) "
        "SET v.price = v.price + 10.0, v.color = 'Matte Black' "
        "WITH v SET v.price = v.price - 10.0, v.color = 'Black' "
        "RETURN v.variant_id AS ok;",
        fmt="verbose",
    )
    qc_ms = parse_cypher_timing_ms(qc_out)

    print("[Neo4j] 5/5 Demonstrating Space Reuse (create 1,000 nodes -> checkpoint -> delete -> checkpoint)...")
    before_del_snap = neo.snapshot_stores()
    neo.run_cypher(
        "UNWIND range(1, 1000) AS i CREATE (:T1DeleteDemo {id: i, pad: 'SpaceReuseDemoPayload_0123456789_' + toString(i)});"
    )
    neo.restart_and_wait()
    with_del_nodes_snap = neo.snapshot_stores()
    neo.run_cypher("MATCH (d:T1DeleteDemo) DETACH DELETE d;")
    neo.restart_and_wait()
    after_del_snap = neo.snapshot_stores()

    return {
        "n1_delta_bytes": n1_delta_bytes,
        "n2_delta_bytes": n2_delta_bytes,
        "n1_delta_buckets": n1_delta_buckets,
        "n2_delta_buckets": n2_delta_buckets,
        "evo_n1_ms": round(evo_n1_srv_ms, 3),
        "evo_n2_ms": round(evo_n2_srv_ms, 3),
        "evo_n1_cnt": evo_n1_cnt,
        "evo_n2_cnt": evo_n2_cnt,
        "q_n1_ms": round(sum(n1_times) / len(n1_times), 3),
        "q_n2_ms": round(sum(n2_times) / len(n2_times), 3),
        "q_n1_hits": n1_hits,
        "q_n2_hits": n2_hits,
        "n1_black": n1_black,
        "n2_black": n2_black,
        "qa_ms": round(qa_ms, 3),
        "qc_ms": round(qc_ms, 3),
        "space_reuse": {
            "before_bytes": before_del_snap["total_bytes"],
            "before_nodestore": before_del_snap["buckets"]["nodestore"],
            "with_1k_bytes": with_del_nodes_snap["total_bytes"],
            "with_1k_nodestore": with_del_nodes_snap["buckets"]["nodestore"],
            "after_delete_bytes": after_del_snap["total_bytes"],
            "after_delete_nodestore": after_del_snap["buckets"]["nodestore"],
        },
        "snapshots": store_snapshots,
    }


def build_summary_records(mssql_res: Dict[str, Any], neo_res: Dict[str, Any]) -> List[Dict[str, Any]]:
    storage_map = {r["model_key"]: r for r in mssql_res["storage"]}
    evo_map = {r["model_key"]: r for r in mssql_res["bench"] if r["phase"] == "evolution"}
    qd_map = {r["model_key"]: r for r in mssql_res["bench"] if r["phase"] == "query_d"}
    io_reads = mssql_res["io_reads"]

    sql_specs = [
        ("M1_EAV", "MS SQL Server 2025", "EAV (3 bảng chuẩn hóa)", "Cao (INSERT dòng, không DDL)",
         io_reads.get("T1_Variant_Attr_Values", 0), "Yếu (attr_value NVARCHAR)"),
        ("M1_EAV_PageComp", "MS SQL Server 2025", "EAV + PAGE Compression", "Cao (INSERT dòng, không DDL)",
         io_reads.get("T1_Variant_Attr_Values_PageComp", 0), "Yếu (attr_value NVARCHAR)"),
        ("M2a_JsonText", "MS SQL Server 2025", "Hybrid JSON (NVARCHAR(MAX))", "Cao (JSON_MODIFY, không DDL)",
         io_reads.get("T1_Variants_JsonText", 0), "Trung bình (CHECK ISJSON)"),
        ("M2b_JsonNative", "MS SQL Server 2025", "Hybrid Native json (SQL 2025)", "Cao (.modify(), không DDL)",
         io_reads.get("T1_Variants_JsonNative", 0), "Trung bình (Native JSON)"),
        ("M3_Sparse", "MS SQL Server 2025", "Wide Table (SPARSE NULL)", "Thấp (ALTER TABLE + Sch-M lock)",
         io_reads.get("T1_Variants_Sparse", 0), "Mạnh (Cột định kiểu riêng)"),
        ("Control_WideNoSparse", "MS SQL Server 2025", "Wide Table (Không SPARSE)", "Thấp (ALTER TABLE + Sch-M lock)",
         io_reads.get("T1_Variants_WideNoSparse", 0), "Mạnh (Cột định kiểu riêng)"),
    ]

    records: List[Dict[str, Any]] = []
    for key, dbms, label, flex, reads, type_safety in sql_specs:
        st = storage_map[key]
        ev = evo_map[key]
        qd = qd_map[key]
        match_cnt = int(qd["row_cnt"])
        evo_cnt = int(ev["row_cnt"])
        assert match_cnt == EXPECTED_BLACK_COUNT, f"SQL {key} Black count mismatch: {match_cnt}"
        assert evo_cnt == EXPECTED_EVOLVED_COUNT, f"SQL {key} Evolved count mismatch: {evo_cnt}"
        records.append({
            "model_key": key,
            "dbms": dbms,
            "design_label": label,
            "variant_count": EXPECTED_TOTAL_VARIANTS,
            "data_mb": float(st["data_mb"]),
            "index_mb": float(st["index_mb"]),
            "total_mb": float(st["total_mb"]),
            "bytes_per_variant": float(st["bytes_per_variant"]),
            "in_row_pages": int(st["in_row_pages"]),
            "row_overflow_pages": int(st["row_overflow_pages"]),
            "lob_pages": int(st["lob_pages"]),
            "avg_record_size_bytes": float(st["avg_record_size_bytes"] or 0),
            "evolution_ms": float(ev["elapsed_ms"]),
            "evolved_count": evo_cnt,
            "query_d_ms": float(qd["elapsed_ms"]),
            "query_d_cost": reads,
            "query_d_cost_unit": "logical_reads",
            "query_d_matches": match_cnt,
            "schema_flexibility": flex,
            "type_integrity": type_safety,
        })

    assert neo_res["n1_black"] == EXPECTED_BLACK_COUNT, f"Neo4j N1 Black count mismatch: {neo_res['n1_black']}"
    assert neo_res["n2_black"] == EXPECTED_BLACK_COUNT, f"Neo4j N2 Black count mismatch: {neo_res['n2_black']}"
    assert neo_res["evo_n1_cnt"] == EXPECTED_EVOLVED_COUNT
    assert neo_res["evo_n2_cnt"] == EXPECTED_EVOLVED_COUNT

    n1_idx_mb = round(neo_res["n1_delta_buckets"]["schema_indexes"] / (1024 * 1024), 4)
    n1_total_mb = round(neo_res["n1_delta_bytes"] / (1024 * 1024), 4)
    n1_data_mb = round(max(0.0, n1_total_mb - n1_idx_mb), 4)

    n2_idx_mb = round(neo_res["n2_delta_buckets"]["schema_indexes"] / (1024 * 1024), 4)
    n2_total_mb = round(neo_res["n2_delta_bytes"] / (1024 * 1024), 4)
    n2_data_mb = round(max(0.0, n2_total_mb - n2_idx_mb), 4)

    records.append({
        "model_key": "N1_Neo4j_Properties",
        "dbms": "Neo4j 5.26 Community",
        "design_label": "Property Graph (Props trên Node)",
        "variant_count": EXPECTED_TOTAL_VARIANTS,
        "data_mb": n1_data_mb,
        "index_mb": n1_idx_mb,
        "total_mb": n1_total_mb,
        "bytes_per_variant": round(neo_res["n1_delta_bytes"] / EXPECTED_TOTAL_VARIANTS, 2),
        "in_row_pages": 0,
        "row_overflow_pages": 0,
        "lob_pages": 0,
        "avg_record_size_bytes": 16.0,
        "evolution_ms": neo_res["evo_n1_ms"],
        "evolved_count": neo_res["evo_n1_cnt"],
        "query_d_ms": neo_res["q_n1_ms"],
        "query_d_cost": neo_res["q_n1_hits"],
        "query_d_cost_unit": "db_hits",
        "query_d_matches": neo_res["n1_black"],
        "schema_flexibility": "Rất cao (SET thuộc tính, 0 DDL)",
        "type_integrity": "Yếu (Community không có type constraint)",
    })
    records.append({
        "model_key": "N2_Neo4j_GraphEAV",
        "dbms": "Neo4j 5.26 Community",
        "design_label": "Graph-EAV (Node giá trị dùng chung)",
        "variant_count": EXPECTED_TOTAL_VARIANTS,
        "data_mb": n2_data_mb,
        "index_mb": n2_idx_mb,
        "total_mb": n2_total_mb,
        "bytes_per_variant": round(neo_res["n2_delta_bytes"] / EXPECTED_TOTAL_VARIANTS, 2),
        "in_row_pages": 0,
        "row_overflow_pages": 0,
        "lob_pages": 0,
        "avg_record_size_bytes": 34.0,
        "evolution_ms": neo_res["evo_n2_ms"],
        "evolved_count": neo_res["evo_n2_cnt"],
        "query_d_ms": neo_res["q_n2_ms"],
        "query_d_cost": neo_res["q_n2_hits"],
        "query_d_cost_unit": "db_hits",
        "query_d_matches": neo_res["n2_black"],
        "schema_flexibility": "Rất cao (MERGE node + cạnh)",
        "type_integrity": "Trung bình (Ràng buộc trên AttrValue)",
    })
    return records


def write_outputs(records: List[Dict[str, Any]], neo_res: Dict[str, Any], mssql_res: Dict[str, Any]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    # 1. topic1_results.csv
    res_path = OUT_DIR / "topic1_results.csv"
    with res_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    # 2. topic1_neo4j_stores.csv
    stores_path = OUT_DIR / "topic1_neo4j_stores.csv"
    buckets = list(neo_res["n1_delta_buckets"].keys())
    with stores_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["bucket", "n1_delta_bytes", "n1_delta_mb", "n2_delta_bytes", "n2_delta_mb"])
        for b in buckets:
            b1 = neo_res["n1_delta_buckets"][b]
            b2 = neo_res["n2_delta_buckets"][b]
            writer.writerow([b, b1, round(b1 / (1024 * 1024), 4), b2, round(b2 / (1024 * 1024), 4)])
        t1 = neo_res["n1_delta_bytes"]
        t2 = neo_res["n2_delta_bytes"]
        writer.writerow(["TOTAL", t1, round(t1 / (1024 * 1024), 4), t2, round(t2 / (1024 * 1024), 4)])

    # 3. topic1_page_internals.txt (including Space Reuse observation)
    sr = neo_res["space_reuse"]
    internals_text = (
        mssql_res["page_internals"]
        + "\n\n=== NEO4J SPACE REUSE EXPERIMENT (1,000 :T1DeleteDemo Nodes) ===\n"
        + f"Before Insert       : total={sr['before_bytes']} bytes, nodestore={sr['before_nodestore']} bytes\n"
        + f"With 1,000 Nodes    : total={sr['with_1k_bytes']} bytes, nodestore={sr['with_1k_nodestore']} bytes\n"
        + f"After DETACH DELETE : total={sr['after_delete_bytes']} bytes, nodestore={sr['after_delete_nodestore']} bytes\n"
    )
    (OUT_DIR / "topic1_page_internals.txt").write_text(internals_text, encoding="utf-8")


def generate_charts(records: List[Dict[str, Any]], neo_res: Dict[str, Any]) -> None:
    plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Arial"]
    plt.rcParams["axes.edgecolor"] = "#CCCCCC"
    plt.rcParams["axes.linewidth"] = 0.8

    # Chart 1: Disk Storage Comparison (Total MB & Bytes/Variant)
    sorted_rec = sorted(records, key=lambda r: r["total_mb"])
    labels = [r["design_label"] for r in sorted_rec]
    data_mbs = [r["data_mb"] for r in sorted_rec]
    idx_mbs = [r["index_mb"] for r in sorted_rec]
    totals = [r["total_mb"] for r in sorted_rec]
    bpv = [r["bytes_per_variant"] for r in sorted_rec]
    is_neo = ["Neo4j" in r["dbms"] for r in sorted_rec]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.6), sharey=True)
    y_pos = range(len(labels))
    data_colors = ["#10B981" if n else "#2563EB" for n in is_neo]
    idx_colors = ["#047857" if n else "#1E3A8A" for n in is_neo]

    ax1.barh(y_pos, data_mbs, color=data_colors, label="Data / Store Files (MB)")
    ax1.barh(y_pos, idx_mbs, left=data_mbs, color=idx_colors, label="Index / Schema Store (MB)")
    for i, tot in enumerate(totals):
        ax1.text(tot + max(totals) * 0.015, i, f"{tot:.2f} MB", va="center", fontsize=9, fontweight="bold")
    ax1.set_yticks(list(y_pos))
    ax1.set_yticklabels(labels, fontsize=9.5)
    ax1.set_xlim(0, max(totals) * 1.22)
    ax1.set_xlabel("Dung lượng đĩa (MB)")
    ax1.set_title("Tổng dung lượng lưu trữ (50.000 variants)", fontsize=11, fontweight="bold")
    ax1.grid(axis="x", linestyle="--", alpha=0.4)
    ax1.legend(loc="lower right", fontsize=8.5)

    ax2.barh(y_pos, bpv, color=data_colors)
    for i, b in enumerate(bpv):
        ax2.text(b + max(bpv) * 0.015, i, f"{b:.0f} B", va="center", fontsize=9, fontweight="bold")
    ax2.set_xlim(0, max(bpv) * 1.22)
    ax2.set_xlabel("Chi phí lưu trữ trung bình (Bytes / variant)")
    ax2.set_title("Mật độ lưu trữ trên mỗi biến thể", fontsize=11, fontweight="bold")
    ax2.grid(axis="x", linestyle="--", alpha=0.4)

    fig.suptitle("So sánh Dung lượng Lưu trữ: MS SQL Server 2025 vs. Neo4j 5.26 Community", fontsize=12.5, fontweight="bold", y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(FIG_DIR / "topic1_storage_comparison.png", dpi=300)
    plt.close(fig)

    # Chart 2: Schema Evolution & Query (d) Latency
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.4), sharey=True)
    order_rec = records
    olabels = [r["design_label"] for r in order_rec]
    ev_ms = [r["evolution_ms"] for r in order_rec]
    qd_ms = [r["query_d_ms"] for r in order_rec]
    colors_2 = ["#10B981" if "Neo4j" in r["dbms"] else "#2563EB" for r in order_rec]
    yp = range(len(olabels))

    ax1.barh(yp, ev_ms, color=colors_2)
    for i, (val, r) in enumerate(zip(ev_ms, order_rec)):
        tag = " (DDL)" if "ALTER TABLE" in r["schema_flexibility"] else ""
        ax1.text(val + max(ev_ms) * 0.015, i, f"{val:.1f} ms{tag}", va="center", fontsize=8.8, fontweight="bold")
    ax1.set_yticks(list(yp))
    ax1.set_yticklabels(olabels, fontsize=9.5)
    ax1.invert_yaxis()
    ax1.set_xlim(0, max(ev_ms) * 1.28)
    ax1.set_xlabel("Thời gian mở rộng (ms)")
    ax1.set_title("Schema Evolution: Thêm battery_mAh (10k Smartphones)", fontsize=10.5, fontweight="bold")
    ax1.grid(axis="x", linestyle="--", alpha=0.4)

    ax2.barh(yp, qd_ms, color=colors_2)
    for i, val in enumerate(qd_ms):
        ax2.text(val + max(qd_ms) * 0.015, i, f"{val:.1f} ms", va="center", fontsize=8.8, fontweight="bold")
    ax2.set_xlim(0, max(qd_ms) * 1.24)
    ax2.set_xlabel("Thời gian truy vấn trung bình trên server (ms)")
    ax2.set_title("Truy vấn (d): Lọc color = 'Black' (8.000 variants)", fontsize=10.5, fontweight="bold")
    ax2.grid(axis="x", linestyle="--", alpha=0.4)

    fig.suptitle("Hiệu năng Mở rộng Schema & Truy vấn Đơn điều kiện (MS SQL Server 2025 vs. Neo4j 5.26)", fontsize=12.5, fontweight="bold", y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(FIG_DIR / "topic1_evolution_query.png", dpi=300)
    plt.close(fig)

    # Chart 3: Neo4j Physical Store File Breakdown (N1 vs N2)
    bucket_labels = {
        "nodestore": "Node Store",
        "relationshipstore": "Relationship Store",
        "relationshipgroupstore": "Rel. Group Store",
        "propertystore_fixed": "Property Store (Fixed)",
        "propertystore_strings": "Dynamic String Store",
        "schema_indexes": "Schema & Indexes",
        "metadata_counts": "Token / Counts / Other",
    }
    keys = list(bucket_labels.keys())
    n1_vals = [neo_res["n1_delta_buckets"][k] / (1024 * 1024) for k in keys]
    n2_vals = [neo_res["n2_delta_buckets"][k] / (1024 * 1024) for k in keys]

    x = range(len(keys))
    width = 0.36
    fig, ax = plt.subplots(figsize=(11.5, 5.2))
    b1 = ax.bar([i - width / 2 for i in x], n1_vals, width, label="N1: Properties trên Node", color="#10B981")
    b2 = ax.bar([i + width / 2 for i in x], n2_vals, width, label="N2: Graph-EAV (Node giá trị chung)", color="#0F766E")

    max_v = max(max(n1_vals), max(n2_vals), 0.1)
    for bar in list(b1) + list(b2):
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h + max_v * 0.015, f"{h:.2f}", ha="center", va="bottom", fontsize=8.5)

    ax.set_xticks(list(x))
    ax.set_xticklabels([bucket_labels[k] for k in keys], rotation=18, ha="right", fontsize=9.5)
    ax.set_ylim(0, max_v * 1.18)
    ax.set_ylabel("Dung lượng tăng thêm (MB)")
    ax.set_title("Phân bổ Dung lượng Vật lý theo Store File trên Neo4j 5.26 (N1 vs. N2)", fontsize=12, fontweight="bold")
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.legend(fontsize=9.5)
    plt.tight_layout()
    fig.savefig(FIG_DIR / "topic1_neo4j_store_breakdown.png", dpi=300)
    plt.close(fig)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Topic 1 Dual-DBMS Storage & Schema Design Benchmark")
    parser.add_argument("--fresh-neo4j", action="store_true", help="Delete existing T1* nodes and reload Neo4j models")
    args = parser.parse_args()

    env = load_env_config()
    mssql = MssqlRunner(env)
    neo = Neo4jRunner(env)
    print(f"Connected MS SQL mode: {mssql.mode} | Neo4j container: {neo.container}")

    mssql_res = run_mssql_pipeline(mssql)
    neo_res = run_neo4j_pipeline(neo, fresh_neo4j=args.fresh_neo4j)

    records = build_summary_records(mssql_res, neo_res)
    write_outputs(records, neo_res, mssql_res)
    generate_charts(records, neo_res)

    print("\n" + "=" * 88)
    print("TOPIC 1 BENCHMARK SUMMARY (50,000 VARIANTS | QUERY (d) = 8,000 | EVOLVED = 10,000)")
    print("=" * 88)
    print(f"{'Model':<22} {'DBMS':<21} {'Total MB':>9} {'B/Var':>8} {'Evo ms':>9} {'Qd ms':>9} {'Matches':>8}")
    print("-" * 88)
    for r in records:
        print(
            f"{r['model_key']:<22} {r['dbms']:<21} {r['total_mb']:>9.4f} {r['bytes_per_variant']:>8.1f} "
            f"{r['evolution_ms']:>9.2f} {r['query_d_ms']:>9.2f} {r['query_d_matches']:>8d}"
        )
    print("\nQuery (a) Insert & Query (c) Update Measurements:")
    for br in mssql_res["bench"]:
        if br["phase"] in ("query_a", "query_c"):
            print(f"  [MSSQL] {br['phase']} | {br['model_key']:<18} | {br['metric_name']:<26} | {float(br['elapsed_ms']):>8.3f} ms | rows={br['row_cnt']} | {br['notes']}")
    print(f"  [Neo4j] query_a | N1_Neo4j_Properties | insert_novel_attr          | {neo_res['qa_ms']:>8.3f} ms | rows=1 | CREATE novel property waterproof_ip")
    print(f"  [Neo4j] query_c | N1_Neo4j_Properties | update_variant_attr        | {neo_res['qc_ms']:>8.3f} ms | rows=1 | Point SET price + color")
    print("\nArtifacts written:")
    print(f"  - {OUT_DIR / 'topic1_results.csv'}")
    print(f"  - {OUT_DIR / 'topic1_neo4j_stores.csv'}")
    print(f"  - {OUT_DIR / 'topic1_page_internals.txt'}")
    print(f"  - {FIG_DIR / 'topic1_storage_comparison.png'}")
    print(f"  - {FIG_DIR / 'topic1_evolution_query.png'}")
    print(f"  - {FIG_DIR / 'topic1_neo4j_store_breakdown.png'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
