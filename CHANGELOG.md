# CHANGELOG

## [v0.3.0] - 2026-11-19
### Added
- **NestJS Modular Backend (`apps/api`)**: 6 independent `@Module()`s (`AuthModule`, `CatalogModule`, `CartOrderModule`, `SellerModule`, `AdminModule`, `DbmsLabModule`) and `DatabaseModule` (`MssqlService` using `mssql` connection pool) connected to single DBMS **MS SQL Server (`ECommerceDB`)**, executing all 16 Stored Procedures and 2 Views from `04_procedures_fr.sql` and mapping T-SQL `THROW 50001..50010` error codes via `SqlExceptionFilter`.
- **Next.js App Router Frontend (`apps/web`)**: Full-featured UI with TailwindCSS, Quick Demo Account Switcher (14 seeded users), Storefront & Multi-criteria Search (`FR-01`, `FR-02`), Shopping Cart & Atomic Voucher Checkout (`FR-03`, `FR-04`), Buyer Order Tracking, 5-Table JOIN Invoice, Cancellation & Reviews (`FR-05`, `FR-06`), Seller Center (`FR-07`..`FR-10`), and Admin Portal & DBMS Topics 1–5 Introspection Lab (`FR-11`, `FR-12`, `DBCC CHECKDB`).
- **Web Architecture Documentation**: Added and synchronized `WEB_MODULES_DOCS.md`, `README.md`, and `INSTRUCTIONS.md`.

## [v0.2.0] - 2026-11-15
### Added
- **Docker Infrastructure**: `docker-compose.yml` for SQL Server 2022 Developer (`ecommerce_mssql`), automated `mssql-init` seeder, persistent volumes, and optional Neo4j 5 LTS companion (`--profile neo4j`); custom `src/mssql/Dockerfile` and `.env.example`.
- **Database Schema & Procedures**: Idempotent 9-table E-Commerce DDL (`01_schema.sql`) with `RECOVERY FULL` and `PAGE_VERIFY CHECKSUM`, covering indexes (`02_indexes.sql`), realistic seed data + baseline backup (`03_seed.sql`), and 16 stored procedures + 2 views (`04_procedures_fr.sql`) covering all 12 FRs and 8 query types (`a`–`h`).
- **Backup, PITR & Dual-DBMS Demo**: Standalone T-SQL scripts (`src/mssql/backup/01..05_*.sql`), Neo4j graph seed (`src/neo4j/init.cypher`), and interactive Python 3.12 CLI demo runner (`src/demo/run_demo.py`).
- **Verification & Export**: Automated `pytest` suite (`tools/tests/`) and PowerShell container export script (`tools/scripts/export_container.ps1`).
- **Documentation & Governance**: Added `INSTRUCTIONS.md`, updated `README.md`, added Section 5 to `AGENTS.md`, and created `.agents/skills/mssql-pitr-docker-workflow/SKILL.md`.

## [v0.1.0] - 2026-11-15
### Added
- Completed Topic 5 research reports (`docs/tasks/task_5.md`, `task_5_re.md`, `.docx`) and Word build script (`tools/scripts/build_task_5_docx.py`).
