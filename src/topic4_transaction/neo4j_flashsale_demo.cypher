// =====================================================================
// DEMO TRANSACTION (Neo4j) – FLASH SALE: CHỐNG OVERSELLING / LOST UPDATE
// Mô hình đồ thị tương đương với Demo_Product / Demo_Order bên MSSQL:
//
//   (:Buyer {id})-[:PLACED]->(:Order {id, qty, createdAt})-[:FOR]->(:Product {id, stock, initialStock})
//
// Mở cypher-shell (mỗi terminal A / B / C một lệnh):
//   docker exec -it txdemo_neo4j cypher-shell -u neo4j -p password123
// Hoặc Neo4j Browser: http://localhost:7474 (Browser KHÔNG hỗ trợ :begin/:commit => dùng cypher-shell
// cho các kịch bản nhiều bước). Nạp phần SETUP + RESET bên dưới:
//   docker exec txdemo_neo4j cypher-shell -u neo4j -p password123 -f /demo/neo4j_flashsale_demo.cypher
//
// Bất biến kiểm chứng (giống MSSQL):
//      stock (cuối) + SUM(order.qty) = initialStock   VÀ   stock >= 0
//   LOST_UPDATE    stock + đã đặt > ban đầu  (ghi đè lẫn nhau)
//   NEGATIVE_STOCK stock < 0                 (check-then-act trên giá trị cũ)
//   LEAKED_STOCK   stock + đã đặt < ban đầu  (trừ kho mà không có đơn – vi phạm Atomicity)
//
// Neo4j chỉ có mức cô lập READ COMMITTED: đọc KHÔNG lấy khoá, ghi lấy write-lock giữ đến commit.
// Không có REPEATABLE READ / SERIALIZABLE / SNAPSHOT => không có chế độ tương đương.
// Không có ràng buộc miền giá trị (kiểu CHECK stock >= 0) – chỉ có UNIQUE / EXISTS / TYPE / KEY.
//
// Các chế độ trong run_flashsale.mjs:
//   NAIVE        Đọc stock -> tính ở app -> SET stock = giá trị đã tính   -> DỰ KIẾN: LOST_UPDATE
//   SINGLE_STMT  1 câu: MATCH ... WHERE stock >= qty SET stock = stock - qty ...
//                (tương tự ATOMIC của MSSQL)
//                Theo Operations Manual (Concurrent data access > Lost updates in Cypher):
//                  - "SET p.stock = p.stock - $qty" là direct dependency => Cypher lấy write-lock
//                    RỒI mới đọc lại p.stock => phép trừ KHÔNG mất cập nhật.
//                  - Nhưng "WHERE p.stock >= $qty" được đánh giá lúc ĐỌC (chưa có khoá).
//                => Bất thường (nếu có) là NEGATIVE_STOCK (không phải LOST_UPDATE).
//                ĐÃ ĐO (Neo4j 5.26, 20–50 buyers, stock 5):
//                  * --retry 0 : ~75–92% giao dịch bị DeadlockDetected trên NODE(Product). Nạn nhân bị
//                    rollback nên verdict vẫn CONSISTENT. Nguyên nhân KHÔNG phải WHERE mà là khoá tự động
//                    của "SET p.stock = p.stock - $qty" (direct dependency): giao dịch đang chờ giữ thêm
//                    1 khoá (activeLockCount 3 so với 2 ở NAIVE/LOCK_FIRST); giao dịch đang giữ node khi
//                    tạo quan hệ [:FOR] tới Product lại cần khoá đó => chu trình chờ.
//                    Đo: SET p.stock = p.stock - 1 (không WHERE) 55/60 deadlock; SET p.stock = 4 hoặc
//                    SET p._lock = true: 0/60; bỏ quan hệ [:FOR]: 0/20; node mới vs node "dense": 49/60 vs 50/60.
//                  * --retry 20: các giao dịch thử lại vượt qua WHERE bằng giá trị cũ => stock âm,
//                    oversold ~3 đơn vị/lần chạy, 10/10 lần chạy NEGATIVE_STOCK.
//                  => Một câu Cypher có điều kiện KHÔNG tương đương UPDATE ... WHERE của MSSQL.
//   LOCK_FIRST   SET p._lock = true (lấy write-lock) -> đọc -> kiểm tra -> ghi
//                (khóa bi quan tường minh theo tài liệu Neo4j)           -> DỰ KIẾN: đúng
// Cờ --fail-every N của runner: giao dịch ném lỗi sau khi đã trừ kho -> kiểm chứng Atomicity.
// =====================================================================


// ---------------------------------------------------------------------
// 0. SETUP (chạy từng câu riêng; schema và data không được trộn trong 1 giao dịch)
// ---------------------------------------------------------------------
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT buyer_id_unique   IF NOT EXISTS FOR (b:Buyer)   REQUIRE b.id IS UNIQUE;


// ---------------------------------------------------------------------
// 1. RESET (kho còn 1 sản phẩm, 2 người mua) – chạy lại trước MỖI kịch bản
// ---------------------------------------------------------------------
MATCH (o:Order) DETACH DELETE o;
// Xoá hẳn rồi tạo mới (không MERGE) để node không mang trạng thái "dense" từ lần chạy trước
MATCH (p:Product {id: 1}) DETACH DELETE p;
CREATE (:Product {id: 1, name: 'Flash Sale Phone', stock: 1, initialStock: 1});
UNWIND range(1, 2) AS i MERGE (:Buyer {id: i});


// ---------------------------------------------------------------------
// 2. TRUY VẤN KIỂM CHỨNG (dùng sau mỗi kịch bản)
// ---------------------------------------------------------------------
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


// ---------------------------------------------------------------------
// 3. KỊCH BẢN 1 – NAIVE (2 terminal cypher-shell: A và B)  => Lost Update
// ---------------------------------------------------------------------
// Terminal A:
//   :begin
//   MATCH (p:Product {id: 1}) RETURN p.stock;            // -> 1   (đọc, KHÔNG khóa)
//   :param {newStock: 0}                                  // app tính: stock đã đọc (1) - qty (1)
//
// Terminal B:
//   :begin
//   MATCH (p:Product {id: 1}) RETURN p.stock;            // -> 1
//   :param {newStock: 0}                                  // app tính: 1 - 1
//   MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 2})
//   SET p.stock = $newStock
//   CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);
//   :commit
//
// Terminal A (sau khi B commit):
//   MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 1})
//   SET p.stock = $newStock                               // ghi đè bằng giá trị tính từ lần đọc cũ
//   CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);
//   :commit
//
// Kiểm chứng (mục 2): orders = 2, finalStock = 0, initial = 1 => LOST_UPDATE (oversell 1).
// (Nếu A ghi TRƯỚC khi B commit, A sẽ treo chờ write-lock của B – nhưng vẫn ghi đè giá trị cũ.)


// ---------------------------------------------------------------------
// 4. KỊCH BẢN 2 – LOCK_FIRST (khóa ghi tường minh)  => đúng, giao dịch sau bị CHẶN
// ---------------------------------------------------------------------
// (Chạy lại mục 1. RESET trước)
// Terminal A:
//   :begin
//   MATCH (p:Product {id: 1}) SET p._lock = true;        // lấy write-lock trên node Product
//   MATCH (p:Product {id: 1}) RETURN p.stock;            // -> 1
//
// Terminal B:
//   :begin
//   MATCH (p:Product {id: 1}) SET p._lock = true;        // <-- TREO tại đây (đang chờ lock của A)
//
// Terminal C (quan sát giao dịch bị chặn):
//   SHOW TRANSACTIONS YIELD transactionId, currentQuery, status, elapsedTime;
//   // status của B: "Blocked by: [neo4j-transaction-...]"  <=> blocking_session_id bên MSSQL
//
// Terminal A:
//   MATCH (p:Product {id: 1}) MATCH (b:Buyer {id: 1})
//   SET p.stock = p.stock - 1 REMOVE p._lock
//   CREATE (b)-[:PLACED]->(:Order {id: randomUUID(), qty: 1, createdAt: datetime()})-[:FOR]->(p);
//   :commit                                               // B được nhả khóa
//
// Terminal B (đã chạy tiếp):
//   MATCH (p:Product {id: 1}) RETURN p.stock;            // -> 0  (thấy dữ liệu A vừa commit)
//   :rollback                                             // hết hàng => huỷ
//
// Kiểm chứng (mục 2): orders = 1, finalStock = 0, CONSISTENT.


// ---------------------------------------------------------------------
// 5. KỊCH BẢN 3 – SINGLE_STMT (1 câu lệnh có điều kiện)
// ---------------------------------------------------------------------
// Khó tái hiện bằng tay (không có điểm dừng giữa chừng) => chạy bằng run_flashsale.mjs
// với nhiều người mua đồng thời. Câu lệnh được dùng:
//
//   MATCH (p:Product {id: $pid})
//   WHERE p.stock >= $qty
//   SET p.stock = p.stock - $qty
//   WITH p
//   MATCH (b:Buyer {id: $bid})
//   CREATE (b)-[:PLACED]->(o:Order {id: randomUUID(), qty: $qty, createdAt: datetime()})-[:FOR]->(p)
//   RETURN o.id AS orderId;
//
// Xem kế hoạch thực thi: toán tử Filter (WHERE) nằm TRƯỚC SetProperty (nơi lấy write-lock):
//   EXPLAIN MATCH (p:Product {id: 1}) WHERE p.stock >= 1 SET p.stock = p.stock - 1 RETURN p.stock;


// ---------------------------------------------------------------------
// 6. KỊCH BẢN 4 – ATOMICITY: sự cố sau khi đã trừ kho
// ---------------------------------------------------------------------
// (RESET trước)
//   :begin
//   MATCH (p:Product {id: 1}) SET p.stock = p.stock - 1 RETURN p.stock;   // -> 0 (chưa commit)
//   :rollback                                             // giả lập lỗi trước khi tạo Order
// Kiểm chứng (mục 2): finalStock = 1, orders = 0, CONSISTENT.
//
// Đối chứng (auto-commit: mỗi câu là 1 giao dịch riêng):
//   MATCH (p:Product {id: 1}) SET p.stock = p.stock - 1;  // đã commit ngay
//   // ... "crash" trước khi CREATE Order
// Kiểm chứng (mục 2): finalStock = 0, orders = 0 => LEAKED_STOCK.
