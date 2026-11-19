-- ==============================================================================
-- 02_indexes.sql: Performance & Covering Indexes for E-Commerce Platform
-- Milestone 1: Multi-Vendor E-Commerce Platform (SQL Server 2022)
-- ==============================================================================

USE [ECommerceDB];
GO

PRINT 'Creating performance and covering indexes on [ECommerceDB]...';

-- ==============================================================================
-- 1. Indexes on Products Table
-- ==============================================================================

-- 1.1. Products(seller_id): Accelerates Seller product listing and seller analytics
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_seller_id')
BEGIN
    PRINT 'Creating index [IX_Products_seller_id]...';
    CREATE NONCLUSTERED INDEX IX_Products_seller_id 
    ON dbo.Products (seller_id)
    INCLUDE (name, price, stock_quantity, status, is_active, sold_quantity);
END
ELSE
BEGIN
    PRINT 'Index [IX_Products_seller_id] already exists.';
END
GO

-- 1.2. Products(category_id): Accelerates Category browsing and hierarchy navigation
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_category_id')
BEGIN
    PRINT 'Creating index [IX_Products_category_id]...';
    CREATE NONCLUSTERED INDEX IX_Products_category_id 
    ON dbo.Products (category_id)
    INCLUDE (name, price, stock_quantity, status, is_active, sold_quantity);
END
ELSE
BEGIN
    PRINT 'Index [IX_Products_category_id] already exists.';
END
GO

-- 1.3. Products(status, price): Composite index for catalog filtering (FR-01, Query e)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Products') AND name = N'IX_Products_status_price')
BEGIN
    PRINT 'Creating index [IX_Products_status_price]...';
    CREATE NONCLUSTERED INDEX IX_Products_status_price 
    ON dbo.Products (status, price)
    INCLUDE (name, seller_id, category_id, is_active, sold_quantity);
END
ELSE
BEGIN
    PRINT 'Index [IX_Products_status_price] already exists.';
END
GO

-- ==============================================================================
-- 2. Indexes on Orders Table
-- ==============================================================================

-- 2.1. Orders(seller_id): Accelerates Seller order lookup and revenue queries (FR-09, Query f, Query g)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'IX_Orders_seller_id')
BEGIN
    PRINT 'Creating index [IX_Orders_seller_id]...';
    CREATE NONCLUSTERED INDEX IX_Orders_seller_id 
    ON dbo.Orders (seller_id)
    INCLUDE (order_status, total_amount, final_amount, created_at);
END
ELSE
BEGIN
    PRINT 'Index [IX_Orders_seller_id] already exists.';
END
GO

-- 2.2. Orders(buyer_id, created_at): Accelerates Buyer order history (FR-05)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'IX_Orders_buyer_id_created_at')
BEGIN
    PRINT 'Creating index [IX_Orders_buyer_id_created_at]...';
    CREATE NONCLUSTERED INDEX IX_Orders_buyer_id_created_at 
    ON dbo.Orders (buyer_id, created_at DESC)
    INCLUDE (seller_id, total_amount, discount_amount, final_amount, order_status, payment_method);
END
ELSE
BEGIN
    PRINT 'Index [IX_Orders_buyer_id_created_at] already exists.';
END
GO

-- 2.3. Orders(order_status): Accelerates Admin and Seller order fulfillment workflows (FR-09)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'IX_Orders_order_status')
BEGIN
    PRINT 'Creating index [IX_Orders_order_status]...';
    CREATE NONCLUSTERED INDEX IX_Orders_order_status 
    ON dbo.Orders (order_status)
    INCLUDE (seller_id, buyer_id, total_amount, final_amount, created_at);
END
ELSE
BEGIN
    PRINT 'Index [IX_Orders_order_status] already exists.';
END
GO

-- ==============================================================================
-- 3. Indexes on Order_Details Table
-- ==============================================================================

-- 3.1. Order_Details(order_id): Accelerates Order detail lookup and invoice generation
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Order_Details') AND name = N'IX_Order_Details_order_id')
BEGIN
    PRINT 'Creating index [IX_Order_Details_order_id]...';
    CREATE NONCLUSTERED INDEX IX_Order_Details_order_id 
    ON dbo.Order_Details (order_id)
    INCLUDE (product_id, quantity, unit_price, subtotal);
END
ELSE
BEGIN
    PRINT 'Index [IX_Order_Details_order_id] already exists.';
END
GO

-- 3.2. Order_Details(product_id): Accelerates Product sales aggregation and Top-sellers reporting (FR-10)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Order_Details') AND name = N'IX_Order_Details_product_id')
BEGIN
    PRINT 'Creating index [IX_Order_Details_product_id]...';
    CREATE NONCLUSTERED INDEX IX_Order_Details_product_id 
    ON dbo.Order_Details (product_id)
    INCLUDE (quantity, unit_price, subtotal);
END
ELSE
BEGIN
    PRINT 'Index [IX_Order_Details_product_id] already exists.';
END
GO

-- ==============================================================================
-- 4. Indexes on Reviews Table
-- ==============================================================================

-- 4.1. Reviews(product_id, rating): Composite index for product review aggregation (FR-06, FR-10)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Reviews') AND name = N'IX_Reviews_product_id_rating')
BEGIN
    PRINT 'Creating index [IX_Reviews_product_id_rating]...';
    CREATE NONCLUSTERED INDEX IX_Reviews_product_id_rating 
    ON dbo.Reviews (product_id, rating)
    INCLUDE (order_detail_id, comment, created_at);
END
ELSE
BEGIN
    PRINT 'Index [IX_Reviews_product_id_rating] already exists.';
END
GO

-- 4.2. Reviews(user_id): Accelerates Buyer profile reviews history
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Reviews') AND name = N'IX_Reviews_user_id')
BEGIN
    PRINT 'Creating index [IX_Reviews_user_id]...';
    CREATE NONCLUSTERED INDEX IX_Reviews_user_id 
    ON dbo.Reviews (user_id)
    INCLUDE (order_detail_id, product_id, rating, created_at);
END
ELSE
BEGIN
    PRINT 'Index [IX_Reviews_user_id] already exists.';
END
GO

PRINT '02_indexes.sql executed successfully.';
GO