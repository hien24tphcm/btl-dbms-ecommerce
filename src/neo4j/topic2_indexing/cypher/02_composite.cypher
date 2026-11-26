// TOPIC2 / COMPOSITE - SQL: category_id=7 AND price BETWEEN 155000 AND 235000 (400 matched)
// A - FORCE LABEL SCAN
PROFILE
MATCH (p:IndexDemoProduct)
USING SCAN p:IndexDemoProduct
WHERE p.category_id=7 AND p.price>=155000 AND p.price<=235000
RETURN count(p) AS total;

// B - FORCE COMPOSITE RANGE INDEX; idx_demo_category_price ONLINE
PROFILE
MATCH (p:IndexDemoProduct)
USING RANGE INDEX p:IndexDemoProduct(category_id,price)
WHERE p.category_id=7 AND p.price>=155000 AND p.price<=235000
RETURN count(p) AS total;
