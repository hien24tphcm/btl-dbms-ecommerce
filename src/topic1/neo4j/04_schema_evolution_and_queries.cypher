// ==============================================================================
// 04_schema_evolution_and_queries.cypher: Neo4j Evolution, Query (d)/(a)/(c)
// Safe to run standalone in cypher-shell (restores temporary demo nodes/updates)
// ==============================================================================

// 1. Schema Evolution on N1: add battery_mAh = 5000 to all 10,000 Smartphones
MATCH (v:T1VariantProp {category: 'Smartphones'})
SET v.battery_mAh = 5000
RETURN count(v) AS n1_evolved_count;

// 2. Schema Evolution on N2: create 1 shared AttrValue node + 10,000 relationships
MERGE (a:T1AttrValue {name: 'battery_mAh', value: '5000'})
WITH a
MATCH (v:T1VariantGraph {category: 'Smartphones'})
MERGE (v)-[:T1_HAS_ATTR]->(a)
RETURN count(v) AS n2_evolved_count;

// 3. Query (d) Single Condition: filter color = 'Black' (must return 8,000)
PROFILE
MATCH (v:T1VariantProp)
WHERE v.color = 'Black'
RETURN count(v) AS n1_black_count;

PROFILE
MATCH (a:T1AttrValue {name: 'color', value: 'Black'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph)
RETURN count(v) AS n2_black_count;

// 4. Schema-Optional Heterogeneous Demo + Query (a) Insert (cleaned up)
CREATE (d1:T1DemoItem {name: 'iPhone 15 Pro Max', color: 'Natural Titanium', storage_gb: 256}),
       (d2:T1DemoItem {name: 'Men Oxford Shirt', apparel_size: 'L', material: '100% Cotton'}),
       (d3:T1DemoItem {name: 'Designing Data-Intensive Apps', author: 'Martin Kleppmann', pages: 616})
RETURN count(d1) AS demo_created;
MATCH (d:T1DemoItem) DETACH DELETE d;

// 5. Query (a) Insert novel attribute waterproof_ip = 'IP68' on N1 (cleaned up)
MATCH (p:T1Product {product_id: 1})
CREATE (p)-[:T1_HAS_VARIANT]->(tv:T1VariantProp {
    variant_id: 999999, product_id: 1, category: 'Smartphones',
    sku: 'SKU-DEMO-IP68', price: 1199.0, stock_qty: 15,
    color: 'Black', waterproof_ip: 'IP68'
})
WITH tv
DETACH DELETE tv;

// 6. Query (c) Update price + color on variant_id = 1, then restore
MATCH (v:T1VariantProp {variant_id: 1})
SET v.price = v.price + 10.0, v.color = 'Matte Black'
WITH v
SET v.price = v.price - 10.0, v.color = 'Black'
RETURN v.variant_id AS restored_variant, v.color AS restored_color;
