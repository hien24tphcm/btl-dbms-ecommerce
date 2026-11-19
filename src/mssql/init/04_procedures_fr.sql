-- ==============================================================================
-- 04_procedures_fr.sql: 16 Idempotent Stored Procedures & Helper Views/Types
-- Milestone 2: Multi-Vendor E-Commerce Platform (SQL Server 2022)
-- Strict Alignment with docs/project.md §II (FR-01..FR-12) & §III (Query Types a..h)
-- Special Focus: Topic 5 Data Backup & Disaster Recovery (FR-05, FR-09, FR-11)
-- ==============================================================================

USE [ECommerceDB];
GO

PRINT '==============================================================================';
PRINT 'Initializing 04_procedures_fr.sql (Types, Views, Stored Procedures)...';
PRINT '==============================================================================';
GO

-- ==============================================================================
-- SECTION 0: HELPER TYPES & VIEWS
-- ==============================================================================

-- 0.1. Table-Valued Parameter Type: TVP_OrderItem
IF TYPE_ID(N'dbo.TVP_OrderItem') IS NULL
BEGIN
    PRINT 'Creating User-Defined Table Type [dbo.TVP_OrderItem]...';
    CREATE TYPE dbo.TVP_OrderItem AS TABLE (
        product_id INT NOT NULL,
        quantity INT NOT NULL
    );
END
ELSE
BEGIN
    PRINT 'User-Defined Table Type [dbo.TVP_OrderItem] already exists.';
END
GO

-- 0.2. Reusable Helper View: v_OrderFulfillmentSummary
PRINT 'Creating/altering View [dbo.v_OrderFulfillmentSummary]...';
GO
CREATE OR ALTER VIEW dbo.v_OrderFulfillmentSummary AS
SELECT 
    o.order_id,
    o.order_status,
    o.created_at AS order_date,
    o.total_amount,
    o.discount_amount,
    o.final_amount,
    o.payment_method,
    o.shipping_address,
    u.user_id AS buyer_id,
    u.full_name AS buyer_name,
    u.email AS buyer_email,
    s.seller_id,
    s.shop_name,
    COUNT(od.order_detail_id) AS total_line_items,
    SUM(od.quantity) AS total_item_count
FROM dbo.Orders o
JOIN dbo.Users u ON o.buyer_id = u.user_id
JOIN dbo.Sellers s ON o.seller_id = s.seller_id
JOIN dbo.Order_Details od ON o.order_id = od.order_id
GROUP BY 
    o.order_id, o.order_status, o.created_at, o.total_amount, o.discount_amount,
    o.final_amount, o.payment_method, o.shipping_address, u.user_id, u.full_name,
    u.email, s.seller_id, s.shop_name;
GO

-- 0.3. Reusable Helper View: v_SellerPerformanceMetrics
PRINT 'Creating/altering View [dbo.v_SellerPerformanceMetrics]...';
GO
CREATE OR ALTER VIEW dbo.v_SellerPerformanceMetrics AS
SELECT 
    s.seller_id,
    s.shop_name,
    s.rating,
    s.is_approved,
    COUNT(DISTINCT p.product_id) AS total_products,
    COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN o.order_id END) AS completed_orders,
    ISNULL(SUM(CASE WHEN o.order_status = 'delivered' THEN o.final_amount ELSE 0 END), 0.00) AS delivered_revenue
FROM dbo.Sellers s
LEFT JOIN dbo.Products p ON s.seller_id = p.seller_id AND p.is_active = 1
LEFT JOIN dbo.Orders o ON s.seller_id = o.seller_id
GROUP BY s.seller_id, s.shop_name, s.rating, s.is_approved;
GO

-- ==============================================================================
-- SECTION 1: BUYER FUNCTIONALITIES (FR-01 through FR-06)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. sp_SearchProducts (FR-01, Query Type e: Composite Condition Filter)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_SearchProducts]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_SearchProducts
    @keyword NVARCHAR(100) = NULL,
    @category_id INT = NULL,
    @min_price DECIMAL(18,2) = NULL,
    @max_price DECIMAL(18,2) = NULL,
    @min_rating DECIMAL(3,2) = NULL,
    @in_stock_only BIT = 0,
    @sort_by NVARCHAR(20) = 'newest'
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate price range boundaries
    IF (@min_price < 0.00 OR @max_price < 0.00 OR (@min_price IS NOT NULL AND @max_price IS NOT NULL AND @min_price > @max_price))
    BEGIN
        THROW 50001, 'Invalid price range specified.', 1;
    END

    SELECT 
        p.product_id,
        p.seller_id,
        s.shop_name,
        s.rating AS seller_rating,
        p.category_id,
        c.category_name,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.sold_quantity,
        p.status,
        p.created_at
    FROM dbo.Products p
    JOIN dbo.Sellers s ON p.seller_id = s.seller_id
    JOIN dbo.Categories c ON p.category_id = c.category_id
    WHERE p.is_active = 1
      AND p.status = 'active'
      AND (@keyword IS NULL OR (p.name LIKE N'%' + @keyword + N'%' OR p.description LIKE N'%' + @keyword + N'%'))
      AND (@category_id IS NULL OR p.category_id = @category_id OR p.category_id IN (SELECT category_id FROM dbo.Categories WHERE parent_id = @category_id))
      AND (@min_price IS NULL OR p.price >= @min_price)
      AND (@max_price IS NULL OR p.price <= @max_price)
      AND (@min_rating IS NULL OR s.rating >= @min_rating)
      AND (@in_stock_only = 0 OR p.stock_quantity > 0)
    ORDER BY 
        CASE WHEN @sort_by = 'price_asc' THEN p.price END ASC,
        CASE WHEN @sort_by = 'price_desc' THEN p.price END DESC,
        CASE WHEN @sort_by = 'sold_desc' THEN p.sold_quantity END DESC,
        CASE WHEN @sort_by = 'newest' OR @sort_by NOT IN ('price_asc', 'price_desc', 'sold_desc') OR @sort_by IS NULL THEN p.created_at END DESC;
END
GO

-- ------------------------------------------------------------------------------
-- 2. sp_GetProductDetails (FR-02, Query Type d: Single Condition Lookup)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetProductDetails]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetProductDetails
    @product_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Verify product existence and active status
    IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE product_id = @product_id AND is_active = 1)
    BEGIN
        THROW 50001, 'Product not found or inactive.', 1;
    END

    -- Result Set 1: Product Specifications & Seller Overview
    SELECT 
        p.product_id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.sold_quantity,
        p.status,
        p.created_at,
        p.updated_at,
        c.category_id,
        c.category_name,
        s.seller_id,
        s.shop_name,
        s.rating AS seller_rating,
        s.address AS seller_address,
        ISNULL(r_stats.avg_rating, 0.00) AS avg_product_rating,
        ISNULL(r_stats.review_count, 0) AS total_reviews
    FROM dbo.Products p
    JOIN dbo.Categories c ON p.category_id = c.category_id
    JOIN dbo.Sellers s ON p.seller_id = s.seller_id
    OUTER APPLY (
        SELECT 
            AVG(CAST(r.rating AS DECIMAL(3,2))) AS avg_rating,
            COUNT(r.review_id) AS review_count
        FROM dbo.Reviews r
        WHERE r.product_id = p.product_id
    ) r_stats
    WHERE p.product_id = @product_id;

    -- Result Set 2: Product Customer Reviews List
    SELECT 
        r.review_id,
        r.order_detail_id,
        r.user_id,
        u.full_name AS reviewer_name,
        r.rating,
        r.comment,
        r.created_at
    FROM dbo.Reviews r
    JOIN dbo.Users u ON r.user_id = u.user_id
    WHERE r.product_id = @product_id
    ORDER BY r.created_at DESC;
END
GO

-- ------------------------------------------------------------------------------
-- 3a. sp_AddToCart (FR-03, Query Type a: Insert / Upsert Cart Item)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_AddToCart]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_AddToCart
    @user_id INT,
    @product_id INT,
    @quantity INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @quantity <= 0
    BEGIN
        THROW 50002, 'Quantity must be greater than zero.', 1;
    END

    -- Verify active buyer
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @user_id AND is_active = 1)
    BEGIN
        THROW 50002, 'User account is inactive or not found.', 1;
    END

    -- Check product active status and stock quantity
    DECLARE @avail_stock INT;
    SELECT @avail_stock = stock_quantity
    FROM dbo.Products
    WHERE product_id = @product_id AND is_active = 1 AND status = 'active';

    IF @avail_stock IS NULL
    BEGIN
        THROW 50002, 'Insufficient stock or product unavailable.', 1;
    END

    DECLARE @current_cart_qty INT = 0;
    SELECT @current_cart_qty = quantity
    FROM dbo.Cart_Items
    WHERE user_id = @user_id AND product_id = @product_id;

    IF (@current_cart_qty + @quantity) > @avail_stock
    BEGIN
        THROW 50002, 'Insufficient stock or product unavailable.', 1;
    END

    -- Upsert cart line item
    IF EXISTS (SELECT 1 FROM dbo.Cart_Items WHERE user_id = @user_id AND product_id = @product_id)
    BEGIN
        UPDATE dbo.Cart_Items
        SET quantity = quantity + @quantity,
            added_at = SYSUTCDATETIME()
        WHERE user_id = @user_id AND product_id = @product_id;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Cart_Items (user_id, product_id, quantity, added_at)
        VALUES (@user_id, @product_id, @quantity, SYSUTCDATETIME());
    END
END
GO

-- ------------------------------------------------------------------------------
-- 3b. sp_RemoveFromCart (FR-03, Query Type b: Delete Cart Item)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_RemoveFromCart]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_RemoveFromCart
    @user_id INT,
    @product_id INT = NULL,
    @cart_item_id INT = NULL,
    @clear_all BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @clear_all = 1
    BEGIN
        DELETE FROM dbo.Cart_Items WHERE user_id = @user_id;
    END
    ELSE IF @cart_item_id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Cart_Items WHERE cart_item_id = @cart_item_id AND user_id = @user_id;
    END
    ELSE IF @product_id IS NOT NULL
    BEGIN
        DELETE FROM dbo.Cart_Items WHERE product_id = @product_id AND user_id = @user_id;
    END
    ELSE
    BEGIN
        THROW 50002, 'No cart item criteria specified for removal.', 1;
    END
END
GO

-- ------------------------------------------------------------------------------
-- 4. sp_PlaceOrder (FR-04, Query Types a & c: Atomic Order Placement & Stock Decrement)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_PlaceOrder]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_PlaceOrder
    @buyer_id INT,
    @seller_id INT,
    @product_id INT = NULL,
    @quantity INT = NULL,
    @voucher_code NVARCHAR(50) = NULL,
    @shipping_address NVARCHAR(255),
    @payment_method NVARCHAR(50) = 'COD',
    @new_order_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Validate Buyer Account
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @buyer_id AND is_active = 1)
        BEGIN
            THROW 50005, 'Buyer account is inactive or not found.', 1;
        END

        -- 2. Validate Seller Account
        IF NOT EXISTS (SELECT 1 FROM dbo.Sellers WHERE seller_id = @seller_id AND is_approved = 1)
        BEGIN
            THROW 50005, 'Seller store is not approved or not found.', 1;
        END

        -- 3. Staging temporary table for checkout line items
        CREATE TABLE #CheckoutItems (
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            unit_price DECIMAL(18,2) NOT NULL,
            subtotal DECIMAL(18,2) NOT NULL
        );

        IF @product_id IS NOT NULL
        BEGIN
            -- Direct Checkout Path
            IF @quantity IS NULL OR @quantity <= 0
                SET @quantity = 1;

            DECLARE @direct_price DECIMAL(18,2);
            SELECT @direct_price = price
            FROM dbo.Products WITH (UPDLOCK, ROWLOCK)
            WHERE product_id = @product_id AND seller_id = @seller_id AND is_active = 1 AND status = 'active';

            IF @direct_price IS NULL
            BEGIN
                THROW 50003, 'Product not found or seller mismatch.', 1;
            END

            INSERT INTO #CheckoutItems (product_id, quantity, unit_price, subtotal)
            VALUES (@product_id, @quantity, @direct_price, @quantity * @direct_price);
        END
        ELSE
        BEGIN
            -- Cart Checkout Path for specified Seller
            INSERT INTO #CheckoutItems (product_id, quantity, unit_price, subtotal)
            SELECT ci.product_id, ci.quantity, p.price, (ci.quantity * p.price)
            FROM dbo.Cart_Items ci
            JOIN dbo.Products p WITH (UPDLOCK, ROWLOCK) ON ci.product_id = p.product_id
            WHERE ci.user_id = @buyer_id
              AND p.seller_id = @seller_id
              AND p.is_active = 1
              AND p.status = 'active';

            IF @@ROWCOUNT = 0
            BEGIN
                THROW 50003, 'No available cart items found for specified seller.', 1;
            END
        END

        -- 4. Calculate Gross Total Amount
        DECLARE @total_amount DECIMAL(18,2);
        SELECT @total_amount = SUM(subtotal) FROM #CheckoutItems;

        -- 5. Process Voucher if provided
        DECLARE @discount_amount DECIMAL(18,2) = 0.00;
        IF @voucher_code IS NOT NULL AND LTRIM(RTRIM(@voucher_code)) <> ''
        BEGIN
            DECLARE @disc_pct DECIMAL(5,2), @min_val DECIMAL(18,2), @max_disc DECIMAL(18,2),
                    @exp_at DATETIME2, @usage_limit INT, @used_count INT;

            SELECT 
                @disc_pct = discount_percent,
                @min_val = min_order_value,
                @max_disc = max_discount,
                @exp_at = expired_at,
                @usage_limit = usage_limit,
                @used_count = used_count
            FROM dbo.Vouchers WITH (UPDLOCK, ROWLOCK)
            WHERE voucher_code = @voucher_code;

            IF @disc_pct IS NULL
            BEGIN
                THROW 50003, 'Voucher code does not exist.', 1;
            END

            IF @exp_at < SYSUTCDATETIME()
            BEGIN
                THROW 50003, 'Voucher has expired.', 1;
            END

            IF @used_count >= @usage_limit
            BEGIN
                THROW 50003, 'Voucher usage limit reached.', 1;
            END

            IF @total_amount < @min_val
            BEGIN
                THROW 50003, 'Order does not meet minimum order value for voucher.', 1;
            END

            -- Compute discount and cap at max_discount if specified
            SET @discount_amount = CAST((@total_amount * @disc_pct / 100.00) AS DECIMAL(18,2));
            IF @max_disc IS NOT NULL AND @discount_amount > @max_disc
                SET @discount_amount = @max_disc;

            -- Atomic voucher usage increment
            UPDATE dbo.Vouchers
            SET used_count = used_count + 1
            WHERE voucher_code = @voucher_code AND used_count < usage_limit;

            IF @@ROWCOUNT = 0
            BEGIN
                THROW 50003, 'Voucher usage limit reached during concurrent checkout.', 1;
            END
        END

        -- 6. Calculate Net Final Amount
        DECLARE @final_amount DECIMAL(18,2) = @total_amount - @discount_amount;
        IF @final_amount < 0.00
            SET @final_amount = 0.00;

        -- 7. Atomically verify and decrement inventory in Products
        UPDATE p
        SET p.stock_quantity = p.stock_quantity - item.quantity,
            p.sold_quantity = p.sold_quantity + item.quantity,
            p.updated_at = SYSUTCDATETIME()
        FROM dbo.Products p
        JOIN #CheckoutItems item ON p.product_id = item.product_id
        WHERE p.product_id = item.product_id
          AND p.stock_quantity >= item.quantity;

        -- If any item had insufficient stock, @@ROWCOUNT will not match number of line items
        IF @@ROWCOUNT <> (SELECT COUNT(*) FROM #CheckoutItems)
        BEGIN
            THROW 50003, 'Insufficient stock', 1;
        END

        -- 8. Insert Master Order Record
        INSERT INTO dbo.Orders (
            buyer_id, seller_id, total_amount, discount_amount, final_amount,
            order_status, shipping_address, payment_method, created_at, updated_at
        )
        VALUES (
            @buyer_id, @seller_id, @total_amount, @discount_amount, @final_amount,
            'pending', @shipping_address, @payment_method, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
        SET @new_order_id = SCOPE_IDENTITY();

        -- 9. Insert Order Line Items into Order_Details
        INSERT INTO dbo.Order_Details (order_id, product_id, quantity, unit_price, subtotal)
        SELECT @new_order_id, product_id, quantity, unit_price, subtotal
        FROM #CheckoutItems;

        -- 10. Clear purchased items from Cart_Items
        DELETE ci
        FROM dbo.Cart_Items ci
        JOIN #CheckoutItems item ON ci.product_id = item.product_id
        WHERE ci.user_id = @buyer_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ------------------------------------------------------------------------------
-- 5. sp_GetOrderDetailsJoin (FR-05, Query Type f: Multi-table JOIN)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetOrderDetailsJoin]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetOrderDetailsJoin
    @order_id INT,
    @user_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Optional Authorization Check
    IF @user_id IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM dbo.Orders o
            JOIN dbo.Sellers s ON o.seller_id = s.seller_id
            JOIN dbo.Users u ON u.user_id = @user_id
            WHERE o.order_id = @order_id
              AND (o.buyer_id = @user_id OR s.user_id = @user_id OR u.role = 'admin')
        )
        BEGIN
            THROW 50005, 'Unauthorized: user cannot view this order.', 1;
        END
    END

    -- 5-Table Relational JOIN: Orders JOIN Users JOIN Sellers JOIN Order_Details JOIN Products
    SELECT 
        o.order_id,
        o.order_status,
        o.created_at AS order_date,
        o.total_amount,
        o.discount_amount,
        o.final_amount,
        o.payment_method,
        o.shipping_address,
        u.user_id AS buyer_id,
        u.full_name AS buyer_name,
        u.email AS buyer_email,
        u.phone_number AS buyer_phone,
        s.seller_id,
        s.shop_name,
        s.address AS shop_address,
        od.order_detail_id,
        p.product_id,
        p.name AS product_name,
        od.quantity,
        od.unit_price,
        od.subtotal
    FROM dbo.Orders o
    JOIN dbo.Users u ON o.buyer_id = u.user_id
    JOIN dbo.Sellers s ON o.seller_id = s.seller_id
    JOIN dbo.Order_Details od ON o.order_id = od.order_id
    JOIN dbo.Products p ON od.product_id = p.product_id
    WHERE o.order_id = @order_id
    ORDER BY od.order_detail_id ASC;
END
GO

-- ------------------------------------------------------------------------------
-- 6. sp_CancelOrder (FR-05, Query Type c: Atomic Cancellation & Stock Replenishment)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_CancelOrder]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_CancelOrder
    @order_id INT,
    @buyer_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @status NVARCHAR(30), @order_buyer INT;
        SELECT @status = order_status, @order_buyer = buyer_id
        FROM dbo.Orders WITH (UPDLOCK, ROWLOCK)
        WHERE order_id = @order_id;

        IF @status IS NULL
        BEGIN
            THROW 50004, 'Order not found.', 1;
        END

        IF @order_buyer <> @buyer_id
        BEGIN
            THROW 50005, 'Unauthorized: order belongs to another buyer.', 1;
        END

        -- Enforce cancellation guard: only permitted in 'pending' or 'processing' states
        IF @status IN ('shipped', 'delivered')
        BEGIN
            THROW 50004, 'Cannot cancel order in shipping or delivered state', 1;
        END

        IF @status = 'cancelled'
        BEGIN
            THROW 50004, 'Order is already cancelled.', 1;
        END

        IF @status NOT IN ('pending', 'processing')
        BEGIN
            THROW 50004, 'Order cannot be cancelled in current status.', 1;
        END

        -- Atomically update order status
        UPDATE dbo.Orders
        SET order_status = 'cancelled',
            updated_at = SYSUTCDATETIME()
        WHERE order_id = @order_id;

        -- Atomically restore inventory stock and reduce sold quantity for all line items
        UPDATE p
        SET p.stock_quantity = p.stock_quantity + od.quantity,
            p.sold_quantity = CASE WHEN p.sold_quantity >= od.quantity THEN p.sold_quantity - od.quantity ELSE 0 END,
            p.updated_at = SYSUTCDATETIME()
        FROM dbo.Products p
        JOIN dbo.Order_Details od ON p.product_id = od.product_id
        WHERE od.order_id = @order_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ------------------------------------------------------------------------------
-- 7. sp_AddReview (FR-06, Query Type a: Insert Customer Review)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_AddReview]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_AddReview
    @user_id INT,
    @order_detail_id INT,
    @rating INT,
    @comment NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validate rating bounds
        IF @rating < 1 OR @rating > 5
        BEGIN
            THROW 50006, 'Rating must be between 1 and 5.', 1;
        END

        DECLARE @prod_id INT, @order_buyer INT, @status NVARCHAR(30), @seller_id INT;
        SELECT 
            @prod_id = od.product_id,
            @order_buyer = o.buyer_id,
            @status = o.order_status,
            @seller_id = o.seller_id
        FROM dbo.Order_Details od
        JOIN dbo.Orders o ON od.order_id = o.order_id
        WHERE od.order_detail_id = @order_detail_id;

        IF @prod_id IS NULL
        BEGIN
            THROW 50006, 'Order detail line item not found.', 1;
        END

        IF @order_buyer <> @user_id
        BEGIN
            THROW 50005, 'Unauthorized: user did not purchase this item.', 1;
        END

        -- Review allowed only after order reaches delivered status
        IF @status <> 'delivered'
        BEGIN
            THROW 50006, 'Order item not yet delivered', 1;
        END

        -- Prevent duplicate review submissions
        IF EXISTS (SELECT 1 FROM dbo.Reviews WHERE order_detail_id = @order_detail_id)
        BEGIN
            THROW 50006, 'Review already submitted for this order item.', 1;
        END

        IF EXISTS (SELECT 1 FROM dbo.Reviews WHERE user_id = @user_id AND product_id = @prod_id)
        BEGIN
            THROW 50006, 'User has already reviewed this product.', 1;
        END

        -- Insert new review
        INSERT INTO dbo.Reviews (order_detail_id, user_id, product_id, rating, comment, created_at)
        VALUES (@order_detail_id, @user_id, @prod_id, @rating, @comment, SYSUTCDATETIME());

        -- Recalculate and update seller composite rating
        UPDATE s
        SET s.rating = CAST(avg_calc.avg_rating AS DECIMAL(3,2)),
            s.updated_at = SYSUTCDATETIME()
        FROM dbo.Sellers s
        CROSS APPLY (
            SELECT ISNULL(AVG(CAST(r.rating AS DECIMAL(5,2))), 5.00) AS avg_rating
            FROM dbo.Reviews r
            JOIN dbo.Products p ON r.product_id = p.product_id
            WHERE p.seller_id = @seller_id
        ) avg_calc
        WHERE s.seller_id = @seller_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ------------------------------------------------------------------------------
-- 8. sp_GetProductRatingStats (FR-06, Query Type h: Review Aggregation)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetProductRatingStats]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetProductRatingStats
    @product_id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        p.product_id,
        p.name AS product_name,
        COUNT(r.review_id) AS review_count,
        ISNULL(AVG(CAST(r.rating AS DECIMAL(3,2))), 0.00) AS avg_rating,
        SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star_count,
        SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star_count,
        SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star_count,
        SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star_count,
        SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star_count
    FROM dbo.Products p
    LEFT JOIN dbo.Reviews r ON p.product_id = r.product_id
    WHERE p.product_id = @product_id
    GROUP BY p.product_id, p.name;
END
GO

-- ==============================================================================
-- SECTION 2: SELLER FUNCTIONALITIES (FR-07 through FR-10)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 9. sp_UpsertProduct (FR-07, Query Types a & c: Product Catalog Upsertion)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_UpsertProduct]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_UpsertProduct
    @seller_id INT,
    @product_id INT = NULL OUTPUT,
    @category_id INT,
    @name NVARCHAR(200),
    @description NVARCHAR(MAX) = NULL,
    @price DECIMAL(18,2),
    @stock_quantity INT = 0,
    @status NVARCHAR(20) = 'active'
AS
BEGIN
    SET NOCOUNT ON;

    -- Validate Seller
    IF NOT EXISTS (SELECT 1 FROM dbo.Sellers WHERE seller_id = @seller_id AND is_approved = 1)
    BEGIN
        THROW 50007, 'Seller not found or not approved.', 1;
    END

    -- Validate Category
    IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE category_id = @category_id)
    BEGIN
        THROW 50007, 'Category does not exist.', 1;
    END

    -- Validate numeric bounds
    IF @price < 0.00
    BEGIN
        THROW 50007, 'Product price cannot be negative.', 1;
    END

    IF @stock_quantity < 0
    BEGIN
        THROW 50007, 'Stock quantity cannot be negative.', 1;
    END

    IF @status NOT IN ('active', 'inactive', 'out_of_stock')
    BEGIN
        SET @status = 'active';
    END

    IF @product_id IS NULL
    BEGIN
        -- Insert new product
        INSERT INTO dbo.Products (
            seller_id, category_id, name, description, price, stock_quantity, sold_quantity, is_active, status, created_at, updated_at
        )
        VALUES (
            @seller_id, @category_id, @name, @description, @price, @stock_quantity, 0, 1, @status, SYSUTCDATETIME(), SYSUTCDATETIME()
        );
        SET @product_id = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        -- Verify seller ownership before update
        IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE product_id = @product_id AND seller_id = @seller_id)
        BEGIN
            THROW 50007, 'Product not found or seller mismatch.', 1;
        END

        UPDATE dbo.Products
        SET category_id = @category_id,
            name = @name,
            description = @description,
            price = @price,
            stock_quantity = @stock_quantity,
            status = @status,
            updated_at = SYSUTCDATETIME()
        WHERE product_id = @product_id AND seller_id = @seller_id;
    END
END
GO

-- ------------------------------------------------------------------------------
-- 10. sp_AdjustInventory (FR-08, Query Type c: Atomic Inventory Adjustment)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_AdjustInventory]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_AdjustInventory
    @seller_id INT,
    @product_id INT,
    @stock_delta INT,
    @low_stock_threshold INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE product_id = @product_id AND seller_id = @seller_id)
    BEGIN
        THROW 50007, 'Product not found or unauthorized seller.', 1;
    END

    -- Atomically update inventory guarded against negative stock
    UPDATE dbo.Products
    SET stock_quantity = stock_quantity + @stock_delta,
        status = CASE 
            WHEN (stock_quantity + @stock_delta) = 0 THEN 'out_of_stock'
            WHEN status = 'out_of_stock' AND (stock_quantity + @stock_delta) > 0 THEN 'active'
            ELSE status 
        END,
        updated_at = SYSUTCDATETIME()
    WHERE product_id = @product_id
      AND seller_id = @seller_id
      AND (stock_quantity + @stock_delta) >= 0;

    IF @@ROWCOUNT = 0
    BEGIN
        THROW 50002, 'Inventory adjustment would result in negative stock quantity.', 1;
    END

    -- Return updated inventory status & low-stock indicator
    SELECT 
        product_id,
        name,
        stock_quantity,
        status,
        is_low_stock = CASE WHEN stock_quantity <= @low_stock_threshold THEN 1 ELSE 0 END
    FROM dbo.Products
    WHERE product_id = @product_id;
END
GO

-- ------------------------------------------------------------------------------
-- 11. sp_UpdateOrderFulfillment (FR-09, Query Type c: Monotonic Order Progression)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_UpdateOrderFulfillment]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_UpdateOrderFulfillment
    @seller_id INT,
    @order_id INT,
    @new_status NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    -- Retrieve current status with lock
    DECLARE @current_status NVARCHAR(30);
    SELECT @current_status = order_status
    FROM dbo.Orders WITH (UPDLOCK, ROWLOCK)
    WHERE order_id = @order_id AND seller_id = @seller_id;

    IF @current_status IS NULL
    BEGIN
        THROW 50009, 'Order not found or shop mismatch.', 1;
    END

    -- Enforce STRICT MONOTONIC FORWARD TRANSITIONS:
    -- 'pending' -> 'processing'
    -- 'processing' -> 'shipped'
    -- 'shipped' -> 'delivered'
    IF NOT (
        (@current_status = 'pending' AND @new_status = 'processing') OR
        (@current_status = 'processing' AND @new_status = 'shipped') OR
        (@current_status = 'shipped' AND @new_status = 'delivered')
    )
    BEGIN
        THROW 50008, 'Illegal order state transition', 1;
    END

    UPDATE dbo.Orders
    SET order_status = @new_status,
        updated_at = SYSUTCDATETIME()
    WHERE order_id = @order_id AND seller_id = @seller_id;
END
GO

-- ------------------------------------------------------------------------------
-- 12. sp_GetSellerOrders (FR-09, Query Type f: Seller Shop Orders Multi-table JOIN)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetSellerOrders]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetSellerOrders
    @seller_id INT,
    @status NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        o.order_id,
        o.order_status,
        o.created_at AS order_date,
        o.total_amount,
        o.discount_amount,
        o.final_amount,
        o.payment_method,
        o.shipping_address,
        u.user_id AS buyer_id,
        u.full_name AS buyer_name,
        u.phone_number AS buyer_phone,
        u.email AS buyer_email,
        od.order_detail_id,
        p.product_id,
        p.name AS product_name,
        od.quantity,
        od.unit_price,
        od.subtotal
    FROM dbo.Orders o
    JOIN dbo.Users u ON o.buyer_id = u.user_id
    JOIN dbo.Order_Details od ON o.order_id = od.order_id
    JOIN dbo.Products p ON od.product_id = p.product_id
    WHERE o.seller_id = @seller_id
      AND (@status IS NULL OR o.order_status = @status)
    ORDER BY o.created_at DESC, o.order_id DESC, od.order_detail_id ASC;
END
GO

-- ------------------------------------------------------------------------------
-- 13. sp_GetSellerAnalytics (FR-10, Query Type h: Seller Analytics Aggregation)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetSellerAnalytics]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetSellerAnalytics
    @seller_id INT,
    @start_date DATETIME2 = NULL,
    @end_date DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Result Set 1: High-level Revenue, Order Count, and Volume Overview
    SELECT 
        s.seller_id,
        s.shop_name,
        ISNULL(SUM(o.final_amount), 0.00) AS total_revenue,
        COUNT(DISTINCT o.order_id) AS completed_order_count,
        ISNULL(SUM(od.quantity), 0) AS total_items_sold
    FROM dbo.Sellers s
    LEFT JOIN dbo.Orders o ON s.seller_id = o.seller_id 
        AND o.order_status = 'delivered'
        AND (@start_date IS NULL OR o.created_at >= @start_date)
        AND (@end_date IS NULL OR o.created_at <= @end_date)
    LEFT JOIN dbo.Order_Details od ON o.order_id = od.order_id
    WHERE s.seller_id = @seller_id
    GROUP BY s.seller_id, s.shop_name;

    -- Result Set 2: Top 5 Best-Selling Products by Quantity & Revenue
    SELECT TOP 5
        p.product_id,
        p.name AS product_name,
        SUM(od.quantity) AS total_sold_quantity,
        SUM(od.subtotal) AS total_revenue
    FROM dbo.Order_Details od
    JOIN dbo.Orders o ON od.order_id = o.order_id
    JOIN dbo.Products p ON od.product_id = p.product_id
    WHERE o.seller_id = @seller_id
      AND o.order_status = 'delivered'
      AND (@start_date IS NULL OR o.created_at >= @start_date)
      AND (@end_date IS NULL OR o.created_at <= @end_date)
    GROUP BY p.product_id, p.name
    ORDER BY SUM(od.quantity) DESC, total_revenue DESC;
END
GO

-- ==============================================================================
-- SECTION 3: ADMIN FUNCTIONALITIES (FR-11 through FR-12)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 14. sp_ModerateUserAccount (FR-11, Query Type c: Admin User & Product Moderation)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_ModerateUserAccount]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_ModerateUserAccount
    @admin_id INT,
    @target_user_id INT,
    @is_active BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verify Admin role authorization
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @admin_id AND role = 'admin' AND is_active = 1)
        BEGIN
            THROW 50010, 'Access denied: Administrator privileges required.', 1;
        END

        -- Verify target user existence
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @target_user_id)
        BEGIN
            THROW 50010, 'Target user does not exist.', 1;
        END

        -- Update user active status
        UPDATE dbo.Users
        SET is_active = @is_active,
            updated_at = SYSUTCDATETIME()
        WHERE user_id = @target_user_id;

        -- If deactivating an account associated with a seller, automatically deactivate all their products
        IF @is_active = 0
        BEGIN
            UPDATE dbo.Products
            SET is_active = 0,
                status = 'inactive',
                updated_at = SYSUTCDATETIME()
            WHERE seller_id IN (SELECT seller_id FROM dbo.Sellers WHERE user_id = @target_user_id);
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ------------------------------------------------------------------------------
-- 15. sp_ApproveSeller (FR-11, Query Type c: Admin Seller Approval)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_ApproveSeller]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_ApproveSeller
    @admin_id INT,
    @seller_id INT,
    @is_approved BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- Verify Admin role authorization
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @admin_id AND role = 'admin' AND is_active = 1)
    BEGIN
        THROW 50010, 'Access denied: Administrator privileges required.', 1;
    END

    -- Verify seller existence
    IF NOT EXISTS (SELECT 1 FROM dbo.Sellers WHERE seller_id = @seller_id)
    BEGIN
        THROW 50010, 'Seller not found.', 1;
    END

    UPDATE dbo.Sellers
    SET is_approved = @is_approved,
        updated_at = SYSUTCDATETIME()
    WHERE seller_id = @seller_id;
END
GO

-- ------------------------------------------------------------------------------
-- 16. sp_GetAboveAverageSellers (FR-12, Query Types g & h: Subquery & Aggregation BI)
-- ------------------------------------------------------------------------------
PRINT 'Creating/altering Stored Procedure [dbo.sp_GetAboveAverageSellers]...';
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetAboveAverageSellers
    @admin_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Optional Admin role authorization
    IF @admin_id IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE user_id = @admin_id AND role = 'admin' AND is_active = 1)
        BEGIN
            THROW 50010, 'Access denied: Administrator privileges required.', 1;
        END
    END

    -- Query sellers whose total sales revenue on delivered orders exceeds the average seller revenue across the platform
    SELECT 
        s.seller_id,
        s.shop_name,
        SUM(o.final_amount) AS delivered_revenue,
        COUNT(o.order_id) AS delivered_order_count
    FROM dbo.Orders o
    JOIN dbo.Sellers s ON o.seller_id = s.seller_id
    WHERE o.order_status = 'delivered'
    GROUP BY s.seller_id, s.shop_name
    HAVING SUM(o.final_amount) > (
        SELECT AVG(shop_rev)
        FROM (
            SELECT SUM(final_amount) AS shop_rev
            FROM dbo.Orders
            WHERE order_status = 'delivered'
            GROUP BY seller_id
        ) AS avg_tab
    )
    ORDER BY delivered_revenue DESC;
END
GO

PRINT '==============================================================================';
PRINT '04_procedures_fr.sql executed successfully: All 16 Stored Procedures ready.';
PRINT '==============================================================================';
GO
