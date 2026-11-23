// ==============================================================================
// 05_demo_browser_queries.cypher: Visual Snippets for Neo4j Browser Live Demo
// Open http://localhost:7474 and run each block step by step during presentation.
// ==============================================================================

// [Demo B] Schema-Optional: 3 nodes with same label, different property sets
CREATE (:T1DemoItem {name: 'iPhone 15 Pro Max', color: 'Natural Titanium', storage: '256GB'}),
       (:T1DemoItem {name: 'Men Oxford Shirt', size: 'L', color: 'Light Blue'}),
       (:T1DemoItem {name: 'Clean Code', author: 'Robert C. Martin', pages: 464});
MATCH (d:T1DemoItem) RETURN d;
// Cleanup after showing slide:
// MATCH (d:T1DemoItem) DETACH DELETE d;

// [Demo C1] Model N1 (Inline/Dynamic Properties): Product 1 + 5 Variants
MATCH p = (prod:T1Product {product_id: 1})-[:T1_HAS_VARIANT]->(v:T1VariantProp)
RETURN p;

// [Demo C2] Model N2 (Shared Graph-EAV): Variants sharing the same ('color':'Black') node
MATCH p = (prod:T1ProductG)-[:T1_HAS_VARIANT_G]->(v:T1VariantGraph)-[:T1_HAS_ATTR]->(a:T1AttrValue {name: 'color', value: 'Black'})
RETURN p LIMIT 15;

// [Demo C3] Query (d) Compare PROFILE db hits: N1 (LabelScan) vs N2 (Index-Free Adjacency)
PROFILE MATCH (v:T1VariantProp) WHERE v.color = 'Black' RETURN count(v);
PROFILE MATCH (a:T1AttrValue {name: 'color', value: 'Black'})<-[:T1_HAS_ATTR]-(v:T1VariantGraph) RETURN count(v);

// [Demo E] Live Store Summary via APOC
CALL apoc.meta.stats() YIELD nodeCount, relCount, labels, relTypesCount
RETURN nodeCount, relCount, labels, relTypesCount;
