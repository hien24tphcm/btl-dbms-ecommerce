# Demo Transaction – Flash Sale (MSSQL vs Neo4j)

Chủ đề: cô lập giao dịch khi nhiều đơn checkout đồng thời trừ tồn kho của cùng một sản phẩm
(Lost Update / Overselling), kèm kiểm chứng Atomicity.

| File | Nội dung |
|---|---|
| `docker-compose.yml` | Neo4j 5.26 Community + SQL Server 2022 Developer |
| `mssql_flashsale_demo.sql` | `TxDemoDB`, 5 chế độ checkout, `demo_Verify`, 6 kịch bản thủ công |
| `neo4j_flashsale_demo.cypher` | Setup + truy vấn kiểm chứng, 4 kịch bản thủ công (cypher-shell) |
| `run_flashsale.mjs` | Mô phỏng N người mua đồng thời trên cả 2 DBMS, xuất bảng số liệu |
| `setup_mssql.mjs` | Nạp file `.sql` vào SQL Server (không cần cài sqlcmd) |

## 1. Cài đặt (một lần)

Yêu cầu: Docker Desktop đang chạy, Node.js ≥ 18. Lệnh dưới đây chạy trong PowerShell tại thư mục này.

```powershell
npm install
npm run db:up:all        # = docker compose --profile mssql up -d  (lần đầu tải ~2 GB image)
npm run db:ps            # chờ cả 2 container ở trạng thái (healthy), ~30 giây
npm run setup:mssql      # tạo TxDemoDB + bảng + procedure
```

Neo4j không cần bước setup: runner tự tạo constraint và dữ liệu.

**Trùng cổng với `docker-compose.yml` ở gốc repo:** `ecommerce_mssql` (1433) và `ecommerce_neo4j`
(7474/7687, profile `neo4j`) dùng cùng cổng với demo. Trước khi bật demo, chạy `docker compose stop` ở gốc repo,
hoặc dùng cách dưới đây.

**Đã có SQL Server khác** (vd container `ecommerce_mssql` của ứng dụng web chiếm cổng 1433):
chỉ chạy `npm run db:up` (Neo4j) rồi `npm run setup:mssql` – `TxDemoDB` là DB riêng, không đụng `ECommerceDB`.
Hoặc chạy MSSQL demo ở cổng khác: `$env:MSSQL_HOST_PORT=1434; npm run db:up:all; $env:MSSQL_PORT=1434`.

| Dịch vụ | Địa chỉ | Tài khoản |
|---|---|---|
| SQL Server | `localhost,1433` (SSMS: tick *Trust server certificate*) | `sa` / `Password_123#` |
| Neo4j Browser | http://localhost:7474 | `neo4j` / `password123` |
| Neo4j Bolt | `neo4j://localhost:7687` | như trên |

## 2. Chạy mô phỏng đồng thời

```powershell
npm run demo                 # 20 người mua, kho 5, think 200 ms, mọi chế độ, cả 2 DBMS
npm run demo:report          # như trên, lặp 5 lần + bảng TỔNG HỢP
npm run demo:report:retry    # think 0, 50 người mua, lặp 10, retry 20 (số liệu cho báo cáo)
npm run demo:atomicity       # mỗi người mua thứ 4 gặp sự cố SAU khi trừ kho
node run_flashsale.mjs --db mssql --mode NAIVE --check    # CHECK(stock>=0) không chữa lost update
```

Tham số đầy đủ ở đầu `run_flashsale.mjs`. Cột `verdict`:
`CONSISTENT` | `LOST_UPDATE` (ghi đè) | `NEGATIVE_STOCK` (check-then-act) | `LEAKED_STOCK` (mất Atomicity).

## 3. Kịch bản thủ công (chụp ảnh cho báo cáo)

- **MSSQL**: mở 3 query window trong SSMS/Azure Data Studio, làm theo phần *KỊCH BẢN THỦ CÔNG* cuối `mssql_flashsale_demo.sql`.
- **Neo4j**: mở 3 cửa sổ PowerShell, mỗi cửa sổ chạy `npm run neo4j:shell`, làm theo các mục 3–6 trong
  `neo4j_flashsale_demo.cypher` (Neo4j Browser không hỗ trợ `:begin`/`:commit`).
  Reset dữ liệu nhanh:
  ```powershell
  docker exec txdemo_neo4j cypher-shell -u neo4j -p password123 -f /demo/neo4j_flashsale_demo.cypher
  ```
  (Trong Git Bash phải thêm `MSYS_NO_PATHCONV=1` trước lệnh để `/demo` không bị đổi đường dẫn.)

## 4. Kết quả tham khảo (đo ngày 26/11/2026, máy nhóm, Docker Desktop / Windows 11)

`--think 0 --buyers 50 --stock 5 --repeat 10 --retry 20` (log gốc: `results/01_tong_hop_retry20.txt`):

| DBMS | Chế độ | Lần bất thường | TB đơn OK | TB oversold | TB deadlock / conflict (kể cả đã retry) | TB ms | Verdict |
|---|---|---|---|---|---|---|---|
| MSSQL | NAIVE | 10/10 | 50 | 45 | 0 | 333 | LOST_UPDATE |
| MSSQL | ATOMIC | 0/10 | 5 | 0 | 0 | 180 | CONSISTENT |
| MSSQL | UPDLOCK | 0/10 | 5 | 0 | 0 | 104 | CONSISTENT |
| MSSQL | REPEATABLE | 0/10 | 5 | 0 | 98,4 deadlock | 2025 | CONSISTENT |
| MSSQL | SNAPSHOT | 0/10 | 5 | 0 | 53,2 conflict | 193 | CONSISTENT |
| Neo4j | NAIVE | 10/10 | 50 | 45 | 0 | 812 | LOST_UPDATE |
| Neo4j | SINGLE_STMT | **10/10** | 8,3 | **3,3** | 339,6 deadlock | 4261 | **NEGATIVE_STOCK** |
| Neo4j | LOCK_FIRST | 0/10 | 5 | 0 | 0 | 557 | CONSISTENT |

Các log khác trong `results/`: `02_check_naive.txt` (CHECK), `03_atomicity.txt` (`--fail-every 4`),
`04`–`06` (nguyên văn thông điệp deadlock Neo4j, lỗi 1205 và 3960 – chạy với `--verbose`).

Nhận xét chính:
- `UPDATE ... WHERE stock_qty >= @qty` của MSSQL an toàn; câu Cypher "tương đương" thì **không**.
  Hai cơ chế riêng: WHERE đọc giá trị chưa khoá => có retry thì oversell (stock âm); khoá tự động của
  `SET p.stock = p.stock - 1` kết hợp tạo quan hệ tới Product => không retry thì ~92% giao dịch thành
  nạn nhân `DeadlockDetected`.
- Neo4j chỉ an toàn khi khoá tường minh trước khi đọc (`LOCK_FIRST`).
- `ms` chỉ so sánh giữa các chế độ trong cùng một DBMS (MSSQL gọi 1 procedure, Neo4j nhiều round-trip Bolt).
- Atomicity (`--fail-every 4`): mọi chế độ đều rollback phần trừ kho của giao dịch lỗi, không có `LEAKED_STOCK`.

Số liệu thay đổi theo máy – hãy chạy lại và dùng số liệu của chính nhóm trong báo cáo.

## 5. Dọn dẹp

```powershell
npm run db:down                                   # dừng container, giữ dữ liệu
docker compose --profile mssql down -v            # xoá cả volume
```
