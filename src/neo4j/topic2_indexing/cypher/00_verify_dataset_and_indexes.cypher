// Chay tung cau lenh rieng biet trong Neo4j Desktop Query.
// 01 - 100000 ben Neo4j; SQL: dbo.IndexDemoProducts 100000.
MATCH (p:IndexDemoProduct)
RETURN count(p) AS totalProducts,
       count(DISTINCT p.sku) AS uniqueSKU;

// 02 - 3 index chinh phai ONLINE; 2 LOOKUP mac dinh van giu.
SHOW INDEXES YIELD name,type,state
WHERE name IN ['idx_demo_price','idx_demo_category_price','idx_demo_name']
RETURN name,type,state ORDER BY name;

// 03 - 3 count phai tuong ung voi SQL: 300,400,11.
MATCH (p:IndexDemoProduct) WHERE p.price >= 154000 AND p.price <= 156000
RETURN count(p) AS range_count;

MATCH (p:IndexDemoProduct) WHERE p.category_id=7 AND p.price >= 155000 AND p.price <= 235000
RETURN count(p) AS composite_count;

MATCH (p:IndexDemoProduct) WHERE p.name CONTAINS 'Model 7777'
RETURN count(p) AS substring_count;
