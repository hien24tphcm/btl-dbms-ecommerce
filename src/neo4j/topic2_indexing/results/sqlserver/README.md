# Kết quả đối chứng SQL Server – chưa có số đo

Gói hiện chỉ chứa mẫu điền kết quả; chưa có CSV benchmark SQL Server hoặc Actual Plan thực tế. Thực hiện theo [README SQL](../../sql_reference/README_SQL.md) trên database thử nghiệm ECommerceDB.

## Các file cần lưu ở thư mục này sau khi chạy

| File | Nguồn / nội dung |
|---|---|
| `mssql_read_runs.csv` | Grid 1 script 06, 60 dòng, experiment/trial/mode/result_count/server_elapsed_ms |
| `mssql_read_summary.csv` | Grid 2 script 06, 3 dòng, median và speedup |
| `mssql_write_runs.csv` | Grid 1 script 04, 14 dòng, trial/mode/inserted/elapsed_ms |
| `mssql_write_summary.csv` | Grid 2 script 04, 2 dòng median theo mode |
| `mssql_environment.txt` | Grid cuối script 06 (`@@VERSION`), CPU/RAM, Docker/native, cache, tải đồng thời, ngày đo |
| `dataset_validation.txt` | Count/SKU/min/max từ script 01; count 300/400/11 ở 02/03/06 |
| `execution_plans/auto/` | 6 Actual Plan từ 02/03 và Messages IO/TIME trước/sau tạo index |
| `execution_plans/forced/` | 6 Actual Plan và Messages của truy vấn ép truy cập cuối 06, đo tách khỏi timing |
| `comparison_template.csv` | Điền số thật, operator và logical reads của plan forced; ghi measurement_scope là server-side elapsed |

Xuất từng result grid riêng với header (SSMS Results to Grid, lưu kết quả hoặc copy với headers). Không gộp các grid vào một CSV. WRITE row trong template dùng scan/index median tương ứng no_index/with_index, để trống logical reads/operator nếu không áp dụng. Không lấy số liệu Topic khác để điền.

## Kiểm tra trước khi sử dụng

READ: 3 case × 2 mode × 10 lượt, count 300/400/11. WRITE: 2 mode × 7 lượt, mỗi lượt 5.000 dòng. Kiểm tra trung vị từ runs, giữ đủ phiên bản/cấu hình máy. Với substring, ghi operator thực tế (Index Scan có thể hợp lệ). Plan 02/03 khác plan ép ở 06; không dùng nhầm Logical Reads giữa hai phương pháp. SQL server elapsed khác Neo4j client wall-clock và Logical Reads khác DB Hits. So sánh speedup/overhead nội bộ, không kết luận tốc độ tuyệt đối từ số đo khác phạm vi.

Nếu chưa chạy, giữ các ô SQL trống và ghi chưa có dữ liệu. Khi đã nhận kết quả, cập nhật [báo cáo Topic 2](../../report/Topic2_KetQua_BaoCao.md), Word và mục 4.2.5–4.2.6 trong báo cáo Prism.
