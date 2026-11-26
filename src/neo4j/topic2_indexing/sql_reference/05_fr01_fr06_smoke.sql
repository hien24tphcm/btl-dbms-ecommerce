-- Read-only smoke queries. Execute on a test copy of the group's ECommerceDB.
USE [ECommerceDB];
GO
EXEC dbo.sp_SearchProducts @category_id=2, @min_price=800, @max_price=1600,
     @min_rating=4, @in_stock_only=1, @sort_by=N'price_asc';
EXEC dbo.sp_GetProductRatingStats @product_id=9;
SELECT COUNT(*) AS review_count, AVG(CAST(rating AS decimal(5,2))) AS avg_rating
FROM dbo.Reviews WHERE product_id=9;
-- Compare FR-01 exact category case with reference graph (no child categories).
SELECT p.product_id,p.name,p.price,p.stock_quantity,s.rating AS seller_rating
FROM dbo.Products p JOIN dbo.Sellers s ON p.seller_id=s.seller_id
WHERE p.category_id=2 AND p.price BETWEEN 800 AND 1600 AND p.is_active=1
AND p.status=N'active' AND p.stock_quantity>0 AND s.rating>=4
ORDER BY p.price;
-- List candidates for a separate, explicitly approved INSERT test on a disposable DB.
SELECT od.order_detail_id,o.buyer_id,od.product_id,o.order_status
FROM dbo.Order_Details od JOIN dbo.Orders o ON o.order_id=od.order_id
WHERE o.order_status=N'delivered'
AND NOT EXISTS (SELECT 1 FROM dbo.Reviews r WHERE r.order_detail_id=od.order_detail_id
 OR (r.user_id=o.buyer_id AND r.product_id=od.product_id));
-- No INSERT/UPDATE/DELETE executed here. See report/FR01_FR06_KiemThu.md.
GO
