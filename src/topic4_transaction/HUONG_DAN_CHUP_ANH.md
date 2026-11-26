# Hướng dẫn chụp ảnh minh họa – mục Transactions & Concurrency Control

Mỗi kịch bản ghi rõ: mở cửa sổ nào, gõ lệnh gì theo thứ tự nào, lúc nào bấm chụp và ảnh phải thấy gì.
Các lệnh đã được chạy thử trên Neo4j 5.26 / SQL Server 2022 của bộ demo.

## 0. Chuẩn bị (làm một lần)

1. Mở **Docker Desktop**, đợi biểu tượng chuyển xanh.
2. Mở PowerShell tại thư mục demo (`src/topic4_transaction` trong repo):
   ```powershell
   npm run db:up:all
   npm run db:ps            # đợi cả 2 dòng (healthy)
   npm run setup:mssql      # chỉ cần nếu chưa nạp hoặc vừa sửa file .sql
   ```
3. **SSMS** → *Connect*:
   - Server name: `localhost,1433` · Authentication: *SQL Server Authentication*
   - Login `sa` · Password `Password_123#` · tick **Trust server certificate**
4. Trong SSMS mở **3 query window** (Ctrl+N), đặt tên trong đầu là **A**, **B**, **C**. Dán vào đầu **mỗi** cửa sổ rồi chạy một lần:
   ```sql
   USE TxDemoDB;
   SELECT @@SPID AS my_session_id;   -- ghi lại số phiên của A và B (dùng ở Kịch bản 2)
   ```
5. Neo4j: mở **3 cửa sổ PowerShell** (A, B, C) tại thư mục demo, mỗi cửa sổ chạy:
   ```powershell
   npm run neo4j:shell
   ```
   Lệnh reset dữ liệu Neo4j (chạy ở một PowerShell **thứ tư**, ngoài cypher-shell):
   ```powershell
   docker exec txdemo_neo4j cypher-shell -u neo4j -p password123 -f /demo/neo4j_flashsale_demo.cypher
   ```
   Lệnh này đặt kho = 1, tạo 2 buyer và in ra dòng kiểm chứng `1, 1, 0, 0, "CONSISTENT"`.

> **Mẹo chụp:** mỗi ảnh nên có cả câu lệnh và kết quả. Với SSMS, kéo khung *Results/Messages* lên cao.
> Với terminal, dùng Win+Shift+S chụp vùng.
> Tham số `@think_ms` dưới đây được tăng lên 10–20 giây, cho đủ thời gian thao tác bằng tay.

**Truy vấn kiểm chứng Neo4j** (dùng nhiều lần, dán vào cypher-shell C):
```cypher
MATCH (p:Product {id: 1})
OPTIONAL MATCH (o:Order)-[:FOR]->(p)
WITH p, count(o) AS orders, coalesce(sum(o.qty), 0) AS units
RETURN p.initialStock AS initial, p.stock AS finalStock, orders, units,
       CASE
         WHEN p.stock + units = p.initialStock AND p.stock >= 0 THEN 'CONSISTENT'
         WHEN p.stock < 0                                         THEN 'NEGATIVE_STOCK'
         WHEN p.stock + units > p.initialStock                    THEN 'LOST_UPDATE'
         ELSE 'LEAKED_STOCK'
       END AS verdict;
```

---

## Kịch bản 1 – Lost Update (NAIVE)

### Ảnh 1 – SSMS: `demo_Verify`
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 1;` |
| 2 | A | `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='NAIVE', @think_ms=10000;` (F5) |
| 3 | B | **trong vòng 10 giây** sau bước 2: `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='NAIVE', @think_ms=10000;` (F5) |
| 4 | A, B | đợi cả hai báo *Commands completed successfully* – **cả hai đều thành công** |
| 5 | C | `EXEC dbo.demo_Verify @product_id = 1;` → **CHỤP** |

Ảnh phải thấy: `initial_qty = 1`, `final_stock = 0`, `orders = 2`, `oversold_units = 1`, `verdict = LOST_UPDATE`.

### Ảnh 2 – cypher-shell: truy vấn kiểm chứng
Chạy lệnh reset Neo4j (mục 0.5) trước.

| Bước | Terminal | Lệnh |
|---|---|---|
| 1 | A | `:begin` |
| 2 | A | `MATCH (p:Product {id: 1}) RETURN p.stock;` → thấy `1` |
| 3 | A | `:param {newStock: 0}` (ứng dụng tính: 1 − 1) |
| 4 | B | `:begin` |
| 5 | B | `MATCH (p:Product {id: 1}) RETURN p.stock;` → cũng thấy `1` |
| 6 | B | `:param {newStock: 0}` |
| 7 | B | `MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 2}) SET p.stock = $newStock CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);` |
| 8 | B | `:commit` |
| 9 | A | `MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 1}) SET p.stock = $newStock CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);` |
| 10 | A | `:commit` |
| 11 | C | dán **truy vấn kiểm chứng** → **CHỤP** |

Ảnh phải thấy: `initial 1, finalStock 0, orders 2, units 2, "LOST_UPDATE"`.
Nên chụp thêm terminal A ở bước 2 và B ở bước 5 (cả hai cùng đọc được `1`) để minh họa nguyên nhân.

---

## Kịch bản 2 – Khóa bi quan tường minh (UPDLOCK / LOCK_FIRST)

### Ảnh 1 – SSMS: DMV
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 1;` |
| 2 | C | dán sẵn 2 câu DMV dưới đây, **chưa chạy** |
| 3 | A | `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='UPDLOCK', @think_ms=20000;` (F5) |
| 4 | B | ngay sau đó: `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='UPDLOCK', @think_ms=20000;` (F5) – B *Executing…* |
| 5 | C | trong lúc A còn giữ khóa (< 20 giây): F5 hai câu DMV → **CHỤP** (cả 2 lưới kết quả) |
| 6 | B | sau khi A xong, B nhận `Msg 50003 … Insufficient stock` → nên chụp thêm |
| 7 | C | `EXEC dbo.demo_Verify @product_id = 1;` → `orders 1, final_stock 0, CONSISTENT` |

```sql
SELECT r.session_id, r.status, r.wait_type, r.wait_time, r.blocking_session_id
FROM sys.dm_exec_requests r
WHERE r.session_id > 50 AND r.blocking_session_id <> 0;

SELECT request_session_id, resource_type, request_mode, request_status
FROM sys.dm_tran_locks
WHERE resource_database_id = DB_ID(N'TxDemoDB')
  AND resource_type IN ('KEY','PAGE','OBJECT')
ORDER BY request_session_id, resource_type;
```

Ảnh phải thấy:
- **Lưới 1:** dòng của phiên B với `status = suspended`, `wait_type = LCK_M_U`, và `blocking_session_id` = số phiên của A (đã ghi ở mục 0.4).
- **Lưới 2:** phiên A có `KEY / U / GRANT`, phiên B có `KEY / U / WAIT`.

### Ảnh 2 – cypher-shell: `SHOW TRANSACTIONS`
Chạy reset Neo4j trước.

| Bước | Terminal | Lệnh |
|---|---|---|
| 1 | A | `:begin` |
| 2 | A | `MATCH (p:Product {id: 1}) SET p._lock = true;` |
| 3 | A | `MATCH (p:Product {id: 1}) RETURN p.stock;` → `1` |
| 4 | B | `:begin` |
| 5 | B | `MATCH (p:Product {id: 1}) SET p._lock = true;` → **treo**, không trả kết quả |
| 6 | C | (không `:begin`) `SHOW TRANSACTIONS YIELD transactionId, currentQuery, status, elapsedTime;` → **CHỤP** |
| 7 | A | `MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 1}) SET p.stock = p.stock - 1 REMOVE p._lock CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);` |
| 8 | A | `:commit` → B hết treo |
| 9 | B | `MATCH (p:Product {id: 1}) RETURN p.stock;` → `0` → `:rollback` |
| 10 | C | truy vấn kiểm chứng → `orders 1, finalStock 0, CONSISTENT` |

Ảnh bước 6 phải thấy: dòng của B có `currentQuery = MATCH (p:Product {id: 1}) SET p._lock = true` và `status = "Blocked by: [neo4j-transaction-…]"`. Mã trong ngoặc trùng với `transactionId` của A (dòng của A có `status = "Running"` và `currentQuery` rỗng).

---

## Kịch bản 3 – Một câu lệnh có điều kiện (SINGLE_STMT)

### Ảnh 1 – Kế hoạch EXPLAIN
**Cách khuyến nghị (ảnh đồ họa):** trình duyệt mở http://localhost:7474 → Connect URL `neo4j://localhost:7687`, user `neo4j`, password `password123` → chạy:
```cypher
EXPLAIN MATCH (p:Product {id: 1}) WHERE p.stock >= 1 SET p.stock = p.stock - 1 RETURN p.stock
```
→ mở tab **Plan** → **CHỤP**. Đọc từ dưới lên, sơ đồ phải thấy thứ tự:
`NodeUniqueIndexSeek(Locking)` → **`Filter`** (`cache[p.stock] >= $autoint_1`) → `Eager` → **`SetProperty`** (`p.stock = p.stock - $autoint_2`) → `Eager` → `Projection` → `ProduceResults`.

Cách thay thế (ảnh bảng chữ) trong PowerShell:
```powershell
docker exec txdemo_neo4j cypher-shell -u neo4j -p password123 --format verbose "EXPLAIN MATCH (p:Product {id: 1}) WHERE p.stock >= 1 SET p.stock = p.stock - 1 RETURN p.stock;"
```

### Ảnh 2 – Thông điệp DeadlockDetected
PowerShell tại thư mục demo:
```powershell
node run_flashsale.mjs --db neo4j --mode SINGLE_STMT --retry 0 --think 0 --buyers 50 --verbose
```
→ **CHỤP** khối `[neo4j/SINGLE_STMT] thông điệp lỗi đầu tiên:` cùng bảng kết quả bên dưới.
Ảnh phải thấy `Neo.TransientError.Transaction.DeadlockDetected … ExclusiveLock … on NODE(…)`, và ở bảng: cột `deadlock` khoảng 45–48 trên 50, verdict `CONSISTENT`.
Bản ghi lần đo cho báo cáo: `results/04_neo4j_deadlock_message.txt`.

---

## Kịch bản 4 – REPEATABLE READ và SNAPSHOT (SQL Server)

### Ảnh 1 – Lỗi 1205
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 5;` |
| 2 | A | `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='REPEATABLE', @think_ms=10000;` |
| 3 | B | trong vòng 10 giây: `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='REPEATABLE', @think_ms=10000;` |
| 4 | A hoặc B | một cửa sổ hiện chữ đỏ ở tab *Messages* → **CHỤP** cửa sổ đó |
| 5 | C | `EXEC dbo.demo_Verify @product_id = 1;` → `orders 1, final_stock 4, CONSISTENT` |

Ảnh phải thấy: `Msg 1205 … was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.`

### Ảnh 2 – Lỗi 3960
Giống ảnh 1, nhưng `@mode='SNAPSHOT'` (reset lại kho 5 trước). Cửa sổ **chạy sau** (B) nhận lỗi:
`Msg 3960 … Snapshot isolation transaction aborted due to update conflict …` → **CHỤP**.
`demo_Verify` → `orders 1, final_stock 4, CONSISTENT`.

---

## Kịch bản 5 – Ràng buộc CHECK

### Ảnh 1 – Lỗi 547
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 1, @with_check = 1;` |
| 2 | C | `UPDATE dbo.Demo_Product SET stock_qty = -1 WHERE product_id = 1;` → **CHỤP** tab *Messages* |

Ảnh phải thấy: `Msg 547 … The UPDATE statement conflicted with the CHECK constraint "CK_Demo_Product_stock" …`

### Ảnh 2 (tùy chọn) – NAIVE khi đã bật CHECK
```powershell
node run_flashsale.mjs --db mssql --mode NAIVE --check
```
→ **CHỤP** bảng: `checkErr = 0`, `oversold = 15`, verdict `LOST_UPDATE`. CHECK không bắt được lost update.

> Sau kịch bản này, các lần `demo_Reset` không truyền `@with_check` sẽ tự tắt CHECK như mặc định.

---

## Kịch bản 6 – Atomicity

### Ảnh 1 – Đối chứng KHÔNG có giao dịch (autocommit)
**SSMS:**
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 5;` |
| 2 | C | bôi đen **cả 2 dòng** rồi F5:<br>`UPDATE dbo.Demo_Product SET stock_qty = stock_qty - 1 WHERE product_id = 1;`<br>`THROW 50099, 'crash', 1;` |
| 3 | C | *Messages* hiện `(1 row affected)` rồi `Msg 50099 … crash` |
| 4 | C | `EXEC dbo.demo_Verify @product_id = 1;` → **CHỤP** |

Ảnh phải thấy: `final_stock = 4`, `orders = 0`, `verdict = LEAKED_STOCK`.

**cypher-shell** (reset Neo4j trước; kho = 1):
1. C: `MATCH (p:Product {id: 1}) SET p.stock = p.stock - 1;` (không `:begin` ⇒ tự commit), coi như "sập" trước khi tạo Order.
2. C: truy vấn kiểm chứng → **CHỤP**: `finalStock 0, orders 0, "LEAKED_STOCK"`.

### Ảnh 2 – CÓ giao dịch tường minh bị hủy giữa chừng
**SSMS:**
| Bước | Cửa sổ | Lệnh |
|---|---|---|
| 1 | C | `EXEC dbo.demo_Reset @product_id = 1, @stock = 5;` |
| 2 | C | `EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='ATOMIC', @fail_after_write=1;` → `Msg 50099 … Simulated failure after stock was deducted` |
| 3 | C | `EXEC dbo.demo_Verify @product_id = 1;` → **CHỤP** |

Ảnh phải thấy: `final_stock = 5`, `orders = 0`, `CONSISTENT`, tức kho được hoàn nguyên.

**cypher-shell** (reset Neo4j trước):
1. C: `:begin`
2. C: `MATCH (p:Product {id: 1}) SET p.stock = p.stock - 1 RETURN p.stock;` → `0` (chưa commit)
3. C: `:rollback` (giả lập sự cố)
4. C: truy vấn kiểm chứng → **CHỤP**: `finalStock 1, orders 0, "CONSISTENT"`.

---

## Dọn dẹp sau khi chụp
```powershell
npm run db:down     # dừng container, giữ dữ liệu
```
Trong cypher-shell gõ `:exit`. Không cần khôi phục dữ liệu: runner và `demo_Reset` luôn đặt lại từ đầu.
