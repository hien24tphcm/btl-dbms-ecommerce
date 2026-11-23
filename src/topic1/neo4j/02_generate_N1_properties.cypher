// ==============================================================================
// 02_generate_N1_properties.cypher: Model N1 (Variant Node Inline/Dynamic Props)
// Parameterized batch: pass -P "start_p=>1" -P "end_p=>2000" (5 batches for 10k)
// Identical deterministic formulas to MS SQL Server 02_generate_data.sql
// ==============================================================================

UNWIND range($start_p, $end_p) AS p
WITH p,
     (p - 1) % 5 AS cat_idx,
     ['Smartphones', 'Laptops', 'Fashion', 'Home_Living', 'Books'][(p - 1) % 5] AS cat_name,
     ['Smartphone Model ', 'Laptop Pro ', 'Apparel Item ', 'Home Appliance ', 'Technical Book '][(p - 1) % 5] + toString(p) AS prod_name,
     100.0 + (p % 20) * 25.0 AS base_price
CREATE (prod:T1Product {
    product_id: p,
    category: cat_name,
    product_name: prod_name,
    base_price: base_price
})
WITH prod, p, cat_idx, cat_name
UNWIND range(0, 4) AS v
WITH prod, p, cat_idx, cat_name, v, (p - 1) * 5 + v + 1 AS vid
CREATE (prod)-[:T1_HAS_VARIANT]->(var:T1VariantProp {
    variant_id: vid,
    product_id: p,
    category: cat_name,
    sku: 'SKU-' + toString(p) + '-' + toString(v),
    price: 100.0 + (p % 20) * 25.0 + v * 10.0,
    stock_qty: 10 + ((p + v) % 90),
    color: CASE WHEN cat_idx IN [0, 1, 2, 3]
        THEN ['Black', 'Silver', 'Blue', 'White', 'Gold'][v] ELSE null END,
    storage_gb: CASE WHEN cat_idx = 0 THEN [128, 256, 512, 1024][(p + v) % 4]
                     WHEN cat_idx = 1 THEN [256, 512, 1024, 2048][(p + v) % 4] ELSE null END,
    ram_gb: CASE WHEN cat_idx = 0 THEN [8, 12, 16][(p + v) % 3]
                 WHEN cat_idx = 1 THEN [16, 32, 64][(p + v) % 3] ELSE null END,
    screen_inch: CASE WHEN cat_idx = 0 THEN ['6.1', '6.5', '6.7', '6.9'][(p + v) % 4] ELSE null END,
    chipset: CASE WHEN cat_idx = 0 THEN ['A18 Pro', 'Snapdragon 8 Gen 3', 'Dimensity 9300', 'Tensor G4'][(p + v) % 4] ELSE null END,
    cpu_model: CASE WHEN cat_idx = 1 THEN ['Apple M3 Pro', 'Intel Core i7-13700H', 'AMD Ryzen 9 7940HS', 'Intel Core Ultra 7'][(p + v) % 4] ELSE null END,
    gpu_model: CASE WHEN cat_idx = 1 THEN ['Integrated', 'RTX 4060', 'RTX 4070', 'Radeon 780M'][(p + v) % 4] ELSE null END,
    os_name: CASE WHEN cat_idx = 1 THEN ['macOS', 'Windows 11 Pro', 'Ubuntu Linux'][(p + v) % 3] ELSE null END,
    apparel_size: CASE WHEN cat_idx = 2 THEN ['S', 'M', 'L', 'XL', 'XXL'][v] ELSE null END,
    material: CASE WHEN cat_idx = 2 THEN ['100% Cotton', 'Merino Wool', 'Selvedge Denim', 'Mulberry Silk', 'Linen Blend'][(p + v) % 5] ELSE null END,
    fit_style: CASE WHEN cat_idx = 2 THEN ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Tailored Fit'][(p + v) % 4] ELSE null END,
    season: CASE WHEN cat_idx = 2 THEN ['Spring/Summer', 'Autumn/Winter', 'All-Season'][(p + v) % 3] ELSE null END,
    power_watt: CASE WHEN cat_idx = 3 THEN [800, 1200, 1500, 2000][(p + v) % 4] ELSE null END,
    capacity_liter: CASE WHEN cat_idx = 3 THEN ['1.5L', '3.5L', '6.5L', '10.0L'][(p + v) % 4] ELSE null END,
    warranty_months: CASE WHEN cat_idx = 3 THEN [12, 24, 36][(p + v) % 3] ELSE null END,
    voltage: CASE WHEN cat_idx = 3 THEN ['220V-50Hz', '110V-60Hz', '110-240V Dual'][(p + v) % 3] ELSE null END,
    author_name: CASE WHEN cat_idx = 4 THEN ['Martin Kleppmann', 'Robert C. Martin', 'Abraham Silberschatz', 'C. J. Date', 'Ian Robinson'][(p + v) % 5] ELSE null END,
    publisher: CASE WHEN cat_idx = 4 THEN ['OReilly Media', 'Pearson Education', 'McGraw-Hill', 'MIT Press'][(p + v) % 4] ELSE null END,
    page_count: CASE WHEN cat_idx = 4 THEN [320, 464, 616, 1344][(p + v) % 4] ELSE null END,
    language: CASE WHEN cat_idx = 4 THEN ['English', 'Vietnamese', 'Bilingual EN-VN'][(p + v) % 3] ELSE null END,
    isbn_note: CASE WHEN cat_idx = 4 THEN 'ISBN-978-1-4919-5035-ED' + toString((p + v) % 20)
        + ' | Hardcover Collector Edition with Extended Technical Appendix and Errata Notes' ELSE null END
})
RETURN count(var) AS created_variants;
