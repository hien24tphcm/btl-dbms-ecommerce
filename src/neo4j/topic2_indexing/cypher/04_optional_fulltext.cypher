// OPTIONAL, not comparable directly with SQL LIKE '%substring%'.
// Fulltext searches tokenized terms, not the same as literal substring matching.
// For Neo4j 2026.10.1, Cypher 25.
CREATE FULLTEXT INDEX idx_topic2_fulltext IF NOT EXISTS
FOR (p:IndexDemoProduct) ON EACH [p.name,p.description];

// Await index ONLINE before running SEARCH (can also inspect SHOW INDEXES).
SHOW INDEXES YIELD name,type,state
WHERE name = 'idx_topic2_fulltext'
RETURN name,type,state;

MATCH (p:IndexDemoProduct)
SEARCH p IN (FULLTEXT INDEX idx_topic2_fulltext FOR 'Laptop' LIMIT 10)
SCORE AS score
RETURN p.sku AS sku, p.name AS name, score ORDER BY score DESC;
