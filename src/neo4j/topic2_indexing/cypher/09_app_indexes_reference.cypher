// OPTIONAL: chay SAU python/04_seed_fr01_fr06_from_sql.py
// Doi chieu tu cac index ung dung trong src/mssql/init/02_indexes.sql
// Khong can cho benchmark 100k; voi 24 products, planner co the chon label scan.

// SQL IX_Products_status_price(status,price)
CREATE RANGE INDEX idx_topic2_app_status_price IF NOT EXISTS
FOR (p:Topic2SQLProduct) ON (p.status,p.price);

// SQL IX_Products_category_id(category_id)
CREATE RANGE INDEX idx_topic2_app_category IF NOT EXISTS
FOR (p:Topic2SQLProduct) ON (p.category_id);

// SQL IX_Reviews_product_id_rating(product_id,rating)
CREATE RANGE INDEX idx_topic2_app_review_prod_rating IF NOT EXISTS
FOR (r:Topic2SQLReview) ON (r.product_id,r.rating);

// SQL IX_Reviews_user_id(user_id)
CREATE RANGE INDEX idx_topic2_app_review_user IF NOT EXISTS
FOR (r:Topic2SQLReview) ON (r.user_id);

SHOW INDEXES YIELD name,type,state
WHERE name STARTS WITH 'idx_topic2_app_'
RETURN name,type,state ORDER BY name;
