# Kết quả đo — provenance và cách đọc

Các file CSV tại đây do script Python thực sự tạo trên máy Neo4j Desktop của thành viên Topic 2, **không phải số liệu mô phỏng**.

| File | Nguồn | Trạng thái |
|---|---|---|
| `profile_da_do_tu_TXT.csv` | Rút số liệu từ sáu TXT PROFILE, đã sửa Composite Scan 208101 | Đã kiểm |
| `neo4j_read_runs.csv` | `python/02_benchmark_read.py` | 60 lượt, đã kiểm |
| `neo4j_read_summary.csv` | Tổng hợp median READ từ runs | Đã kiểm |
| `neo4j_write_runs.csv` | `python/03_benchmark_write.py` | 14 lượt, đã kiểm |
| `neo4j_write_summary.csv` | Tổng hợp median WRITE từ runs | Đã kiểm |
| `neo4j_environment.json` | Môi trường chạy READ | Đã có |
| `neo4j_demo_profile_current.csv` | `python/05_demo_readonly.py` phiên bản đã sửa | 6/6 OK, đủ toán tử/Rows/DB Hits |

CSV hiện tại đã sửa lỗi đọc plan; có sáu truy vấn OK, count 300/400/11 ở cả hai mode và DB Hits khớp TXT. Giữ nguyên CSV này. Nếu chạy trên instance khác và nhận UI_REQUIRED, dùng Query UI để kiểm chứng; không tự điền số liệu.

Đo READ dùng **client-observed wall-clock time**, không phải thời gian server thuần. SQL Server cần báo riêng định nghĩa thời gian và thiết bị đo nếu so hai bên. Không coi Neo4j DB Hits và SQL Logical Reads là cùng đơn vị.

Biểu đồ ở `charts/` chỉ sử dụng dữ liệu gốc; thư mục `sqlserver/` dành cho kết quả SQL chưa nhận.

Để kiểm chứng offline (không kết nối Neo4j): `py python/06_audit_local_outputs.py`.
