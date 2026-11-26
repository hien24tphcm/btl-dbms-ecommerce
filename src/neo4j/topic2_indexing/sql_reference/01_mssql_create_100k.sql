/* Topic 2 ONLY. Run in SSMS connected to the group's SQL Server.
   Dedicated table; does not alter dbo.Products, dbo.Reviews or application indexes.
   Same values as Neo4j IndexDemoProduct 100,000-node generator.
*/
USE [ECommerceDB];
GO
IF OBJECT_ID(N'dbo.IndexDemoProducts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.IndexDemoProducts (
    product_id INT NOT NULL CONSTRAINT PK_IndexDemoProducts PRIMARY KEY CLUSTERED,
    sku VARCHAR(32) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(200) NOT NULL,
    category_id INT NOT NULL,
    price INT NOT NULL,
    is_active BIT NOT NULL
  );
END;
GO
DECLARE @existing BIGINT = (SELECT COUNT_BIG(*) FROM dbo.IndexDemoProducts);
IF @existing = 0
BEGIN
  /* Cartesian product of five digit columns: exactly 100,000 distinct i=1..100000 */
  ;WITH D AS (
    SELECT d FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS V(d)
  ), N AS (
    SELECT 1 + a.d + 10*b.d + 100*c.d + 1000*d.d + 10000*e.d AS i
    FROM D a CROSS JOIN D b CROSS JOIN D c CROSS JOIN D d CROSS JOIN D e
  )
  INSERT dbo.IndexDemoProducts (product_id, sku, name, description, category_id, price, is_active)
  SELECT i,
         'SKU-' + CONVERT(VARCHAR(20), i),
         CASE WHEN i % 5 = 0
              THEN N'Laptop Model ' + CONVERT(NVARCHAR(20), i)
              ELSE N'Phone Model ' + CONVERT(NVARCHAR(20), i) END,
         N'Product description ' + CONVERT(NVARCHAR(20), i),
         i % 20, 100000 + (i % 1000) * 1000, CONVERT(BIT,1)
  FROM N;
  PRINT 'Inserted 100,000 benchmark products.';
END
ELSE
  PRINT 'Existing benchmark records found; insertion skipped. Do NOT append duplicate rows.';
GO
SELECT COUNT_BIG(*) AS totalProducts,
       COUNT(DISTINCT sku) AS uniqueSKU,
       MIN(product_id) AS min_id,
       MAX(product_id) AS max_id
FROM dbo.IndexDemoProducts;
GO
/* Expected totalProducts=100000, uniqueSKU=100000, min_id=1, max_id=100000 */
