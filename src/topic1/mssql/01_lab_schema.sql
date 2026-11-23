-- ==============================================================================
-- 01_lab_schema.sql: Topic 1 Storage & Schema Design Lab (MS SQL Server 2025)
-- Isolated in dedicated database [Topic1_StorageLab] so [ECommerceDB] is untouched.
-- Models:
--   M1           : EAV (T1_Attributes + T1_Variants_EAV + T1_Variant_Attr_Values)
--   M1_PageComp  : EAV with DATA_COMPRESSION = PAGE on attribute values
--   M2a          : Hybrid JSON using NVARCHAR(MAX) + CHECK (ISJSON(attributes)=1)
--   M2b          : Native `json` data type (SQL Server 2025)
--   M3           : Wide Table with SPARSE NULL columns
--   WideNoSparse : Control Wide Table (identical columns without SPARSE)
-- ==============================================================================

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'Topic1_StorageLab')
BEGIN
    PRINT 'Creating database [Topic1_StorageLab]...';
    CREATE DATABASE [Topic1_StorageLab];
END
GO

ALTER DATABASE [Topic1_StorageLab] SET RECOVERY SIMPLE;
ALTER DATABASE [Topic1_StorageLab] SET PAGE_VERIFY CHECKSUM;
GO

USE [Topic1_StorageLab];
GO

-- Clean drop in reverse dependency order for deterministic re-runs
IF OBJECT_ID(N'dbo.T1_Variant_Attr_Values_PageComp', N'U') IS NOT NULL DROP TABLE dbo.T1_Variant_Attr_Values_PageComp;
IF OBJECT_ID(N'dbo.T1_Variant_Attr_Values', N'U') IS NOT NULL DROP TABLE dbo.T1_Variant_Attr_Values;
IF OBJECT_ID(N'dbo.T1_Variants_EAV', N'U') IS NOT NULL DROP TABLE dbo.T1_Variants_EAV;
IF OBJECT_ID(N'dbo.T1_Attributes', N'U') IS NOT NULL DROP TABLE dbo.T1_Attributes;
IF OBJECT_ID(N'dbo.T1_Variants_JsonText', N'U') IS NOT NULL DROP TABLE dbo.T1_Variants_JsonText;
IF OBJECT_ID(N'dbo.T1_Variants_JsonNative', N'U') IS NOT NULL DROP TABLE dbo.T1_Variants_JsonNative;
IF OBJECT_ID(N'dbo.T1_Variants_Sparse', N'U') IS NOT NULL DROP TABLE dbo.T1_Variants_Sparse;
IF OBJECT_ID(N'dbo.T1_Variants_WideNoSparse', N'U') IS NOT NULL DROP TABLE dbo.T1_Variants_WideNoSparse;
IF OBJECT_ID(N'dbo.T1_Products', N'U') IS NOT NULL DROP TABLE dbo.T1_Products;
GO

-- Shared Product anchor (10,000 products across 5 categories)
IF OBJECT_ID(N'dbo.T1_Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Products (
        product_id    INT            NOT NULL,
        category_name NVARCHAR(30)   NOT NULL,
        product_name  NVARCHAR(120)  NOT NULL,
        base_price    DECIMAL(18, 2) NOT NULL,
        CONSTRAINT PK_T1_Products PRIMARY KEY CLUSTERED (product_id)
    );
END
GO

-- ==============================================================================
-- M1 & M1_PageComp: Entity-Attribute-Value (EAV)
-- ==============================================================================
IF OBJECT_ID(N'dbo.T1_Attributes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Attributes (
        attr_id   INT IDENTITY(1,1) NOT NULL,
        attr_name NVARCHAR(50)      NOT NULL,
        data_type NVARCHAR(20)      NOT NULL,
        CONSTRAINT PK_T1_Attributes PRIMARY KEY CLUSTERED (attr_id),
        CONSTRAINT UQ_T1_Attributes_name UNIQUE (attr_name)
    );
END
GO

IF OBJECT_ID(N'dbo.T1_Variants_EAV', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variants_EAV (
        variant_id INT            NOT NULL,
        product_id INT            NOT NULL,
        sku        NVARCHAR(40)   NOT NULL,
        price      DECIMAL(18, 2) NOT NULL,
        stock_qty  INT            NOT NULL,
        CONSTRAINT PK_T1_Variants_EAV PRIMARY KEY CLUSTERED (variant_id),
        CONSTRAINT FK_T1_Variants_EAV_Prod FOREIGN KEY (product_id) REFERENCES dbo.T1_Products(product_id)
    );
END
GO

IF OBJECT_ID(N'dbo.T1_Variant_Attr_Values', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variant_Attr_Values (
        variant_id INT           NOT NULL,
        attr_id    INT           NOT NULL,
        attr_value NVARCHAR(200) NOT NULL,
        CONSTRAINT PK_T1_Variant_Attr_Values PRIMARY KEY CLUSTERED (variant_id, attr_id),
        CONSTRAINT FK_T1_EAV_Var  FOREIGN KEY (variant_id) REFERENCES dbo.T1_Variants_EAV(variant_id),
        CONSTRAINT FK_T1_EAV_Attr FOREIGN KEY (attr_id)    REFERENCES dbo.T1_Attributes(attr_id)
    );

    CREATE NONCLUSTERED INDEX IX_T1_EAV_AttrVal
    ON dbo.T1_Variant_Attr_Values (attr_id, attr_value);
END
GO

IF OBJECT_ID(N'dbo.T1_Variant_Attr_Values_PageComp', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variant_Attr_Values_PageComp (
        variant_id INT           NOT NULL,
        attr_id    INT           NOT NULL,
        attr_value NVARCHAR(200) NOT NULL,
        CONSTRAINT PK_T1_Variant_Attr_Values_PageComp PRIMARY KEY CLUSTERED (variant_id, attr_id)
            WITH (DATA_COMPRESSION = PAGE),
        CONSTRAINT FK_T1_EAV_PC_Var  FOREIGN KEY (variant_id) REFERENCES dbo.T1_Variants_EAV(variant_id),
        CONSTRAINT FK_T1_EAV_PC_Attr FOREIGN KEY (attr_id)    REFERENCES dbo.T1_Attributes(attr_id)
    );

    CREATE NONCLUSTERED INDEX IX_T1_EAV_PageComp_AttrVal
    ON dbo.T1_Variant_Attr_Values_PageComp (attr_id, attr_value)
    WITH (DATA_COMPRESSION = PAGE);
END
GO

-- ==============================================================================
-- M2a: Hybrid Relational + NVARCHAR(MAX) JSON
-- ==============================================================================
IF OBJECT_ID(N'dbo.T1_Variants_JsonText', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variants_JsonText (
        variant_id    INT            NOT NULL,
        product_id    INT            NOT NULL,
        category_name NVARCHAR(30)   NOT NULL,
        sku           NVARCHAR(40)   NOT NULL,
        price         DECIMAL(18, 2) NOT NULL,
        stock_qty     INT            NOT NULL,
        attributes    NVARCHAR(MAX)  NOT NULL,
        CONSTRAINT PK_T1_Variants_JsonText PRIMARY KEY CLUSTERED (variant_id),
        CONSTRAINT FK_T1_JsonText_Prod FOREIGN KEY (product_id) REFERENCES dbo.T1_Products(product_id),
        CONSTRAINT CK_T1_JsonText_Valid CHECK (ISJSON(attributes) = 1)
    );
END
GO

-- ==============================================================================
-- M2b: Hybrid Relational + Native `json` Type (SQL Server 2025)
-- ==============================================================================
IF OBJECT_ID(N'dbo.T1_Variants_JsonNative', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variants_JsonNative (
        variant_id    INT            NOT NULL,
        product_id    INT            NOT NULL,
        category_name NVARCHAR(30)   NOT NULL,
        sku           NVARCHAR(40)   NOT NULL,
        price         DECIMAL(18, 2) NOT NULL,
        stock_qty     INT            NOT NULL,
        attributes    json           NOT NULL,
        CONSTRAINT PK_T1_Variants_JsonNative PRIMARY KEY CLUSTERED (variant_id),
        CONSTRAINT FK_T1_JsonNative_Prod FOREIGN KEY (product_id) REFERENCES dbo.T1_Products(product_id)
    );
END
GO

-- ==============================================================================
-- M3: Wide Table with SPARSE NULL Columns
-- (`color` is 80% populated so kept non-sparse; 20 category attrs are SPARSE)
-- ==============================================================================
IF OBJECT_ID(N'dbo.T1_Variants_Sparse', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variants_Sparse (
        variant_id      INT            NOT NULL,
        product_id      INT            NOT NULL,
        category_name   NVARCHAR(30)   NOT NULL,
        sku             NVARCHAR(40)   NOT NULL,
        price           DECIMAL(18, 2) NOT NULL,
        stock_qty       INT            NOT NULL,
        color           NVARCHAR(20)   NULL,
        storage_gb      INT            SPARSE NULL,
        ram_gb          INT            SPARSE NULL,
        screen_inch     NVARCHAR(10)   SPARSE NULL,
        chipset         NVARCHAR(40)   SPARSE NULL,
        cpu_model       NVARCHAR(40)   SPARSE NULL,
        gpu_model       NVARCHAR(30)   SPARSE NULL,
        os_name         NVARCHAR(30)   SPARSE NULL,
        apparel_size    NVARCHAR(10)   SPARSE NULL,
        material        NVARCHAR(30)   SPARSE NULL,
        fit_style       NVARCHAR(25)   SPARSE NULL,
        season          NVARCHAR(25)   SPARSE NULL,
        power_watt      INT            SPARSE NULL,
        capacity_liter  NVARCHAR(15)   SPARSE NULL,
        warranty_months INT            SPARSE NULL,
        voltage         NVARCHAR(25)   SPARSE NULL,
        author_name     NVARCHAR(50)   SPARSE NULL,
        publisher       NVARCHAR(40)   SPARSE NULL,
        page_count      INT            SPARSE NULL,
        language        NVARCHAR(25)   SPARSE NULL,
        isbn_note       NVARCHAR(200)  SPARSE NULL,
        CONSTRAINT PK_T1_Variants_Sparse PRIMARY KEY CLUSTERED (variant_id),
        CONSTRAINT FK_T1_Sparse_Prod FOREIGN KEY (product_id) REFERENCES dbo.T1_Products(product_id)
    );
END
GO

-- ==============================================================================
-- Control: Wide Table WITHOUT SPARSE (identical columns to quantify SPARSE savings)
-- ==============================================================================
IF OBJECT_ID(N'dbo.T1_Variants_WideNoSparse', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.T1_Variants_WideNoSparse (
        variant_id      INT            NOT NULL,
        product_id      INT            NOT NULL,
        category_name   NVARCHAR(30)   NOT NULL,
        sku             NVARCHAR(40)   NOT NULL,
        price           DECIMAL(18, 2) NOT NULL,
        stock_qty       INT            NOT NULL,
        color           NVARCHAR(20)   NULL,
        storage_gb      INT            NULL,
        ram_gb          INT            NULL,
        screen_inch     NVARCHAR(10)   NULL,
        chipset         NVARCHAR(40)   NULL,
        cpu_model       NVARCHAR(40)   NULL,
        gpu_model       NVARCHAR(30)   NULL,
        os_name         NVARCHAR(30)   NULL,
        apparel_size    NVARCHAR(10)   NULL,
        material        NVARCHAR(30)   NULL,
        fit_style       NVARCHAR(25)   NULL,
        season          NVARCHAR(25)   NULL,
        power_watt      INT            NULL,
        capacity_liter  NVARCHAR(15)   NULL,
        warranty_months INT            NULL,
        voltage         NVARCHAR(25)   NULL,
        author_name     NVARCHAR(50)   NULL,
        publisher       NVARCHAR(40)   NULL,
        page_count      INT            NULL,
        language        NVARCHAR(25)   NULL,
        isbn_note       NVARCHAR(200)  NULL,
        CONSTRAINT PK_T1_Variants_WideNoSparse PRIMARY KEY CLUSTERED (variant_id),
        CONSTRAINT FK_T1_WideNoSparse_Prod FOREIGN KEY (product_id) REFERENCES dbo.T1_Products(product_id)
    );
END
GO

PRINT '01_lab_schema.sql executed successfully.';
GO
