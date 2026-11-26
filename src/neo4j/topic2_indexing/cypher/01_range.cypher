// TOPIC2 / RANGE - SQL: price BETWEEN 154000 AND 156000 (300 matched)
// A - FORCE LABEL SCAN: bat buoc quet, index khac van dang ton tai.
PROFILE
MATCH (p:IndexDemoProduct)
USING SCAN p:IndexDemoProduct
WHERE p.price >= 154000 AND p.price <= 156000
RETURN count(p) AS total;

// B - FORCE RANGE INDEX, chay rieng cau nay; idx_demo_price da ONLINE.
PROFILE
MATCH (p:IndexDemoProduct)
USING RANGE INDEX p:IndexDemoProduct(price)
WHERE p.price >= 154000 AND p.price <= 156000
RETURN count(p) AS total;
