-- ==============================================================================
-- 01_schema.sql: Database Initialization & 9-Table Schema for E-Commerce Platform
-- Milestone 1: Multi-Vendor E-Commerce Platform (SQL Server 2022)
-- Strict Alignment with docs/project.md §IV and Downstream Stored Procedures
-- ==============================================================================

USE master;
GO

-- 1. Create Database if not exists (Idempotent)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ECommerceDB')
BEGIN
    PRINT 'Creating database [ECommerceDB]...';
    CREATE DATABASE [ECommerceDB];
END
ELSE
BEGIN
    PRINT 'Database [ECommerceDB] already exists.';
END
GO

-- 2. Configure Database Recovery & Integrity Options (Mandatory for WAL / PITR)
PRINT 'Configuring database recovery model and integrity options...';
ALTER DATABASE [ECommerceDB] SET RECOVERY FULL;
ALTER DATABASE [ECommerceDB] SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE [ECommerceDB] SET TARGET_RECOVERY_TIME = 60 SECONDS;
GO

USE [ECommerceDB];
GO

-- ==============================================================================
-- 3. Core Tables Definition (Docs Project §IV)
-- ==============================================================================

-- 3.1. Users Table (FR-11 sp_ModerateUserAccount)
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Users]...';
    CREATE TABLE dbo.Users (
        user_id INT IDENTITY(1,1) NOT NULL,
        username NVARCHAR(50) NOT NULL,
        email NVARCHAR(100) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(100) NOT NULL,
        phone_number NVARCHAR(20) NULL,
        address NVARCHAR(255) NULL,
        role NVARCHAR(20) NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT 1,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Users_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_Users_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (user_id),
        CONSTRAINT UQ_Users_username UNIQUE (username),
        CONSTRAINT UQ_Users_email UNIQUE (email),
        CONSTRAINT CK_Users_role CHECK (role IN ('buyer', 'seller', 'admin'))
    );
END
GO

-- 3.2. Sellers Table (Query f, sp_GetOrderDetailsJoin, FR-11 sp_ApproveSeller)
IF OBJECT_ID(N'dbo.Sellers', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Sellers]...';
    CREATE TABLE dbo.Sellers (
        seller_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NOT NULL,
        shop_name NVARCHAR(100) NOT NULL,
        store_description NVARCHAR(MAX) NULL,
        rating DECIMAL(3,2) NOT NULL CONSTRAINT DF_Sellers_rating DEFAULT 5.00,
        is_approved BIT NOT NULL CONSTRAINT DF_Sellers_is_approved DEFAULT 1,
        address NVARCHAR(255) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Sellers_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_Sellers_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Sellers PRIMARY KEY CLUSTERED (seller_id),
        CONSTRAINT UQ_Sellers_user_id UNIQUE (user_id),
        CONSTRAINT UQ_Sellers_shop_name UNIQUE (shop_name),
        CONSTRAINT FK_Sellers_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        CONSTRAINT CK_Sellers_rating CHECK (rating >= 0.00 AND rating <= 5.00)
    );
END
GO

-- 3.3. Categories Table (Self-referencing for hierarchical categories)
IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Categories]...';
    CREATE TABLE dbo.Categories (
        category_id INT IDENTITY(1,1) NOT NULL,
        category_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        parent_id INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Categories_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Categories PRIMARY KEY CLUSTERED (category_id),
        CONSTRAINT UQ_Categories_category_name UNIQUE (category_name),
        CONSTRAINT FK_Categories_Parent FOREIGN KEY (parent_id) REFERENCES dbo.Categories(category_id)
    );
END
GO

-- 3.4. Products Table (FR-01, FR-10 top sellers, Query e)
IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Products]...';
    CREATE TABLE dbo.Products (
        product_id INT IDENTITY(1,1) NOT NULL,
        seller_id INT NOT NULL,
        category_id INT NOT NULL,
        name NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NULL,
        price DECIMAL(18,2) NOT NULL,
        stock_quantity INT NOT NULL CONSTRAINT DF_Products_stock DEFAULT 0,
        sold_quantity INT NOT NULL CONSTRAINT DF_Products_sold_quantity DEFAULT 0,
        is_active BIT NOT NULL CONSTRAINT DF_Products_is_active DEFAULT 1,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_Products_status DEFAULT 'active',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Products_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_Products_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Products PRIMARY KEY CLUSTERED (product_id),
        CONSTRAINT FK_Products_Sellers FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id),
        CONSTRAINT FK_Products_Categories FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id),
        CONSTRAINT CK_Products_price CHECK (price >= 0.00),
        CONSTRAINT CK_Products_stock CHECK (stock_quantity >= 0),
        CONSTRAINT CK_Products_sold_quantity CHECK (sold_quantity >= 0),
        CONSTRAINT CK_Products_status CHECK (status IN ('active', 'inactive', 'out_of_stock'))
    );
END
GO

-- 3.5. Cart_Items Table
IF OBJECT_ID(N'dbo.Cart_Items', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Cart_Items]...';
    CREATE TABLE dbo.Cart_Items (
        cart_item_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL CONSTRAINT DF_Cart_Items_quantity DEFAULT 1,
        added_at DATETIME2 NOT NULL CONSTRAINT DF_Cart_Items_added_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Cart_Items PRIMARY KEY CLUSTERED (cart_item_id),
        CONSTRAINT UQ_Cart_Items_User_Product UNIQUE (user_id, product_id),
        CONSTRAINT FK_Cart_Items_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_Cart_Items_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id),
        CONSTRAINT CK_Cart_Items_quantity CHECK (quantity > 0)
    );
END
GO

-- 3.6. Orders Table (Query f, Query g, FR-04, FR-05, FR-09)
IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Orders]...';
    CREATE TABLE dbo.Orders (
        order_id INT IDENTITY(1,1) NOT NULL,
        buyer_id INT NOT NULL,
        seller_id INT NOT NULL,
        total_amount DECIMAL(18,2) NOT NULL,
        discount_amount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_discount_amount DEFAULT 0.00,
        final_amount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_final_amount DEFAULT 0.00,
        order_status NVARCHAR(30) NOT NULL CONSTRAINT DF_Orders_order_status DEFAULT 'pending',
        shipping_address NVARCHAR(255) NOT NULL,
        payment_method NVARCHAR(50) NOT NULL CONSTRAINT DF_Orders_payment DEFAULT 'COD',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Orders_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_Orders_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (order_id),
        CONSTRAINT FK_Orders_Users FOREIGN KEY (buyer_id) REFERENCES dbo.Users(user_id),
        CONSTRAINT FK_Orders_Sellers FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id),
        CONSTRAINT CK_Orders_status CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        CONSTRAINT CK_Orders_payment_method CHECK (payment_method IN ('COD', 'Credit Card', 'Bank Transfer', 'E-Wallet')),
        CONSTRAINT CK_Orders_total CHECK (total_amount >= 0.00),
        CONSTRAINT CK_Orders_discount CHECK (discount_amount >= 0.00),
        CONSTRAINT CK_Orders_final CHECK (final_amount >= 0.00)
    );
END
GO

-- 3.7. Order_Details Table
IF OBJECT_ID(N'dbo.Order_Details', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Order_Details]...';
    CREATE TABLE dbo.Order_Details (
        order_detail_id INT IDENTITY(1,1) NOT NULL,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL CONSTRAINT DF_Order_Details_quantity DEFAULT 1,
        unit_price DECIMAL(18,2) NOT NULL,
        subtotal DECIMAL(18,2) NOT NULL,
        CONSTRAINT PK_Order_Details PRIMARY KEY CLUSTERED (order_detail_id),
        CONSTRAINT UQ_Order_Details_Order_Product UNIQUE (order_id, product_id),
        CONSTRAINT FK_Order_Details_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE,
        CONSTRAINT FK_Order_Details_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id),
        CONSTRAINT CK_Order_Details_quantity CHECK (quantity > 0),
        CONSTRAINT CK_Order_Details_price CHECK (unit_price >= 0.00),
        CONSTRAINT CK_Order_Details_subtotal CHECK (subtotal >= 0.00)
    );
END
GO

-- 3.8. Vouchers Table
IF OBJECT_ID(N'dbo.Vouchers', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Vouchers]...';
    CREATE TABLE dbo.Vouchers (
        voucher_code NVARCHAR(50) NOT NULL,
        discount_percent DECIMAL(5,2) NOT NULL,
        min_order_value DECIMAL(18,2) NOT NULL CONSTRAINT DF_Vouchers_min_order DEFAULT 0.00,
        max_discount DECIMAL(18,2) NULL,
        valid_from DATETIME2 NOT NULL,
        expired_at DATETIME2 NOT NULL,
        usage_limit INT NOT NULL CONSTRAINT DF_Vouchers_usage_limit DEFAULT 100,
        used_count INT NOT NULL CONSTRAINT DF_Vouchers_used_count DEFAULT 0,
        CONSTRAINT PK_Vouchers PRIMARY KEY CLUSTERED (voucher_code),
        CONSTRAINT CK_Vouchers_discount CHECK (discount_percent >= 0.00 AND discount_percent <= 100.00),
        CONSTRAINT CK_Vouchers_max_discount CHECK (max_discount IS NULL OR max_discount >= 0.00),
        CONSTRAINT CK_Vouchers_min_order CHECK (min_order_value >= 0.00),
        CONSTRAINT CK_Vouchers_usage_limit CHECK (usage_limit >= 0),
        CONSTRAINT CK_Vouchers_used_count CHECK (used_count >= 0),
        CONSTRAINT CK_Vouchers_dates CHECK (expired_at >= valid_from),
        CONSTRAINT CK_Vouchers_usage CHECK (used_count <= usage_limit)
    );
END
GO

-- 3.9. Reviews Table
IF OBJECT_ID(N'dbo.Reviews', N'U') IS NULL
BEGIN
    PRINT 'Creating table [dbo.Reviews]...';
    CREATE TABLE dbo.Reviews (
        review_id INT IDENTITY(1,1) NOT NULL,
        order_detail_id INT NULL,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating INT NOT NULL,
        comment NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Reviews_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Reviews PRIMARY KEY CLUSTERED (review_id),
        CONSTRAINT UQ_Reviews_User_Product UNIQUE (user_id, product_id),
        CONSTRAINT FK_Reviews_Order_Details FOREIGN KEY (order_detail_id) REFERENCES dbo.Order_Details(order_detail_id),
        CONSTRAINT FK_Reviews_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id),
        CONSTRAINT FK_Reviews_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id),
        CONSTRAINT CK_Reviews_rating CHECK (rating >= 1 AND rating <= 5)
    );
END
GO

PRINT '01_schema.sql executed successfully.';
GO