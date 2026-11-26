// OPTIONAL SMALL APP REFERENCE GRAPH: run python/04_seed_fr01_fr06_from_sql.py first.
// This uses isolated labels Topic2SQL*; it DOES NOT read/modify the team's existing :Product graph.
// SOURCE: src/mssql/init/03_seed.sql (24 Products, 16 Reviews, 5 Sellers, 8 Categories).

// FR-01 equivalent example from dbo.sp_SearchProducts:
// active product, electronics smartphone category=2, price 800..1600,
// store rating>=4.0 and available stock. SQL also supports keyword and subcategories;
// this simplified demo deliberately does not claim to cover every optional parameter.
MATCH (p:Topic2SQLProduct)-[:SOLD_BY]->(s:Topic2SQLSeller)
MATCH (p)-[:IN_CATEGORY]->(c:Topic2SQLCategory)
WHERE p.is_active=true AND p.status='active'
  AND p.category_id=2 AND p.price>=800 AND p.price<=1600
  AND s.rating>=4.0 AND p.stock_quantity>0
RETURN p.product_id AS product_id, p.name AS name,
       c.category_name AS category, s.shop_name AS seller,
       p.price AS price, p.stock_quantity AS stock
ORDER BY price ASC;

// FR-06 READ stats equivalent to sp_GetProductRatingStats, product 9 has two reviews.
MATCH (p:Topic2SQLProduct {product_id:9})
OPTIONAL MATCH (r:Topic2SQLReview)-[:REVIEW_OF]->(p)
RETURN p.product_id AS product_id,
       p.name AS product_name,
       count(r) AS review_count,
       coalesce(avg(toFloat(r.rating)),0.0) AS avg_rating,
       sum(CASE WHEN r.rating=5 THEN 1 ELSE 0 END) AS five_star_count,
       sum(CASE WHEN r.rating=4 THEN 1 ELSE 0 END) AS four_star_count,
       sum(CASE WHEN r.rating=3 THEN 1 ELSE 0 END) AS three_star_count,
       sum(CASE WHEN r.rating=2 THEN 1 ELSE 0 END) AS two_star_count,
       sum(CASE WHEN r.rating=1 THEN 1 ELSE 0 END) AS one_star_count;

// FR-06 details (READ only); actual sp_AddReview performs authorization and transaction checks not implemented here.
MATCH (p:Topic2SQLProduct {product_id:9})
MATCH (r:Topic2SQLReview)-[:REVIEW_OF]->(p)
RETURN p.name AS product_name, r.review_id AS review_id,
       r.user_id AS user_id, r.rating AS rating, r.comment AS comment
ORDER BY review_id;
