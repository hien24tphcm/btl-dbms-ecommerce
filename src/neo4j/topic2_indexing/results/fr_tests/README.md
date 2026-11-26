# Minh chứng FR-01 và FR-06

Hai ảnh dưới đây ghi nhận kết quả truy vấn đọc trên graph tham chiếu Neo4j `Topic2SQL*`, theo `cypher/08_fr01_fr06_reference.cypher`. Kết quả hiển thị khớp seed SQL tham chiếu.

| Case | Kết quả quan sát | Trạng thái | Minh chứng |
|---|---|---|---|
| FR-01 Composite | 3 sản phẩm, ID 3/1/2, giá 899/1199/1299, tồn kho 20/45/30; giá tăng dần | PASS (truy vấn mẫu) | [PNG](fr01_composite_neo4j.png) |
| FR-06 Aggregate | Product 9, 2 review, trung bình 4,5; 1 đánh giá 5 sao, 1 đánh giá 4 sao, các mức còn lại 0 | PASS (truy vấn mẫu) | [PNG](fr06_aggregate_neo4j.png) |

Ảnh chỉ chứng minh kết quả hai truy vấn đọc tham chiếu, không xác nhận toàn bộ FR-01, thao tác Insert Review, quyền mua hàng, giao dịch hoặc Web/API. Các ca SQL Server/Web cần minh chứng riêng theo [kế hoạch kiểm thử](../../report/FR01_FR06_KiemThu.md).

Dump ngày 24/11 được giữ nguyên; có thể tái tạo graph tham chiếu bằng script seed nếu bản phục hồi chưa chứa các nhãn này.
