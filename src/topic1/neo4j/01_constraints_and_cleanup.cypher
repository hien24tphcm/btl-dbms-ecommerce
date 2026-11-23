// ==============================================================================
// 01_constraints_and_cleanup.cypher: Neo4j 5 LTS Topic 1 Constraints & Indexes
// Isolated labels (T1*) so existing init.cypher nodes remain untouched.
// ==============================================================================

CREATE CONSTRAINT t1_prod_id IF NOT EXISTS
FOR (p:T1Product) REQUIRE p.product_id IS UNIQUE;

CREATE CONSTRAINT t1_varprop_id IF NOT EXISTS
FOR (v:T1VariantProp) REQUIRE v.variant_id IS UNIQUE;

CREATE CONSTRAINT t1_prodg_id IF NOT EXISTS
FOR (p:T1ProductG) REQUIRE p.product_id IS UNIQUE;

CREATE CONSTRAINT t1_varg_id IF NOT EXISTS
FOR (v:T1VariantGraph) REQUIRE v.variant_id IS UNIQUE;

CREATE INDEX t1_varprop_cat IF NOT EXISTS
FOR (v:T1VariantProp) ON (v.category);

CREATE INDEX t1_varg_cat IF NOT EXISTS
FOR (v:T1VariantGraph) ON (v.category);

CREATE INDEX t1_attr_nv IF NOT EXISTS
FOR (a:T1AttrValue) ON (a.name, a.value);
