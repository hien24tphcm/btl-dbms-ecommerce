# Topic 2 – Indexing Techniques | HK261

Nghiên cứu Microsoft SQL Server và Neo4j trong hệ thống thương mại điện tử đa gian hàng. Phần thực nghiệm Neo4j đã hoàn thành trên Neo4j Kernel 2026.10.1 (Cypher 25); Hai truy vấn đọc tham chiếu FR-01/FR-06 trên Neo4j đã có ảnh kết quả khớp seed; SQL Server đối chứng và kiểm thử toàn bộ nghiệp vụ trên ứng dụng vẫn cần minh chứng riêng. Kịch bản lời thoại thuyết trình được lưu riêng, không cần để chạy source.

## 1. Kết quả thực nghiệm đã lưu

Dataset `IndexDemoProduct`: 100.000 node, 100.000 SKU duy nhất, `invalid_rows=0`. Ba Property Index chính ONLINE. Kết quả PROFILE và trung vị READ:

| Case | Số node khớp | DB Hits Scan / Index | Scan (ms) | Index (ms) | Speedup |
|---|---:|---:|---:|---:|---:|
| Range | 300 | 200001 / 301 | 40,8664 | 3,6634 | 11,16× |
| Composite | 400 | 208101 / 401 | 53,4330 | 3,9587 | 13,50× |
| Text Substring | 11 | 200001 / 12 | 61,0870 | 8,3001 | 7,36× |

READ: 60 lượt đo chính thức (10 lượt mỗi case/mode). WRITE: 14 lượt (7 mỗi mode), INSERT 5.000 node/lượt; median 55,7479 ms không Property Index, 121,6240 ms có một Range Index trên `value` (2,18×; tăng 118,17%). Thời gian là client wall-clock qua Bolt; READ dùng Forced Label Scan vs Forced Index, cả hai chế độ đều có Index tồn tại. DB Hits không phải thời gian hay SQL Logical Reads. Sáu PROFILE tự động có `plan_status=OK`, 12 file TXT/PNG minh chứng. Không suy rộng các kết quả này thành kết luận Neo4j nhanh hơn SQL Server.

## 2. Cấu trúc và tài liệu

| Thư mục | Nội dung |
|---|---|
| [app_reference_data/](app_reference_data/) | Seed tham chiếu 24 Products, 16 Reviews, 5 Sellers, 8 Categories |
| [cypher/](cypher/) | Kiểm tra, PROFILE, tạo Index và truy vấn tham chiếu |
| [database/](database/) | Dump (bản bàn giao riêng), checksum, [hướng dẫn restore](database/README.md) |
| [evidence_original/](evidence_original/) | 6 TXT và 6 PNG PROFILE gốc |
| [python/](python/) | Seed, validate, READ/WRITE, PROFILE tự động và audit |
| [report/](report/) | [Báo cáo Topic 2](report/Topic2_KetQua_BaoCao.md), [SRS/ERD](report/Chapter2_SRS_ERD.md), [kiểm thử FR](report/FR01_FR06_KiemThu.md), [Word](report/Task2.docx), [lý thuyết gốc](report/Topic2_Theory.pdf) |
| [results/](results/) | [Giải thích CSV](results/README.md), [biểu đồ](results/charts/README.md), [kết quả SQL](results/sqlserver/README.md), [kết quả FR](results/fr_tests/README.md) |
| [sql_reference/](sql_reference/) | [Hướng dẫn SQL](sql_reference/README_SQL.md), 6 script đối chứng và smoke test |

## 3. Kiểm tra offline (không cần DBMS)

Giải nén ZIP, mở Terminal PowerShell tại thư mục chứa chính README này, có Python (`py --version`).

```powershell
py -B python/06_audit_local_outputs.py
```

Mong đợi: `PASS: 60 read runs; 14 write runs; 3 PROFILE records; 12 TXT/PNG evidence; summaries consistent.` Audit kiểm tra kết quả lưu sẵn, không thay thế kiểm tra kết nối hoặc restore database. Kiểm tra thêm SHA-256 nếu có dump theo hướng dẫn trong `database/README.md`.

## 4. Chuẩn bị kết nối Neo4j

Môi trường gốc: Windows 11, Python 3.13.0, Neo4j Desktop 2.3.1, DBMS 2026.10.1, Cypher 25, instance `DBMS_Topic2_Neo4j`. Trên máy khác chọn phiên bản tương thích; Docker Neo4j 5 của nhóm chưa được xác nhận chạy toàn bộ script này (đặc biệt Full-Text `SEARCH`). Cài driver:

```powershell
py -m pip install -r requirements.txt
```

Khởi động instance, chọn đúng database; mặc định `bolt://localhost:7687`, user `neo4j`, database `neo4j`. Nếu cần đổi, đặt các biến môi trường trong PowerShell trước khi chạy:

```powershell
$env:NEO4J_URI = 'bolt://localhost:7687'
$env:NEO4J_USER = 'neo4j'
$env:NEO4J_DATABASE = 'neo4j'
```

Nhập mật khẩu instance khi Python hỏi (không hiện ký tự là bình thường). Không ghi mật khẩu vào README hoặc Git. Kiểm tra đúng cổng để tránh kết nối nhầm Docker/instance khác.

## 5. Chọn một trong ba cách chuẩn bị dataset

### A. Đã có 100.000 node và Index (máy thực nghiệm gốc)

```powershell
py -B python/01_validate.py
```

Nếu PASS thì không sinh lại dữ liệu hay tạo lại Index. Nếu FAIL, đọc lỗi và kiểm tra đúng instance, số node, công thức, trạng thái Index; không xóa dữ liệu tùy tiện.

### B. Phục hồi dump

Thực hiện theo [database/README.md](database/README.md), trên instance riêng tương thích; chọn đúng tên database vừa load và chạy `01_validate.py`. Checksum OK không chứng minh restore đã thành công. Không hạ cấp dump 2026.10.1 vào Neo4j 5.

### C. Tái tạo trên instance thử mới, không cần dump

```powershell
py -B python/00_seed_if_empty.py
```

Nhập `TAO` khi xác nhận tạo mới. Script chỉ tạo khi label `IndexDemoProduct` rỗng; nếu dữ liệu đã có 100.000 node thì bỏ qua, nếu có số lượng khác thì dừng để kiểm tra. Nếu lỗi giữa chừng, không chạy lại mù quáng.

Mở Neo4j Query, chạy riêng từng câu trong [cypher/07_create_benchmark_indexes_if_missing.cypher](cypher/07_create_benchmark_indexes_if_missing.cypher), chờ ba Index ONLINE. Sau đó chạy `py -B python/01_validate.py`. Mong đợi: 100.000 node/SKU, `invalid_rows=0`, các count 300/400/11, PASS.

## 6. Tái lập thực nghiệm và xem Query Plan

**Không cần đo lại để nộp nếu chỉ muốn xem kết quả đã lưu.** Các script chạy lại có thể ghi đè CSV và JSON trong `results/`; hãy sao lưu nguyên thư mục dự án hoặc chạy trên bản sao để bảo toàn số liệu đã nộp.

| Bước | Lệnh / file | Kết quả |
|---|---|---|
| Kiểm tra | `py -B python/01_validate.py` | PASS dataset/Index/count |
| READ | `py -B python/02_benchmark_read.py` | `neo4j_read_runs.csv`, `neo4j_read_summary.csv`, `neo4j_environment.json` |
| WRITE | `py -B python/03_benchmark_write.py` | `neo4j_write_runs.csv`, `neo4j_write_summary.csv` |
| Kiểm tra sau WRITE | `py -B python/01_validate.py` | PASS như trước WRITE |
| PROFILE tự động | `py -B python/05_demo_readonly.py` | `neo4j_demo_profile_current.csv` |

WRITE yêu cầu nhập đúng `YES`; script dọn hai label WRITE thử nghiệm, không tác động `IndexDemoProduct` hoặc dữ liệu ứng dụng. Chỉ chạy trên database thử. Số đo mới có thể khác; không ghép CSV mới với summary, hình và báo cáo cũ mà chưa cập nhật đồng bộ.

Để xem trực tiếp Query Plan, chạy lần lượt từng câu lệnh trong [00_verify_dataset_and_indexes.cypher](cypher/00_verify_dataset_and_indexes.cypher), [01_range.cypher](cypher/01_range.cypher), [02_composite.cypher](cypher/02_composite.cypher), [03_text_substring.cypher](cypher/03_text_substring.cypher). Chọn tab Plan, đọc Rows và DB Hits; kiểm tra count ở tab Table. [05_planner_auto.cypher](cypher/05_planner_auto.cypher) là đối chiếu tùy chọn không ép hint. [04_optional_fulltext.cypher](cypher/04_optional_fulltext.cypher) là mở rộng, không nằm trong kết quả benchmark gốc.

## 7. SQL Server và FR-01/FR-06

Chạy các script 01, 02, 03, 04, 06 theo [README SQL](sql_reference/README_SQL.md) trên bản sao ECommerceDB dành cho thử nghiệm. Script 05 chỉ dành cho smoke test nghiệp vụ. Lưu kết quả SQL vào `results/sqlserver/`. Không điền số giả; SQL đo server elapsed, Neo4j đo client wall-clock. Các script SQL chưa có kết quả chạy xác minh trong gói này.

Ba phạm vi độc lập:

- `IndexDemoProduct`: benchmark 100.000 node.
- `Topic2SQL*`: graph tham chiếu FR-01/FR-06; chỉ tạo nếu cần, bằng `py -B python/04_seed_fr01_fr06_from_sql.py` (nhập `MERGE`) rồi chạy `cypher/08_fr01_fr06_reference.cypher`. Hai ảnh kết quả trong [results/fr_tests/](results/fr_tests/README.md) xác nhận FR-01 trả 3 sản phẩm (ID 3, 1, 2, giá tăng dần) và FR-06 Product 9 trả 2 reviews, trung bình 4,5 sao. Chỉ xác nhận truy vấn tham chiếu, không phải toàn bộ Web/API hoặc Insert Review.
- Graph `User`, `Seller`, `Product`, `Order` của `src/neo4j/init.cypher` trong repository nhóm: không ghi đè. Ứng dụng chính dùng SQL Server; thêm đánh giá qua `sp_AddReview`. Xem [quy trình kiểm thử](report/FR01_FR06_KiemThu.md).

## 8. Bàn giao và giới hạn

Gói nộp có thể giữ dump, báo cáo, bằng chứng và source. Khi tích hợp repository [btl-dbms-ecommerce](https://github.com/hien24tphcm/btl-dbms-ecommerce), đặt nội dung gói trong `src/neo4j/topic2_indexing/` trên nhánh riêng nếu nhóm thống nhất; giữ nguyên `src/neo4j/init.cypher`, cấu hình Docker và source ứng dụng. Không commit dump, cache Python, mật khẩu hoặc dữ liệu nhạy cảm lên Git mặc định.

Phần Neo4j cốt lõi đã có dữ liệu thực nghiệm và kiểm tra offline. Cần bổ sung kết quả SQL đối chứng, kiểm thử nghiệp vụ FR-01/FR-06 trên SQL Server/Web, xác nhận khả năng restore nếu muốn công bố đã phục hồi thành công, và đồng bộ báo cáo chung (PDF hiện tại: mục 3 và 4.2). Không cần đưa kịch bản thuyết trình vào gói nộp.
