-- ==============================================================================
-- 04_schema_evolution.sql: Schema Evolution + Queries (d), (a), (c) Benchmark
-- 1. Adds new attribute battery_mAh = 5000 to all 10,000 Smartphones variants
-- 2. Benchmarks Query (d) Single condition: color = 'Black' (must return 8,000)
-- 3. Benchmarks Query (a) Insert & Query (c) Update (restores clean baseline)
-- ==============================================================================

USE [Topic1_StorageLab];
GO

SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#BenchResults') IS NOT NULL DROP TABLE #BenchResults;
CREATE TABLE #BenchResults (
    phase       NVARCHAR(30)  NOT NULL,
    model_key   NVARCHAR(30)  NOT NULL,
    metric_name NVARCHAR(50)  NOT NULL,
    elapsed_ms  DECIMAL(12,3) NOT NULL,
    row_cnt     INT           NOT NULL,
    notes       NVARCHAR(200) NULL
);

DECLARE @t0 DATETIME2(7), @t1 DATETIME2(7), @rows INT, @attr_id INT;

-- ==============================================================================
-- PART 1: Schema Evolution (Add battery_mAh = 5000 to 10,000 Smartphones)
-- ==============================================================================

-- M1 (EAV): INSERT metadata row + 10,000 attribute value rows (no DDL!)
SET @t0 = SYSUTCDATETIME();
IF NOT EXISTS (SELECT 1 FROM dbo.T1_Attributes WHERE attr_name = N'battery_mAh')
    INSERT INTO dbo.T1_Attributes (attr_name, data_type) VALUES (N'battery_mAh', N'int');
SELECT @attr_id = attr_id FROM dbo.T1_Attributes WHERE attr_name = N'battery_mAh';

INSERT INTO dbo.T1_Variant_Attr_Values (variant_id, attr_id, attr_value)
SELECT v.variant_id, @attr_id, N'5000'
FROM dbo.T1_Variants_EAV v
JOIN dbo.T1_Products p ON p.product_id = v.product_id
WHERE p.category_name = N'Smartphones'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.T1_Variant_Attr_Values x
      WHERE x.variant_id = v.variant_id AND x.attr_id = @attr_id
  )
OPTION (MAXDOP 1, LOOP JOIN, MAX_GRANT_PERCENT = 20);
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'M1_EAV', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'INSERT T1_Attributes + 10k rows (No DDL)');

-- M1_PageComp: INSERT 10,000 rows into PAGE-compressed EAV table
SET @t0 = SYSUTCDATETIME();
INSERT INTO dbo.T1_Variant_Attr_Values_PageComp (variant_id, attr_id, attr_value)
SELECT v.variant_id, @attr_id, N'5000'
FROM dbo.T1_Variants_EAV v
JOIN dbo.T1_Products p ON p.product_id = v.product_id
WHERE p.category_name = N'Smartphones'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.T1_Variant_Attr_Values_PageComp x
      WHERE x.variant_id = v.variant_id AND x.attr_id = @attr_id
  )
OPTION (MAXDOP 1, LOOP JOIN, MAX_GRANT_PERCENT = 20);
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'M1_EAV_PageComp', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'INSERT 10k PAGE-compressed rows (No DDL)');

-- M2a (NVARCHAR JSON): UPDATE using JSON_MODIFY (no DDL)
SET @t0 = SYSUTCDATETIME();
UPDATE dbo.T1_Variants_JsonText
SET attributes = JSON_MODIFY(attributes, '$.battery_mAh', 5000)
WHERE category_name = N'Smartphones';
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'M2a_JsonText', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'UPDATE JSON_MODIFY (No DDL)');

-- M2b (Native json 2025): UPDATE using native .modify() (no DDL)
SET @t0 = SYSUTCDATETIME();
UPDATE dbo.T1_Variants_JsonNative
SET attributes.modify('$.battery_mAh', 5000)
WHERE category_name = N'Smartphones';
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'M2b_JsonNative', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'UPDATE attributes.modify() native json (No DDL)');

-- M3 (Sparse): Requires DDL ALTER TABLE ADD SPARSE NULL + dynamic UPDATE
SET @t0 = SYSUTCDATETIME();
IF COL_LENGTH('dbo.T1_Variants_Sparse', 'battery_mAh') IS NULL
    EXEC(N'ALTER TABLE dbo.T1_Variants_Sparse ADD battery_mAh INT SPARSE NULL;');
EXEC(N'UPDATE dbo.T1_Variants_Sparse SET battery_mAh = 5000 WHERE category_name = N''Smartphones'';');
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'M3_Sparse', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'ALTER TABLE ADD SPARSE NULL (Sch-M lock) + UPDATE');

-- Control (WideNoSparse): Requires DDL ALTER TABLE ADD NULL + dynamic UPDATE
SET @t0 = SYSUTCDATETIME();
IF COL_LENGTH('dbo.T1_Variants_WideNoSparse', 'battery_mAh') IS NULL
    EXEC(N'ALTER TABLE dbo.T1_Variants_WideNoSparse ADD battery_mAh INT NULL;');
EXEC(N'UPDATE dbo.T1_Variants_WideNoSparse SET battery_mAh = 5000 WHERE category_name = N''Smartphones'';');
SET @rows = @@ROWCOUNT;
SET @t1 = SYSUTCDATETIME();
INSERT INTO #BenchResults VALUES ('evolution', 'Control_WideNoSparse', 'add_battery_mAh', DATEDIFF_BIG(MICROSECOND, @t0, @t1) / 1000.0, @rows, N'ALTER TABLE ADD NULL (Sch-M lock) + UPDATE');

CHECKPOINT;

-- ==============================================================================
-- PART 2: Query (d) Single Condition — Filter color = 'Black' (8,000 variants)
-- Warmup + 3 timed runs per model, plus STATISTICS IO capture
-- ==============================================================================
DECLARE @color_attr_id INT = (SELECT attr_id FROM dbo.T1_Attributes WHERE attr_name = N'color');
DECLARE @i INT, @sum_us BIGINT;

-- Warmup scans
SELECT @rows = COUNT(*) FROM dbo.T1_Variant_Attr_Values WHERE attr_id = @color_attr_id AND attr_value = N'Black';
SELECT @rows = COUNT(*) FROM dbo.T1_Variant_Attr_Values_PageComp WHERE attr_id = @color_attr_id AND attr_value = N'Black';
SELECT @rows = COUNT(*) FROM dbo.T1_Variants_JsonText WHERE JSON_VALUE(attributes, '$.color') = N'Black';
SELECT @rows = COUNT(*) FROM dbo.T1_Variants_JsonNative WHERE JSON_VALUE(attributes, '$.color') = N'Black';
SELECT @rows = COUNT(*) FROM dbo.T1_Variants_Sparse WHERE color = N'Black';
SELECT @rows = COUNT(*) FROM dbo.T1_Variants_WideNoSparse WHERE color = N'Black';

-- M1_EAV (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variant_Attr_Values v
    JOIN dbo.T1_Attributes a ON a.attr_id = v.attr_id
    WHERE a.attr_name = N'color' AND v.attr_value = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'M1_EAV', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'JOIN T1_Attributes + Index IX_T1_EAV_AttrVal');

-- M1_EAV_PageComp (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variant_Attr_Values_PageComp v
    JOIN dbo.T1_Attributes a ON a.attr_id = v.attr_id
    WHERE a.attr_name = N'color' AND v.attr_value = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'M1_EAV_PageComp', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'JOIN T1_Attributes + PAGE Compressed Index');

-- M2a_JsonText (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variants_JsonText WHERE JSON_VALUE(attributes, '$.color') = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'M2a_JsonText', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'Clustered Scan + JSON_VALUE() parse');

-- M2b_JsonNative (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variants_JsonNative WHERE JSON_VALUE(attributes, '$.color') = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'M2b_JsonNative', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'Clustered Scan + native json JSON_VALUE()');

-- M3_Sparse (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variants_Sparse WHERE color = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'M3_Sparse', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'Clustered Scan on typed column');

-- Control_WideNoSparse (3 runs)
SET @sum_us = 0; SET @i = 1;
WHILE @i <= 3 BEGIN
    SET @t0 = SYSUTCDATETIME();
    SELECT @rows = COUNT(*) FROM dbo.T1_Variants_WideNoSparse WHERE color = N'Black';
    SET @sum_us += DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME());
    SET @i += 1;
END
INSERT INTO #BenchResults VALUES ('query_d', 'Control_WideNoSparse', 'filter_color_Black', (@sum_us / 3.0) / 1000.0, @rows, N'Clustered Scan on wide table without SPARSE');

-- ==============================================================================
-- PART 3: Query (a) Insert & Query (c) Update on single variant (FR-07 / FR-02)
-- ==============================================================================
-- Query (a) Insert novel attribute waterproof_ip = 'IP68' on variant_id = 999999
SET @t0 = SYSUTCDATETIME();
INSERT INTO dbo.T1_Variants_JsonNative (variant_id, product_id, category_name, sku, price, stock_qty, attributes)
VALUES (999999, 1, N'Smartphones', N'SKU-DEMO-IP68', 1199.00, 15, '{"color":"Black","waterproof_ip":"IP68"}');
SET @rows = @@ROWCOUNT;
INSERT INTO #BenchResults VALUES ('query_a', 'M2b_JsonNative', 'insert_novel_attr', DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME()) / 1000.0, @rows, N'Direct INSERT with novel key waterproof_ip');
DELETE FROM dbo.T1_Variants_JsonNative WHERE variant_id = 999999;

-- Query (a) Insert into M3_Sparse WITHOUT DDL fails for novel attribute
BEGIN TRY
    EXEC(N'INSERT INTO dbo.T1_Variants_Sparse (variant_id, product_id, category_name, sku, price, stock_qty, waterproof_ip) VALUES (999999, 1, N''Smartphones'', N''SKU-DEMO-IP68'', 1199.00, 15, N''IP68'');');
END TRY
BEGIN CATCH
    INSERT INTO #BenchResults VALUES ('query_a', 'M3_Sparse', 'insert_novel_attr_blocked', 0.0, 0, CONCAT(N'Blocked Msg ', ERROR_NUMBER(), N': ', LEFT(ERROR_MESSAGE(), 100)));
END CATCH

-- Query (c) Update price + color on variant_id = 1, then restore
DECLARE @orig_price DECIMAL(18,2) = (SELECT price FROM dbo.T1_Variants_JsonNative WHERE variant_id = 1);
SET @t0 = SYSUTCDATETIME();
UPDATE dbo.T1_Variants_JsonNative
SET price = @orig_price + 10.00,
    attributes.modify('$.color', N'Matte Black')
WHERE variant_id = 1;
SET @rows = @@ROWCOUNT;
INSERT INTO #BenchResults VALUES ('query_c', 'M2b_JsonNative', 'update_variant_attr', DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME()) / 1000.0, @rows, N'Point UPDATE price + .modify()');
UPDATE dbo.T1_Variants_JsonNative SET price = @orig_price, attributes.modify('$.color', N'Black') WHERE variant_id = 1;

-- Return all timed benchmark results
SELECT phase, model_key, metric_name, elapsed_ms, row_cnt, notes
FROM #BenchResults
ORDER BY phase, model_key;

-- Print STATISTICS IO logical reads for Query (d) once per model
PRINT '=== STATISTICS_IO_START ===';
SET STATISTICS IO ON;
SELECT COUNT(*) AS eav_black_cnt FROM dbo.T1_Variant_Attr_Values WHERE attr_id = @color_attr_id AND attr_value = N'Black';
SELECT COUNT(*) AS eav_pc_black_cnt FROM dbo.T1_Variant_Attr_Values_PageComp WHERE attr_id = @color_attr_id AND attr_value = N'Black';
SELECT COUNT(*) AS jsontext_black_cnt FROM dbo.T1_Variants_JsonText WHERE JSON_VALUE(attributes, '$.color') = N'Black';
SELECT COUNT(*) AS jsonnative_black_cnt FROM dbo.T1_Variants_JsonNative WHERE JSON_VALUE(attributes, '$.color') = N'Black';
SELECT COUNT(*) AS sparse_black_cnt FROM dbo.T1_Variants_Sparse WHERE color = N'Black';
SELECT COUNT(*) AS wide_black_cnt FROM dbo.T1_Variants_WideNoSparse WHERE color = N'Black';
SET STATISTICS IO OFF;
PRINT '=== STATISTICS_IO_END ===';
GO
