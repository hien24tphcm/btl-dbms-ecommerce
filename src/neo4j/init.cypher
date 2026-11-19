// ==============================================================================
// init.cypher: Neo4j 5 LTS Companion Graph Schema & Seed Data
// Aligned with MS SQL ECommerceDB seed IDs (Users, Sellers, Products, Orders)
// ==============================================================================

CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE;
CREATE CONSTRAINT seller_id_unique IF NOT EXISTS FOR (s:Seller) REQUIRE s.seller_id IS UNIQUE;
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.product_id IS UNIQUE;
CREATE CONSTRAINT order_id_unique IF NOT EXISTS FOR (o:Order) REQUIRE o.order_id IS UNIQUE;

// Users (Buyers & Sellers)
MERGE (u1:User {user_id: 1}) SET u1.username = 'admin_root', u1.full_name = 'System Administrator', u1.role = 'admin', u1.is_active = true;
MERGE (u2:User {user_id: 2}) SET u2.username = 'seller_techzone', u2.full_name = 'TechZone Official Store', u2.role = 'seller', u2.is_active = true;
MERGE (u3:User {user_id: 3}) SET u3.username = 'seller_fashionhub', u3.full_name = 'FashionHub Apparel Ltd', u3.role = 'seller', u3.is_active = true;
MERGE (u4:User {user_id: 4}) SET u4.username = 'seller_bookstore', u4.full_name = 'Knowledge Bookstore', u4.role = 'seller', u4.is_active = true;
MERGE (u5:User {user_id: 5}) SET u5.username = 'seller_homeappliances', u5.full_name = 'Modern Home Appliances', u5.role = 'seller', u5.is_active = true;
MERGE (u6:User {user_id: 6}) SET u6.username = 'seller_sporty', u6.full_name = 'ProSports Athletics', u6.role = 'seller', u6.is_active = true;

MERGE (u7:User {user_id: 7}) SET u7.username = 'buyer_alex', u7.full_name = 'Alex Smith', u7.role = 'buyer', u7.is_active = true;
MERGE (u8:User {user_id: 8}) SET u8.username = 'buyer_beatrice', u8.full_name = 'Beatrice Tran', u8.role = 'buyer', u8.is_active = true;
MERGE (u9:User {user_id: 9}) SET u9.username = 'buyer_charlie', u9.full_name = 'Charlie Le', u9.role = 'buyer', u9.is_active = true;
MERGE (u10:User {user_id: 10}) SET u10.username = 'buyer_david', u10.full_name = 'David Nguyen', u10.role = 'buyer', u10.is_active = true;
MERGE (u11:User {user_id: 11}) SET u11.username = 'buyer_emma', u11.full_name = 'Emma Watson', u11.role = 'buyer', u11.is_active = true;

// Sellers
MERGE (s1:Seller {seller_id: 1}) SET s1.shop_name = 'TechZone Store', s1.rating = 4.85, s1.is_approved = true;
MERGE (s2:Seller {seller_id: 2}) SET s2.shop_name = 'FashionHub Official', s2.rating = 4.70, s2.is_approved = true;
MERGE (s3:Seller {seller_id: 3}) SET s3.shop_name = 'Knowledge Bookstore', s3.rating = 4.90, s3.is_approved = true;
MERGE (s4:Seller {seller_id: 4}) SET s4.shop_name = 'Modern Home Appliances', s4.rating = 4.65, s4.is_approved = true;
MERGE (s5:Seller {seller_id: 5}) SET s5.shop_name = 'ProSports Athletics', s5.rating = 4.80, s5.is_approved = true;

// Products (Representative subset matching MS SQL seed)
MERGE (p1:Product {product_id: 1}) SET p1.name = 'ProPhone X15 256GB', p1.price = 1199.00, p1.stock_quantity = 45;
MERGE (p2:Product {product_id: 2}) SET p2.name = 'UltraBook Air M3 16GB', p2.price = 1999.00, p2.stock_quantity = 20;
MERGE (p3:Product {product_id: 3}) SET p3.name = 'NoiseCancel Pro Headphones', p3.price = 349.00, p3.stock_quantity = 80;
MERGE (p5:Product {product_id: 5}) SET p5.name = 'Classic Oxford Shirt', p5.price = 85.00, p5.stock_quantity = 150;
MERGE (p9:Product {product_id: 9}) SET p9.name = 'Designing Data-Intensive Apps', p9.price = 48.00, p9.stock_quantity = 60;

// Orders (Matching MS SQL seed order_id 1..5)
MERGE (o1:Order {order_id: 1}) SET o1.total_amount = 1548.00, o1.final_amount = 1548.00, o1.order_status = 'delivered';
MERGE (o2:Order {order_id: 2}) SET o2.total_amount = 175.00, o2.final_amount = 160.00, o2.order_status = 'delivered';
MERGE (o3:Order {order_id: 3}) SET o3.total_amount = 1999.00, o3.final_amount = 1999.00, o3.order_status = 'shipped';
MERGE (o4:Order {order_id: 4}) SET o4.total_amount = 86.00, o4.final_amount = 86.00, o4.order_status = 'delivered';
MERGE (o5:Order {order_id: 5}) SET o5.total_amount = 499.00, o5.final_amount = 499.00, o5.order_status = 'delivered';

// Relationships: (:User)-[:PLACED]->(:Order)-[:FULFILLED_BY]->(:Seller) & [:CONTAINS]
MATCH (u7:User {user_id: 7}), (o1:Order {order_id: 1}), (s1:Seller {seller_id: 1}), (p1:Product {product_id: 1}), (p3:Product {product_id: 3})
MERGE (u7)-[:PLACED]->(o1)
MERGE (o1)-[:FULFILLED_BY]->(s1)
MERGE (o1)-[:CONTAINS {quantity: 1, unit_price: 1199.00}]->(p1)
MERGE (o1)-[:CONTAINS {quantity: 1, unit_price: 349.00}]->(p3);

MATCH (u8:User {user_id: 8}), (o2:Order {order_id: 2}), (s2:Seller {seller_id: 2}), (p5:Product {product_id: 5})
MERGE (u8)-[:PLACED]->(o2)
MERGE (o2)-[:FULFILLED_BY]->(s2)
MERGE (o2)-[:CONTAINS {quantity: 2, unit_price: 85.00}]->(p5);

MATCH (u9:User {user_id: 9}), (o3:Order {order_id: 3}), (s1:Seller {seller_id: 1}), (p2:Product {product_id: 2})
MERGE (u9)-[:PLACED]->(o3)
MERGE (o3)-[:FULFILLED_BY]->(s1)
MERGE (o3)-[:CONTAINS {quantity: 1, unit_price: 1999.00}]->(p2);

MATCH (u10:User {user_id: 10}), (o4:Order {order_id: 4}), (s3:Seller {seller_id: 3}), (p9:Product {product_id: 9})
MERGE (u10)-[:PLACED]->(o4)
MERGE (o4)-[:FULFILLED_BY]->(s3)
MERGE (o4)-[:CONTAINS {quantity: 1, unit_price: 48.00}]->(p9);

MATCH (u11:User {user_id: 11}), (o5:Order {order_id: 5}), (s4:Seller {seller_id: 4})
MERGE (u11)-[:PLACED]->(o5)
MERGE (o5)-[:FULFILLED_BY]->(s4);
