/* Topic 2 — optional controlled READ benchmark for SQL Server.
   Run 01_mssql_create_100k.sql, then 03_mssql_create_indexes_and_after.sql first.
   Dedicated table only, no production changes. Both index sets remain present.
   Scan = forced clustered index scan (INDEX(1), FORCESCAN); index = forced
   named nonclustered index access (may be scan rather than seek for substring).
   3 warm-ups + 10 recorded runs per case/mode; alternating order.
   Server-observed elapsed milliseconds incl. query execution, not client wall time.
   Run without Actual Plan/STATISTICS IO/TIME for timing. Inspect plans separately.
   Static review only; not executed against a live SQL Server by the author. */
USE [ECommerceDB];
SET NOCOUNT ON;
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
IF OBJECT_ID(N'dbo.IndexDemoProducts',N'U') IS NULL
    THROW 50001, 'Run 01_mssql_create_100k.sql first.', 1;
IF (SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts) <> 100000
    THROW 50002, 'Expected exactly 100000 benchmark products.', 1;
IF EXISTS (SELECT 1 FROM dbo.IndexDemoProducts
 WHERE product_id NOT BETWEEN 1 AND 100000
    OR sku <> 'SKU-' + CONVERT(varchar(20),product_id)
    OR category_id <> product_id % 20
    OR price <> 100000 + (product_id % 1000)*1000
    OR name <> CASE WHEN product_id % 5 = 0 THEN N'Laptop Model ' ELSE N'Phone Model ' END + CONVERT(nvarchar(20),product_id)
    OR description <> N'Product description ' + CONVERT(nvarchar(20),product_id)
    OR is_active <> 1)
    THROW 50003, 'Benchmark data formula mismatch.', 1;
IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts')
 AND name IN (N'IX_Topic2_price',N'IX_Topic2_category_price',N'IX_Topic2_name') AND is_disabled=0) <> 3
    THROW 50004, 'Run 03_mssql_create_indexes_and_after.sql first.', 1;
DECLARE @cases TABLE (id int PRIMARY KEY, experiment varchar(20), predicate nvarchar(400), idx sysname, expected bigint);
INSERT @cases VALUES
(1,'Range',N'price BETWEEN 154000 AND 156000',N'IX_Topic2_price',300),
(2,'Composite',N'category_id=7 AND price BETWEEN 155000 AND 235000',N'IX_Topic2_category_price',400),
(3,'TextSubstring',N'name LIKE N''%Model 7777%''',N'IX_Topic2_name',11);
DECLARE @runs TABLE (experiment varchar(20), trial int, mode varchar(10), result_count bigint, server_elapsed_ms decimal(19,4));
DECLARE @case int=1,@trial int,@step int,@mode varchar(10),@exp varchar(20),@predicate nvarchar(400),@idx sysname,@expected bigint,@sql nvarchar(max),@count bigint,@t datetime2(7),@ms decimal(19,4);
WHILE @case<=3
BEGIN
    SELECT @exp=experiment,@predicate=predicate,@idx=idx,@expected=expected FROM @cases WHERE id=@case;
    SET @trial=-2;
    WHILE @trial<=10
    BEGIN
        SET @step=1;
        WHILE @step<=2
        BEGIN
            SET @mode=CASE WHEN (ABS(@trial)+@step)%2=0 THEN 'scan' ELSE 'index' END;
            SET @sql=N'SELECT @n=COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH ('+
                CASE WHEN @mode='scan' THEN N'INDEX(1), FORCESCAN' ELSE N'INDEX('+QUOTENAME(@idx)+N')' END+
                N') WHERE '+@predicate+N';';
            SET @t=SYSUTCDATETIME();
            EXEC sys.sp_executesql @sql,N'@n bigint OUTPUT',@n=@count OUTPUT;
            SET @ms=CONVERT(decimal(19,4),DATEDIFF_BIG(microsecond,@t,SYSUTCDATETIME())/1000.0);
            IF @count<>@expected OR @count IS NULL THROW 50005,'Query result mismatch.',1;
            IF @trial>0 INSERT @runs VALUES(@exp,@trial,@mode,@count,@ms);
            SET @step+=1;
        END;
        SET @trial+=1;
    END;
    SET @case+=1;
END;
-- Save first result grid as mssql_read_runs.csv (60 rows).
SELECT * FROM @runs ORDER BY experiment,trial,mode;
-- Save second result grid as mssql_read_summary.csv (3 rows).
;WITH M AS (
 SELECT DISTINCT experiment,mode,result_count,
 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY server_elapsed_ms) OVER(PARTITION BY experiment,mode) AS med
 FROM @runs
), P AS (
 SELECT experiment,MAX(result_count) AS result_count,
 MAX(CASE WHEN mode='scan' THEN med END) AS scan_median_ms,
 MAX(CASE WHEN mode='index' THEN med END) AS index_median_ms
 FROM M GROUP BY experiment
)
SELECT experiment,result_count,CAST(scan_median_ms AS decimal(19,4)) AS scan_median_ms,
 CAST(index_median_ms AS decimal(19,4)) AS index_median_ms,
 CAST(scan_median_ms/NULLIF(index_median_ms,0) AS decimal(19,4)) AS speedup FROM P ORDER BY experiment;
SELECT @@VERSION AS mssql_version;
/* Separate actual plan inspection (Ctrl+M and SET STATISTICS IO ON):
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(1),FORCESCAN) WHERE price BETWEEN 154000 AND 156000;
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(IX_Topic2_price)) WHERE price BETWEEN 154000 AND 156000;
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(1),FORCESCAN) WHERE category_id=7 AND price BETWEEN 155000 AND 235000;
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(IX_Topic2_category_price)) WHERE category_id=7 AND price BETWEEN 155000 AND 235000;
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(1),FORCESCAN) WHERE name LIKE N'%Model 7777%';
SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WITH(INDEX(IX_Topic2_name)) WHERE name LIKE N'%Model 7777%';
SET STATISTICS IO OFF;
*/
