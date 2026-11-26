// TOPIC2 / TEXT SUBSTRING - SQL LIKE N'%Model 7777%' (11 matched)
// A - FORCE LABEL SCAN
PROFILE
MATCH (p:IndexDemoProduct)
USING SCAN p:IndexDemoProduct
WHERE p.name CONTAINS 'Model 7777'
RETURN count(p) AS total;

// B - FORCE TEXT INDEX, idx_demo_name ONLINE
PROFILE
MATCH (p:IndexDemoProduct)
USING TEXT INDEX p:IndexDemoProduct(name)
WHERE p.name CONTAINS 'Model 7777'
RETURN count(p) AS total;
