-- ==============================================================================
-- 03_seed.sql: Realistic Seed Data & Baseline Full Database Backup
-- Milestone 1: Multi-Vendor E-Commerce Platform (SQL Server 2022)
-- Strict Alignment with docs/project.md §IV and Downstream Stored Procedures
-- ==============================================================================

USE [ECommerceDB];
GO

PRINT 'Seeding initial data into [ECommerceDB]...';

-- ==============================================================================
-- 1. Users Seed Data (1 Admin, 5 Sellers, 8 Buyers = 14 Users)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = N'admin_root')
BEGIN
    PRINT 'Seeding [dbo.Users]...';
    SET IDENTITY_INSERT dbo.Users ON;

    INSERT INTO dbo.Users (user_id, username, email, password_hash, full_name, phone_number, address, role, is_active, created_at, updated_at) VALUES
    -- Admin
    (1, N'admin_root', N'admin@ecommerce.local', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0adminhash', N'System Administrator', N'0901000001', N'123 Admin Boulevard, District 1, HCMC', N'admin', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- Sellers
    (2, N'seller_techzone', N'support@techzone.vn', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0seller01', N'TechZone Official Store', N'0902000002', N'45 Technology Highway, Thu Duc City, HCMC', N'seller', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (3, N'seller_fashionhub', N'contact@fashionhub.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0seller02', N'FashionHub Apparel Ltd', N'0903000003', N'78 Fashion Street, District 3, HCMC', N'seller', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (4, N'seller_bookstore', N'sales@knowledgebooks.vn', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0seller03', N'Knowledge Bookstore', N'0904000004', N'12 Book Street, District 1, HCMC', N'seller', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (5, N'seller_homeappliances', N'care@modernhome.vn', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0seller04', N'Modern Home Appliances', N'0905000005', N'89 Nguyen Van Linh, District 7, HCMC', N'seller', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (6, N'seller_sporty', N'team@prosports.vn', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0seller05', N'ProSports Athletics', N'0906000006', N'204 Vo Van Kiet, District 5, HCMC', N'seller', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- Buyers
    (7, N'buyer_alex', N'alex.smith@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer01', N'Alex Smith', N'0911000007', N'10 Le Loi, District 1, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (8, N'buyer_beatrice', N'beatrice.tran@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer02', N'Beatrice Tran', N'0912000008', N'55 Hai Ba Trung, District 3, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (9, N'buyer_charlie', N'charlie.le@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer03', N'Charlie Le', N'0913000009', N'88 Tran Hung Dao, District 5, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (10, N'buyer_david', N'david.nguyen@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer04', N'David Nguyen', N'0914000010', N'19 Pham Ngoc Thach, District 3, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (11, N'buyer_emma', N'emma.watson@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer05', N'Emma Watson', N'0915000011', N'42 Nguyen Hue, District 1, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (12, N'buyer_frank', N'frank.wright@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer06', N'Frank Wright', N'0916000012', N'77 Nam Ky Khoi Nghia, District 1, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (13, N'buyer_grace', N'grace.hopper@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer07', N'Grace Hopper', N'0917000013', N'34 Pasteur, District 1, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME()),
    (14, N'buyer_hannah', N'hannah.abbott@example.com', N'$2a$12$K8yR2u/7m2uNqLwSgB9r.uW4qL5u6y8o1z9r8x2v1n0buyer08', N'Hannah Abbott', N'0918000014', N'63 Dinh Tien Hoang, Binh Thanh, HCMC', N'buyer', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Users OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Users] already seeded.';
END
GO

-- ==============================================================================
-- 2. Sellers Seed Data (5 Stores with shop_name, is_approved, address)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Sellers WHERE shop_name = N'TechZone Store')
BEGIN
    PRINT 'Seeding [dbo.Sellers]...';
    SET IDENTITY_INSERT dbo.Sellers ON;

    INSERT INTO dbo.Sellers (seller_id, user_id, shop_name, store_description, rating, is_approved, address, created_at, updated_at) VALUES
    (1, 2, N'TechZone Store', N'Official authorized reseller for premium smartphones, laptops, and smart electronics.', 4.85, 1, N'45 Technology Highway, Thu Duc City, HCMC', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (2, 3, N'FashionHub Official', N'Trendy designer apparel, street wear, and classic formal collection.', 4.70, 1, N'78 Fashion Street, District 3, HCMC', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (3, 4, N'Knowledge Bookstore', N'Specialized in computer science, software engineering, and university textbooks.', 4.90, 1, N'12 Book Street, District 1, HCMC', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (4, 5, N'Modern Home Appliances', N'High efficiency smart kitchen appliances and ergonomic lifestyle products.', 4.65, 1, N'89 Nguyen Van Linh, District 7, HCMC', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (5, 6, N'ProSports Athletics', N'Authentic athletic shoes, training gear, and fitness equipment.', 4.80, 1, N'204 Vo Van Kiet, District 5, HCMC', SYSUTCDATETIME(), SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Sellers OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Sellers] already seeded.';
END
GO

-- ==============================================================================
-- 3. Categories Seed Data (8 Categories: 4 Roots, 4 Hierarchical Subcategories)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE category_name = N'Electronics')
BEGIN
    PRINT 'Seeding [dbo.Categories]...';
    SET IDENTITY_INSERT dbo.Categories ON;

    -- Root categories
    INSERT INTO dbo.Categories (category_id, category_name, description, parent_id, created_at) VALUES
    (1, N'Electronics', N'Consumer electronic devices, gadgets, and components', NULL, SYSUTCDATETIME()),
    (4, N'Fashion & Apparel', N'Men and Women fashion, shoes, and luxury wear', NULL, SYSUTCDATETIME()),
    (7, N'Home & Living', N'Furniture, smart cleaning, and home improvement', NULL, SYSUTCDATETIME()),
    (8, N'Books & Literature', N'Technical books, academic textbooks, and literature', NULL, SYSUTCDATETIME());

    -- Child categories
    INSERT INTO dbo.Categories (category_id, category_name, description, parent_id, created_at) VALUES
    (2, N'Smartphones & Tablets', N'Mobile phones, iPads, Android tablets and accessories', 1, SYSUTCDATETIME()),
    (3, N'Computers & Laptops', N'High performance ultrabooks, workstations, and desktop rigs', 1, SYSUTCDATETIME()),
    (5, N'Men Fashion', N'Shirts, jeans, suits, jackets for men', 4, SYSUTCDATETIME()),
    (6, N'Women Fashion', N'Dresses, skirts, blazers, trousers for women', 4, SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Categories OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Categories] already seeded.';
END
GO

-- ==============================================================================
-- 4. Products Seed Data (24 Products with sold_quantity, is_active, price DECIMAL(18,2))
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE product_id = 1)
BEGIN
    PRINT 'Seeding [dbo.Products]...';
    SET IDENTITY_INSERT dbo.Products ON;

    INSERT INTO dbo.Products (product_id, seller_id, category_id, name, description, price, stock_quantity, sold_quantity, is_active, status, created_at, updated_at) VALUES
    -- TechZone (seller 1)
    (1, 1, 2, N'iPhone 15 Pro Max 256GB Natural Titanium', N'A17 Pro chip, Super Retina XDR display with ProMotion, 48MP main camera.', 1199.00, 45, 25, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (2, 1, 2, N'Samsung Galaxy S24 Ultra 512GB Titanium Gray', N'Snapdragon 8 Gen 3 for Galaxy, Galaxy AI built-in, 200MP camera system.', 1299.00, 30, 18, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (3, 1, 2, N'Google Pixel 8 Pro 128GB Obsidian', N'Google Tensor G3 chip, Google AI camera capabilities, 120Hz LTPO OLED.', 899.00, 20, 12, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (4, 1, 3, N'Apple MacBook Pro 14 M3 Pro 18GB/512GB', N'Liquid Retina XDR, extreme battery life up to 18 hours, Space Black finish.', 1999.00, 15, 8, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (5, 1, 3, N'Dell XPS 15 9530 Core i7-13700H RTX 4060', N'15.6 inch OLED 3.5K touch screen, 32GB RAM, 1TB NVMe SSD.', 1699.00, 18, 10, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (6, 1, 3, N'Lenovo ThinkPad X1 Carbon Gen 11', N'Ultralight magnesium alloy body, Intel Evo Core i7, 16GB RAM, 512GB SSD.', 1499.00, 12, 6, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (7, 1, 1, N'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', N'Industry leading noise canceling, 30 hour battery life, crystal clear hands-free calling.', 349.00, 40, 35, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (8, 1, 1, N'Apple AirPods Pro 2nd Gen USB-C', N'H2 chip, Adaptive Audio, Pro-level Active Noise Cancellation.', 249.00, 50, 42, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- FashionHub (seller 2)
    (9, 2, 5, N'Men Slim-Fit Oxford Dress Shirt Light Blue', N'100% premium long-staple cotton, wrinkle-resistant weave, tailored collar.', 45.00, 120, 65, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (10, 2, 5, N'Men Classic Selvedge Denim Straight Jeans', N'Japanese raw selvedge denim, durable copper rivets, timeless straight cut.', 59.00, 80, 40, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (11, 2, 5, N'Genuine Lambskin Leather Bomber Jacket Black', N'Supple real leather, soft silk lining, robust metal hardware zippers.', 189.00, 25, 14, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (12, 2, 6, N'Women Floral Silk Maxi Summer Dress', N'Breathable Mulberry silk blend, hand-painted floral pattern, A-line silhouette.', 65.00, 90, 55, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (13, 2, 6, N'High-Waisted Tailored Wool Trousers Beige', N'Superfine Merino wool blend, relaxed wide leg with crisp front pleats.', 55.00, 75, 30, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (14, 2, 6, N'Cashmere Double-Breasted Trench Coat Camel', N'Luxurious double-faced Mongolian cashmere, belted waist, horn buttons.', 220.00, 20, 11, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- Knowledge Bookstore (seller 3)
    (15, 3, 8, N'Designing Data-Intensive Applications (Kleppmann)', N'The big ideas behind reliable, scalable, and maintainable systems.', 48.00, 100, 85, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (16, 3, 8, N'Clean Code: A Handbook of Agile Software Craftsmanship (Martin)', N'Principles, patterns, and practices of writing maintainable, clean code.', 42.00, 85, 70, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (17, 3, 8, N'Database System Concepts 7th Edition (Silberschatz)', N'Foundational relational theory, indexing, query optimization, and transactions.', 85.00, 40, 28, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (18, 3, 8, N'System Design Interview An Insider Guide (Alex Xu)', N'Step-by-step framework to master large-scale distributed systems design.', 38.00, 110, 95, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- Modern Home Appliances (seller 4)
    (19, 4, 7, N'Ergonomic Mesh High-Back Office Chair Pro', N'Dynamic lumbar support, 4D adjustable armrests, breathable Korean mesh.', 280.00, 35, 20, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (20, 4, 7, N'Smart Robot Vacuum & Mop Cleaner X10 Pro', N'LiDAR SLAM navigation, 5000Pa suction power, auto-empty dustbin station.', 499.00, 22, 15, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (21, 4, 7, N'Digital Air Fryer XXL 6.5 Liters Touch Screen', N'Rapid air circulation, 12 smart cooking presets, non-stick dishwasher-safe basket.', 129.00, 55, 38, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    -- ProSports Athletics (seller 5)
    (22, 5, 4, N'Pro Running Shoes Air Zoom Pegasus 40', N'Dual Zoom Air units, responsive React foam, breathable engineered mesh upper.', 130.00, 60, 45, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (23, 5, 7, N'Eco-Friendly Non-Slip Yoga Mat 6mm TPE', N'Dual-layer non-slip texture, lightweight with carrying strap, alignment lines.', 35.00, 150, 80, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME()),
    (24, 5, 7, N'Adjustable Dumbbells Set 2x24kg Quick Dial', N'Dial system adjusts weight from 2.5kg to 24kg in seconds, space-saving design.', 240.00, 20, 12, 1, N'active', SYSUTCDATETIME(), SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Products OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Products] already seeded.';
END
GO

-- ==============================================================================
-- 5. Vouchers Seed Data (6 Vouchers with voucher_code PK, discount_percent, min_order_value)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Vouchers WHERE voucher_code = N'WELCOME10')
BEGIN
    PRINT 'Seeding [dbo.Vouchers]...';

    INSERT INTO dbo.Vouchers (voucher_code, discount_percent, min_order_value, max_discount, valid_from, expired_at, usage_limit, used_count) VALUES
    (N'WELCOME10', 10.00, 100.00, 50.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 500, 45),
    (N'TECHSALE15', 15.00, 300.00, 150.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 200, 28),
    (N'FREESHIP', 100.00, 50.00, 15.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 1000, 182),
    (N'FLASH25', 25.00, 200.00, 100.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 100, 62),
    (N'BOOKWORM', 20.00, 60.00, 30.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 300, 35),
    (N'FITNESS30', 30.00, 150.00, 80.00, '2026-01-01T00:00:00', '2026-12-31T23:59:59', 150, 14);
END
ELSE
BEGIN
    PRINT '[dbo.Vouchers] already seeded.';
END
GO

-- ==============================================================================
-- 6. Cart_Items Seed Data (12 Cart Items)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Cart_Items WHERE cart_item_id = 1)
BEGIN
    PRINT 'Seeding [dbo.Cart_Items]...';
    SET IDENTITY_INSERT dbo.Cart_Items ON;

    INSERT INTO dbo.Cart_Items (cart_item_id, user_id, product_id, quantity, added_at) VALUES
    (1, 7, 1, 1, SYSUTCDATETIME()),   -- Alex has iPhone 15 Pro Max
    (2, 7, 7, 1, SYSUTCDATETIME()),   -- Alex has Sony WH-1000XM5
    (3, 8, 12, 2, SYSUTCDATETIME()),  -- Beatrice has Floral Dress
    (4, 8, 15, 1, SYSUTCDATETIME()),  -- Beatrice has DDIA Book
    (5, 9, 4, 1, SYSUTCDATETIME()),   -- Charlie has MacBook Pro
    (6, 10, 16, 1, SYSUTCDATETIME()), -- David has Clean Code
    (7, 10, 18, 1, SYSUTCDATETIME()), -- David has System Design
    (8, 11, 19, 1, SYSUTCDATETIME()), -- Emma has Office Chair
    (9, 11, 21, 1, SYSUTCDATETIME()), -- Emma has Air Fryer
    (10, 12, 22, 1, SYSUTCDATETIME()),-- Frank has Running Shoes
    (11, 12, 24, 1, SYSUTCDATETIME()),-- Frank has Dumbbells
    (12, 13, 9, 2, SYSUTCDATETIME());  -- Grace has Oxford Shirts

    SET IDENTITY_INSERT dbo.Cart_Items OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Cart_Items] already seeded.';
END
GO

-- ==============================================================================
-- 7. Orders Seed Data (16 Orders with buyer_id, seller_id, discount_amount, final_amount, order_status)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE order_id = 1)
BEGIN
    PRINT 'Seeding [dbo.Orders] and [dbo.Order_Details]...';
    SET IDENTITY_INSERT dbo.Orders ON;

    INSERT INTO dbo.Orders (order_id, buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method, created_at, updated_at) VALUES
    -- Order 1: TechZone (Seller 1)
    (1, 7, 1, 1548.00, 0.00, 1548.00, N'delivered', N'10 Le Loi, District 1, HCMC', N'Credit Card', DATEADD(DAY, -20, SYSUTCDATETIME()), DATEADD(DAY, -18, SYSUTCDATETIME())),
    -- Order 2: FashionHub (Seller 2)
    (2, 8, 2, 175.00, 15.00, 160.00, N'delivered', N'55 Hai Ba Trung, District 3, HCMC', N'Bank Transfer', DATEADD(DAY, -18, SYSUTCDATETIME()), DATEADD(DAY, -16, SYSUTCDATETIME())),
    -- Order 3: TechZone (Seller 1)
    (3, 9, 1, 1999.00, 0.00, 1999.00, N'shipped', N'88 Tran Hung Dao, District 5, HCMC', N'Credit Card', DATEADD(DAY, -15, SYSUTCDATETIME()), DATEADD(DAY, -14, SYSUTCDATETIME())),
    -- Order 4: Knowledge Bookstore (Seller 3)
    (4, 10, 3, 86.00, 0.00, 86.00, N'delivered', N'19 Pham Ngoc Thach, District 3, HCMC', N'COD', DATEADD(DAY, -14, SYSUTCDATETIME()), DATEADD(DAY, -12, SYSUTCDATETIME())),
    -- Order 5: Modern Home Appliances (Seller 4)
    (5, 11, 4, 499.00, 0.00, 499.00, N'delivered', N'42 Nguyen Hue, District 1, HCMC', N'E-Wallet', DATEADD(DAY, -12, SYSUTCDATETIME()), DATEADD(DAY, -10, SYSUTCDATETIME())),
    -- Order 6: ProSports Athletics (Seller 5)
    (6, 12, 5, 370.00, 20.00, 350.00, N'shipped', N'77 Nam Ky Khoi Nghia, District 1, HCMC', N'Credit Card', DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, -9, SYSUTCDATETIME())),
    -- Order 7: FashionHub (Seller 2)
    (7, 13, 2, 149.00, 0.00, 149.00, N'processing', N'34 Pasteur, District 1, HCMC', N'COD', DATEADD(DAY, -8, SYSUTCDATETIME()), DATEADD(DAY, -8, SYSUTCDATETIME())),
    -- Order 8: TechZone (Seller 1)
    (8, 14, 1, 249.00, 0.00, 249.00, N'processing', N'63 Dinh Tien Hoang, Binh Thanh, HCMC', N'Credit Card', DATEADD(DAY, -7, SYSUTCDATETIME()), DATEADD(DAY, -7, SYSUTCDATETIME())),
    -- Order 9: TechZone (Seller 1)
    (9, 7, 1, 1299.00, 50.00, 1249.00, N'pending', N'10 Le Loi, District 1, HCMC', N'Credit Card', DATEADD(DAY, -5, SYSUTCDATETIME()), DATEADD(DAY, -5, SYSUTCDATETIME())),
    -- Order 10: FashionHub (Seller 2)
    (10, 8, 2, 220.00, 0.00, 220.00, N'delivered', N'55 Hai Ba Trung, District 3, HCMC', N'Bank Transfer', DATEADD(DAY, -5, SYSUTCDATETIME()), DATEADD(DAY, -3, SYSUTCDATETIME())),
    -- Order 11: TechZone (Seller 1)
    (11, 9, 1, 899.00, 0.00, 899.00, N'cancelled', N'88 Tran Hung Dao, District 5, HCMC', N'Credit Card', DATEADD(DAY, -4, SYSUTCDATETIME()), DATEADD(DAY, -4, SYSUTCDATETIME())),
    -- Order 12: Knowledge Bookstore (Seller 3)
    (12, 10, 3, 170.00, 10.00, 160.00, N'delivered', N'19 Pham Ngoc Thach, District 3, HCMC', N'COD', DATEADD(DAY, -3, SYSUTCDATETIME()), DATEADD(DAY, -1, SYSUTCDATETIME())),
    -- Order 13: Modern Home Appliances (Seller 4)
    (13, 11, 4, 409.00, 0.00, 409.00, N'processing', N'42 Nguyen Hue, District 1, HCMC', N'E-Wallet', DATEADD(DAY, -2, SYSUTCDATETIME()), DATEADD(DAY, -2, SYSUTCDATETIME())),
    -- Order 14: ProSports Athletics (Seller 5)
    (14, 12, 5, 70.00, 0.00, 70.00, N'delivered', N'77 Nam Ky Khoi Nghia, District 1, HCMC', N'COD', DATEADD(DAY, -2, SYSUTCDATETIME()), DATEADD(DAY, -1, SYSUTCDATETIME())),
    -- Order 15: FashionHub (Seller 2)
    (15, 13, 2, 189.00, 0.00, 189.00, N'shipped', N'34 Pasteur, District 1, HCMC', N'Credit Card', DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME()),
    -- Order 16: TechZone (Seller 1)
    (16, 14, 1, 1699.00, 100.00, 1599.00, N'pending', N'63 Dinh Tien Hoang, Binh Thanh, HCMC', N'Bank Transfer', SYSUTCDATETIME(), SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Orders OFF;

    -- ==============================================================================
    -- 8. Order_Details Seed Data (22 Items strictly aligned with Orders & Sellers)
    -- ==============================================================================
    SET IDENTITY_INSERT dbo.Order_Details ON;

    INSERT INTO dbo.Order_Details (order_detail_id, order_id, product_id, quantity, unit_price, subtotal) VALUES
    -- Order 1 (Seller 1: TechZone): 1548.00 (iPhone 1199 + Sony 349)
    (1, 1, 1, 1, 1199.00, 1199.00),
    (2, 1, 7, 1, 349.00, 349.00),
    -- Order 2 (Seller 2: FashionHub): 175.00 (Dress 65*2 = 130 + Shirt 45*1 = 45)
    (3, 2, 12, 2, 65.00, 130.00),
    (4, 2, 9, 1, 45.00, 45.00),
    -- Order 3 (Seller 1: TechZone): 1999.00 (MacBook Pro)
    (5, 3, 4, 1, 1999.00, 1999.00),
    -- Order 4 (Seller 3: Knowledge Bookstore): 86.00 (DDIA 48 + System Design 38)
    (6, 4, 15, 1, 48.00, 48.00),
    (7, 4, 18, 1, 38.00, 38.00),
    -- Order 5 (Seller 4: Modern Home Appliances): 499.00 (Robot Vacuum)
    (8, 5, 20, 1, 499.00, 499.00),
    -- Order 6 (Seller 5: ProSports Athletics): 370.00 (Running shoes 130 + Dumbbells 240)
    (9, 6, 22, 1, 130.00, 130.00),
    (10, 6, 24, 1, 240.00, 240.00),
    -- Order 7 (Seller 2: FashionHub): 149.00 (Shirt 45*2 = 90 + Jeans 59*1 = 59)
    (11, 7, 9, 2, 45.00, 90.00),
    (12, 7, 10, 1, 59.00, 59.00),
    -- Order 8 (Seller 1: TechZone): 249.00 (AirPods Pro)
    (13, 8, 8, 1, 249.00, 249.00),
    -- Order 9 (Seller 1: TechZone): 1299.00 (Galaxy S24 Ultra)
    (14, 9, 2, 1, 1299.00, 1299.00),
    -- Order 10 (Seller 2: FashionHub): 220.00 (Cashmere Trench Coat)
    (15, 10, 14, 1, 220.00, 220.00),
    -- Order 11 (Seller 1: TechZone): 899.00 (Pixel 8 Pro)
    (16, 11, 3, 1, 899.00, 899.00),
    -- Order 12 (Seller 3: Knowledge Bookstore): 170.00 (Database System Concepts 85*2 = 170)
    (17, 12, 17, 2, 85.00, 170.00),
    -- Order 13 (Seller 4: Modern Home Appliances): 409.00 (Office chair 280 + Air fryer 129)
    (18, 13, 19, 1, 280.00, 280.00),
    (19, 13, 21, 1, 129.00, 129.00),
    -- Order 14 (Seller 5: ProSports Athletics): 70.00 (Yoga mat 35*2 = 70)
    (20, 14, 23, 2, 35.00, 70.00),
    -- Order 15 (Seller 2: FashionHub): 189.00 (Leather Bomber Jacket)
    (21, 15, 11, 1, 189.00, 189.00),
    -- Order 16 (Seller 1: TechZone): 1699.00 (Dell XPS 15)
    (22, 16, 5, 1, 1699.00, 1699.00);

    SET IDENTITY_INSERT dbo.Order_Details OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Orders] and [dbo.Order_Details] already seeded.';
END
GO

-- ==============================================================================
-- 9. Reviews Seed Data (16 Reviews matching delivered products & orders)
-- ==============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Reviews WHERE review_id = 1)
BEGIN
    PRINT 'Seeding [dbo.Reviews]...';
    SET IDENTITY_INSERT dbo.Reviews ON;

    INSERT INTO dbo.Reviews (review_id, order_detail_id, user_id, product_id, rating, comment, created_at) VALUES
    (1, 1, 7, 1, 5, N'Exceptional performance, camera is top notch, titanium build feels amazing in hand.', DATEADD(DAY, -17, SYSUTCDATETIME())),
    (2, 2, 7, 7, 5, N'Best active noise cancelling headphones on the market. Incredibly comfortable for all-day flights.', DATEADD(DAY, -16, SYSUTCDATETIME())),
    (3, 3, 8, 12, 4, N'Lovely summer dress, premium silk fabric, fits very well though slightly long for my height.', DATEADD(DAY, -15, SYSUTCDATETIME())),
    (4, 4, 8, 9, 5, N'Crisp Oxford weave, breathable cotton material, perfect tailored fit for office wear.', DATEADD(DAY, -14, SYSUTCDATETIME())),
    (5, 5, 9, 4, 5, N'M3 Pro chip delivers unbelievable compilation speeds and 16 hours real-world battery life.', DATEADD(DAY, -13, SYSUTCDATETIME())),
    (6, 6, 10, 15, 5, N'The holy grail textbook on distributed systems, replication, and data models. Highly recommended!', DATEADD(DAY, -11, SYSUTCDATETIME())),
    (7, 7, 10, 18, 5, N'Very realistic scenarios for real-world architecture interviews and system scaling.', DATEADD(DAY, -10, SYSUTCDATETIME())),
    (8, 8, 11, 20, 4, N'Great navigation with LiDAR, reaches corners well. The auto-empty station is super convenient.', DATEADD(DAY, -9, SYSUTCDATETIME())),
    (9, 9, 12, 22, 5, N'Superior cushioning and energy return. Excellent running shoes for half-marathon training.', DATEADD(DAY, -8, SYSUTCDATETIME())),
    (10, 10, 12, 24, 4, N'Quick dial mechanism is very sturdy. Saves a ton of space in my home workout corner.', DATEADD(DAY, -7, SYSUTCDATETIME())),
    (11, 15, 8, 14, 5, N'Superb cashmere quality, luxurious feeling, and keeps warm effectively during autumn breezes.', DATEADD(DAY, -2, SYSUTCDATETIME())),
    (12, 17, 10, 17, 5, N'Comprehensive theoretical coverage of query processing, relational calculus, and ACID guarantees.', DATEADD(DAY, -1, SYSUTCDATETIME())),
    (13, 20, 12, 23, 5, N'Thick 6mm cushioning protects knees well, superior non-slip grip even with heavy sweating.', SYSUTCDATETIME()),
    (14, 21, 13, 11, 5, N'Genuine leather smell, butter-soft lambskin, sturdy metal zippers. Worth every dollar.', SYSUTCDATETIME()),
    (15, 13, 14, 8, 5, N'Seamless pairing across devices and transparency mode is best in class.', SYSUTCDATETIME()),
    (16, 11, 13, 9, 4, N'Good fit, comfortable collar and cuffs, durable after multiple laundry cycles.', SYSUTCDATETIME());

    SET IDENTITY_INSERT dbo.Reviews OFF;
END
ELSE
BEGIN
    PRINT '[dbo.Reviews] already seeded.';
END
GO

-- ==============================================================================
-- 10. Baseline Full Database Backup
-- Transition out of pseudo-simple recovery mode & establish base LSN chain
-- ==============================================================================
PRINT '==============================================================================';
PRINT 'Performing Baseline Full Database Backup to establish LSN chain...';
PRINT '==============================================================================';

BACKUP DATABASE [ECommerceDB]
TO DISK = N'/var/opt/mssql/backup/ECommerceDB_baseline.bak'
WITH FORMAT, INIT, COMPRESSION, CHECKSUM;
GO

PRINT '03_seed.sql and Baseline Backup executed successfully.';
GO