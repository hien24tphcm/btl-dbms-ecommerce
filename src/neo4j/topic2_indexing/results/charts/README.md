# Biểu đồ từ số liệu thực tế

- `read_median.png`: neo4j_read_summary.csv, trung vị 10 lượt/mode.
- `db_hits.png`: profile_da_do_tu_TXT.csv, trục log để thấy được cả 12 và 208.101 DB Hits. Không đọc độ cao như thang tuyến tính.
- `write_median.png`: neo4j_write_summary.csv, trung vị 7 lượt/mode, 5.000 node/lượt.

READ/WRITE là client wall-clock, DB Hits không phải thời gian. Không có số liệu SQL được thêm vào biểu đồ. Khi nhóm có số đo SQL, vẽ riêng và ghi rõ phương pháp. Các PNG phục vụ báo cáo/slide, CSV gốc vẫn là nguồn chính.
