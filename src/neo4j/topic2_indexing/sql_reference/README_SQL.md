# Topic 2 – Hướng dẫn thực nghiệm SQL Server

Bộ script đối chứng đề xuất, chưa có kết quả chạy SQL Server trong gói hiện tại. Chỉ chạy trên SQL Server thử nghiệm có `ECommerceDB` (bản sao), không trên database dùng chung. Kiểm tra tên database/bảng trước khi chạy. Không thay schema, seed hoặc stored procedures ứng dụng. Script 02 xóa ba index benchmark; script 04 TRUNCATE hai bảng WRITE riêng. Nếu các tên đó đã được dùng cho mục đích khác, dừng và kiểm tra.

## 1. Thiết lập và thứ tự chạy trong SSMS

Kết nối SQL Server, mở các script dưới đây theo thứ tự. Ghi lại `SELECT @@VERSION;`, CPU/RAM, Docker hay native, máy đo, trạng thái cache và tải đồng thời. Nếu sử dụng SSMS, Ctrl+M bật/tắt Actual Execution Plan; kiểm tra trạng thái trước mỗi phép đo.

| Bước | File | Thực hiện / kiểm tra |
|---|---|---|
| 1 | [01_mssql_create_100k.sql](01_mssql_create_100k.sql) | Tạo bảng riêng `dbo.IndexDemoProducts`; total=100000, uniqueSKU=100000, min/max=1/100000. Nếu có dữ liệu cũ, script bỏ qua insert; không thêm dữ liệu khi kết quả sai. |
| 2 | [02_mssql_baseline_before_indexes.sql](02_mssql_baseline_before_indexes.sql) | Bật Actual Plan. Bỏ ba nonclustered index thử, giữ clustered PK; chạy 3 truy vấn, count 300/400/11. Lưu 3 plan và Messages IO/TIME. |
| 3 | [03_mssql_create_indexes_and_after.sql](03_mssql_create_indexes_and_after.sql) | Tạo `IX_Topic2_price`, `IX_Topic2_category_price`, `IX_Topic2_name`; lấy 3 plan và Messages sau tạo Index. Kiểm tra count 300/400/11. |
| 4 | [04_mssql_write_overhead.sql](04_mssql_write_overhead.sql) | Tắt Actual Plan, STATISTICS IO/TIME, chạy trong chế độ autocommit. 1 warm-up và 7 lượt đo mỗi mode, 5.000 dòng/lượt. Xuất 14 dòng runs và 2 dòng median. |
| 5 | [06_mssql_read_repeated.sql](06_mssql_read_repeated.sql) | Vẫn tắt Actual Plan; kiểm tra 3 Index tồn tại, 100.000 dòng đúng công thức. 3 warm-up và 10 lượt đo mỗi case/mode (60 dòng). Xuất bảng runs, summary 3 dòng và phiên bản SQL. |

Script 05 không phải bước benchmark: [05_fr01_fr06_smoke.sql](05_fr01_fr06_smoke.sql) dành cho kiểm thử đọc nghiệp vụ trên bản sao seed; xem [kế hoạch FR](../report/FR01_FR06_KiemThu.md).

## 2. Hai phương pháp READ phải phân biệt

- 02/03: kế hoạch tự động, trước/sau khi tạo ba nonclustered index thử, truy vấn có OPTION(RECOMPILE). Dùng để minh họa hành vi optimizer, không lấy một lần đo làm median của 10 lượt.
- 06: ép `INDEX(1), FORCESCAN` cho clustered scan và `INDEX(tên index)` cho truy cập nonclustered index. Cả ba index thử vẫn tồn tại trong hai chế độ; phù hợp đối chiếu tương đối với Forced Scan/Index Neo4j. Index hint không bảo đảm Index Seek; `LIKE N'%Model 7777%'` có thể là Nonclustered Index Scan.

Sau khi đo 06, bật Actual Plan, copy **chỉ các câu truy vấn ở khối comment cuối file 06** ra cửa sổ mới, kết nối ECommerceDB, bỏ dấu comment bao ngoài và chạy với `SET STATISTICS IO ON;` trước sáu truy vấn, `SET STATISTICS IO OFF;` sau đó. Lưu sáu plan và Messages riêng, ghi Logical Reads đúng truy vấn. Không chạy lại toàn bộ script đo khi bật Actual Plan. Tách kế hoạch tự động 02/03 khỏi kế hoạch ép truy cập 06.

## 3. Lưu và đối chiếu kết quả

Lưu các bảng kết quả SSMS thành CSV có header theo [results/sqlserver/README.md](../results/sqlserver/README.md). Giữ Messages và file `.sqlplan`/PNG, phiên bản và cấu hình máy. Mỗi lần đo phải có đúng 300/400/11 kết quả; WRITE đúng 5.000 dòng. Nếu gặp lỗi hoặc thiếu lượt, lưu log và kiểm tra thay vì điền giả.

Tính Speedup = median(scan) / median(index), Write ratio = median(with_index) / median(no_index), overhead% = 100 × (Write ratio − 1). Nếu mẫu số bằng 0, không tính ratio; báo giới hạn độ phân giải thời gian. SQL đo server-side elapsed, Neo4j đo client wall-clock. So sánh cải thiện nội bộ từng DBMS; không chia trực tiếp thời gian hai hệ để kết luận hệ nào nhanh hơn. Logical Reads khác DB Hits. Báo rõ độ chọn lọc, plan thực tế và giới hạn dữ liệu tổng hợp.

## 4. Giới hạn

Bảng `dbo.IndexDemoProducts` không phải `dbo.Products`; Index ứng dụng `IX_Products_status_price` không thay thế index thử. SQL Full-Text Search theo token không tương đương substring. WRITE chỉ so một nonclustered index trên `[value]` với heap thử không index; Neo4j có label lookup mặc định và một Range Property Index trong mode indexed. Script SQL đã được đọc/kiểm tra tĩnh, chưa xác nhận chạy thực tế trong gói này.
