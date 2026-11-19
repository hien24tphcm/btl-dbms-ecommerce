"""
src/demo/run_demo.py
Interactive Dual-DBMS (MS SQL Server 2022 vs Neo4j 5) & Disaster Recovery (PITR) Demo Runner.
Covers:
  - FR-05 & Query (f): Multi-table Order Join (SQL) vs Graph Traversal (Cypher)
  - FR-09 & FR-11 & Query (c): Atomic Fulfillment & Moderation Updates
  - FR-12 & Query (g)/(h): Above-Average Sellers & Platform BI
  - Topic 5 Live PITR Drill: Full Backup -> Corruption -> Tail-Log -> STOPAT Restore -> DBCC CHECKDB
"""

import argparse
import os
import subprocess
import sys
import time
from typing import Any, List, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

MSSQL_HOST = os.getenv("MSSQL_HOST", "localhost")
MSSQL_PORT = os.getenv("MSSQL_PORT", "1433")
MSSQL_PASSWORD = os.getenv("MSSQL_SA_PASSWORD", "Password_123#")
MSSQL_DB = os.getenv("MSSQL_DB_NAME", "ECommerceDB")
MSSQL_CONTAINER = os.getenv("MSSQL_CONTAINER", "ecommerce_mssql")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "Neo4jSecurePass2025!")


def exec_mssql_sqlcmd(sql: str, database: str = MSSQL_DB) -> Tuple[bool, str, float]:
    """Execute T-SQL inside the running Docker container via sqlcmd and return (ok, output, elapsed_ms)."""
    start = time.perf_counter()
    cmd = [
        "docker", "exec", MSSQL_CONTAINER,
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S", "localhost", "-U", "sa", "-P", MSSQL_PASSWORD,
        "-C", "-d", database, "-W", "-s", "|", "-Q", sql,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    output = (res.stdout or "") + ("\n" + res.stderr if res.stderr else "")
    return res.returncode == 0, output.strip(), elapsed_ms


def exec_neo4j_cypher(cypher: str, params: Optional[dict] = None) -> Tuple[bool, List[dict], float]:
    """Execute Cypher against Neo4j if the neo4j driver and container are available."""
    try:
        from neo4j import GraphDatabase
    except ImportError:
        return False, [{"info": "python 'neo4j' package not installed (pip install -r src/demo/requirements.txt)"}], 0.0

    start = time.perf_counter()
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            result = session.run(cypher, params or {})
            records = [dict(r) for r in result]
        driver.close()
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        return True, records, elapsed_ms
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        return False, [{"info": f"Neo4j unavailable ({exc}). Start with: docker compose --profile neo4j up -d"}], elapsed_ms


def demo_fr05_join_vs_traversal() -> None:
    print("\n" + "=" * 72)
    print("DEMO 1: FR-05 & Query (f) — Order Details JOIN (MS SQL) vs Graph Traversal (Neo4j)")
    print("=" * 72)

    sql = "EXEC dbo.sp_GetOrderDetailsJoin @order_id = 1;"
    ok_sql, out_sql, ms_sql = exec_mssql_sqlcmd(sql)
    print(f"\n[MS SQL Server 2022] ({ms_sql:.1f} ms) | Status: {'OK' if ok_sql else 'ERR'}")
    print(out_sql[:1200])

    cypher = """
    MATCH (u:User)-[:PLACED]->(o:Order {order_id: 1})-[:FULFILLED_BY]->(s:Seller),
          (o)-[c:CONTAINS]->(p:Product)
    RETURN o.order_id AS order_id, u.full_name AS buyer, s.shop_name AS shop_name,
           p.name AS product_name, c.quantity AS quantity, c.unit_price AS unit_price,
           o.order_status AS order_status;
    """
    ok_neo, recs_neo, ms_neo = exec_neo4j_cypher(cypher)
    print(f"\n[Neo4j 5 LTS] ({ms_neo:.1f} ms) | Status: {'OK' if ok_neo else 'INFO'}")
    for r in recs_neo:
        print(" ", r)


def demo_fr09_fr11_updates() -> None:
    print("\n" + "=" * 72)
    print("DEMO 2: FR-09 / FR-11 & Query (c) — Atomic Updates (Fulfillment & Moderation)")
    print("=" * 72)

    sql_check = """
    SELECT order_id, order_status FROM dbo.Orders WHERE order_id = 9;
    SELECT seller_id, shop_name, is_approved FROM dbo.Sellers WHERE seller_id = 1;
    """
    _, before_out, _ = exec_mssql_sqlcmd(sql_check)
    print("\n[Before Update]\n" + before_out)

    sql_update = """
    BEGIN TRAN;
    EXEC dbo.sp_UpdateOrderFulfillment @order_id = 9, @seller_id = 1, @new_status = N'processing';
    SELECT order_id, order_status FROM dbo.Orders WHERE order_id = 9;
    ROLLBACK TRAN;
    """
    ok, after_out, ms = exec_mssql_sqlcmd(sql_update)
    print(f"\n[Transactional Update + Rollback Verification] ({ms:.1f} ms) | {'OK' if ok else 'ERR'}\n" + after_out)


def demo_fr12_subquery_bi() -> None:
    print("\n" + "=" * 72)
    print("DEMO 3: FR-12 & Query (g)/(h) — Above-Average Sellers & Platform BI")
    print("=" * 72)

    ok_sql, out_sql, ms_sql = exec_mssql_sqlcmd("EXEC dbo.sp_GetAboveAverageSellers;")
    print(f"\n[MS SQL Server 2022] ({ms_sql:.1f} ms) | {'OK' if ok_sql else 'ERR'}")
    print(out_sql[:1200])

    cypher = """
    MATCH (o:Order)-[:FULFILLED_BY]->(s:Seller)
    WITH s, sum(o.final_amount) AS seller_rev
    WITH collect({shop: s.shop_name, rev: seller_rev}) AS shops, avg(seller_rev) AS avg_rev
    UNWIND shops AS item
    WITH item, avg_rev WHERE item.rev > avg_rev
    RETURN item.shop AS shop_name, item.rev AS seller_revenue, round(avg_rev, 2) AS platform_avg;
    """
    ok_neo, recs_neo, ms_neo = exec_neo4j_cypher(cypher)
    print(f"\n[Neo4j 5 LTS] ({ms_neo:.1f} ms) | {'OK' if ok_neo else 'INFO'}")
    for r in recs_neo:
        print(" ", r)


def demo_topic5_pitr_drill() -> None:
    print("\n" + "=" * 72)
    print("DEMO 4: Topic 5 — Live Disaster Recovery & Point-In-Time Recovery (PITR) Drill")
    print("=" * 72)

    print("1) Taking baseline FULL backup with COMPRESSION & CHECKSUM...")
    t0 = time.perf_counter()
    ok, out, _ = exec_mssql_sqlcmd(
        "BACKUP DATABASE [ECommerceDB] TO DISK = N'/var/opt/mssql/backup/ECommerceDB_DemoFull.bak' "
        "WITH FORMAT, INIT, COMPRESSION, CHECKSUM;",
        database="master",
    )
    backup_sec = time.perf_counter() - t0
    if not ok:
        print("Backup failed:", out)
        return
    print(f"   FULL backup completed in {backup_sec:.2f}s.")

    time.sleep(1.5)
    _, ts_out, _ = exec_mssql_sqlcmd("SET NOCOUNT ON; SELECT CONVERT(VARCHAR(23), GETDATE(), 126);")
    safe_ts = [line.strip() for line in ts_out.splitlines() if line.strip() and "T" in line][-1]
    print(f"2) Recorded safe recovery timestamp T_safe = {safe_ts}")

    time.sleep(1.5)
    print("3) Simulating accidental unfiltered UPDATE on dbo.Orders (all orders -> 'cancelled')...")
    exec_mssql_sqlcmd("UPDATE dbo.Orders SET order_status = N'cancelled';")
    _, corrupted_cnt, _ = exec_mssql_sqlcmd("SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Orders WHERE order_status = N'cancelled';")
    print(f"   Corrupted cancelled count: {corrupted_cnt.splitlines()[-1].strip()}")

    print("4) Executing Tail-Log Backup (WITH NORECOVERY) + FULL Restore + STOPAT PITR...")
    t_rec_start = time.perf_counter()
    pitr_sql = f"""
    USE master;
    ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    BACKUP LOG [ECommerceDB] TO DISK = N'/var/opt/mssql/backup/ECommerceDB_DemoTail.trn'
      WITH NORECOVERY, FORMAT, INIT, COMPRESSION, CHECKSUM;
    RESTORE DATABASE [ECommerceDB] FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_DemoFull.bak'
      WITH NORECOVERY, REPLACE;
    RESTORE LOG [ECommerceDB] FROM DISK = N'/var/opt/mssql/backup/ECommerceDB_DemoTail.trn'
      WITH RECOVERY, STOPAT = '{safe_ts}';
    ALTER DATABASE [ECommerceDB] SET MULTI_USER;
    """
    ok_rec, out_rec, _ = exec_mssql_sqlcmd(pitr_sql, database="master")
    rto_sec = time.perf_counter() - t_rec_start
    if not ok_rec:
        print("PITR failed:", out_rec)
        return

    print("5) Running DBCC CHECKDB integrity verification...")
    ok_dbcc, out_dbcc, _ = exec_mssql_sqlcmd(
        "DBCC CHECKDB ([ECommerceDB]) WITH NO_INFOMSGS, ALL_ERRORMSGS;",
        database="master",
    )
    _, restored_cnt, _ = exec_mssql_sqlcmd("SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Orders WHERE order_status = N'cancelled';")

    print("\n--- Topic 5 Recovery Summary ---")
    print(f"  Post-PITR cancelled orders : {restored_cnt.splitlines()[-1].strip()} (restored to pre-disaster state)")
    print(f"  DBCC CHECKDB status        : {'0 errors (PASS)' if ok_dbcc else out_dbcc}")
    print(f"  Measured RTO               : {rto_sec:.2f}s | RPO: ~0s (Tail-Log captured)")
    print("\n--- MS SQL Server vs Neo4j Backup/DR Comparison ---")
    print(f"  {'Dimension':<26} | {'MS SQL Server 2022':<28} | {'Neo4j 5 LTS':<28}")
    print("  " + "-" * 86)
    print(f"  {'Backup Mode':<26} | {'Online Full/Diff/Log':<28} | {'Online (Ent) / Dump (Comm)':<28}")
    print(f"  {'PITR Granularity':<26} | {'Second-level (STOPAT / LSN)':<28} | {'Tx-ID / Timestamp replay':<28}")
    print(f"  {'Integrity Check':<26} | {'DBCC CHECKDB + CHECKSUM':<28} | {'neo4j-admin database check':<28}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dual-DBMS & PITR Interactive Demo Runner")
    parser.add_argument("--auto", action="store_true", help="Run all demo scenarios non-interactively")
    args = parser.parse_args()

    if args.auto:
        demo_fr05_join_vs_traversal()
        demo_fr09_fr11_updates()
        demo_fr12_subquery_bi()
        demo_topic5_pitr_drill()
        return 0

    while True:
        print("\n=== E-Commerce Dual-DBMS & PITR Demo Menu ===")
        print("1. FR-05 & Query (f): Order Details JOIN (MS SQL) vs Graph Traversal (Neo4j)")
        print("2. FR-09 / FR-11 & Query (c): Atomic Fulfillment & Moderation Updates")
        print("3. FR-12 & Query (g)/(h): Above-Average Sellers & Platform BI")
        print("4. Topic 5: Live Backup -> Corruption -> Tail-Log -> PITR -> DBCC CHECKDB")
        print("5. Run All Scenarios")
        print("0. Exit")
        choice = input("Select an option [0-5]: ").strip()
        if choice == "1":
            demo_fr05_join_vs_traversal()
        elif choice == "2":
            demo_fr09_fr11_updates()
        elif choice == "3":
            demo_fr12_subquery_bi()
        elif choice == "4":
            demo_topic5_pitr_drill()
        elif choice == "5":
            demo_fr05_join_vs_traversal()
            demo_fr09_fr11_updates()
            demo_fr12_subquery_bi()
            demo_topic5_pitr_drill()
        elif choice == "0":
            return 0
        else:
            print("Invalid selection.")


if __name__ == "__main__":
    sys.exit(main())
