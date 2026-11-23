// ==============================================================================
// 03_generate_N2_graph_eav.cypher: Model N2 (Shared Attribute-Value Graph-EAV)
// Parameterized batch: pass -P "start_p=>1" -P "end_p=>2000" (5 batches for 10k)
// Uses t1_attr_nv composite index for fast MERGE on shared (:T1AttrValue) nodes.
// ==============================================================================

UNWIND range($start_p, $end_p) AS p
WITH p,
     (p - 1) % 5 AS cat_idx,
     ['Smartphones', 'Laptops', 'Fashion', 'Home_Living', 'Books'][(p - 1) % 5] AS cat_name,
     ['Smartphone Model ', 'Laptop Pro ', 'Apparel Item ', 'Home Appliance ', 'Technical Book '][(p - 1) % 5] + toString(p) AS prod_name,
     100.0 + (p % 20) * 25.0 AS base_price
CREATE (prod:T1ProductG {
    product_id: p,
    category: cat_name,
    product_name: prod_name,
    base_price: base_price
})
WITH prod, p, cat_idx, cat_name
UNWIND range(0, 4) AS v
WITH prod, p, cat_idx, cat_name, v, (p - 1) * 5 + v + 1 AS vid
CREATE (prod)-[:T1_HAS_VARIANT_G]->(var:T1VariantGraph {
    variant_id: vid,
    product_id: p,
    category: cat_name,
    sku: 'SKU-' + toString(p) + '-' + toString(v),
    price: 100.0 + (p % 20) * 25.0 + v * 10.0,
    stock_qty: 10 + ((p + v) % 90)
})
WITH var, p, cat_idx, v,
CASE cat_idx
    WHEN 0 THEN [
        ['color',       ['Black', 'Silver', 'Blue', 'White', 'Gold'][v]],
        ['storage_gb',  toString([128, 256, 512, 1024][(p + v) % 4])],
        ['ram_gb',      toString([8, 12, 16][(p + v) % 3])],
        ['screen_inch', ['6.1', '6.5', '6.7', '6.9'][(p + v) % 4]],
        ['chipset',     ['A18 Pro', 'Snapdragon 8 Gen 3', 'Dimensity 9300', 'Tensor G4'][(p + v) % 4]]
    ]
    WHEN 1 THEN [
        ['color',       ['Black', 'Silver', 'Blue', 'White', 'Gold'][v]],
        ['storage_gb',  toString([256, 512, 1024, 2048][(p + v) % 4])],
        ['ram_gb',      toString([16, 32, 64][(p + v) % 3])],
        ['cpu_model',   ['Apple M3 Pro', 'Intel Core i7-13700H', 'AMD Ryzen 9 7940HS', 'Intel Core Ultra 7'][(p + v) % 4]],
        ['gpu_model',   ['Integrated', 'RTX 4060', 'RTX 4070', 'Radeon 780M'][(p + v) % 4]],
        ['os_name',     ['macOS', 'Windows 11 Pro', 'Ubuntu Linux'][(p + v) % 3]]
    ]
    WHEN 2 THEN [
        ['color',        ['Black', 'Silver', 'Blue', 'White', 'Gold'][v]],
        ['apparel_size', ['S', 'M', 'L', 'XL', 'XXL'][v]],
        ['material',     ['100% Cotton', 'Merino Wool', 'Selvedge Denim', 'Mulberry Silk', 'Linen Blend'][(p + v) % 5]],
        ['fit_style',    ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Tailored Fit'][(p + v) % 4]],
        ['season',       ['Spring/Summer', 'Autumn/Winter', 'All-Season'][(p + v) % 3]]
    ]
    WHEN 3 THEN [
        ['color',           ['Black', 'Silver', 'Blue', 'White', 'Gold'][v]],
        ['power_watt',      toString([800, 1200, 1500, 2000][(p + v) % 4])],
        ['capacity_liter',  ['1.5L', '3.5L', '6.5L', '10.0L'][(p + v) % 4]],
        ['warranty_months', toString([12, 24, 36][(p + v) % 3])],
        ['voltage',         ['220V-50Hz', '110V-60Hz', '110-240V Dual'][(p + v) % 3]]
    ]
    ELSE [
        ['author_name', ['Martin Kleppmann', 'Robert C. Martin', 'Abraham Silberschatz', 'C. J. Date', 'Ian Robinson'][(p + v) % 5]],
        ['publisher',   ['OReilly Media', 'Pearson Education', 'McGraw-Hill', 'MIT Press'][(p + v) % 4]],
        ['page_count',  toString([320, 464, 616, 1344][(p + v) % 4])],
        ['language',    ['English', 'Vietnamese', 'Bilingual EN-VN'][(p + v) % 3]],
        ['isbn_note',   'ISBN-978-1-4919-5035-ED' + toString((p + v) % 20)
            + ' | Hardcover Collector Edition with Extended Technical Appendix and Errata Notes']
    ]
END AS kv_list
UNWIND kv_list AS kv
MERGE (a:T1AttrValue {name: kv[0], value: kv[1]})
CREATE (var)-[:T1_HAS_ATTR]->(a)
RETURN count(*) AS created_attr_links;
