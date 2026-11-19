# **TÀI LIỆU ĐẶC TẢ YÊU CẦU HỆ THỐNG (SRS)**

# **ĐỀ TÀI: NỀN TẢNG SÀN THƯƠNG MẠI ĐIỆN TỬ ĐA GIAN HÀNG (MULTI-VENDOR E-COMMERCE PLATFORM)**

**Môn học:** Hệ thống Quản trị Cơ sở Dữ liệu (DBMS) – Học kỳ 261  
**Quy mô nhóm:** 4 – 5 thành viên

# **I. TỔNG QUAN HỆ THỐNG VÀ ĐỐI TƯỢNG NGƯỜI DÙNG**

## **1\. Mục tiêu hệ thống**

Xây dựng nền tảng sàn thương mại điện tử đa người bán (Multi-vendor E-Commerce) cho phép nhiều nhà bán hàng (Sellers) đăng ký gian hàng, quản lý kho hàng và xử lý đơn hàng tập trung; người mua (Buyers) tìm kiếm, mua sắm đa sản phẩm và đánh giá chất lượng; ban quản trị (Admin) kiểm duyệt hệ thống, vận hành chính sách và đối soát doanh thu. Ứng dụng phục vụ việc triển khai thực tế trên hai nền tảng cơ sở dữ liệu: Hệ quản trị CSDL Quan hệ (PostgreSQL / MySQL) và Hệ quản trị CSDL NoSQL (MongoDB) để đo lường, đối sánh hiệu năng.

## **2\. Các nhóm tác nhân (Actors)**

* **Khách hàng (Buyer):** Khám phá sản phẩm, quản lý giỏ hàng cá nhân, đặt đơn hàng, thanh toán và gửi phản hồi/đánh giá sau khi mua.  
* **Người bán (Seller):** Thiết lập gian hàng, quản lý thông tin và tồn kho sản phẩm, tiếp nhận và đổi trạng thái xử lý đơn hàng, theo dõi báo cáo doanh thu gian hàng.  
* **Quản trị viên (Admin):** Phê duyệt hồ sơ mở gian hàng, khóa/mở tài khoản, quản lý danh mục dùng chung và giám sát báo cáo tổng hợp kinh doanh toàn sàn.

# **II. ĐẶC TẢ YÊU CẦU CHỨC NĂNG NGHIỆP VỤ (FUNCTIONAL REQUIREMENTS)**

## **1\. Phân hệ Khách hàng (Buyer)**

* **FR-01: Tìm kiếm & Lọc sản phẩm nâng cao (Product Search & Multi-criteria Filtering)**  
  * Tìm kiếm sản phẩm theo từ khóa tên hoặc thương hiệu.  
  * Lọc kết hợp đa điều kiện: Danh mục ngành hàng, khoảng giá tùy biến (Giá từ Min đến Max), đánh giá sao tối thiểu, trạng thái sẵn hàng trong kho.  
  * Sắp xếp danh sách kết quả: Giá tăng/giảm dần, số lượng bán chạy, mới nhất.  
* **FR-02: Xem chi tiết sản phẩm & Đánh giá (Product Details & Reviews Inquiry)**  
  * Hiển thị thông số kỹ thuật, hình ảnh, phân loại biến thể, giá bán, số lượng tồn kho và điểm sao trung bình.  
  * Tải danh sách đánh giá của các khách hàng trước đó kèm điểm xếp hạng và bình luận thực tế.  
* **FR-03: Quản lý giỏ hàng mua sắm (Shopping Cart Management)**  
  * Thêm mặt hàng vào giỏ hàng với số lượng tùy chọn (tự động chặn nếu vượt số lượng tồn kho khả dụng).  
  * Điều chỉnh số lượng, chọn/bỏ chọn mặt hàng khi thanh toán, xóa sản phẩm khỏi giỏ hàng.  
* **FR-04: Đặt hàng & Áp dụng mã giảm giá (Order Placement & Coupon Checkout)**  
  * Thiết lập địa chỉ nhận hàng, hình thức giao hàng và phương thức thanh toán (COD hoặc Ví/Chuyển khoản).  
  * Áp dụng mã giảm giá (kiểm tra hợp lệ: còn hạn sử dụng, đạt giá trị đơn hàng tối thiểu, chưa vượt hạn mức sử dụng).  
  * Tạo hóa đơn đặt hàng và tự động trừ lượng hàng tồn kho tương ứng.  
* **FR-05: Theo dõi trạng thái & Lịch sử đơn hàng (Order Tracking & History)**  
  * Tra cứu tiến trình xử lý đơn hàng theo vòng đời: Chờ xác nhận, Đang xử lý, Đang giao hàng, Giao thành công, Đã hủy.  
  * Cho phép người mua hủy đơn hàng khi đơn chưa chuyển sang trạng thái vận chuyển.  
* **FR-06: Đánh giá & Phản hồi sau mua hàng (Product Review & Feedback)**  
  * Cho phép người mua gửi xếp hạng sao (1–5 sao) và nhận xét chất lượng đối với sản phẩm thuộc đơn hàng đã hoàn tất giao dịch.

## **2\. Phân hệ Người bán (Seller)**

* **FR-07: Quản lý thông tin & Danh mục sản phẩm (Product Catalog Management)**  
  * Thêm mới sản phẩm: Nhập tên, mô tả, danh mục, tải ảnh, định giá niêm yết và số lượng kho khởi tạo.  
  * Cập nhật thông tin chi tiết, chỉnh sửa giá bán và áp dụng chiết khấu.  
  * Tạm ngừng kinh doanh hoặc xóa sản phẩm (xóa mềm/soft delete nếu sản phẩm đã phát sinh lịch sử giao dịch).  
* **FR-08: Quản trị tồn kho hàng hóa (Inventory Management)**  
  * Cập nhật số lượng nhập kho định kỳ.  
  * Cảnh báo tự động các mặt hàng có lượng tồn kho dưới ngưỡng an toàn (Low Stock Alert).  
* **FR-09: Xử lý và luân chuyển đơn hàng (Order Fulfillment Processing)**  
  * Tiếp nhận đơn hàng mới từ người mua, xác nhận đóng gói và bàn giao cho đơn vị vận chuyển.  
  * Tra cứu danh sách mặt hàng, số lượng và địa chỉ người nhận theo từng đơn hàng của gian hàng.  
* **FR-10: Thống kê & Báo cáo hiệu quả kinh doanh gian hàng (Seller Analytics & Reporting)**  
  * Thống kê tổng doanh thu thuần, số lượng đơn hoàn tất theo mốc thời gian (ngày, tháng, quý).  
  * Trích xuất Top 5 sản phẩm có doanh số bán cao nhất của gian hàng.

## **3\. Phân hệ Quản trị viên (Admin)**

* **FR-11: Quản lý tài khoản & Kiểm duyệt gian hàng (Account & Shop Moderation)**  
  * Khóa tạm thời hoặc chấm dứt hoạt động các tài khoản vi phạm chính sách sàn.  
  * Thẩm định và xét duyệt hồ sơ đăng ký mở gian hàng mới của Seller.  
* **FR-12: Phân tích kinh doanh & Báo cáo tổng thể toàn sàn (Platform Business Intelligence)**  
  * Báo cáo tổng giá trị giao dịch toàn sàn (GMV) và doanh thu phí hoa hồng sàn thu được.  
  * Truy vấn thống kê các Seller có doanh thu vượt mức doanh thu bình quân của toàn bộ các nhà bán hàng.  
  * Thống kê các nhóm ngành hàng có sản lượng tiêu thụ lớn nhất sàn.

# **III. BẢNG ÁNH XẠ THAO TÁC NGHIỆP VỤ VÀ 8 DẠNG TRUY VẤN CSDL**

| STT | Dạng truy vấn bắt buộc | Mã FR tương ứng | Nghiệp vụ cụ thể | Minh họa câu lệnh SQL (RDBMS) | Minh họa truy vấn NoSQL (MongoDB) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| a | Insert | FR-03, FR-04 | Thêm sản phẩm vào giỏ hàng hoặc tạo đơn hàng mới. | `INSERT INTO Order_Details (order_id, product_id, quantity, unit_price) VALUES (@oid, @pid, @qty, @price);` | `db.orders.insertOne({ order_id: "...", items: [...] });` |
| b | Delete | FR-03 | Xóa một mặt hàng khỏi giỏ hàng. | `DELETE FROM Cart_Items WHERE cart_id = @cid AND product_id = @pid;` | `db.carts.updateOne({ user_id: @uid }, { $pull: { items: { product_id: @pid } } });` |
| c | Update | FR-04, FR-08 | Cập nhật trừ kho hàng tồn khi tạo đơn thành công. | `UPDATE Products SET stock_quantity = stock_quantity - @qty WHERE product_id = @pid AND stock_quantity >= @qty;` | `db.products.updateOne({ _id: @pid, stock: { $gte: @qty } }, { $inc: { stock: -@qty } });` |
| d | Query with a single condition | FR-02 | Lấy thông tin chi tiết một sản phẩm theo định danh ID. | `SELECT * FROM Products WHERE product_id = @pid;` | `db.products.findOne({ _id: @pid });` |
| e | Query with a composite condition | FR-01 | Lọc sản phẩm theo danh mục, khoảng giá và trạng thái khả dụng. | `SELECT * FROM Products WHERE category_id = @cat AND (price BETWEEN @min AND @max) AND is_active = 1;` | `db.products.find({ category_id: @cat, price: { $gte: @min, $lte: @max }, is_active: true });` |
| f | Query with a join | FR-05, FR-09 | Truy vấn thông tin chi tiết đơn hàng kết hợp thông tin sản phẩm và thông tin Shop. | `SELECT o.order_id, p.name, od.quantity, s.shop_name FROM Orders o JOIN Order_Details od ON o.order_id = od.order_id JOIN Products p ON od.product_id = p.product_id JOIN Sellers s ON o.seller_id = s.seller_id WHERE o.order_id = @oid;` | Dùng `$lookup` kết hợp embedding collection orders với collection products và sellers. |
| g | Query with a subquery | FR-12 | Tìm danh sách các gian hàng có tổng doanh thu lớn hơn mức doanh thu trung bình toàn sàn. | `SELECT seller_id, SUM(total_amount) AS revenue FROM Orders GROUP BY seller_id HAVING SUM(total_amount) > (SELECT AVG(shop_rev) FROM (SELECT SUM(total_amount) AS shop_rev FROM Orders GROUP BY seller_id) AS temp);` | Dùng `$facet` hoặc tính biến trung bình ở pipeline trước để filter `$expr: { $gt: ["$totalRevenue", "$avgRevenue"] }`. |
| h | Query with aggregate functions | FR-06, FR-10 | Tính điểm đánh giá sao trung bình của sản phẩm và đếm tổng số lượt đánh giá. | `SELECT product_id, COUNT(review_id) AS total_reviews, AVG(rating) AS avg_rating FROM Reviews GROUP BY product_id HAVING COUNT(review_id) >= 1;` | `db.reviews.aggregate([{ $group: { _id: "$product_id", total_reviews: { $sum: 1 }, avg_rating: { $avg: "$rating" } } }]);` |

# **IV. THIẾT KẾ CƠ SỞ DỮ LIỆU CỐT LÕI (CORE ENTITIES)**

1. **Users** (user\_id, email, password\_hash, full\_name, phone, role, created\_at)  
2. **Sellers** (seller\_id, user\_id, shop\_name, rating, is\_approved, address)  
3. **Categories** (category\_id, name, parent\_id)  
4. **Products** (product\_id, seller\_id, category\_id, name, description, price, stock\_quantity, sold\_quantity, is\_active, created\_at)  
5. **Carts & Cart\_Items** (cart\_item\_id, user\_id, product\_id, quantity, updated\_at)  
6. **Orders** (order\_id, buyer\_id, seller\_id, total\_amount, discount\_amount, final\_amount, order\_status, payment\_method, created\_at)  
7. **Order\_Details** (order\_detail\_id, order\_id, product\_id, quantity, unit\_price)  
8. **Vouchers** (voucher\_code, discount\_percent, min\_order\_value, max\_discount, usage\_limit, expired\_at)  
9. **Reviews** (review\_id, order\_detail\_id, product\_id, user\_id, rating, comment, created\_at)

# **V. PHÂN CÔNG ĐỀ TÀI THỰC NGHIỆM CHUYÊN SÂU DBMS (SQL vs NoSQL)**

## **Chủ đề 1: Data Storage & Schema Design (Lưu trữ dữ liệu & Cấu trúc Schema)**

* **Thành viên phụ trách:** Thành viên 1  
* **Nội dung thực nghiệm:** Mô hình hóa dữ liệu thuộc tính biến thể linh hoạt của sản phẩm (ví dụ: kích cỡ, màu sắc, thông số công nghệ). So sánh mô hình quan hệ chuẩn hóa (Entity-Attribute-Value hoặc cột JSONB trên PostgreSQL) với mô hình tài liệu lồng ghép tự nhiên (Embedded Documents) trên MongoDB. Đo lường dung lượng lưu trữ đĩa cứng và độ phức tạp khi mở rộng schema.

## **Chủ đề 2: Indexing Techniques (Kỹ thuật đánh chỉ mục)**

* **Thành viên phụ trách:** Thành viên 2  
* **Nội dung thực nghiệm:** Đánh giá hiệu năng tìm kiếm và lọc sản phẩm (FR-01) trên tập dữ liệu lớn (100.000 đến 1.000.000 records). Thực nghiệm so sánh B-Tree Index, Composite Index và Text Index giữa PostgreSQL và MongoDB. Đo lường thời gian thực thi truy vấn (Query Execution Time) và chi phí tài nguyên ghi (Write Overhead) khi có chỉ mục.

## **Chủ đề 3: Query Processing & Execution Plan (Tối ưu hóa và Xử lý truy vấn)**

* **Thành viên phụ trách:** Thành viên 3  
* **Nội dung thực nghiệm:** Phân tích kế hoạch thực thi câu lệnh phức tạp (FR-12, FR-10) với phép tính tổng hợp, gom nhóm và lọc lồng nhau. Sử dụng EXPLAIN ANALYZE trên PostgreSQL đối chiếu với explain("executionStats") của MongoDB Aggregation Pipeline. Đo lường chi phí bộ nhớ (Memory footprint) và số lượng document/bản ghi cần duyệt qua (Scanned records).

## **Chủ đề 4: Transactions & Concurrency Control (Giao dịch & Kiểm soát đồng thời)**

* **Thành viên phụ trách:** Thành viên 4  
* **Nội dung thực nghiệm:** Mô phỏng kịch bản Flash Sale: 100 người dùng đồng thời đặt mua 10 sản phẩm cuối cùng trong kho tại cùng một thời điểm. So sánh giải pháp Pessimistic Locking (SELECT FOR UPDATE), Optimistic Locking (version column) trên SQL với Atomic Update (findAndModify, \$inc có điều kiện) và Multi-document ACID Transactions trên MongoDB. Đánh giá tỷ lệ quá bán (Overselling) và độ trễ giao dịch.

## **Chủ đề 5: Data Backup & Disaster Recovery (Sao lưu và Phục hồi dữ liệu)**

* **Thành viên phụ trách:** Thành viên 5  
* **Nội dung thực nghiệm:** Thiết lập kịch bản sao lưu định kỳ và khôi phục khi gặp sự cố dữ liệu. So sánh công cụ sao lưu logic (pg\_dump / mysqldump vs mongodump) và sao lưu vật lý. Đo thời gian thực hiện backup, kích thước file nén đầu ra, thời gian phục hồi (Recovery time) và mức độ sẵn sàng của hệ thống trong thời gian sao lưu.

# **VI. CẤU TRÚC BÁO CÁO BTL** 

1. **Chapter 1: Introduction to the Project & System Architecture** (Giới thiệu bài toán, mục tiêu và kiến trúc hệ thống Client-Server / MVC / N-tier).  
2. **Chapter 2: System Requirements & Database Design** (Tài liệu SRS 12 chức năng, bảng ánh xạ 8 loại truy vấn a-h, mô hình ERD và lược đồ quan hệ/NoSQL).  
3. **Chapter 3: DBMS In-depth Studies & Experimental Comparisons** (Nội dung chi tiết 5 đề tài thực nghiệm của các thành viên, kèm biểu đồ phân tích và đối sánh định lượng giữa SQL và NoSQL).  
4. **Chapter 4: Application Demonstration & Implementation** (Giao diện ứng dụng web thực thi trên cơ sở dữ liệu, chứng minh các tính năng nghiệp vụ hoạt động ổn định).  
5. **Chapter 5: Teamwork Report & Meeting Minutes** (Bảng phân chia công việc chi tiết, tỷ lệ đóng góp của từng thành viên và tối thiểu 01 biên bản cuộc họp nhóm).  
6. **Chapter 6: Conclusion, Self-assessment & References** (Kết luận lựa chọn hệ quản trị CSDL phù hợp nhất cho bài toán, bảng tự đánh giá điểm số theo tiêu chí chấm điểm và danh mục tài liệu tham khảo chuẩn).

