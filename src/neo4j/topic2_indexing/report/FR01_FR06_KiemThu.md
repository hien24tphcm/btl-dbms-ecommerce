# Kiểm thử FR-01 và FR-06 – TV2

**Trạng thái:** hai truy vấn tham chiếu Neo4j đã có ảnh kết quả khớp seed. Các ca SQL Server/Web dưới đây vẫn là kế hoạch, chưa có minh chứng chạy trên ứng dụng trong ZIP này. Chạy trên database thử nghiệm, không trên dữ liệu đang dùng chung. Mục tiêu là kiểm thử nghiệp vụ độc lập với benchmark 100.000 node.

## SQL Server (ứng dụng của nhóm)

1. Khởi động SQL Server và seed ứng dụng theo hướng dẫn của nhóm. Chạy `sql_reference/05_fr01_fr06_smoke.sql` trong SSMS. Hai EXEC đầu chỉ đọc; các truy vấn đối chiếu và liệt kê ứng viên cũng chỉ đọc.
2. FR-01: xác minh bộ lọc mẫu category=2, 800–1600, min_rating=4, in_stock_only=1, price_asc. SQL có thể gồm danh mục con; không mặc định kết quả trùng 3 của Neo4j nếu tập lọc khác. Kiểm tra tên/mô tả, sort giảm/tăng, tồn kho, khoảng giá sai (phải bị từ chối), và đối chiếu với yêu cầu brand/product rating còn lệch SRS.
3. FR-06 aggregate: `product_id=9` seed gốc có 2 review, trung bình 4,5; kiểm tra tổng số sao và trường hợp không có review. Nếu seed đã thay đổi, so với truy vấn trực tiếp Reviews.
4. FR-06 Insert: script read-only liệt kê order detail hợp lệ chưa đánh giá. Chọn một dòng trên **bản sao database thử**, chạy `EXEC dbo.sp_AddReview @user_id=<buyer>, @order_detail_id=<detail>, @rating=5, @comment=N'Topic2 test';` rồi xem Review mới và Seller rating. Không tự động sửa đơn hàng để tạo case. Nếu không có ứng viên, tạo fixture theo quy trình nhóm trên bản sao. Kiểm tra lặp lại cùng review, rating ngoài 1–5, user khác, order chưa delivered đều bị từ chối. Không chạy trên database dùng chung; khôi phục bản sao sau kiểm thử.
5. Thực hiện cùng bộ kiểm thử từ GUI/API của ứng dụng đang chạy (theo README repository nhóm) và lưu ảnh, request/result (không chứa credentials), SQL row count. Stored procedure chạy đúng chưa chứng minh UI đã tích hợp.

## Neo4j (tham chiếu, tùy chọn)

- Tại gốc project, chạy `py -B python/04_seed_fr01_fr06_from_sql.py` với `MERGE` trên đúng instance; chỉ tạo label `Topic2SQL*`.
- Chạy từng câu trong `cypher/08_fr01_fr06_reference.cypher`: FR-01 mẫu dự kiến 3 kết quả; FR-06 product 9 dự kiến 2 đánh giá và 4,5 sao.
- Phần Neo4j chỉ minh họa đọc/lọc/tổng hợp trên graph tham chiếu. INSERT Review chính thức kiểm thử trên SQL Server như mục trên. Không coi WRITE benchmark là kiểm thử FR-06.
- Lưu ảnh/log theo tên case ở `results/fr_tests/`; ghi actual và PASS/FAIL thật. Không chạy nếu chỉ cần demo Indexing và nhóm không yêu cầu graph nghiệp vụ.

| Case | Mong đợi | Actual/Status |
|---|---|---|
| FR01 composite | Chỉ sản phẩm thỏa filter, đúng sort | Chưa đo |
| FR01 invalid price | Procedure từ chối | Chưa đo |
| FR06 aggregate | Product 9: 2 reviews, 4,5 trên seed gốc | Chưa đo |
| FR06 insert valid | Thêm review và cập nhật seller | Chưa đo |
| FR06 duplicate / invalid / unauthorized / undelivered | Bị từ chối | Chưa đo |
| FR01 Neo4j reference | 3 products, sort giá tăng | PASS – ID 3, 1, 2; giá 899, 1199, 1299. [Ảnh](../results/fr_tests/fr01_composite_neo4j.png) |
| FR06 Neo4j reference aggregate | Product 9: 2 reviews, 4,5 | PASS – 1 đánh giá 5 sao, 1 đánh giá 4 sao. [Ảnh](../results/fr_tests/fr06_aggregate_neo4j.png) |
