/* Topic 2 SQL Server BASELINE. Dedicated table only.
   This script removes ONLY three benchmark indexes; does not modify other indexes.
   Run before 03_mssql_create_indexes_and_after.sql.
   In SSMS press Ctrl+M to Include Actual Execution Plan, then execute.
*/
USE [ECommerceDB];
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_price')
  DROP INDEX IX_Topic2_price ON dbo.IndexDemoProducts;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_category_price')
  DROP INDEX IX_Topic2_category_price ON dbo.IndexDemoProducts;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_name')
  DROP INDEX IX_Topic2_name ON dbo.IndexDemoProducts;
GO
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
/* A. Range — expected total 300 */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE price BETWEEN 154000 AND 156000 OPTION (RECOMPILE);
/* B. Composite — expected total 400 */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE category_id=7 AND price BETWEEN 155000 AND 235000 OPTION (RECOMPILE);
/* C. Substring — expected total 11. LIKE '%...%' is not a B-tree index seek. */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE name LIKE N'%Model 7777%' OPTION (RECOMPILE);
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO
