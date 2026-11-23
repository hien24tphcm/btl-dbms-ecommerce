"""
tools/tests/test_topic1_storage.py
Topic 1 Verification Suite: Data Storage & Schema Design (MS SQL Server 2025 vs. Neo4j 5.26)
- Offline: verifies script presence/idempotency, benchmark CSVs, PNG figures, and task_1.md/docx
- Live MS SQL Server: verifies Topic1_StorageLab (50k variants, 270k EAV pairs, 8k Black, 10k evolved)
  and confirms ECommerceDB integrity remains completely untouched
- Live Neo4j: verifies N1/N2 50k variants, cross-DBMS parity (8k Black, 10k evolved), and original init.cypher parity
"""

from __future__ import annotations

import csv
import os
import re
import subprocess
from pathlib import Path
import pytest

try:
    from tools.tests.conftest import get_database_client, is_mssql_online
except ImportError:
    from conftest import get_database_client, is_mssql_online

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
TOPIC1_DIR = WORKSPACE_ROOT / "src" / "topic1"
TASKS_DIR = WORKSPACE_ROOT / "docs" / "tasks"
FIG_DIR = TASKS_DIR / "figures"


def _load_neo4j_password() -> str:
    env_path = WORKSPACE_ROOT / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("NEO4J_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("NEO4J_PASSWORD", "Neo4jSecurePass2025!")


def _is_neo4j_online() -> bool:
    pw = _load_neo4j_password()
    try:
        res = subprocess.run(
            ["docker", "exec", "ecommerce_neo4j", "cypher-shell", "-u", "neo4j", "-p", pw, "RETURN 1;"],
            capture_output=True,
            text=True,
            timeout=8,
        )
        return res.returncode == 0
    except Exception:
        return False


def _run_neo4j_scalar(cypher: str) -> int:
    pw = _load_neo4j_password()
    res = subprocess.run(
        ["docker", "exec", "-i", "ecommerce_neo4j", "cypher-shell", "-u", "neo4j", "-p", pw, "--format", "plain"],
        input=cypher,
        capture_output=True,
        text=True,
        timeout=30,
        check=True,
    )
    return int(res.stdout.strip().splitlines()[-1].strip())


class TestTopic1OfflineArtifacts:
    def test_topic1_scripts_exist_and_idempotent(self):
        mssql_files = [
            "01_lab_schema.sql",
            "02_generate_data.sql",
            "03_measure_storage.sql",
            "04_schema_evolution.sql",
            "05_page_internals.sql",
        ]
        for fname in mssql_files:
            p = TOPIC1_DIR / "mssql" / fname
            assert p.is_file() and p.stat().st_size > 0, f"Missing SQL script: {p}"

        schema_sql = (TOPIC1_DIR / "mssql" / "01_lab_schema.sql").read_text(encoding="utf-8")
        assert "IF NOT EXISTS" in schema_sql
        assert "IF OBJECT_ID" in schema_sql
        assert "Topic1_StorageLab" in schema_sql
        assert "DATA_COMPRESSION = PAGE" in schema_sql
        assert "SPARSE NULL" in schema_sql

        neo_files = [
            "01_constraints_and_cleanup.cypher",
            "02_generate_N1_properties.cypher",
            "03_generate_N2_graph_eav.cypher",
            "04_schema_evolution_and_queries.cypher",
            "05_demo_browser_queries.cypher",
        ]
        for fname in neo_files:
            p = TOPIC1_DIR / "neo4j" / fname
            assert p.is_file() and p.stat().st_size > 0, f"Missing Cypher script: {p}"

        constraints_cypher = (TOPIC1_DIR / "neo4j" / "01_constraints_and_cleanup.cypher").read_text(encoding="utf-8")
        assert "IF NOT EXISTS" in constraints_cypher

        assert (TOPIC1_DIR / "run_topic1_benchmark.py").is_file()

    def test_benchmark_csv_and_figures_real_numbers(self):
        res_csv = TASKS_DIR / "topic1_results.csv"
        stores_csv = TASKS_DIR / "topic1_neo4j_stores.csv"
        page_txt = TASKS_DIR / "topic1_page_internals.txt"
        assert res_csv.is_file() and res_csv.stat().st_size > 0
        assert stores_csv.is_file() and stores_csv.stat().st_size > 0
        assert page_txt.is_file() and page_txt.stat().st_size > 0

        with res_csv.open("r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 8, f"Expected 8 models in topic1_results.csv, got {len(rows)}"
        for r in rows:
            assert float(r["total_mb"]) > 0, f"Non-positive total_mb for {r['model_key']}"
            assert int(r["query_d_matches"]) == 8000, f"Unexpected matches for {r['model_key']}"
            assert int(r["evolved_count"]) == 10000, f"Unexpected evolved_count for {r['model_key']}"

        for png_name in [
            "topic1_storage_comparison.png",
            "topic1_evolution_query.png",
            "topic1_neo4j_store_breakdown.png",
        ]:
            fig_path = FIG_DIR / png_name
            assert fig_path.is_file() and fig_path.stat().st_size > 10_000, f"Missing or tiny chart: {fig_path}"

    def test_task1_report_markdown_and_docx_ready(self):
        md_path = TASKS_DIR / "task_1.md"
        docx_path = TASKS_DIR / "task_1.docx"
        assert md_path.is_file() and md_path.stat().st_size > 10_000
        assert docx_path.is_file() and docx_path.stat().st_size > 50_000

        md_text = md_path.read_text(encoding="utf-8")
        assert not re.search(r"\|\s*\?\s*(ms|MB|reads|db hits)?\s*\|", md_text), "Found unresolved '?' placeholder in task_1.md tables"
        assert "CHAPTER 1" in md_text.upper()
        assert "CHAPTER 3" in md_text.upper()
        assert "CHAPTER 6" in md_text.upper()


class TestTopic1LiveDualDbmsParity:
    def test_live_mssql_topic1_storage_lab_and_ecommercedb_intact(self):
        if not is_mssql_online():
            pytest.skip("Live MSSQL unavailable")

        lab = get_database_client(database="Topic1_StorageLab")
        try:
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Products;") == 10000
            for tbl in [
                "T1_Variants_EAV",
                "T1_Variants_JsonText",
                "T1_Variants_JsonNative",
                "T1_Variants_Sparse",
                "T1_Variants_WideNoSparse",
            ]:
                assert lab.execute_scalar(f"SELECT COUNT(*) FROM dbo.{tbl};") == 50000

            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variant_Attr_Values;") == 270000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variant_Attr_Values_PageComp;") == 270000

            # Query (d): color = 'Black' must return 8,000 across all SQL models
            eav_black = lab.execute_scalar(
                "SELECT COUNT(*) FROM dbo.T1_Variant_Attr_Values v "
                "JOIN dbo.T1_Attributes a ON a.attr_id = v.attr_id "
                "WHERE a.attr_name = N'color' AND v.attr_value = N'Black';"
            )
            assert eav_black == 8000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variants_JsonText WHERE JSON_VALUE(attributes, '$.color') = N'Black';") == 8000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variants_JsonNative WHERE JSON_VALUE(attributes, '$.color') = N'Black';") == 8000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variants_Sparse WHERE color = N'Black';") == 8000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variants_Sparse WHERE battery_mAh = 5000;") == 10000
            assert lab.execute_scalar("SELECT COUNT(*) FROM dbo.T1_Variants_JsonNative WHERE JSON_VALUE(attributes, '$.battery_mAh') = '5000';") == 10000
        finally:
            lab.close()

        # Verify ECommerceDB was never mutated by Topic 1 lab
        prod = get_database_client(database="ECommerceDB")
        try:
            assert prod.execute_scalar("SELECT COUNT(*) FROM dbo.Categories;") == 8
            assert prod.execute_scalar("SELECT COUNT(*) FROM dbo.Products;") == 24
            assert prod.execute_scalar("SELECT COUNT(*) FROM dbo.Orders;") == 16
            with pytest.raises(Exception):
                prod.execute_non_query(
                    "INSERT INTO dbo.Products(seller_id, category_id, name, price) VALUES (1, 2, N'NegativeTest', -1);"
                )
        finally:
            prod.close()

    def test_live_neo4j_topic1_and_cross_dbms_parity(self):
        if not _is_neo4j_online():
            pytest.skip("Live Neo4j container unavailable")

        assert _run_neo4j_scalar("MATCH (p:T1Product) RETURN count(p);") == 10000
        assert _run_neo4j_scalar("MATCH (v:T1VariantProp) RETURN count(v);") == 50000
        assert _run_neo4j_scalar("MATCH (v:T1VariantGraph) RETURN count(v);") == 50000

        # Query (d) exact parity with MS SQL Server (8,000 Black variants)
        assert _run_neo4j_scalar("MATCH (v:T1VariantProp) WHERE v.color = 'Black' RETURN count(v);") == 8000
        assert _run_neo4j_scalar(
            "MATCH (:T1AttrValue {name: 'color', value: 'Black'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph) RETURN count(v);"
        ) == 8000

        # Schema evolution parity (10,000 Smartphones with battery_mAh = 5000)
        assert _run_neo4j_scalar("MATCH (v:T1VariantProp) WHERE v.battery_mAh = 5000 RETURN count(v);") == 10000
        assert _run_neo4j_scalar(
            "MATCH (:T1AttrValue {name: 'battery_mAh', value: '5000'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph) RETURN count(v);"
        ) == 10000

        # Original init.cypher nodes untouched
        assert _run_neo4j_scalar("MATCH (u:User) RETURN count(u);") == 11
        assert _run_neo4j_scalar("MATCH (s:Seller) RETURN count(s);") == 5
        assert _run_neo4j_scalar("MATCH (p:Product) RETURN count(p);") == 5
        assert _run_neo4j_scalar("MATCH (o:Order) RETURN count(o);") == 5
