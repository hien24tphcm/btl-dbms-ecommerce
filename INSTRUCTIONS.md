# Instruction Manual: MS SQL Server 2022/2025, NestJS + Next.js Web App & Dual-DBMS Demo

This manual explains how to start and verify the **Microsoft SQL Server (`ECommerceDB`)** database, run the **NestJS Backend (`apps/api`)** and **Next.js App Router Frontend (`apps/web`)**, and execute the automated tests.

---

## 1. Prerequisites
- **Microsoft SQL Server 2022 / 2025** (via Docker Desktop container `ecommerce_mssql` OR local Windows `MSSQLSERVER` service)
- **Node.js 20+** and `npm` (for NestJS `apps/api` and Next.js `apps/web`)
- **Python 3.10+** (optional, for CLI `pytest` suite and `src/demo/run_demo.py`)

Create `.env` from the template if not already present:
```powershell
Copy-Item .env.example .env
```

---

## 2. Starting & Initializing the Database (`ECommerceDB`)

### Option A: Using Docker Compose (`ecommerce_mssql` on Port 1433)
```powershell
docker compose up -d --build mssql mssql-init
```
Wait for `ecommerce_mssql` to report `healthy` and `ecommerce_mssql_init` to exit with code `0`.

### Option B: Using Local Windows SQL Server (`MSSQLSERVER`)
If running directly on a Windows machine with a local SQL Server instance:
```powershell
sqlcmd -S localhost -E -C -i "src\mssql\init\01_schema.sql"
sqlcmd -S localhost -E -C -d ECommerceDB -i "src\mssql\init\02_indexes.sql"
sqlcmd -S localhost -E -C -d ECommerceDB -i "src\mssql\init\03_seed.sql"
sqlcmd -S localhost -E -C -d ECommerceDB -i "src\mssql\init\04_procedures_fr.sql"
sqlcmd -S localhost -E -C -Q "BACKUP DATABASE [ECommerceDB] TO DISK = N'ECommerceDB_baseline.bak' WITH FORMAT, INIT, COMPRESSION, CHECKSUM;"
```

---

## 3. Running the Web Application (Option A: Next.js + NestJS)

### Step 1: Start NestJS Modular Backend (`apps/api` — Port 4000)
```powershell
cd apps/api
npm install
npm run start:dev
```
The API will be available at `http://localhost:4000/api` with 6 independent modules:
- `AuthModule` (`/api/auth/users`, `/api/auth/login`)
- `CatalogModule` (`/api/categories`, `/api/products`, `/api/products/:id`) — **FR-01, FR-02**
- `CartOrderModule` (`/api/cart`, `/api/vouchers`, `/api/orders/checkout`, `/api/buyer/orders`, `/api/orders/:id`, `/api/orders/:id/cancel`, `/api/reviews`) — **FR-03, FR-04, FR-05, FR-06**
- `SellerModule` (`/api/seller/products`, `/api/seller/products/:id/inventory`, `/api/seller/orders`, `/api/seller/orders/:id/status`, `/api/seller/analytics`) — **FR-07, FR-08, FR-09, FR-10**
- `AdminModule` (`/api/admin/users`, `/api/admin/users/:id/moderate`, `/api/admin/sellers`, `/api/admin/sellers/:id/approve`, `/api/admin/analytics`) — **FR-11, FR-12**
- `DbmsLabModule` (`/api/dbms-lab/introspection`, `/api/dbms-lab/integrity-check`) — **Topics 1–5 Introspection & Live `DBCC CHECKDB`**

### Step 2: Start Next.js App Router Frontend (`apps/web` — Port 3000)
```powershell
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Use the **Active Account Switcher** in the top navigation bar to switch immediately between any of the 14 seeded accounts (`buyer_alex`, `seller_techzone`, `admin_root`, etc.).

---

## 4. Running Automated Tests (`pytest`)

```powershell
pytest tools/tests/ -v
```
