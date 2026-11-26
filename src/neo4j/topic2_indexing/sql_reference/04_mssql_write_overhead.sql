/* Topic 2 - MSSQL Write Overhead (REFERENCE FOR SQL OWNER ONLY)
   Automated: one warm-up + seven measured trials for EACH mode,
   alternating run order. Measures server-side statement wall-time by DATETIME2.
   ONLY truncates dbo.Topic2WriteNoIndex and dbo.Topic2WriteWithIndex.
   NEVER touches dbo.Products, dbo.Reviews or dbo.IndexDemoProducts.
   Review the dedicated tables before running. Run in SSMS on ECommerceDB.
*/
USE [ECommerceDB];
GO
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.Topic2WriteNoIndex',N'U') IS NULL
  CREATE TABLE dbo.Topic2WriteNoIndex ([value] INT NOT NULL, [name] NVARCHAR(100) NOT NULL);
IF OBJECT_ID(N'dbo.Topic2WriteWithIndex',N'U') IS NULL
  CREATE TABLE dbo.Topic2WriteWithIndex ([value] INT NOT NULL, [name] NVARCHAR(100) NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id=OBJECT_ID(N'dbo.Topic2WriteWithIndex') AND name=N'IX_Topic2_write_value')
  CREATE NONCLUSTERED INDEX IX_Topic2_write_value ON dbo.Topic2WriteWithIndex([value]);
GO
/* Prepare EXACTLY 5000 numbers BEFORE beginning the timed tests. */
IF OBJECT_ID('tempdb..#Numbers') IS NOT NULL DROP TABLE #Numbers;
CREATE TABLE #Numbers (i INT PRIMARY KEY);
;WITH Digits AS (SELECT d FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS v(d)),
Numbers AS (
  SELECT 1 + a.d + 10*b.d + 100*c.d + 1000*d.d AS i
  FROM Digits a CROSS JOIN Digits b CROSS JOIN Digits c CROSS JOIN Digits d
)
INSERT INTO #Numbers(i) SELECT i FROM Numbers WHERE i <= 5000;
IF (SELECT COUNT_BIG(*) FROM #Numbers) <> 5000
    THROW 50100, 'Benchmark number generator did not produce 5000 rows', 1;

IF OBJECT_ID('tempdb..#WriteRuns') IS NOT NULL DROP TABLE #WriteRuns;
CREATE TABLE #WriteRuns (
  trial INT NOT NULL,
  mode VARCHAR(20) NOT NULL,
  inserted BIGINT NOT NULL,
  elapsed_ms DECIMAL(19,4) NOT NULL
);

DECLARE @trial INT = 0, @slot INT, @indexed BIT, @t0 DATETIME2(7),
        @ms DECIMAL(19,4), @rowcount BIGINT;

WHILE @trial <= 7
BEGIN
  SET @slot = 0;
  WHILE @slot < 2
  BEGIN
    /* Alternating order to reduce the consistent first-query advantage. */
    SET @indexed = CASE WHEN (@trial + @slot) % 2 = 0 THEN 0 ELSE 1 END;

    IF @indexed = 0
    BEGIN
      TRUNCATE TABLE dbo.Topic2WriteNoIndex;
      SET @t0 = SYSUTCDATETIME();
      INSERT dbo.Topic2WriteNoIndex ([value], [name])
      SELECT i, N'Product ' + CONVERT(NVARCHAR(20),i) FROM #Numbers;
      SET @rowcount = @@ROWCOUNT;
      SET @ms = DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME()) / 1000.0;
    END
    ELSE
    BEGIN
      TRUNCATE TABLE dbo.Topic2WriteWithIndex;
      SET @t0 = SYSUTCDATETIME();
      INSERT dbo.Topic2WriteWithIndex ([value], [name])
      SELECT i, N'Product ' + CONVERT(NVARCHAR(20),i) FROM #Numbers;
      SET @rowcount = @@ROWCOUNT;
      SET @ms = DATEDIFF_BIG(MICROSECOND, @t0, SYSUTCDATETIME()) / 1000.0;
    END;

    IF @rowcount <> 5000
      THROW 50101, 'An INSERT did not affect exactly 5000 rows', 1;

    /* Trial 0 is warm-up; do not include it in measured results. */
    IF @trial > 0
      INSERT INTO #WriteRuns(trial,mode,inserted,elapsed_ms)
      VALUES (@trial, CASE WHEN @indexed=1 THEN 'with_index' ELSE 'no_index' END,
              @rowcount,@ms);

    SET @slot = @slot + 1;
  END;
  SET @trial = @trial + 1;
END;

SELECT trial,mode,inserted,elapsed_ms FROM #WriteRuns ORDER BY trial,mode;
;WITH med AS (
  SELECT mode,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_ms)
             OVER (PARTITION BY mode) AS median_ms
  FROM #WriteRuns
)
SELECT DISTINCT mode, CAST(median_ms AS DECIMAL(19,4)) AS median_ms
FROM med ORDER BY mode;

/* Do NOT claim these are comparable to Neo4j Python client-wall timings.
   SQL runs use a server-side wall-clock measurement here.
   For direct absolute-ms comparison, use a consistent client-side driver on both.
*/
