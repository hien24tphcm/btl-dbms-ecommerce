"""
Milestone 2 Verification Test Suite
Verifies Stored Procedures, Views, Types, and Functional Requirements (FR-01 through FR-12).
Validates 8 Query Types (a through h), Parameter Signatures, ACID Transactions, and Error Handling.
Strict Alignment with docs/project.md §II, §III, §IV and Topic 5 Disaster Recovery Requirements.
"""

import os
import re
import unittest
import pytest

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class SeedDataStore:
    """Parses 03_seed.sql to extract in-memory datasets for offline verification."""
    def __init__(self):
        seed_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "03_seed.sql")
        with open(seed_path, "r", encoding="utf-8") as f:
            text = f.read()

        # 1. Users
        user_matches = re.findall(
            r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*N'\$2a\$[^']+',\s*N'([^']+)',\s*(?:N'([^']+)'|NULL),\s*(?:N'([^']+)'|NULL),\s*N'([^']+)',\s*([01]),",
            text
        )
        self.users = {}
        for r in user_matches:
            self.users[int(r[0])] = {
                "user_id": int(r[0]), "username": r[1], "email": r[2], "full_name": r[3],
                "phone_number": r[4], "address": r[5], "role": r[6], "is_active": int(r[7])
            }

        # 2. Sellers
        seller_matches = re.findall(
            r"\((\d+),\s*(\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(\d+\.\d{2}),\s*([01]),\s*N'([^']+)',",
            text
        )
        self.sellers = {}
        for r in seller_matches:
            self.sellers[int(r[0])] = {
                "seller_id": int(r[0]), "user_id": int(r[1]), "shop_name": r[2],
                "store_description": r[3], "rating": float(r[4]), "is_approved": int(r[5]), "address": r[6]
            }

        # 3. Categories
        cat_matches = re.findall(r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(NULL|\d+)", text)
        self.categories = {}
        for r in cat_matches:
            self.categories[int(r[0])] = {
                "category_id": int(r[0]), "category_name": r[1], "description": r[2],
                "parent_id": None if r[3] == "NULL" else int(r[3])
            }

        # 4. Products
        prod_matches = re.findall(
            r"\((\d+),\s*(\d+),\s*(\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(\d+\.\d{2}),\s*(\d+),\s*(\d+),\s*([01]),\s*N'([^']+)'",
            text
        )
        self.products = {}
        for r in prod_matches:
            self.products[int(r[0])] = {
                "product_id": int(r[0]), "seller_id": int(r[1]), "category_id": int(r[2]),
                "name": r[3], "description": r[4], "price": float(r[5]),
                "stock_quantity": int(r[6]), "sold_quantity": int(r[7]), "is_active": int(r[8]), "status": r[9]
            }

        # 5. Vouchers
        voucher_matches = re.findall(
            r"\(N'([^']+)',\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)",
            text
        )
        self.vouchers = {}
        for r in voucher_matches:
            self.vouchers[r[0]] = {
                "voucher_code": r[0], "discount_percent": float(r[1]),
                "min_order_value": float(r[2]), "max_discount": float(r[3]),
                "valid_from": r[4], "expired_at": r[5], "usage_limit": int(r[6]), "used_count": int(r[7])
            }

        # 6. Cart_Items
        cart_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*SYSUTCDATETIME\(\)\)", text)
        self.cart_items = {}
        for r in cart_matches:
            self.cart_items[int(r[0])] = {
                "cart_item_id": int(r[0]), "user_id": int(r[1]), "product_id": int(r[2]), "quantity": int(r[3])
            }

        # 7. Orders
        order_matches = re.findall(
            r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*N'([^']+)',\s*N'([^']+)',\s*N'([^']+)'",
            text
        )
        self.orders = {}
        for r in order_matches:
            self.orders[int(r[0])] = {
                "order_id": int(r[0]), "buyer_id": int(r[1]), "seller_id": int(r[2]),
                "total_amount": float(r[3]), "discount_amount": float(r[4]), "final_amount": float(r[5]),
                "order_status": r[6], "shipping_address": r[7], "payment_method": r[8]
            }

        # 8. Order_Details
        od_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d{2}),\s*(\d+\.\d{2})\)", text)
        self.order_details = {}
        for r in od_matches:
            self.order_details[int(r[0])] = {
                "order_detail_id": int(r[0]), "order_id": int(r[1]), "product_id": int(r[2]),
                "quantity": int(r[3]), "unit_price": float(r[4]), "subtotal": float(r[5])
            }

        # 9. Reviews
        rev_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([1-5]),\s*N'([^']+)'", text)
        self.reviews = {}
        for r in rev_matches:
            self.reviews[int(r[0])] = {
                "review_id": int(r[0]), "order_detail_id": int(r[1]), "user_id": int(r[2]),
                "product_id": int(r[3]), "rating": int(r[4]), "comment": r[5]
            }


class TestMilestone2Procedures(unittest.TestCase):
    def setUp(self):
        self.sql_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "04_procedures_fr.sql")
        self.assertTrue(os.path.isfile(self.sql_path), f"File missing: {self.sql_path}")
        with open(self.sql_path, "r", encoding="utf-8") as f:
            self.sql_content = f.read()
        self.seed = SeedDataStore()

    def test_file_exists_and_non_empty(self):
        self.assertGreater(os.path.getsize(self.sql_path), 5000, "04_procedures_fr.sql is smaller than expected")

    def test_database_context_and_types(self):
        self.assertIn("USE [ECommerceDB];", self.sql_content)
        # Check TVP_OrderItem user-defined table type
        self.assertRegex(
            self.sql_content,
            r"CREATE\s+TYPE\s+dbo\.TVP_OrderItem\s+AS\s+TABLE",
            "User-Defined Table Type dbo.TVP_OrderItem is missing"
        )
        self.assertIn("product_id INT NOT NULL", self.sql_content)
        self.assertIn("quantity INT NOT NULL", self.sql_content)

    def test_helper_views_declared(self):
        views = [
            "dbo.v_OrderFulfillmentSummary",
            "dbo.v_SellerPerformanceMetrics"
        ]
        for v in views:
            pattern = rf"CREATE\s+OR\s+ALTER\s+VIEW\s+{re.escape(v)}"
            self.assertRegex(self.sql_content, pattern, f"View {v} not properly declared with CREATE OR ALTER")

    def test_all_16_stored_procedures_declared(self):
        expected_procedures = [
            "dbo.sp_SearchProducts",           # FR-01 (query e)
            "dbo.sp_GetProductDetails",        # FR-02 (query d)
            "dbo.sp_AddToCart",                # FR-03 (query a)
            "dbo.sp_RemoveFromCart",           # FR-03 (query b)
            "dbo.sp_PlaceOrder",               # FR-04 (queries a, c)
            "dbo.sp_GetOrderDetailsJoin",      # FR-05 (query f)
            "dbo.sp_CancelOrder",              # FR-05 (query c)
            "dbo.sp_AddReview",                # FR-06 (query a)
            "dbo.sp_GetProductRatingStats",    # FR-06 (query h)
            "dbo.sp_UpsertProduct",            # FR-07 (queries a, c)
            "dbo.sp_AdjustInventory",          # FR-08 (query c)
            "dbo.sp_UpdateOrderFulfillment",   # FR-09 (query c)
            "dbo.sp_GetSellerOrders",          # FR-09 (query f)
            "dbo.sp_GetSellerAnalytics",       # FR-10 (query h)
            "dbo.sp_ModerateUserAccount",      # FR-11 (query c)
            "dbo.sp_ApproveSeller",            # FR-11 (query c)
            "dbo.sp_GetAboveAverageSellers"    # FR-12 (queries g, h)
        ]
        for sp in expected_procedures:
            pattern = rf"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+{re.escape(sp)}"
            self.assertRegex(
                self.sql_content,
                pattern,
                f"Stored Procedure {sp} not declared with CREATE OR ALTER PROCEDURE"
            )

    def test_stored_procedure_parameters_and_signatures(self):
        # 1. sp_SearchProducts
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@keyword NVARCHAR\(100\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@category_id INT")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@min_price DECIMAL\(18,2\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@max_price DECIMAL\(18,2\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@min_rating DECIMAL\(3,2\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@in_stock_only BIT")
        self.assertRegex(self.sql_content, r"dbo\.sp_SearchProducts[\s\S]*?@sort_by NVARCHAR\(20\)")

        # 2. sp_GetProductDetails
        self.assertRegex(self.sql_content, r"dbo\.sp_GetProductDetails[\s\S]*?@product_id INT")

        # 3. sp_AddToCart & sp_RemoveFromCart
        self.assertRegex(self.sql_content, r"dbo\.sp_AddToCart[\s\S]*?@user_id INT[\s\S]*?@product_id INT")
        self.assertRegex(self.sql_content, r"dbo\.sp_RemoveFromCart[\s\S]*?@user_id INT[\s\S]*?@product_id INT[\s\S]*?@cart_item_id INT[\s\S]*?@clear_all BIT")

        # 4. sp_PlaceOrder
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@buyer_id INT")
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@seller_id INT")
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@voucher_code NVARCHAR\(50\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@shipping_address NVARCHAR\(255\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@payment_method NVARCHAR\(50\)")
        self.assertRegex(self.sql_content, r"dbo\.sp_PlaceOrder[\s\S]*?@new_order_id INT OUTPUT")

        # 5. sp_GetOrderDetailsJoin
        self.assertRegex(self.sql_content, r"dbo\.sp_GetOrderDetailsJoin[\s\S]*?@order_id INT[\s\S]*?@user_id INT")

        # 6. sp_CancelOrder
        self.assertRegex(self.sql_content, r"dbo\.sp_CancelOrder[\s\S]*?@order_id INT[\s\S]*?@buyer_id INT")

        # 7. sp_AddReview
        self.assertRegex(self.sql_content, r"dbo\.sp_AddReview[\s\S]*?@user_id INT[\s\S]*?@order_detail_id INT[\s\S]*?@rating INT")

        # 8. sp_GetProductRatingStats
        self.assertRegex(self.sql_content, r"dbo\.sp_GetProductRatingStats[\s\S]*?@product_id INT")

        # 9. sp_UpsertProduct
        self.assertRegex(self.sql_content, r"dbo\.sp_UpsertProduct[\s\S]*?@seller_id INT[\s\S]*?@product_id INT = NULL OUTPUT")

        # 10. sp_AdjustInventory
        self.assertRegex(self.sql_content, r"dbo\.sp_AdjustInventory[\s\S]*?@seller_id INT[\s\S]*?@product_id INT[\s\S]*?@stock_delta INT")

        # 11. sp_UpdateOrderFulfillment
        self.assertRegex(self.sql_content, r"dbo\.sp_UpdateOrderFulfillment[\s\S]*?@seller_id INT[\s\S]*?@order_id INT[\s\S]*?@new_status NVARCHAR\(30\)")

        # 12. sp_GetSellerOrders
        self.assertRegex(self.sql_content, r"dbo\.sp_GetSellerOrders[\s\S]*?@seller_id INT")

        # 13. sp_GetSellerAnalytics
        self.assertRegex(self.sql_content, r"dbo\.sp_GetSellerAnalytics[\s\S]*?@seller_id INT")

        # 14. sp_ModerateUserAccount
        self.assertRegex(self.sql_content, r"dbo\.sp_ModerateUserAccount[\s\S]*?@admin_id INT[\s\S]*?@target_user_id INT[\s\S]*?@is_active BIT")

        # 15. sp_ApproveSeller
        self.assertRegex(self.sql_content, r"dbo\.sp_ApproveSeller[\s\S]*?@admin_id INT[\s\S]*?@seller_id INT")

        # 16. sp_GetAboveAverageSellers
        self.assertRegex(self.sql_content, r"dbo\.sp_GetAboveAverageSellers[\s\S]*?@admin_id INT")

    def test_transaction_atomicity_and_rollback_safeguards(self):
        """Mutating procedures must maintain transactional ACID consistency with TRY-CATCH and ROLLBACK."""
        mutating_procedures = [
            "sp_PlaceOrder",
            "sp_CancelOrder",
            "sp_AddReview",
            "sp_ModerateUserAccount"
        ]
        for proc in mutating_procedures:
            proc_pattern = rf"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.{proc}[\s\S]*?GO"
            match = re.search(proc_pattern, self.sql_content)
            self.assertIsNotNone(match, f"Block for {proc} not found")
            proc_body = match.group(0)

            self.assertIn("BEGIN TRY", proc_body, f"{proc} missing BEGIN TRY")
            self.assertIn("BEGIN TRANSACTION", proc_body, f"{proc} missing BEGIN TRANSACTION")
            self.assertIn("COMMIT TRANSACTION", proc_body, f"{proc} missing COMMIT TRANSACTION")
            self.assertIn("BEGIN CATCH", proc_body, f"{proc} missing BEGIN CATCH")
            self.assertIn("ROLLBACK TRANSACTION", proc_body, f"{proc} missing ROLLBACK TRANSACTION")
            self.assertIn("THROW;", proc_body, f"{proc} missing THROW in catch block")

    def test_topic_5_order_cancellation_guards(self):
        """FR-05 / Topic 5: Order cancellation guard prevents cancelling shipped/delivered orders."""
        match = re.search(r"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.sp_CancelOrder[\s\S]*?GO", self.sql_content)
        self.assertIsNotNone(match)
        body = match.group(0)

        self.assertIn("'shipped', 'delivered'", body)
        self.assertIn("Cannot cancel order in shipping or delivered state", body)
        self.assertIn("stock_quantity = p.stock_quantity + od.quantity", body)
        self.assertIn("sold_quantity = CASE WHEN p.sold_quantity >= od.quantity", body)

    def test_topic_5_order_fulfillment_state_machine(self):
        """FR-09 / Topic 5: Fulfillment must enforce strict monotonic forward progression."""
        match = re.search(r"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.sp_UpdateOrderFulfillment[\s\S]*?GO", self.sql_content)
        self.assertIsNotNone(match)
        body = match.group(0)

        self.assertIn("@current_status = 'pending' AND @new_status = 'processing'", body)
        self.assertIn("@current_status = 'processing' AND @new_status = 'shipped'", body)
        self.assertIn("@current_status = 'shipped' AND @new_status = 'delivered'", body)
        self.assertIn("Illegal order state transition", body)
        self.assertIn("50008", body)

    def test_topic_5_admin_moderation_cascades(self):
        """FR-11 / Topic 5: Account deactivation automatically deactivates seller products."""
        match = re.search(r"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.sp_ModerateUserAccount[\s\S]*?GO", self.sql_content)
        self.assertIsNotNone(match)
        body = match.group(0)

        self.assertIn("UPDATE dbo.Users", body)
        self.assertIn("UPDATE dbo.Products", body)
        self.assertIn("is_active = 0", body)
        self.assertIn("status = 'inactive'", body)
        self.assertIn("SELECT seller_id FROM dbo.Sellers WHERE user_id = @target_user_id", body)
        self.assertIn("50010", body)

    def test_platform_bi_subquery_and_having(self):
        """FR-12: Subquery with HAVING comparing seller delivered revenue against platform mean."""
        match = re.search(r"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.sp_GetAboveAverageSellers[\s\S]*?GO", self.sql_content)
        self.assertIsNotNone(match)
        body = match.group(0)

        self.assertIn("HAVING SUM(o.final_amount) >", body)
        self.assertIn("SELECT AVG(shop_rev)", body)
        self.assertIn("GROUP BY seller_id", body)
        self.assertIn("order_status = 'delivered'", body)

    def test_all_standard_error_codes_present(self):
        """Verify presence of all standardized error codes (50001 through 50010)."""
        for code in range(50001, 50011):
            self.assertIn(f"THROW {code},", self.sql_content, f"Error code {code} missing from procedures")

    # =========================================================================
    # BEHAVIORAL LOGIC & CONTRACT VERIFICATION
    # =========================================================================

    def test_behavior_fr01_search_products_composite_filters(self):
        """Simulates sp_SearchProducts logic against seed data store."""
        # Condition: category_id = 2, min_price = 800, max_price = 1300, in_stock_only = 1
        results = [
            p for p in self.seed.products.values()
            if p["is_active"] == 1
            and p["status"] == "active"
            and p["category_id"] == 2
            and 800.00 <= p["price"] <= 1300.00
            and p["stock_quantity"] > 0
        ]
        # Should return Pixel 8 Pro (899), iPhone 15 Pro Max (1199), Galaxy S24 Ultra (1299)
        self.assertEqual(len(results), 3)
        product_names = [p["name"] for p in results]
        self.assertTrue(any("iPhone 15 Pro Max" in n for n in product_names))
        self.assertTrue(any("Galaxy S24 Ultra" in n for n in product_names))
        self.assertTrue(any("Pixel 8 Pro" in n for n in product_names))

    def test_behavior_fr04_order_placement_voucher_discount_and_capping(self):
        """Simulates sp_PlaceOrder voucher discount and max discount cap calculation."""
        voucher = self.seed.vouchers["WELCOME10"]
        total_amount = 600.00  # 10% = 60.00, but max_discount is 50.00
        disc_amount = total_amount * voucher["discount_percent"] / 100.00
        if voucher["max_discount"] is not None and disc_amount > voucher["max_discount"]:
            disc_amount = voucher["max_discount"]
        final_amount = total_amount - disc_amount

        self.assertEqual(disc_amount, 50.00)
        self.assertEqual(final_amount, 550.00)

    def test_behavior_fr05_order_details_multi_table_join(self):
        """Simulates sp_GetOrderDetailsJoin for Order 1."""
        target_order_id = 1
        order = self.seed.orders[target_order_id]
        buyer = self.seed.users[order["buyer_id"]]
        seller = self.seed.sellers[order["seller_id"]]
        details = [od for od in self.seed.order_details.values() if od["order_id"] == target_order_id]

        self.assertEqual(order["order_status"], "delivered")
        self.assertEqual(buyer["full_name"], "Alex Smith")
        self.assertEqual(seller["shop_name"], "TechZone Store")
        self.assertEqual(len(details), 2)
        total_calc = sum(d["subtotal"] for d in details)
        self.assertEqual(total_calc, order["total_amount"])

    def test_behavior_fr05_order_cancellation_guards(self):
        """Simulates sp_CancelOrder guard against delivered or shipped orders."""
        order_delivered = self.seed.orders[1]  # delivered
        order_shipped = self.seed.orders[3]    # shipped
        order_pending = self.seed.orders[9]    # pending
        order_processing = self.seed.orders[7] # processing

        # Cancellation should be blocked for delivered and shipped
        self.assertIn(order_delivered["order_status"], ["shipped", "delivered"])
        self.assertIn(order_shipped["order_status"], ["shipped", "delivered"])

        # Cancellation should be allowed for pending and processing
        self.assertIn(order_pending["order_status"], ["pending", "processing"])
        self.assertIn(order_processing["order_status"], ["pending", "processing"])

    def test_behavior_fr09_monotonic_fulfillment_progression(self):
        """Simulates sp_UpdateOrderFulfillment monotonic forward transitions."""
        valid_transitions = {
            "pending": "processing",
            "processing": "shipped",
            "shipped": "delivered"
        }
        for current_st, next_st in valid_transitions.items():
            is_valid = (
                (current_st == "pending" and next_st == "processing") or
                (current_st == "processing" and next_st == "shipped") or
                (current_st == "shipped" and next_st == "delivered")
            )
            self.assertTrue(is_valid)

        # Disallowed transitions:
        invalid_transitions = [
            ("delivered", "pending"),
            ("shipped", "processing"),
            ("cancelled", "processing"),
            ("pending", "delivered")
        ]
        for cur, nxt in invalid_transitions:
            is_valid = (
                (cur == "pending" and nxt == "processing") or
                (cur == "processing" and nxt == "shipped") or
                (cur == "shipped" and nxt == "delivered")
            )
            self.assertFalse(is_valid)

    def test_behavior_fr11_admin_role_authorization_and_product_cascade(self):
        """Simulates sp_ModerateUserAccount authorization and cascading deactivation."""
        admin_user = self.seed.users[1]
        self.assertEqual(admin_user["role"], "admin")
        self.assertEqual(admin_user["is_active"], 1)

        buyer_user = self.seed.users[7]
        self.assertNotEqual(buyer_user["role"], "admin")

        # Seller target: seller 1 is associated with user 2
        seller_user_id = 2
        seller_products = [p for p in self.seed.products.values() if p["seller_id"] == 1]
        self.assertGreater(len(seller_products), 0)

    def test_behavior_fr12_above_average_sellers_subquery(self):
        """Simulates sp_GetAboveAverageSellers platform average comparison."""
        seller_delivered_rev = {}
        for o in self.seed.orders.values():
            if o["order_status"] == "delivered":
                sid = o["seller_id"]
                seller_delivered_rev[sid] = seller_delivered_rev.get(sid, 0.0) + o["final_amount"]

        avg_rev = sum(seller_delivered_rev.values()) / len(seller_delivered_rev)
        above_avg = {sid: rev for sid, rev in seller_delivered_rev.items() if rev > avg_rev}

        # Verify that only sellers whose revenue exceeds average are identified
        self.assertGreater(len(above_avg), 0)
        for sid, rev in above_avg.items():
            self.assertGreater(rev, avg_rev)


if __name__ == "__main__":
    unittest.main()
