# Hệ Quản Trị Cơ Sở Dữ Liệu (DBMS) - Assignment (Semester 261)

> **Dự án môn học**: Thực hành các tính năng cốt lõi trên hai hệ quản trị cơ sở dữ liệu (**Microsoft SQL Server** vs. **Neo4j**) và xây dựng ứng dụng thương mại điện tử đa gian hàng (**Multi-Vendor E-Commerce Platform**) với **Next.js App Router (`apps/web`)** + **NestJS Modular Backend (`apps/api`)** kết nối tới **MS SQL Server (`ECommerceDB`)**.

---

## 1. Tổng quan dự án

Dự án thực hiện nghiên cứu so sánh sâu giữa hệ quản trị CSDL quan hệ (**Relational DBMS - Microsoft SQL Server**) và hệ quản trị CSDL đồ thị thuộc tính (**Graph DBMS - Neo4j**), đồng thời triển khai ứng dụng Web thương mại điện tử hoàn chỉnh trên **1 CSDL duy nhất là Microsoft SQL Server (`ECommerceDB`)** đáp ứng toàn bộ 12 Yêu cầu chức năng (`FR-01` $\rightarrow$ `FR-12`) và 8 dạng truy vấn (`a` $\rightarrow$ `h`).

- **Lĩnh vực nghiệp vụ (Domain)**: Multi-Vendor E-Commerce (Sàn thương mại điện tử đa gian hàng).
- **Công nghệ CSDL nghiên cứu**:
  - **SQL (CSDL chính của Web App)**: Microsoft SQL Server (2022/2025 Developer / Enterprise).
  - **NoSQL (Đối sánh lý thuyết & thực nghiệm)**: Neo4j (Cypher 25, Neo4j 5.x LTS).
- **Kiến trúc ứng dụng Web (Phương án A)**:
  - **Frontend (`apps/web`)**: Next.js 14 App Router, TypeScript, TailwindCSS, shadcn/ui style components (Port `3005`).
  - **Backend (`apps/api`)**: NestJS chia thành 6 `@Module()` độc lập (`AuthModule`, `CatalogModule`, `CartOrderModule`, `SellerModule`, `AdminModule`, `DbmsLabModule`) + `DatabaseModule` (`mssql` ConnectionPool, Port `4000`).
  - **Tài liệu kiến trúc chi tiết**: Xem tại [WEB_MODULES_DOCS.md](WEB_MODULES_DOCS.md).

---

## 2. Phân công nhiệm vụ nhóm (Team Roster & Responsibilities)

Dựa trên phân công chính thức tại [tasks.csv](docs/tasks/tasks.csv):

| Thành viên | Chủ đề nghiên cứu DBMS (SQL vs NoSQL) | Chức năng nghiệp vụ (FR) | Dạng truy vấn phụ trách | Thực thể / Bảng trọng tâm | Module Web tương ứng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Thành viên 1** *(Leader)* | **Chủ đề 1**: Data Storage & Schema Design | FR-02, FR-07 (+ Base App & Auth) | (d) Single condition, (a) Insert, (c) Update | `Categories`, `Products` | `AuthModule`, `CatalogModule`, `SellerModule` |
| **Thành viên 2** | **Chủ đề 2**: Indexing Techniques | FR-01, FR-06 (+ Seed Data lớn) | (e) Composite condition, (h) Aggregate, (a) Insert | `Reviews`, `Products` | `CatalogModule`, `CartOrderModule` |
| **Thành viên 3** | **Chủ đề 3**: Query Processing & Execution Plan | FR-10, FR-12 | (g) Subquery, (h) Aggregate functions | Views / Pipelines thống kê | `SellerModule`, `AdminModule` |
| **Thành viên 4** | **Chủ đề 4**: Transactions & Concurrency Control | FR-03, FR-04, FR-08 | (a) Insert, (b) Delete, (c) Update | `Cart_Items`, `Vouchers`, `Orders`, `Order_Details` | `CartOrderModule`, `SellerModule` |
| **Thành viên 5** | **Chủ đề 5**: Data Backup & Disaster Recovery | FR-05, FR-09, FR-11 | (f) Join (JOIN / Graph Traversal), (c) Update | `Users`, `Sellers`, `Orders` | `CartOrderModule`, `SellerModule`, `AdminModule`, `DbmsLabModule` |

---

## 3. Cấu trúc thư mục dự án

```text
dbms/
├── apps/                       # Ứng dụng Web (Phương án A: Next.js + NestJS)
│   ├── api/                    # Backend NestJS (6 @Module độc lập + mssql Pool - Port 4000)
│   └── web/                    # Frontend Next.js App Router + TailwindCSS (Port 3000)
├── docs/                       # Tài liệu đề bài (docs.md, project.md) và báo cáo nhóm
├── src/                        # Mã nguồn triển khai CSDL & CLI Demo
│   ├── mssql/
│   │   ├── Dockerfile          # Custom SQL Server 2022 image
│   │   ├── init/               # 01_schema.sql, 02_indexes.sql, 03_seed.sql, 04_procedures_fr.sql
│   │   └── backup/             # 01..05_*.sql (Full, Diff, Log, PITR STOPAT, DBCC CHECKDB)
│   ├── neo4j/
│   │   └── init.cypher         # Neo4j 5 LTS companion graph schema & seed
│   └── demo/
│       └── run_demo.py         # Interactive Dual-DBMS & PITR CLI Runner
├── tools/                      # Công cụ kiểm thử pytest & đóng gói container
├── WEB_MODULES_DOCS.md         # Đặc tả kiến trúc 6 Module Web (Next.js + NestJS + ECommerceDB)
├── INSTRUCTIONS.md             # Hướng dẫn cài đặt, chạy Web, Demo, Test & Export
├── CHANGELOG.md                # Nhật ký thay đổi phiên bản
└── README.md                   # Tổng quan dự án (tài liệu này)
```

---

## 4. Khởi chạy Nhanh (Quick Start)

Xem hướng dẫn chi tiết tại [INSTRUCTIONS.md](INSTRUCTIONS.md) và [WEB_MODULES_DOCS.md](WEB_MODULES_DOCS.md):

```powershell
# 1. Khởi tạo CSDL MS SQL Server (ECommerceDB: 9 bảng + 10 Indexes + Seed + 16 Stored Procedures)
docker compose up -d --build mssql mssql-init

# 2. Khởi chạy Backend NestJS (Port 4000)
cd apps/api
npm install
npm run start:dev

# 3. Khởi chạy Frontend Next.js (Port 3000)
cd apps/web
npm install
npm run dev
```
