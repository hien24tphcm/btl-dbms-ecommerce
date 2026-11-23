-- ==============================================================================
-- 05_page_internals.sql: Live Physical Internals & Schema-on-Write Demo
-- Inspects ECommerceDB (Read-only) + Topic1_StorageLab JSON/Sparse internals
-- ==============================================================================

USE [ECommerceDB];
GO

SET NOCOUNT ON;

PRINT '=== 1. SCHEMA-ON-WRITE DEMO (CK_Products_price rejects negative price) ===';
BEGIN TRY
    INSERT INTO dbo.Products (seller_id, category_id, name, price)
    VALUES (1, 2, N'Topic1 Schema-on-Write Test', -5.00);
END TRY
BEGIN CATCH
    SELECT
        ERROR_NUMBER() AS error_number,
        ERROR_SEVERITY() AS severity,
        ERROR_MESSAGE() AS error_message;
END CATCH;
GO

PRINT '=== 2. ECOMMERCEDB 9 TABLES ALLOCATION UNITS & 8KB PAGES ===';
SELECT
    t.name AS table_name,
    MAX(CASE WHEN i.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS row_count,
    SUM(au.total_pages) AS total_pages_8kb,
    SUM(au.used_pages) AS used_pages_8kb,
    SUM(CASE WHEN au.type = 1 THEN au.used_pages ELSE 0 END) AS in_row_pages,
    SUM(CASE WHEN au.type = 3 THEN au.used_pages ELSE 0 END) AS row_overflow_pages,
    SUM(CASE WHEN au.type = 2 THEN au.used_pages ELSE 0 END) AS lob_pages,
    CAST(SUM(au.used_pages) * 8.0 AS DECIMAL(10, 2)) AS used_kb
FROM sys.tables t
JOIN sys.indexes i ON t.object_id = i.object_id
JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
JOIN sys.allocation_units au ON p.partition_id = au.container_id
GROUP BY t.name
ORDER BY used_pages_8kb DESC, t.name;
GO

PRINT '=== 3. DBCC IND & DBCC PAGE (8 KB Physical Page Anatomy of dbo.Products) ===';
DBCC TRACEON(3604);

IF OBJECT_ID('tempdb..#DbccInd') IS NOT NULL DROP TABLE #DbccInd;
CREATE TABLE #DbccInd (
    PageFID         INT,
    PagePID         INT,
    IAMFID          INT,
    IAMPID          INT,
    ObjectID        INT,
    IndexID         INT,
    PartitionNumber INT,
    PartitionID     BIGINT,
    iam_chain_type  VARCHAR(30),
    PageType        INT,
    IndexLevel      INT,
    NextPageFID     INT,
    NextPagePID     INT,
    PrevPageFID     INT,
    PrevPagePID     INT
);

INSERT INTO #DbccInd
EXEC(N'DBCC IND(''ECommerceDB'', ''dbo.Products'', 1);');

SELECT PageFID, PagePID, PageType, IndexLevel, iam_chain_type
FROM #DbccInd
ORDER BY PageType DESC, PagePID ASC;

DECLARE @first_fid INT, @first_pid INT;
SELECT TOP (1) @first_fid = PageFID, @first_pid = PagePID
FROM #DbccInd
WHERE PageType = 1 AND IndexLevel = 0
ORDER BY PagePID ASC;

IF @first_pid IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(200) = CONCAT(N'DBCC PAGE(''ECommerceDB'', ', @first_fid, N', ', @first_pid, N', 3);');
    PRINT CONCAT('Inspecting Data Page (', @first_fid, ':', @first_pid, ') with dump style 3:');
    EXEC(@sql);
END

DBCC TRACEOFF(3604);
GO
