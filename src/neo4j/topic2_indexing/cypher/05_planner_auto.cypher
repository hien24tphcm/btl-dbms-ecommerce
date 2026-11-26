// TOPIC 2 - UNHINTED PLANS. Chay TUNG cau trong Neo4j Desktop Query.
// Muc dich: kiem tra Query Planner TU DONG lua chon gi, khac 6 forced Scan/Index.
// KHONG khang dinh no se dung Index neu chua xem Plan tren may.

PROFILE
MATCH (p:IndexDemoProduct)
WHERE p.price >= 154000 AND p.price <= 156000
RETURN count(p) AS total;

PROFILE
MATCH (p:IndexDemoProduct)
WHERE p.category_id = 7 AND p.price >= 155000 AND p.price <= 235000
RETURN count(p) AS total;

PROFILE
MATCH (p:IndexDemoProduct)
WHERE p.name CONTAINS 'Model 7777'
RETURN count(p) AS total;
