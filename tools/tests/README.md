# E2E Test Suite: Dual-Fidelity Architecture & Point-In-Time Recovery (PITR) Drill

## 1. Overview
This test directory contains the comprehensive, opaque-box end-to-end (E2E) test suite for the Multi-Vendor E-Commerce Platform on Microsoft SQL Server 2022, built upon a rigorous **Dual-Fidelity Test Architecture**:

1. **Static & In-Memory Relational Engine Tier**:
   - **Static DDL & AST Contract Verification**: Statically parses `src/mssql/init/01_schema.sql`, `02_indexes.sql`, `03_seed.sql`, and canonical backup scripts to guarantee exact T-SQL syntax, database options (`RECOVERY FULL`, `PAGE_VERIFY CHECKSUM`, `TARGET_RECOVERY_TIME = 60 SECONDS`), 9 table declarations, PKs/UQs, foreign keys with `ON DELETE CASCADE`, 10 covering performance indexes, and disaster-recovery clauses (`FORMAT, INIT, COMPRESSION, CHECKSUM`, `WITH NORECOVERY`, `REPLACE`, `STOPAT`).
   - **Dynamic In-Memory SQLite Relational Engine Probes**: Translates `01_schema.sql` into an in-memory SQLite schema with `PRAGMA foreign_keys = ON;`. Executes genuine SQL statements that violate domain constraints (negative stock, negative prices, expired vouchers, used_count > usage_limit, invalid order status, rating out of 1..5 range, unauthorized roles, duplicate reviews) and asserts authentic `sqlite3.IntegrityError` (`CHECK constraint failed` / `UNIQUE constraint failed`). Verifies atomic inventory deduction (`UPDATE ... WHERE stock_quantity >= @qty`) and complete multi-actor lifecycle progression (`pending` -> `processing` -> `shipped` -> `delivered` -> `Reviews` -> `ON DELETE CASCADE`).
   - **Formal Engine State Machine**: Validates Microsoft SQL Server database engine state transitions (`ONLINE` -> `RESTORING` -> `ONLINE`), access mode changes (`MULTI_USER` -> `SINGLE_USER`), and error invariants (e.g. `Msg 927` when opening a restoring database).

2. **Live Database Engine Tier**:
   - Executes full transactional operations, stored procedures, and the live 10-step Point-In-Time Recovery (PITR) drill directly against the live Microsoft SQL Server 2022 container.
   - Physical page-level allocation and B-Tree structural consistency verification (`DBCC CHECKDB ([ECommerceDB]) WITH NO_INFOMSGS, ALL_ERRORMSGS`) is executed exclusively against the live database engine during Step 10 of the disaster recovery drill.
   - Cleanly and instantaneously skipped via `is_mssql_online()` when the container is offline.

---

## 2. Multi-Tier Test Breakdown

- **Tier 1**: Schema Verification & Functional Happy Paths
  - 9 core relational tables (`Users`, `Sellers`, `Categories`, `Products`, `Cart_Items`, `Orders`, `Order_Details`, `Vouchers`, `Reviews`).
  - Integrity constraints (PKs, UKs, FKs with cascading deletes, CHECK constraints, DEFAULT definitions).
  - 10 nonclustered performance indexes with covering columns.
  - Functional requirements FR-01 through FR-12.
  - All 8 database query types (a through h: Insert, Delete, Update, Single Condition, Composite Condition, Join, Subquery, Aggregate).
- **Tier 2**: Boundary & Corner Cases (Dual-Layer: Static DDL & SQLite Probes)
  - Negative stock and price prevention (`CK_Products_stock`, `CK_Products_price`).
  - Insufficient stock atomic purchase guards.
  - Expired and exhausted voucher rejection (`CK_Vouchers_usage`, `CK_Vouchers_dates`, `CK_Vouchers_discount`).
  - Cancellation blocking on dispatched and delivered orders (`CK_Orders_status`).
  - Duplicate review prevention (`UQ_Reviews_User_Product`) and rating range bounds (`CK_Reviews_rating`).
  - Invalid order status and disaster status rejection (`CK_Orders_status`).
  - Tripartite Role-Based Access Control (RBAC) domain enforcement (`CK_Users_role`).
- **Tier 3**: Cross-Feature Combinations & Multi-Actor Lifecycle Flows
  - Complete multi-actor workflow: Seller lists product -> Buyer adds to cart -> Order created & stock decremented -> Seller processes & ships -> Delivery confirmed -> Buyer reviews product -> Platform BI verifies GMV.
  - Referential foreign key cascade verification (`ON DELETE CASCADE` from `Orders` to `Order_Details`).
- **Tier 4**: Real-World Disaster Recovery & Point-In-Time Recovery (PITR) Drill
  - 10-step disaster drill: Baseline Sentinel 1 -> Full Backup -> Sentinel 2 ($T_{safe}$) -> Temporal Buffer -> Simulated Unfiltered Disaster Corruption -> Tail-Log Backup WITH NORECOVERY -> Restore Full WITH NORECOVERY, REPLACE -> Restore Tail-Log WITH RECOVERY, STOPAT = $T_{safe}$ -> Reset to MULTI_USER.
  - 5 Crucial live verification assertions:
    1. Exactly 0 corrupted rows remain (`status != 'CORRUPTED_DISASTER'`).
    2. Baseline Sentinel 1 exists intact ($total\_amount == 1111.11$).
    3. Sentinel 2 exists intact ($total\_amount == 2222.22$, proving PITR roll-forward past Full Backup to $T_{safe}$).
    4. All 16 individual seed orders intact matching `03_seed.sql` baseline.
    5. Database page allocation & B-Tree consistency verified (`DBCC CHECKDB ([ECommerceDB]) WITH NO_INFOMSGS, ALL_ERRORMSGS` returning 0 errors).
  - Guaranteed teardown safety guard restoring database to ONLINE, MULTI_USER, and active constraints.

---

## 3. Multi-Tier Connection Architecture (`conftest.py`)
To guarantee execution portability across any CI/CD or sandboxed developer environment, `conftest.py` implements a fast non-blocking connection probe (`is_mssql_online()`) and a resilient 3-tier fallback resolver:

```
[Pytest Invocation]
        │
        ├─► is_mssql_online() probe (socket + SELECT 1, 0.03s timeout)
        │     └── If False: Live Engine Tier cleanly skipped
        │
        ▼
   Tier 1: pyodbc probe
   ├── Probes 'ODBC Driver 18 for SQL Server' (Encrypt=yes; TrustServerCertificate=yes)
   ├── Probes 'ODBC Driver 17 for SQL Server' (Encrypt=no; TrustServerCertificate=yes)
   └── Probes legacy 'SQL Server'
        │ (If uninstalled or no ODBC drivers)
        ▼
   Tier 2: pymssql probe
   └── Direct FreeTDS TCP connection to localhost:1433 (no Windows ODBC registry needed)
        │ (If uninstalled or air-gapped environment)
        ▼
   Tier 3: Containerized Execution Fallback
   ├── Executes /opt/mssql-tools18/bin/sqlcmd inside 'ecommerce_mssql' / 'dbms-mssql' via docker exec
   └── Fallback to docker compose exec -T mssql /opt/mssql-tools18/bin/sqlcmd
```

When no live SQL engine is reachable (e.g. offline sandbox without Docker daemon access), live database tests invoke `pytest.skip` cleanly, while all static contracts, in-memory SQLite schema probes, relational invariants, and state machine transitions execute and PASS completely in less than 0.25 seconds.

---

## 4. How to Run the Tests

### Run the entire test suite:
```powershell
pytest tools/tests/ -v
```

### Run specific test modules:
```powershell
# Tier 1, 2, 3: Schema, Queries, Boundary & Lifecycle Tests
pytest tools/tests/test_schema_and_queries.py -v

# Tier 4: Disaster Recovery & PITR Drill
pytest tools/tests/test_backup_pitr.py -v

# Milestone 1 Infrastructure & Integrity Tests
pytest tools/tests/test_milestone_1.py tools/tests/test_sql_integrity.py -v
```

### Run via standard unittest discovery:
```powershell
python -m unittest discover tools/tests -v
```

---

## 5. Test Summary Matrix

| Test Module | Test Class | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| `test_milestone_1.py` | `TestMilestone1Infrastructure` | Docker Compose, Dockerfile, Initial Schema, Indexes, Seed Data | **8 PASSED** |
| `test_sql_integrity.py` | `TestSqlIntegrity` | Foreign keys, relationships, subtotal calculations, reviews | **1 PASSED** |
| `test_schema_and_queries.py` | `TestTier1SchemaContract` | 9 tables, PKs, UQs, FKs, CHECKs, 10 performance indexes | **6 PASSED** |
| `test_schema_and_queries.py` | `TestTier1FunctionalHappyPaths` | FR-01 through FR-12, Query types a-h | **12 PASSED** |
| `test_schema_and_queries.py` | `TestTier2BoundaryAndCornerCases` | Dual-layer: static DDL contract + SQLite in-memory constraint probes | **7 PASSED** |
| `test_schema_and_queries.py` | `TestTier3LifecycleFlows` | Relational FK graph, cascades, financial math, offline multi-actor flow | **3 PASSED** |
| `test_schema_and_queries.py` | `TestLiveDatabaseIntegration` | Live database execution (cleanly skipped when container is offline) | **13 SKIPPED** |
| `test_backup_pitr.py` | `TestTier4StaticContract` | Recovery model, checksum, LSN chain, state machine, T-SQL command clauses, DBCC parser | **12 PASSED** |
| `test_backup_pitr.py` | `TestTier4DisasterRecoveryDrill` | Live 10-step PITR drill & live DBCC CHECKDB execution (cleanly skipped when container is offline) | **1 SKIPPED** |
| **Total** | | | **49 PASSED, 14 SKIPPED (63 Tests)** |
