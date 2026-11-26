// USE ONLY when setting up a NEW dataset on a fresh instance.
// For the current student's Desktop instance, 3 indexes ALREADY ONLINE; do not recreate.
// Run each CREATE statement separately. None of these drops existing indexes.

CREATE RANGE INDEX idx_demo_price IF NOT EXISTS
FOR (p:IndexDemoProduct) ON (p.price);

CREATE RANGE INDEX idx_demo_category_price IF NOT EXISTS
FOR (p:IndexDemoProduct) ON (p.category_id, p.price);

CREATE TEXT INDEX idx_demo_name IF NOT EXISTS
FOR (p:IndexDemoProduct) ON (p.name);

SHOW INDEXES YIELD name, type, state
WHERE name IN ['idx_demo_price','idx_demo_category_price','idx_demo_name']
RETURN name,type,state ORDER BY name;
