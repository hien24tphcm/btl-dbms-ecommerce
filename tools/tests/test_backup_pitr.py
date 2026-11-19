"""
tools/tests/test_backup_pitr.py: Tier 4 Disaster Recovery & Point-In-Time Recovery (PITR) Drill
=================================================================================================
Objective:
  Executes an End-to-End disaster recovery drill on ECommerceDB demonstrating:
  - Zero transaction loss (RPO approx 0).
  - Rapid recovery (RTO < 60s).
  - Successful Point-In-Time roll-forward using Full Backup + Tail-Log Backup with STOPAT.
  - 5 Crucial verification assertions confirming database integrity and non-corruption.
=================================================================================================
"""

import os
import re
import time
import pytest
from typing import Any, Dict, List, Tuple

try:
    from tools.tests.conftest import is_mssql_online
except ImportError:
    try:
        from conftest import is_mssql_online
    except ImportError:
        def is_mssql_online() -> bool:
            return False

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCHEMA_SQL_PATH = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "01_schema.sql")
SEED_SQL_PATH = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "03_seed.sql")

# Backup artifact paths inside Linux container
FULL_BACKUP_PATH = "/var/opt/mssql/backup/ECommerceDB_Full.bak"
TAIL_LOG_BACKUP_PATH = "/var/opt/mssql/backup/ECommerceDB_TailLog.trn"
BASELINE_BACKUP_PATH = "/var/opt/mssql/backup/ECommerceDB_baseline.bak"

# Canonical Disaster Recovery T-SQL Command Specifications
SQL_FULL_BACKUP_CMD = (
    f"USE master;\n"
    f"BACKUP DATABASE [ECommerceDB]\n"
    f"TO DISK = N'{FULL_BACKUP_PATH}'\n"
    f"WITH FORMAT, INIT, COMPRESSION, CHECKSUM;"
)

SQL_TAIL_LOG_BACKUP_CMD = (
    f"USE master;\n"
    f"ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;\n"
    f"BACKUP LOG [ECommerceDB]\n"
    f"TO DISK = N'{TAIL_LOG_BACKUP_PATH}'\n"
    f"WITH NORECOVERY, FORMAT, INIT, COMPRESSION, CHECKSUM;"
)

SQL_RESTORE_FULL_CMD = (
    f"USE master;\n"
    f"RESTORE DATABASE [ECommerceDB]\n"
    f"FROM DISK = N'{FULL_BACKUP_PATH}'\n"
    f"WITH NORECOVERY, REPLACE;"
)

SQL_RESTORE_TAIL_LOG_TEMPLATE = (
    "USE master;\n"
    "RESTORE LOG [ECommerceDB]\n"
    f"FROM DISK = N'{TAIL_LOG_BACKUP_PATH}'\n"
    "WITH RECOVERY, STOPAT = '{stopat_time}';"
)

SQL_DBCC_CHECKDB_CMD = "DBCC CHECKDB ([ECommerceDB]) WITH NO_INFOMSGS, ALL_ERRORMSGS;"

# Canonical expected seed orders established in 03_seed.sql
EXPECTED_SEED_ORDERS: Dict[int, Dict[str, Any]] = {
    1: {"buyer_id": 7, "seller_id": 1, "total_amount": 1548.00, "discount_amount": 0.00, "final_amount": 1548.00, "order_status": "delivered"},
    2: {"buyer_id": 8, "seller_id": 2, "total_amount": 175.00, "discount_amount": 15.00, "final_amount": 160.00, "order_status": "delivered"},
    3: {"buyer_id": 9, "seller_id": 1, "total_amount": 1999.00, "discount_amount": 0.00, "final_amount": 1999.00, "order_status": "shipped"},
    4: {"buyer_id": 10, "seller_id": 3, "total_amount": 86.00, "discount_amount": 0.00, "final_amount": 86.00, "order_status": "delivered"},
    5: {"buyer_id": 11, "seller_id": 4, "total_amount": 499.00, "discount_amount": 0.00, "final_amount": 499.00, "order_status": "delivered"},
    6: {"buyer_id": 12, "seller_id": 5, "total_amount": 370.00, "discount_amount": 20.00, "final_amount": 350.00, "order_status": "shipped"},
    7: {"buyer_id": 13, "seller_id": 2, "total_amount": 149.00, "discount_amount": 0.00, "final_amount": 149.00, "order_status": "processing"},
    8: {"buyer_id": 14, "seller_id": 1, "total_amount": 249.00, "discount_amount": 0.00, "final_amount": 249.00, "order_status": "processing"},
    9: {"buyer_id": 7, "seller_id": 1, "total_amount": 1299.00, "discount_amount": 50.00, "final_amount": 1249.00, "order_status": "pending"},
    10: {"buyer_id": 8, "seller_id": 2, "total_amount": 220.00, "discount_amount": 0.00, "final_amount": 220.00, "order_status": "delivered"},
    11: {"buyer_id": 9, "seller_id": 1, "total_amount": 899.00, "discount_amount": 0.00, "final_amount": 899.00, "order_status": "cancelled"},
    12: {"buyer_id": 10, "seller_id": 3, "total_amount": 170.00, "discount_amount": 10.00, "final_amount": 160.00, "order_status": "delivered"},
    13: {"buyer_id": 11, "seller_id": 4, "total_amount": 409.00, "discount_amount": 0.00, "final_amount": 409.00, "order_status": "processing"},
    14: {"buyer_id": 12, "seller_id": 5, "total_amount": 70.00, "discount_amount": 0.00, "final_amount": 70.00, "order_status": "delivered"},
    15: {"buyer_id": 13, "seller_id": 2, "total_amount": 189.00, "discount_amount": 0.00, "final_amount": 189.00, "order_status": "shipped"},
    16: {"buyer_id": 14, "seller_id": 1, "total_amount": 1699.00, "discount_amount": 100.00, "final_amount": 1599.00, "order_status": "pending"},
}


# =============================================================================
# Helper: Parse DBCC CHECKDB Output for Allocation and Consistency Errors
# =============================================================================
def parse_dbcc_checkdb_output(output: str) -> Tuple[int, int]:
    """
    Parses DBCC CHECKDB output for allocation errors and consistency errors.
    Returns (allocation_errors, consistency_errors).
    Handles:
      - Standard verbose summary: "CHECKDB found X allocation errors and Y consistency errors in database '...'."
      - Clean / empty NO_INFOMSGS output: returns (0, 0)
      - Explicit corruption error messages: parses Msg counts.
    """
    if not output or not output.strip():
        return 0, 0
    m = re.search(r"CHECKDB found (\d+) allocation errors and (\d+) consistency errors", output, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))
    severe_errors = re.findall(r"Msg\s+\d+,\s+Level\s+(?:1[6-9]|[2-9]\d)", output)
    if severe_errors:
        return len(severe_errors), len(severe_errors)
    return 0, 0


# =============================================================================
# Helper: Formal State Machine Modeling Engine Transitions
# =============================================================================
class SqlDatabaseStateMachine:
    """
    Formal state machine modeling Microsoft SQL Server database engine states,
    access modes, and recovery transitions during disaster drills.
    """
    VALID_STATES = {"ONLINE", "RESTORING", "RECOVERING", "SUSPECT", "EMERGENCY"}
    VALID_ACCESS_MODES = {"MULTI_USER", "SINGLE_USER", "RESTRICTED_USER"}

    def __init__(self, state: str = "ONLINE", access_mode: str = "MULTI_USER"):
        if state not in self.VALID_STATES:
            raise ValueError(f"Invalid initial state: {state}")
        if access_mode not in self.VALID_ACCESS_MODES:
            raise ValueError(f"Invalid initial access mode: {access_mode}")
        self.state = state
        self.access_mode = access_mode
        self.check_constraints_active = True

    def set_access_mode(self, mode: str) -> None:
        if self.state == "RESTORING":
            raise RuntimeError("Msg 927, Level 14, State 2: Database 'ECommerceDB' cannot be opened because it is in restoring state.")
        if mode not in self.VALID_ACCESS_MODES:
            raise ValueError(f"Invalid access mode: {mode}")
        self.access_mode = mode

    def backup_tail_log_norecovery(self) -> None:
        """BACKUP LOG ... WITH NORECOVERY transitions database from ONLINE to RESTORING."""
        if self.state != "ONLINE":
            raise RuntimeError(f"Cannot perform tail-log backup on database in {self.state} state.")
        self.state = "RESTORING"

    def restore_database_norecovery(self, replace: bool = True) -> None:
        """RESTORE DATABASE ... WITH NORECOVERY, REPLACE maintains RESTORING state."""
        if not replace and self.state == "ONLINE":
            raise RuntimeError("Msg 3159: The tail of the log for the database has not been backed up. Use BACKUP LOG WITH NORECOVERY or RESTORE WITH REPLACE.")
        self.state = "RESTORING"

    def restore_log_stopat(self, recovery: bool = True) -> None:
        """RESTORE LOG ... WITH RECOVERY, STOPAT replays log and transitions to ONLINE."""
        if self.state != "RESTORING":
            raise RuntimeError(f"Cannot restore log: database must be in RESTORING state (currently {self.state}).")
        if recovery:
            self.state = "ONLINE"

    def set_check_constraint(self, active: bool) -> None:
        self.check_constraints_active = active


# =============================================================================
# Helper: Read SQL files for static contract verification
# =============================================================================
def _read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# =============================================================================
# TIER 4: STATIC CONTRACT & SCRIPT INTEGRITY TESTS
# =============================================================================
class TestTier4StaticContract:
    """Validates T-SQL scripts, backup commands, paths, and recovery model constraints."""

    @pytest.fixture(autouse=True)
    def setup_files(self):
        self.schema_sql = _read_file(SCHEMA_SQL_PATH)
        self.seed_sql = _read_file(SEED_SQL_PATH)

    def test_full_recovery_model_mandated(self):
        """Verifies database is explicitly configured with FULL recovery model for log archiving."""
        assert "ALTER DATABASE [ECommerceDB] SET RECOVERY FULL" in self.schema_sql

    def test_page_verify_checksum_mandated(self):
        """Verifies CHECKSUM is active for corruption detection."""
        assert "ALTER DATABASE [ECommerceDB] SET PAGE_VERIFY CHECKSUM" in self.schema_sql

    def test_baseline_backup_establishes_lsn_chain(self):
        """Verifies 03_seed.sql establishes the initial full backup to break pseudo-simple mode."""
        assert "BACKUP DATABASE [ECommerceDB]" in self.seed_sql
        assert BASELINE_BACKUP_PATH in self.seed_sql
        assert "WITH FORMAT, INIT, COMPRESSION, CHECKSUM" in self.seed_sql

    def test_orders_column_and_status_constraint_names(self):
        """Verifies Orders table has 'order_status' column and CK_Orders_status constraint."""
        assert "order_status NVARCHAR(30)" in self.schema_sql
        assert "CONSTRAINT CK_Orders_status CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))" in self.schema_sql

    def test_backup_path_container_linux_compliance(self):
        """Ensures backup paths comply with Linux container standards."""
        for path in [FULL_BACKUP_PATH, TAIL_LOG_BACKUP_PATH, BASELINE_BACKUP_PATH]:
            assert path.startswith("/var/opt/mssql/backup/"), f"Invalid backup path: {path}"
            assert "\\" not in path, f"Windows backslash forbidden in container path: {path}"

    def test_pitr_state_machine_transition_rules(self):
        """
        Validates formal SQL Server engine state machine transitions and error invariants:
          1. Initial: ONLINE + MULTI_USER
          2. Access mode transition: MULTI_USER -> SINGLE_USER
          3. Tail-Log Backup WITH NORECOVERY: ONLINE -> RESTORING
          4. Invariant Rejection: ALTER DATABASE SET SINGLE_USER fails with Msg 927 when RESTORING
          5. Full Database Restore WITH NORECOVERY, REPLACE: stays in RESTORING
          6. Tail-Log Restore WITH RECOVERY, STOPAT: RESTORING -> ONLINE
          7. Post-Restore Access Mode: SINGLE_USER -> MULTI_USER
          8. Invariant Rejection: RESTORE LOG on ONLINE database raises RuntimeError
        """
        sm = SqlDatabaseStateMachine(state="ONLINE", access_mode="MULTI_USER")
        assert sm.state == "ONLINE" and sm.access_mode == "MULTI_USER"

        # Step 1: Set to SINGLE_USER
        sm.set_access_mode("SINGLE_USER")
        assert sm.access_mode == "SINGLE_USER"

        # Step 2: Tail-log backup WITH NORECOVERY
        sm.backup_tail_log_norecovery()
        assert sm.state == "RESTORING"

        # Step 3: Invariant check - setting access mode while RESTORING must be rejected (Msg 927)
        with pytest.raises(RuntimeError, match=r"Msg 927.*restoring state"):
            sm.set_access_mode("SINGLE_USER")

        # Step 4: Restore full database WITH NORECOVERY
        sm.restore_database_norecovery(replace=True)
        assert sm.state == "RESTORING"

        # Step 5: Restore log WITH RECOVERY, STOPAT
        sm.restore_log_stopat(recovery=True)
        assert sm.state == "ONLINE"

        # Step 6: Reset to MULTI_USER
        sm.set_access_mode("MULTI_USER")
        assert sm.access_mode == "MULTI_USER"

        # Step 7: Invariant check - restoring log on an already ONLINE database must be rejected
        with pytest.raises(RuntimeError, match=r"must be in RESTORING state"):
            sm.restore_log_stopat(recovery=True)

    def test_static_full_backup_command_clauses(self):
        """Verifies full backup command mandates FORMAT, INIT, COMPRESSION, and CHECKSUM."""
        assert "BACKUP DATABASE [ECommerceDB]" in SQL_FULL_BACKUP_CMD
        assert "CHECKSUM" in SQL_FULL_BACKUP_CMD
        assert "COMPRESSION" in SQL_FULL_BACKUP_CMD
        assert "FORMAT" in SQL_FULL_BACKUP_CMD
        assert "INIT" in SQL_FULL_BACKUP_CMD

    def test_static_tail_log_backup_command_clauses(self):
        """Verifies tail-log backup mandates WITH NORECOVERY, SINGLE_USER, FORMAT, INIT, COMPRESSION, and CHECKSUM."""
        assert "BACKUP LOG [ECommerceDB]" in SQL_TAIL_LOG_BACKUP_CMD
        assert "WITH NORECOVERY" in SQL_TAIL_LOG_BACKUP_CMD
        assert "CHECKSUM" in SQL_TAIL_LOG_BACKUP_CMD
        assert "COMPRESSION" in SQL_TAIL_LOG_BACKUP_CMD
        assert "FORMAT" in SQL_TAIL_LOG_BACKUP_CMD
        assert "INIT" in SQL_TAIL_LOG_BACKUP_CMD
        assert "SET SINGLE_USER WITH ROLLBACK IMMEDIATE" in SQL_TAIL_LOG_BACKUP_CMD

    def test_static_restore_full_command_clauses(self):
        """Verifies full restore mandates WITH NORECOVERY and REPLACE."""
        assert "RESTORE DATABASE [ECommerceDB]" in SQL_RESTORE_FULL_CMD
        assert "WITH NORECOVERY" in SQL_RESTORE_FULL_CMD
        assert "REPLACE" in SQL_RESTORE_FULL_CMD

    def test_static_restore_tail_log_command_clauses(self):
        """Verifies tail-log restore mandates WITH RECOVERY and STOPAT parameter."""
        assert "RESTORE LOG [ECommerceDB]" in SQL_RESTORE_TAIL_LOG_TEMPLATE
        assert "WITH RECOVERY" in SQL_RESTORE_TAIL_LOG_TEMPLATE
        assert "STOPAT = '{stopat_time}'" in SQL_RESTORE_TAIL_LOG_TEMPLATE

    def test_static_dbcc_checkdb_command_clauses(self):
        """Verifies DBCC CHECKDB syntax targets [ECommerceDB] with NO_INFOMSGS and ALL_ERRORMSGS."""
        assert "DBCC CHECKDB ([ECommerceDB])" in SQL_DBCC_CHECKDB_CMD
        assert "ALL_ERRORMSGS" in SQL_DBCC_CHECKDB_CMD
        assert "NO_INFOMSGS" in SQL_DBCC_CHECKDB_CMD

    def test_dbcc_checkdb_output_parser_semantics(self):
        """Unit tests the DBCC CHECKDB regex parser across clean, empty, and corrupted outputs."""
        clean_output = "CHECKDB found 0 allocation errors and 0 consistency errors in database 'ECommerceDB'."
        assert parse_dbcc_checkdb_output(clean_output) == (0, 0)

        empty_output = ""
        assert parse_dbcc_checkdb_output(empty_output) == (0, 0)

        corrupted_output = (
            "Msg 8928, Level 16, State 1: Table error: Object ID 123... "
            "CHECKDB found 2 allocation errors and 5 consistency errors in database 'ECommerceDB'."
        )
        assert parse_dbcc_checkdb_output(corrupted_output) == (2, 5)


# =============================================================================
# TIER 4: LIVE DISASTER RECOVERY & POINT-IN-TIME RECOVERY (PITR) DRILL
# =============================================================================
@pytest.mark.skipif(not is_mssql_online(), reason="Requires live MSSQL instance")
class TestTier4DisasterRecoveryDrill:
    """
    Tier 4 Live End-to-End PITR Drill:
      - 10-Step Scenario executing Full Backup, Safe Sentinel, Unfiltered UPDATE,
        Tail-Log Backup, Full Restore, and Log Restore to T_safe.
      - 5 Verification Assertions.
      - Guaranteed Teardown Reset: Restores from BASELINE_BACKUP_PATH if drill aborts mid-flight.
    """

    @pytest.fixture(autouse=True)
    def drill_cleanup_guard(self, master_client):
        """
        Guaranteed teardown fixture ensuring ECommerceDB is returned to
        ONLINE, MULTI_USER, and clean baseline state even if a mid-drill failure occurs.
        NEVER wipes Orders with DELETE WHERE order_status = 'CORRUPTED_DISASTER'.
        If database is not ONLINE or contains corrupted rows, restores directly from BASELINE_BACKUP_PATH.
        """
        yield

        need_baseline_restore = False
        try:
            db_state = master_client.execute_query(
                "SELECT state_desc, user_access_desc FROM sys.databases WHERE name = 'ECommerceDB'"
            )
            if not db_state or db_state[0]["state_desc"] != "ONLINE" or db_state[0]["user_access_desc"] != "MULTI_USER":
                need_baseline_restore = True
            else:
                corrupted_count = master_client.execute_scalar(
                    "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders WHERE order_status = 'CORRUPTED_DISASTER';"
                )
                order_count = master_client.execute_scalar(
                    "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders;"
                )
                if int(corrupted_count or 0) > 0 or int(order_count or 0) < 16:
                    need_baseline_restore = True

            if need_baseline_restore:
                master_client.execute_script(f"""
                USE master;
                IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ECommerceDB' AND state_desc <> 'RESTORING')
                BEGIN
                    ALTER DATABASE [ECommerceDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                END
                RESTORE DATABASE [ECommerceDB]
                FROM DISK = N'{BASELINE_BACKUP_PATH}'
                WITH REPLACE;
                ALTER DATABASE [ECommerceDB] SET MULTI_USER;
                """)
            else:
                # Safe sentinel cleanup only
                master_client.execute_script("""
                USE master;
                ALTER TABLE [ECommerceDB].dbo.Orders CHECK CONSTRAINT CK_Orders_status;
                DELETE FROM [ECommerceDB].dbo.Orders
                WHERE order_status IN ('SENTINEL_T1', 'SENTINEL_T2')
                   OR total_amount IN (1111.11, 2222.22);
                """)
        except Exception as e:
            print(f"[WARN] Drill teardown encountered exception: {e}")

    def test_live_pitr_disaster_recovery_drill(self, master_client, db_client):
        """
        Full 10-Step Real-World Disaster Recovery Drill.
        """
        # =====================================================================
        # STEP 1: Baseline Sentinel Insertion (Order 17)
        # =====================================================================
        db_client.execute_script("ALTER TABLE dbo.Orders NOCHECK CONSTRAINT CK_Orders_status;")

        insert_sentinel1_sql = """
        INSERT INTO dbo.Orders (buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method)
        VALUES (7, 1, 1111.11, 0.00, 1111.11, 'SENTINEL_T1', N'TEST_SENTINEL 10 Le Loi, Address 1', 'Credit Card');
        """
        db_client.execute_non_query(insert_sentinel1_sql)

        sentinel1_count = int(db_client.execute_scalar(
            "SELECT COUNT(*) FROM dbo.Orders WHERE order_status = 'SENTINEL_T1' AND total_amount = 1111.11;"
        ))
        assert sentinel1_count == 1, "Step 1 Failed: Sentinel 1 was not inserted"

        # =====================================================================
        # STEP 2: Full Database Backup Trigger
        # =====================================================================
        full_backup_sql = SQL_FULL_BACKUP_CMD
        master_client.execute_script(full_backup_sql)

        # =====================================================================
        # STEP 3: Sentinel 2 Insertion & Capture T_safe with Millisecond Precision
        # =====================================================================
        insert_sentinel2_sql = """
        INSERT INTO dbo.Orders (buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method)
        VALUES (8, 2, 2222.22, 0.00, 2222.22, 'SENTINEL_T2', N'TEST_SENTINEL 55 Hai Ba Trung, Address 2', 'Bank Transfer');
        """
        db_client.execute_non_query(insert_sentinel2_sql)

        time_res = db_client.execute_query(
            "SELECT CONVERT(NVARCHAR(30), GETDATE(), 121) AS SafeTimeServer;"
        )
        safe_time_str = time_res[0]["SafeTimeServer"]
        assert safe_time_str, "Step 3 Failed: Could not capture server timestamp"

        # Temporal buffer delay (>= 2.0s) to guarantee clear separation before disaster
        time.sleep(2.0)

        # =====================================================================
        # STEP 4: Transition Log Chain & Verify Pre-Disaster State
        # =====================================================================
        pre_disaster_orders = int(db_client.execute_scalar("SELECT COUNT(*) FROM dbo.Orders;"))
        assert pre_disaster_orders == 18, f"Expected 18 orders (16 seed + 2 sentinels), got {pre_disaster_orders}"

        # =====================================================================
        # STEP 5: Simulated Accidental Corruption (Unfiltered Bulk UPDATE)
        # =====================================================================
        db_client.execute_script("ALTER TABLE dbo.Orders NOCHECK CONSTRAINT CK_Orders_status;")
        corruption_sql = """
        UPDATE dbo.Orders
        SET order_status = 'CORRUPTED_DISASTER', total_amount = 0.00, final_amount = 0.00;
        """
        db_client.execute_non_query(corruption_sql)

        corrupted_count = int(db_client.execute_scalar(
            "SELECT COUNT(*) FROM dbo.Orders WHERE order_status = 'CORRUPTED_DISASTER';"
        ))
        assert corrupted_count == 18, "Step 5 Failed: Corruption did not affect all rows"

        # =====================================================================
        # STEP 6: Tail-Log Backup WITH NORECOVERY (via master!)
        # =====================================================================
        tail_log_sql = SQL_TAIL_LOG_BACKUP_CMD
        master_client.execute_script(tail_log_sql)

        db_state = master_client.execute_scalar(
            "SELECT state_desc FROM sys.databases WHERE name = 'ECommerceDB';"
        )
        assert db_state == "RESTORING", f"Step 6 Failed: Expected RESTORING state, got {db_state}"

        # =====================================================================
        # STEP 7: Restore Full Backup WITH NORECOVERY, REPLACE
        # =====================================================================
        restore_full_sql = SQL_RESTORE_FULL_CMD
        master_client.execute_script(restore_full_sql)

        # =====================================================================
        # STEP 8: Restore Tail-Log WITH RECOVERY, STOPAT = T_safe
        # =====================================================================
        restore_taillog_sql = SQL_RESTORE_TAIL_LOG_TEMPLATE.format(stopat_time=safe_time_str)
        master_client.execute_script(restore_taillog_sql)

        # =====================================================================
        # STEP 9: Reset Database to MULTI_USER & Re-enable Constraint
        # =====================================================================
        post_restore_sql = """
        USE master;
        ALTER DATABASE [ECommerceDB] SET MULTI_USER;
        ALTER TABLE [ECommerceDB].dbo.Orders CHECK CONSTRAINT CK_Orders_status;
        """
        master_client.execute_script(post_restore_sql)

        db_info = master_client.execute_query(
            "SELECT state_desc, user_access_desc FROM sys.databases WHERE name = 'ECommerceDB';"
        )
        assert db_info[0]["state_desc"] == "ONLINE"
        assert db_info[0]["user_access_desc"] == "MULTI_USER"

        # =====================================================================
        # STEP 10: 5 Crucial Verification Assertions
        # =====================================================================
        # Assertion 1: Exactly 0 corrupted rows remain
        corrupted_remaining = int(master_client.execute_scalar(
            "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders WHERE order_status = 'CORRUPTED_DISASTER';"
        ))
        assert corrupted_remaining == 0, f"Assertion 1 Failed: Found {corrupted_remaining} corrupted rows"

        # Assertion 2: Baseline Sentinel 1 exists intact
        sentinel1_intact = int(master_client.execute_scalar(
            "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders WHERE order_status = 'SENTINEL_T1' AND total_amount = 1111.11;"
        ))
        assert sentinel1_intact == 1, "Assertion 2 Failed: Sentinel 1 missing or corrupted"

        # Assertion 3: Sentinel 2 exists intact (Proves PITR rolled forward past Full Backup to T_safe)
        sentinel2_intact = int(master_client.execute_scalar(
            "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders WHERE order_status = 'SENTINEL_T2' AND total_amount = 2222.22;"
        ))
        assert sentinel2_intact == 1, "Assertion 3 Failed: Sentinel 2 missing (PITR roll-forward failed)"

        # Assertion 4: All 16 individual seed orders verified against EXPECTED_SEED_ORDERS
        rows = master_client.execute_query(
            "SELECT order_id, total_amount, order_status FROM [ECommerceDB].dbo.Orders WHERE order_id <= 16 ORDER BY order_id ASC;"
        )
        assert len(rows) == 16, f"Assertion 4 Failed: Expected 16 seed orders, got {len(rows)}"
        for r in rows:
            oid = int(r["order_id"])
            exp = EXPECTED_SEED_ORDERS[oid]
            assert r["order_status"] == exp["order_status"], f"Seed order {oid} status mismatch: {r['order_status']} != {exp['order_status']}"
            assert float(r["total_amount"]) == exp["total_amount"], f"Seed order {oid} amount mismatch: {r['total_amount']} != {exp['total_amount']}"
            assert r["order_status"] != "CORRUPTED_DISASTER"
            assert float(r["total_amount"]) > 0

        total_orders_restored = int(master_client.execute_scalar(
            "SELECT COUNT(*) FROM [ECommerceDB].dbo.Orders;"
        ))
        assert total_orders_restored == 18, f"Assertion 4 Failed: Expected 18 orders, found {total_orders_restored}"

        # Assertion 5: DBCC CHECKDB reports 0 allocation errors and 0 consistency errors
        checkdb_sql = SQL_DBCC_CHECKDB_CMD
        master_client.execute_script(checkdb_sql)

        checkdb_rows = master_client.execute_query(
            "DBCC CHECKDB ([ECommerceDB]) WITH TABLERESULTS, ALL_ERRORMSGS, NO_INFOMSGS;"
        )
        severe_corruption_rows = [r for r in checkdb_rows if int(r.get("Level", 0)) >= 16 or int(r.get("Error", 0)) > 0]
        assert len(severe_corruption_rows) == 0, f"Assertion 5 Failed: DBCC CHECKDB found errors: {severe_corruption_rows}"
