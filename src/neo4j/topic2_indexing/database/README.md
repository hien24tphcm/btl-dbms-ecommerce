# Bàn giao và phục hồi Neo4j Topic 2

## 1. Tệp đã xuất

- Tệp: `neo4j-2026-11-24T08-47-43.dump` (giữ nguyên tên và nội dung gốc).
- Kích thước: 8,603,479 bytes.
- Neo4j nguồn: Kernel 2026.10.1, Desktop 2.3.1, Cypher 25 theo môi trường benchmark. Kiểm tra edition của instance nguồn trước khi tạo instance đích.
- SHA-256: `ff803ac1e711bde4e88d8339d005c50423bf27f3dfc70dba488efa47be4f42ff`.
- Trạng thái: tệp có trong ZIP và đã tính checksum; **chưa kiểm thử phục hồi**. Nội dung 100.000 Node và Index chỉ được xác nhận sau khi load và validate.

## 2. Kiểm tra trước khi phục hồi

Tại gốc folder Topic 2 trong PowerShell:

```powershell
Get-FileHash '.\database\neo4j-2026-11-24T08-47-43.dump' -Algorithm SHA256
```

Đối chiếu hash phía trên. Nếu lệch, nhận lại bản gốc. File dump không chứa tài khoản của database `system`; mật khẩu đăng nhập là mật khẩu của **instance đích**, không phải mật khẩu giải nén dump. Thành viên nhận bàn giao tự đặt mật khẩu; không ghi mật khẩu vào README hoặc Git.

## 3. Phục hồi an toàn trên Desktop (không ghi đè instance đang làm)

1. Giữ nguyên instance `DBMS_Topic2_Neo4j` đang có. Tạo instance phục hồi riêng, chọn Neo4j 2026.10.1 và edition tương thích. Đặt mật khẩu riêng cho user `neo4j`.
2. Dừng instance đích. Tạo một bản sao của dump, đổi tên bản sao thành `topic2-indexing.dump` (không sửa file gốc). Tên database đích suy ra từ tên file và phải chưa tồn tại.
3. Trong Instances, menu `...` của instance đích → Load database → chọn bản sao → Import. Desktop không ghi đè database trùng tên và có thể tự khởi động instance sau khi load.
4. Nếu edition đích không hỗ trợ database bổ sung, không xóa database hiện tại để ép import. Dùng instance tương thích hoặc phương án tái tạo ở mục 5. Nếu trùng cổng Bolt, dừng instance nguồn hoặc cấu hình cổng khác.
5. Kết nối Query với database vừa load. Kiểm tra phiên bản, `SHOW INDEXES` và chờ ba Index chính ONLINE. Chạy `MATCH (p:IndexDemoProduct) RETURN count(p) AS total`.

## 4. Xác minh bằng Python

Tại gốc project, với instance phục hồi đang chạy:

```powershell
$env:NEO4J_DATABASE = 'topic2-indexing'
$env:NEO4J_URI = 'bolt://localhost:7687'  # đổi nếu instance đích dùng port khác
py -m pip install -r requirements.txt
py python/01_validate.py
```

Nhập mật khẩu instance đích khi được hỏi (ký tự không hiện là bình thường). PASS yêu cầu 100.000 Node, SKU duy nhất, dữ liệu đúng, ba Index ONLINE, count 300/400/11. Có thể chạy `05_demo_readonly.py` trên bản sao thư mục dự án để không ghi đè CSV gốc. Lưu ảnh/log validate phục hồi nếu thành công. Sau khi xong:

```powershell
Remove-Item Env:NEO4J_DATABASE -ErrorAction SilentlyContinue
Remove-Item Env:NEO4J_URI -ErrorAction SilentlyContinue
```

## 5. Phương án tái tạo không cần dump

Docker nhóm dùng `neo4j:5-community`, khác với 2026.10.1. Không hạ cấp dump hay copy thư mục store. Trên instance mới tương thích Cypher với bộ script, chạy `python/00_seed_if_empty.py` (xác nhận `TAO` chỉ khi 0 Node), từng lệnh `cypher/07_create_benchmark_indexes_if_missing.cypher`, rồi `01_validate.py`. Các kết quả timing mới phải ghi tách riêng. File Full-Text dùng SEARCH của Cypher 25 không mặc định chạy trên Neo4j 5.

## 6. Bàn giao

Giữ dump trong ZIP nộp riêng/handoff nội bộ. Không commit dump vào Git mặc định; không copy thư mục data/databases hoặc transactions. Kiểm tra dữ liệu trong dump không chứa dữ liệu không liên quan hoặc thông tin bí mật trước khi chia sẻ.

Nguồn: [Neo4j Desktop – Database management](https://neo4j.com/docs/desktop/current/operations/database-management/), [Restore a database dump](https://neo4j.com/docs/operations-manual/current/backup-restore/restore-dump/).
