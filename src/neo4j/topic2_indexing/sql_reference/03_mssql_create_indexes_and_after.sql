/* Topic 2 SQL Server indexed counterparts; dedicated table only.
   Run AFTER saving the three baseline plans. In SSMS use Ctrl+M for actual plan.
*/
USE [ECommerceDB];
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_price')
  CREATE NONCLUSTERED INDEX IX_Topic2_price ON dbo.IndexDemoProducts(price);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_category_price')
  CREATE NONCLUSTERED INDEX IX_Topic2_category_price ON dbo.IndexDemoProducts(category_id,price);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts') AND name=N'IX_Topic2_name')
  CREATE NONCLUSTERED INDEX IX_Topic2_name ON dbo.IndexDemoProducts(name);
GO
SELECT name, type_desc FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IndexDemoProducts');
GO
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
/* A. Range — compare with baseline; record Actual Execution Plan */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE price BETWEEN 154000 AND 156000 OPTION (RECOMPILE);
/* B. Composite — inspect whether IX_Topic2_category_price was chosen */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE category_id=7 AND price BETWEEN 155000 AND 235000 OPTION (RECOMPILE);
/* C. Substring — name index may be SCANNED, not SEEKED (leading % wildcard) */
SELECT COUNT_BIG(*) AS total FROM dbo.IndexDemoProducts
WHERE name LIKE N'%Model 7777%' OPTION (RECOMPILE);
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO
/* Optional, meaningful B-tree prefix-search contrast (not same query as substring case):
   SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts WHERE name LIKE N'Laptop Model 7777%';
*/
