-- ==============================================================================
-- 02_generate_data.sql: Deterministic Set-Based Data Generator for Topic 1
-- Generates @ProductCount = 10,000 products x 5 variants = 50,000 variants
-- across M1 (EAV), M1_PageComp, M2a (NVARCHAR JSON), M2b (Native json 2025),
-- M3 (SPARSE), and WideNoSparse.
-- Uses 500-product batches + MAXDOP 1 + MAX_GRANT_PERCENT=20 to run smoothly
-- even on memory-constrained hosts without RESOURCE_SEMAPHORE waits.
-- ==============================================================================

USE [Topic1_StorageLab];
GO

SET NOCOUNT ON;

DECLARE @ProductCount INT = 10000;
DECLARE @VariantsPerProduct INT = 5;
DECLARE @BatchSize INT = 500;

-- Clean existing data in reverse FK order (idempotent re-run)
DELETE FROM dbo.T1_Variant_Attr_Values_PageComp;
DELETE FROM dbo.T1_Variant_Attr_Values;
DELETE FROM dbo.T1_Variants_EAV;
DELETE FROM dbo.T1_Attributes;
DELETE FROM dbo.T1_Variants_JsonText;
DELETE FROM dbo.T1_Variants_JsonNative;
DELETE FROM dbo.T1_Variants_Sparse;
DELETE FROM dbo.T1_Variants_WideNoSparse;
DELETE FROM dbo.T1_Products;

DBCC CHECKIDENT ('dbo.T1_Attributes', RESEED, 0) WITH NO_INFOMSGS;

-- 1. Seed Attribute Catalog (21 attributes)
INSERT INTO dbo.T1_Attributes (attr_name, data_type) VALUES
(N'color',           N'nvarchar'),
(N'storage_gb',      N'int'),
(N'ram_gb',          N'int'),
(N'screen_inch',     N'nvarchar'),
(N'chipset',         N'nvarchar'),
(N'cpu_model',       N'nvarchar'),
(N'gpu_model',       N'nvarchar'),
(N'os_name',         N'nvarchar'),
(N'apparel_size',    N'nvarchar'),
(N'material',        N'nvarchar'),
(N'fit_style',       N'nvarchar'),
(N'season',          N'nvarchar'),
(N'power_watt',      N'int'),
(N'capacity_liter',  N'nvarchar'),
(N'warranty_months', N'int'),
(N'voltage',         N'nvarchar'),
(N'author_name',     N'nvarchar'),
(N'publisher',       N'nvarchar'),
(N'page_count',      N'int'),
(N'language',        N'nvarchar'),
(N'isbn_note',       N'nvarchar');

-- 2. Populate 10,000 Products using stacked Tally CTE
;WITH E1(N) AS (SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1
                UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1),
      E2(N) AS (SELECT 1 FROM E1 a CROSS JOIN E1 b),
      E4(N) AS (SELECT 1 FROM E2 a CROSS JOIN E2 b),
      Nums(p) AS (SELECT TOP (@ProductCount) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) FROM E4)
INSERT INTO dbo.T1_Products (product_id, category_name, product_name, base_price)
SELECT
    p AS product_id,
    CHOOSE(((p - 1) % 5) + 1, N'Smartphones', N'Laptops', N'Fashion', N'Home_Living', N'Books') AS category_name,
    CHOOSE(((p - 1) % 5) + 1, N'Smartphone Model ', N'Laptop Pro ', N'Apparel Item ', N'Home Appliance ', N'Technical Book ')
        + CAST(p AS NVARCHAR(10)) AS product_name,
    CAST(100.00 + (p % 20) * 25.00 AS DECIMAL(18, 2)) AS base_price
FROM Nums
OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

-- 3. Populate all 6 SQL models in deterministic batches of 500 products (2,500 variants/batch)
DECLARE @start_p INT = 1;
DECLARE @end_p INT;
DECLARE @start_v INT;
DECLARE @end_v INT;

WHILE @start_p <= @ProductCount
BEGIN
    SET @end_p = @start_p + @BatchSize - 1;
    IF @end_p > @ProductCount SET @end_p = @ProductCount;
    SET @start_v = (@start_p - 1) * @VariantsPerProduct + 1;
    SET @end_v   = @end_p * @VariantsPerProduct;

    -- 3a. M3 (Sparse Wide Table)
    ;WITH V(v) AS (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4),
    Base AS (
        SELECT
            p.product_id,
            p.category_name,
            ((p.product_id - 1) % 5) AS cat_idx,
            v.v,
            ((p.product_id - 1) * @VariantsPerProduct + v.v + 1) AS variant_id,
            p.product_id AS p
        FROM dbo.T1_Products p
        CROSS JOIN V v
        WHERE p.product_id BETWEEN @start_p AND @end_p
    )
    INSERT INTO dbo.T1_Variants_Sparse (
        variant_id, product_id, category_name, sku, price, stock_qty,
        color, storage_gb, ram_gb, screen_inch, chipset,
        cpu_model, gpu_model, os_name,
        apparel_size, material, fit_style, season,
        power_watt, capacity_liter, warranty_months, voltage,
        author_name, publisher, page_count, language, isbn_note
    )
    SELECT
        variant_id,
        product_id,
        category_name,
        CONCAT(N'SKU-', p, N'-', v) AS sku,
        CAST(100.00 + (p % 20) * 25.00 + v * 10.00 AS DECIMAL(18, 2)) AS price,
        10 + ((p + v) % 90) AS stock_qty,
        CASE WHEN cat_idx IN (0, 1, 2, 3)
             THEN CHOOSE(v + 1, N'Black', N'Silver', N'Blue', N'White', N'Gold') ELSE NULL END,
        CASE WHEN cat_idx = 0 THEN CHOOSE(((p + v) % 4) + 1, 128, 256, 512, 1024)
             WHEN cat_idx = 1 THEN CHOOSE(((p + v) % 4) + 1, 256, 512, 1024, 2048) ELSE NULL END,
        CASE WHEN cat_idx = 0 THEN CHOOSE(((p + v) % 3) + 1, 8, 12, 16)
             WHEN cat_idx = 1 THEN CHOOSE(((p + v) % 3) + 1, 16, 32, 64) ELSE NULL END,
        CASE WHEN cat_idx = 0 THEN CHOOSE(((p + v) % 4) + 1, N'6.1', N'6.5', N'6.7', N'6.9') ELSE NULL END,
        CASE WHEN cat_idx = 0 THEN CHOOSE(((p + v) % 4) + 1, N'A18 Pro', N'Snapdragon 8 Gen 3', N'Dimensity 9300', N'Tensor G4') ELSE NULL END,
        CASE WHEN cat_idx = 1 THEN CHOOSE(((p + v) % 4) + 1, N'Apple M3 Pro', N'Intel Core i7-13700H', N'AMD Ryzen 9 7940HS', N'Intel Core Ultra 7') ELSE NULL END,
        CASE WHEN cat_idx = 1 THEN CHOOSE(((p + v) % 4) + 1, N'Integrated', N'RTX 4060', N'RTX 4070', N'Radeon 780M') ELSE NULL END,
        CASE WHEN cat_idx = 1 THEN CHOOSE(((p + v) % 3) + 1, N'macOS', N'Windows 11 Pro', N'Ubuntu Linux') ELSE NULL END,
        CASE WHEN cat_idx = 2 THEN CHOOSE(v + 1, N'S', N'M', N'L', N'XL', N'XXL') ELSE NULL END,
        CASE WHEN cat_idx = 2 THEN CHOOSE(((p + v) % 5) + 1, N'100% Cotton', N'Merino Wool', N'Selvedge Denim', N'Mulberry Silk', N'Linen Blend') ELSE NULL END,
        CASE WHEN cat_idx = 2 THEN CHOOSE(((p + v) % 4) + 1, N'Slim Fit', N'Regular Fit', N'Relaxed Fit', N'Tailored Fit') ELSE NULL END,
        CASE WHEN cat_idx = 2 THEN CHOOSE(((p + v) % 3) + 1, N'Spring/Summer', N'Autumn/Winter', N'All-Season') ELSE NULL END,
        CASE WHEN cat_idx = 3 THEN CHOOSE(((p + v) % 4) + 1, 800, 1200, 1500, 2000) ELSE NULL END,
        CASE WHEN cat_idx = 3 THEN CHOOSE(((p + v) % 4) + 1, N'1.5L', N'3.5L', N'6.5L', N'10.0L') ELSE NULL END,
        CASE WHEN cat_idx = 3 THEN CHOOSE(((p + v) % 3) + 1, 12, 24, 36) ELSE NULL END,
        CASE WHEN cat_idx = 3 THEN CHOOSE(((p + v) % 3) + 1, N'220V-50Hz', N'110V-60Hz', N'110-240V Dual') ELSE NULL END,
        CASE WHEN cat_idx = 4 THEN CHOOSE(((p + v) % 5) + 1, N'Martin Kleppmann', N'Robert C. Martin', N'Abraham Silberschatz', N'C. J. Date', N'Ian Robinson') ELSE NULL END,
        CASE WHEN cat_idx = 4 THEN CHOOSE(((p + v) % 4) + 1, N'OReilly Media', N'Pearson Education', N'McGraw-Hill', N'MIT Press') ELSE NULL END,
        CASE WHEN cat_idx = 4 THEN CHOOSE(((p + v) % 4) + 1, 320, 464, 616, 1344) ELSE NULL END,
        CASE WHEN cat_idx = 4 THEN CHOOSE(((p + v) % 3) + 1, N'English', N'Vietnamese', N'Bilingual EN-VN') ELSE NULL END,
        CASE WHEN cat_idx = 4 THEN N'ISBN-978-1-4919-5035-ED' + CAST((p + v) % 20 AS NVARCHAR(2))
            + N' | Hardcover Collector Edition with Extended Technical Appendix and Errata Notes' ELSE NULL END
    FROM Base
    OPTION (MAXDOP 1, LOOP JOIN, MAX_GRANT_PERCENT = 20);

    -- 3b. Control WideNoSparse
    INSERT INTO dbo.T1_Variants_WideNoSparse
    SELECT * FROM dbo.T1_Variants_Sparse
    WHERE variant_id BETWEEN @start_v AND @end_v
    OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

    -- 3c. M2a (NVARCHAR JSON)
    INSERT INTO dbo.T1_Variants_JsonText (variant_id, product_id, category_name, sku, price, stock_qty, attributes)
    SELECT
        s.variant_id, s.product_id, s.category_name, s.sku, s.price, s.stock_qty,
        (SELECT
            s.color, s.storage_gb, s.ram_gb, s.screen_inch, s.chipset,
            s.cpu_model, s.gpu_model, s.os_name,
            s.apparel_size, s.material, s.fit_style, s.season,
            s.power_watt, s.capacity_liter, s.warranty_months, s.voltage,
            s.author_name, s.publisher, s.page_count, s.language, s.isbn_note
         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS attributes
    FROM dbo.T1_Variants_Sparse s
    WHERE s.variant_id BETWEEN @start_v AND @end_v
    OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

    -- 3d. M2b (Native SQL Server 2025 `json` type)
    INSERT INTO dbo.T1_Variants_JsonNative (variant_id, product_id, category_name, sku, price, stock_qty, attributes)
    SELECT variant_id, product_id, category_name, sku, price, stock_qty, CAST(attributes AS json)
    FROM dbo.T1_Variants_JsonText
    WHERE variant_id BETWEEN @start_v AND @end_v
    OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

    -- 3e. M1 & M1_PageComp (EAV)
    INSERT INTO dbo.T1_Variants_EAV (variant_id, product_id, sku, price, stock_qty)
    SELECT variant_id, product_id, sku, price, stock_qty
    FROM dbo.T1_Variants_Sparse
    WHERE variant_id BETWEEN @start_v AND @end_v
    OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

    INSERT INTO dbo.T1_Variant_Attr_Values (variant_id, attr_id, attr_value)
    SELECT s.variant_id, a.attr_id, x.attr_value
    FROM dbo.T1_Variants_Sparse s
    CROSS APPLY (VALUES
        (N'color',           s.color),
        (N'storage_gb',      CAST(s.storage_gb AS NVARCHAR(200))),
        (N'ram_gb',          CAST(s.ram_gb AS NVARCHAR(200))),
        (N'screen_inch',     s.screen_inch),
        (N'chipset',         s.chipset),
        (N'cpu_model',       s.cpu_model),
        (N'gpu_model',       s.gpu_model),
        (N'os_name',         s.os_name),
        (N'apparel_size',    s.apparel_size),
        (N'material',        s.material),
        (N'fit_style',       s.fit_style),
        (N'season',          s.season),
        (N'power_watt',      CAST(s.power_watt AS NVARCHAR(200))),
        (N'capacity_liter',  s.capacity_liter),
        (N'warranty_months', CAST(s.warranty_months AS NVARCHAR(200))),
        (N'voltage',         s.voltage),
        (N'author_name',     s.author_name),
        (N'publisher',       s.publisher),
        (N'page_count',      CAST(s.page_count AS NVARCHAR(200))),
        (N'language',        s.language),
        (N'isbn_note',       s.isbn_note)
    ) AS x(attr_name, attr_value)
    JOIN dbo.T1_Attributes a ON a.attr_name = x.attr_name
    WHERE s.variant_id BETWEEN @start_v AND @end_v
      AND x.attr_value IS NOT NULL
    OPTION (MAXDOP 1, LOOP JOIN, MAX_GRANT_PERCENT = 20);

    INSERT INTO dbo.T1_Variant_Attr_Values_PageComp (variant_id, attr_id, attr_value)
    SELECT v.variant_id, v.attr_id, v.attr_value
    FROM dbo.T1_Variant_Attr_Values v
    WHERE v.variant_id BETWEEN @start_v AND @end_v
    OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 20);

    SET @start_p = @end_p + 1;
END

-- Refresh statistics & flush dirty pages for accurate DMV space measurements
UPDATE STATISTICS dbo.T1_Products;
UPDATE STATISTICS dbo.T1_Attributes;
UPDATE STATISTICS dbo.T1_Variants_EAV;
UPDATE STATISTICS dbo.T1_Variant_Attr_Values;
UPDATE STATISTICS dbo.T1_Variant_Attr_Values_PageComp;
UPDATE STATISTICS dbo.T1_Variants_JsonText;
UPDATE STATISTICS dbo.T1_Variants_JsonNative;
UPDATE STATISTICS dbo.T1_Variants_Sparse;
UPDATE STATISTICS dbo.T1_Variants_WideNoSparse;
CHECKPOINT;

SELECT
    (SELECT COUNT(*) FROM dbo.T1_Products) AS products_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variants_EAV) AS variants_eav_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variant_Attr_Values) AS eav_pairs_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variant_Attr_Values_PageComp) AS eav_pc_pairs_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variants_JsonText) AS json_text_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variants_JsonNative) AS json_native_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variants_Sparse) AS sparse_cnt,
    (SELECT COUNT(*) FROM dbo.T1_Variants_WideNoSparse) AS wide_nosparse_cnt;
GO
