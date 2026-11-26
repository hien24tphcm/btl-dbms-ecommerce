/* =====================================================================
   DEMO TRANSACTION (MSSQL) – FLASH SALE: CHỐNG OVERSELLING / LOST UPDATE
   Miền ứng dụng: Sàn TMĐT đa gian hàng – FR-04 (sp_CheckoutOrder), FR-08

   Cách chạy (nạp script):
     npm run setup:mssql                      (khuyến nghị – xem README.md)
   hoặc SSMS / Azure Data Studio, hoặc trong container:
     docker exec -it txdemo_mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Password_123#" -C -i /demo/mssql_flashsale_demo.sql

   Dùng DB riêng TxDemoDB để KHÔNG đụng vào ECommerceDB.
   Bảng Demo_Product / Demo_Order là bản rút gọn của Products / Orders.

   Bất biến (invariant) dùng để kiểm chứng:
        stock_qty (cuối) + SUM(qty đã đặt) = initial_qty   VÀ   stock_qty >= 0
   Phân loại vi phạm (demo_Verify / run_flashsale.mjs):
     LOST_UPDATE     stock + đã đặt  > ban đầu : bán nhiều hơn số đã trừ kho (ghi đè lẫn nhau)
     NEGATIVE_STOCK  stock < 0                  : kiểm tra "còn hàng" dựa trên giá trị cũ (check-then-act)
     LEAKED_STOCK    stock + đã đặt  < ban đầu : trừ kho nhưng không có đơn (vi phạm Atomicity)

   Các chế độ (@mode) của dbo.demo_Checkout:
     NAIVE       READ COMMITTED, đọc tồn kho -> tính ở "ứng dụng" -> ghi lại
                 (mô phỏng code sai)                                -> DỰ KIẾN: LOST_UPDATE
     ATOMIC      1 câu UPDATE có điều kiện (stock_qty >= @qty)      -> DỰ KIẾN: đúng
     UPDLOCK     SELECT WITH (UPDLOCK, ROWLOCK) rồi UPDATE
                 (giống mô tả sp_CheckoutOrder của nhóm)            -> DỰ KIẾN: đúng
     REPEATABLE  REPEATABLE READ: giữ S-lock rồi nâng lên X         -> DỰ KIẾN: đúng nhưng
                                                                       nhiều deadlock (1205)
     SNAPSHOT    SNAPSHOT isolation (optimistic)                    -> DỰ KIẾN: đúng nhưng
                                                                       nhiều update conflict (3960)

   Tham số phụ:
     @think_ms          mô phỏng thời gian xử lý của ứng dụng bên trong giao dịch (voucher,
                        thanh toán...). Nới rộng "cửa sổ race" để kết quả tái lập được.
                        Lưu ý: thực tế KHÔNG nên gọi dịch vụ ngoài khi đang giữ khoá.
                        Hãy chạy thêm với @think_ms = 0 để đo tỉ lệ race thực.
     @fail_after_write  = 1: ném lỗi 50099 SAU khi đã trừ kho, TRƯỚC khi tạo đơn
                        -> kiểm chứng Atomicity (kho phải được hoàn nguyên).
   demo_Reset @with_check = 1 bật ràng buộc CHECK (stock_qty >= 0) – lớp phòng thủ khai báo
   mà Neo4j không có (Neo4j không hỗ trợ ràng buộc miền giá trị).
   ===================================================================== */

USE master;
GO
IF DB_ID(N'TxDemoDB') IS NULL CREATE DATABASE TxDemoDB;
GO
ALTER DATABASE TxDemoDB SET ALLOW_SNAPSHOT_ISOLATION ON;   -- cần cho mode SNAPSHOT
GO
USE TxDemoDB;
GO

-- Kiểm tra RCSI (mặc định OFF trên SQL Server 2022 / Docker; Azure SQL mặc định ON)
SELECT name,
       is_read_committed_snapshot_on,
       snapshot_isolation_state_desc
FROM sys.databases WHERE name = N'TxDemoDB';
GO

DROP TABLE IF EXISTS dbo.Demo_Order;
DROP TABLE IF EXISTS dbo.Demo_Product;
GO

CREATE TABLE dbo.Demo_Product (
    product_id  INT           NOT NULL PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,
    stock_qty   INT           NOT NULL,
    initial_qty INT           NOT NULL,
    -- Mặc định bị TẮT trong demo_Reset để bất thường lộ ra; bật bằng @with_check = 1
    CONSTRAINT CK_Demo_Product_stock CHECK (stock_qty >= 0)
);

CREATE TABLE dbo.Demo_Order (
    order_id   INT IDENTITY(1,1) PRIMARY KEY,
    product_id INT          NOT NULL,
    buyer_id   INT          NOT NULL,
    qty        INT          NOT NULL,
    created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ---------- Reset dữ liệu giữa các lần chạy ---------- */
CREATE OR ALTER PROCEDURE dbo.demo_Reset
    @product_id INT = 1,
    @stock      INT = 5,
    @with_check BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Demo_Order   WHERE product_id = @product_id;
    DELETE FROM dbo.Demo_Product WHERE product_id = @product_id;
    INSERT dbo.Demo_Product (product_id, name, stock_qty, initial_qty)
    VALUES (@product_id, N'Flash Sale Phone', @stock, @stock);

    IF @with_check = 1
        ALTER TABLE dbo.Demo_Product WITH CHECK CHECK CONSTRAINT CK_Demo_Product_stock;
    ELSE
        ALTER TABLE dbo.Demo_Product NOCHECK CONSTRAINT CK_Demo_Product_stock;
END
GO

/* ---------- Giao dịch checkout rút gọn: 5 chế độ ---------- */
CREATE OR ALTER PROCEDURE dbo.demo_Checkout
    @product_id       INT,
    @buyer_id         INT,
    @qty              INT         = 1,
    @mode             VARCHAR(12) = 'NAIVE',
    @think_ms         INT         = 0,
    @fail_after_write BIT         = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;   -- lỗi runtime (deadlock, conflict, CHECK, THROW) => tự rollback toàn bộ giao dịch

    DECLARE @stock INT;
    -- 'hh:mm:ss.mmm' cho WAITFOR DELAY
    DECLARE @delay VARCHAR(12) =
        RIGHT(CONVERT(VARCHAR(23), DATEADD(MILLISECOND, @think_ms, CAST('19000101' AS DATETIME)), 121), 12);

    IF @mode = 'REPEATABLE'     SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    ELSE IF @mode = 'SNAPSHOT'  SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
    ELSE                        SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

    BEGIN TRANSACTION;

    IF @mode = 'ATOMIC'
    BEGIN
        -- Kiểm tra + trừ kho trong CÙNG MỘT câu lệnh: U-lock được lấy TRƯỚC khi đánh giá điều kiện
        UPDATE dbo.Demo_Product
           SET stock_qty = stock_qty - @qty
         WHERE product_id = @product_id AND stock_qty >= @qty;

        IF @@ROWCOUNT = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50003, 'Insufficient stock', 1;   -- trùng mã 50003 của sp_CheckoutOrder
        END;

        IF @think_ms > 0 WAITFOR DELAY @delay;      -- giữ X-lock trong lúc "xử lý thanh toán"
    END
    ELSE
    BEGIN
        -- Bước 1: ĐỌC tồn kho
        IF @mode = 'UPDLOCK'
            SELECT @stock = stock_qty
              FROM dbo.Demo_Product WITH (UPDLOCK, ROWLOCK)
             WHERE product_id = @product_id;
        ELSE
            SELECT @stock = stock_qty
              FROM dbo.Demo_Product
             WHERE product_id = @product_id;

        -- Bước 2: KIỂM TRA nghiệp vụ
        IF @stock IS NULL OR @stock < @qty
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50003, 'Insufficient stock', 1;
        END;

        -- Bước 3: "xử lý" (voucher, thanh toán...)
        IF @think_ms > 0 WAITFOR DELAY @delay;

        -- Bước 4: GHI giá trị tính từ lần đọc ở Bước 1
        UPDATE dbo.Demo_Product
           SET stock_qty = @stock - @qty
         WHERE product_id = @product_id;
    END

    -- Mô phỏng sự cố giữa giao dịch (vd: lỗi ghi đơn / mất kết nối cổng thanh toán)
    IF @fail_after_write = 1
        THROW 50099, 'Simulated failure after stock was deducted', 1;   -- XACT_ABORT => rollback cả việc trừ kho

    INSERT dbo.Demo_Order (product_id, buyer_id, qty)
    VALUES (@product_id, @buyer_id, @qty);

    COMMIT TRANSACTION;
END
GO

/* ---------- Kiểm chứng bất biến ---------- */
CREATE OR ALTER PROCEDURE dbo.demo_Verify
    @product_id INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.initial_qty,
           p.stock_qty                     AS final_stock,
           x.orders,
           x.units_ordered,
           CASE WHEN x.units_ordered > p.initial_qty
                THEN x.units_ordered - p.initial_qty ELSE 0 END AS oversold_units,
           CASE
             WHEN p.stock_qty + x.units_ordered = p.initial_qty AND p.stock_qty >= 0 THEN 'CONSISTENT'
             ELSE CONCAT_WS(' + ',
                    CASE WHEN p.stock_qty + x.units_ordered > p.initial_qty THEN 'LOST_UPDATE'    END,
                    CASE WHEN p.stock_qty + x.units_ordered < p.initial_qty THEN 'LEAKED_STOCK'   END,
                    CASE WHEN p.stock_qty < 0                               THEN 'NEGATIVE_STOCK' END)
           END                                              AS verdict
    FROM dbo.Demo_Product p
    CROSS APPLY (SELECT COUNT(*)              AS orders,
                        ISNULL(SUM(o.qty), 0) AS units_ordered
                 FROM dbo.Demo_Order o
                 WHERE o.product_id = p.product_id) x
    WHERE p.product_id = @product_id;
END
GO

/* =====================================================================
   KỊCH BẢN THỦ CÔNG NHIỀU CỬA SỔ (dùng để chụp ảnh đưa vào báo cáo)
   SSMS/ADS kết nối: Server = localhost,1433 ; Login = sa ; Trust server certificate.
   Mở 2 query window (A, B) + 1 window quan sát (C), tất cả USE TxDemoDB.
   ===================================================================== */

-- ---- Kịch bản 1: NAIVE  => Lost Update / Overselling -------------------
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 1;
-- Rồi chạy ngay A và B (cách nhau < 5 giây):
--   Window A: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='NAIVE', @think_ms=5000;
--   Window B: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='NAIVE', @think_ms=5000;
-- Kết quả mong đợi: CẢ HAI đều thành công.
--   EXEC dbo.demo_Verify @product_id = 1;   --> orders = 2, final_stock = 0, oversold_units = 1, LOST_UPDATE
-- Giải thích: READ COMMITTED nhả S-lock ngay sau khi đọc => cả A và B cùng thấy stock = 1,
-- B chờ X-lock của A ở Bước 4 rồi GHI ĐÈ giá trị 0 (tính từ lần đọc cũ).

-- ---- Kịch bản 2: UPDLOCK / ATOMIC  => đúng, giao dịch sau bị CHẶN -------
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 1;
--   Window A: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='UPDLOCK', @think_ms=5000;
--   Window B: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='UPDLOCK', @think_ms=5000;
--   Window C (trong lúc B đang chờ) – bằng chứng khóa:
--     SELECT r.session_id, r.status, r.wait_type, r.wait_time, r.blocking_session_id
--     FROM sys.dm_exec_requests r WHERE r.session_id > 50 AND r.blocking_session_id <> 0;
--     SELECT request_session_id, resource_type, request_mode, request_status
--     FROM sys.dm_tran_locks WHERE resource_database_id = DB_ID(N'TxDemoDB')
--       AND resource_type IN ('KEY','RID','PAGE','OBJECT');
--   Mong đợi: B ở trạng thái WAIT (LCK_M_U); khi A commit, B đọc stock = 0 và nhận lỗi 50003.
--   EXEC dbo.demo_Verify @product_id = 1;   --> orders = 1, final_stock = 0, CONSISTENT
--   (Lặp lại với @mode='ATOMIC': B cũng chờ LCK_M_U ngay tại câu UPDATE.)

-- ---- Kịch bản 3: REPEATABLE READ => Deadlock (conversion deadlock) ------
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 5;
--   Chạy A và B (cách nhau < 5 giây):
--     Window A: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='REPEATABLE', @think_ms=5000;
--     Window B: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='REPEATABLE', @think_ms=5000;
--   Mong đợi: một cửa sổ nhận lỗi 1205 (chosen as deadlock victim), cửa sổ kia thành công.
--   Cả 2 cùng giữ S-lock rồi cùng xin X-lock => chờ vòng.
--   EXEC dbo.demo_Verify @product_id = 1;   --> orders = 1, final_stock = 4, CONSISTENT

-- ---- Kịch bản 4: SNAPSHOT => Update conflict (optimistic) ---------------
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 5;
--   Chạy A và B (cách nhau < 5 giây):
--     Window A: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='SNAPSHOT', @think_ms=5000;
--     Window B: EXEC dbo.demo_Checkout @product_id=1, @buyer_id=2, @mode='SNAPSHOT', @think_ms=5000;
--   Mong đợi: giao dịch ghi SAU nhận lỗi 3960 (snapshot isolation update conflict),
--   KHÔNG chờ khoá lúc đọc (khác REPEATABLE) – phát hiện xung đột lúc ghi.
--   EXEC dbo.demo_Verify @product_id = 1;   --> orders = 1, final_stock = 4, CONSISTENT

-- ---- Kịch bản 5: CHECK constraint – phòng thủ khai báo, nhưng KHÔNG chữa lost update ----
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 1, @with_check = 1;
--   Lặp lại Kịch bản 1 (NAIVE) => VẪN LOST_UPDATE (stock không âm nên CHECK không bắt được).
--   Thử ghi âm trực tiếp:
--     UPDATE dbo.Demo_Product SET stock_qty = -1 WHERE product_id = 1;   --> lỗi 547 (CHECK)
--   Kết luận: CHECK chặn NEGATIVE_STOCK; lost update phải chặn bằng khoá / mức cô lập.

-- ---- Kịch bản 6: Atomicity – sự cố sau khi đã trừ kho ---------------------
--   EXEC dbo.demo_Reset @product_id = 1, @stock = 5;
--   EXEC dbo.demo_Checkout @product_id=1, @buyer_id=1, @mode='ATOMIC', @fail_after_write=1;  --> lỗi 50099
--   EXEC dbo.demo_Verify @product_id = 1;   --> orders = 0, final_stock = 5, CONSISTENT (đã rollback)
--   Đối chứng (KHÔNG giao dịch – mỗi câu tự commit):
--     UPDATE dbo.Demo_Product SET stock_qty = stock_qty - 1 WHERE product_id = 1;
--     THROW 50099, 'crash', 1;                  -- giả lập lỗi trước khi INSERT đơn
--   EXEC dbo.demo_Verify @product_id = 1;   --> final_stock = 4, orders = 0, LEAKED_STOCK

-- Chạy tự động N người mua đồng thời + thu số liệu: xem run_flashsale.mjs / README.md
