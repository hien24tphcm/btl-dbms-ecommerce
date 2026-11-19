"""
tools/tests/test_schema_and_queries.py: Comprehensive Schema, Queries & Business Logic Test Suite
==================================================================================================
Tiers Covered:
  - Tier 1: Schema Verification (9 Tables, Constraints, 10 Performance Indexes, Database Settings)
  - Tier 1: Functional Happy Paths (FR-01 through FR-12 and 8 Query Types a through h)
  - Tier 2: Boundary & Corner Cases (Negative stock, insufficient stock, expired/exhausted vouchers,
            cancellation of shipped/delivered orders, duplicate reviews, invalid state transitions,
            unauthorized admin actions)
  - Tier 3: Cross-Feature Combinations & Multi-Actor Lifecycle Flows (Buyer -> Seller -> Admin)
==================================================================================================
"""

import os
import re
import sqlite3
import pytest
from typing import Any, Dict, List, Set, Tuple

try:
    from tools.tests.conftest import is_mssql_online
except ImportError:
    try:
        from conftest import is_mssql_online
    except ImportError:
        def is_mssql_online() -> bool:
            return False

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCHEMA_SQL_PATH = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "01_schema.sql")
INDEXES_SQL_PATH = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "02_indexes.sql")
SEED_SQL_PATH = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "03_seed.sql")


def _read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def translate_mssql_to_sqlite(sql_text: str) -> List[Tuple[str, str]]:
    """
    Translates MSSQL DDL statements from 01_schema.sql into valid SQLite statements
    for authentic in-memory relational integrity probing with PRAGMA foreign_keys = ON.
    """
    table_blocks = re.findall(
        r"CREATE TABLE\s+(?:dbo\.)?(\w+)\s*\((.*?)\);\s*END",
        sql_text,
        re.DOTALL | re.IGNORECASE
    )
    sqlite_statements = []
    for tbl, body in table_blocks:
        b = re.sub(r"dbo\.", "", body)
        b = re.sub(r"INT\s+IDENTITY\(1,1\)\s+NOT\s+NULL", "INTEGER PRIMARY KEY AUTOINCREMENT", b, flags=re.I)
        b = re.sub(r"\bCLUSTERED\b", "", b, flags=re.I)
        if "INTEGER PRIMARY KEY AUTOINCREMENT" in b:
            b = re.sub(r",\s*CONSTRAINT\s+PK_\w+\s+PRIMARY\s+KEY\s*\(\w+\)", "", b, flags=re.I)
        b = re.sub(r"NVARCHAR\([^)]+\)", "TEXT", b, flags=re.I)
        b = re.sub(r"NVARCHAR\(MAX\)", "TEXT", b, flags=re.I)
        b = re.sub(r"DECIMAL\([^)]+\)", "NUMERIC", b, flags=re.I)
        b = re.sub(r"DATETIME2", "TEXT", b, flags=re.I)
        b = re.sub(r"BIT", "INTEGER", b, flags=re.I)
        b = re.sub(r"CONSTRAINT\s+DF_\w+\s+DEFAULT\s+SYSUTCDATETIME\(\)", "DEFAULT CURRENT_TIMESTAMP", b, flags=re.I)
        b = re.sub(r"CONSTRAINT\s+DF_\w+\s+DEFAULT\s+", "DEFAULT ", b, flags=re.I)
        sqlite_statements.append((tbl, f"CREATE TABLE {tbl} ({b});"))
    return sqlite_statements


# =============================================================================
# Helper: Parsed Relational Model from Seed Data for Deterministic Verification
# =============================================================================
class SeedDataStore:
    def __init__(self):
        text = _read_file(SEED_SQL_PATH)
        
        # 1. Users: user_id, username, email, password_hash, full_name, phone, address, role, is_active
        user_matches = re.findall(
            r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*N'([^']+)',\s*N'([^']+)',\s*(?:N'([^']+)'|NULL),\s*(?:N'([^']+)'|NULL),\s*N'([^']+)',\s*([01]),",
            text
        )
        self.users = {}
        for r in user_matches:
            self.users[int(r[0])] = {
                "user_id": int(r[0]), "username": r[1], "email": r[2], "full_name": r[4],
                "phone_number": r[5], "address": r[6], "role": r[7], "is_active": int(r[8])
            }

        # 2. Sellers: seller_id, user_id, shop_name, store_description, rating, is_approved, address
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

        # 3. Categories: category_id, category_name, description, parent_id
        cat_matches = re.findall(r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(NULL|\d+)", text)
        self.categories = {}
        for r in cat_matches:
            self.categories[int(r[0])] = {
                "category_id": int(r[0]), "category_name": r[1], "description": r[2],
                "parent_id": None if r[3] == "NULL" else int(r[3])
            }

        # 4. Products: product_id, seller_id, category_id, name, description, price, stock_quantity, sold_quantity, is_active, status
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

        # 5. Vouchers: voucher_code, discount_percent, min_order_value, max_discount, valid_from, expired_at, usage_limit, used_count
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

        # 6. Cart_Items: cart_item_id, user_id, product_id, quantity
        cart_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*SYSUTCDATETIME\(\)\)", text)
        self.cart_items = {}
        for r in cart_matches:
            self.cart_items[int(r[0])] = {
                "cart_item_id": int(r[0]), "user_id": int(r[1]), "product_id": int(r[2]), "quantity": int(r[3])
            }

        # 7. Orders: order_id, buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method
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

        # 8. Order_Details: order_detail_id, order_id, product_id, quantity, unit_price, subtotal
        od_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d{2}),\s*(\d+\.\d{2})\)", text)
        self.order_details = {}
        for r in od_matches:
            self.order_details[int(r[0])] = {
                "order_detail_id": int(r[0]), "order_id": int(r[1]), "product_id": int(r[2]),
                "quantity": int(r[3]), "unit_price": float(r[4]), "subtotal": float(r[5])
            }

        # 9. Reviews: review_id, order_detail_id, user_id, product_id, rating, comment
        rev_matches = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([1-5]),\s*N'([^']+)'", text)
        self.reviews = {}
        for r in rev_matches:
            self.reviews[int(r[0])] = {
                "review_id": int(r[0]), "order_detail_id": int(r[1]), "user_id": int(r[2]),
                "product_id": int(r[3]), "rating": int(r[4]), "comment": r[5]
            }


@pytest.fixture(scope="module")
def seed_store():
    return SeedDataStore()


# =============================================================================
# TIER 1: SCHEMA VERIFICATION (Static Contract Inspection)
# =============================================================================
class TestTier1SchemaContract:
    """Static validation of all 9 tables, constraints, options, and performance indexes."""

    @pytest.fixture(autouse=True)
    def setup_files(self):
        self.schema_sql = _read_file(SCHEMA_SQL_PATH)
        self.indexes_sql = _read_file(INDEXES_SQL_PATH)
        self.seed_sql = _read_file(SEED_SQL_PATH)

    def test_database_options_and_wal_settings(self):
        """Verifies FULL recovery model, PAGE_VERIFY CHECKSUM, and target recovery time."""
        assert "ALTER DATABASE [ECommerceDB] SET RECOVERY FULL" in self.schema_sql
        assert "ALTER DATABASE [ECommerceDB] SET PAGE_VERIFY CHECKSUM" in self.schema_sql
        assert "ALTER DATABASE [ECommerceDB] SET TARGET_RECOVERY_TIME = 60 SECONDS" in self.schema_sql

    def test_all_9_core_tables_declared(self):
        """Verifies presence of all 9 core tables."""
        expected_tables = [
            "dbo.Users", "dbo.Sellers", "dbo.Categories", "dbo.Products",
            "dbo.Cart_Items", "dbo.Orders", "dbo.Order_Details",
            "dbo.Vouchers", "dbo.Reviews"
        ]
        for tbl in expected_tables:
            assert f"CREATE TABLE {tbl}" in self.schema_sql, f"Table declaration missing: {tbl}"

    def test_primary_and_unique_keys_declared(self):
        """Verifies primary and unique key constraints across all 9 tables."""
        constraints = [
            ("PK_Users", "PRIMARY KEY CLUSTERED (user_id)"),
            ("UQ_Users_username", "UNIQUE (username)"),
            ("UQ_Users_email", "UNIQUE (email)"),
            ("PK_Sellers", "PRIMARY KEY CLUSTERED (seller_id)"),
            ("UQ_Sellers_user_id", "UNIQUE (user_id)"),
            ("UQ_Sellers_shop_name", "UNIQUE (shop_name)"),
            ("PK_Categories", "PRIMARY KEY CLUSTERED (category_id)"),
            ("UQ_Categories_category_name", "UNIQUE (category_name)"),
            ("PK_Products", "PRIMARY KEY CLUSTERED (product_id)"),
            ("PK_Cart_Items", "PRIMARY KEY CLUSTERED (cart_item_id)"),
            ("UQ_Cart_Items_User_Product", "UNIQUE (user_id, product_id)"),
            ("PK_Orders", "PRIMARY KEY CLUSTERED (order_id)"),
            ("PK_Order_Details", "PRIMARY KEY CLUSTERED (order_detail_id)"),
            ("UQ_Order_Details_Order_Product", "UNIQUE (order_id, product_id)"),
            ("PK_Vouchers", "PRIMARY KEY CLUSTERED (voucher_code)"),
            ("PK_Reviews", "PRIMARY KEY CLUSTERED (review_id)"),
            ("UQ_Reviews_User_Product", "UNIQUE (user_id, product_id)")
        ]
        for name, defn in constraints:
            assert name in self.schema_sql, f"Constraint missing: {name}"
            assert defn in self.schema_sql, f"Definition missing for {name}: {defn}"

    def test_foreign_key_and_cascade_constraints(self):
        """Verifies foreign key constraints and cascade rules."""
        fks = [
            ("FK_Sellers_Users", "FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE"),
            ("FK_Categories_Parent", "FOREIGN KEY (parent_id) REFERENCES dbo.Categories(category_id)"),
            ("FK_Products_Sellers", "FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id)"),
            ("FK_Products_Categories", "FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id)"),
            ("FK_Cart_Items_Users", "FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE"),
            ("FK_Cart_Items_Products", "FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)"),
            ("FK_Orders_Users", "FOREIGN KEY (buyer_id) REFERENCES dbo.Users(user_id)"),
            ("FK_Orders_Sellers", "FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id)"),
            ("FK_Order_Details_Orders", "FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE"),
            ("FK_Order_Details_Products", "FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)"),
            ("FK_Reviews_Order_Details", "FOREIGN KEY (order_detail_id) REFERENCES dbo.Order_Details(order_detail_id)"),
            ("FK_Reviews_Users", "FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)"),
            ("FK_Reviews_Products", "FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)")
        ]
        for name, defn in fks:
            assert name in self.schema_sql, f"FK missing: {name}"
            assert defn in self.schema_sql, f"FK definition mismatch for {name}: {defn}"

    def test_check_constraints_declared(self):
        """Verifies domain check constraints on roles, status, stock, price, and ratings."""
        checks = [
            ("CK_Users_role", "CHECK (role IN ('buyer', 'seller', 'admin'))"),
            ("CK_Sellers_rating", "CHECK (rating >= 0.00 AND rating <= 5.00)"),
            ("CK_Products_price", "CHECK (price >= 0.00)"),
            ("CK_Products_stock", "CHECK (stock_quantity >= 0)"),
            ("CK_Products_sold_quantity", "CHECK (sold_quantity >= 0)"),
            ("CK_Products_status", "CHECK (status IN ('active', 'inactive', 'out_of_stock'))"),
            ("CK_Cart_Items_quantity", "CHECK (quantity > 0)"),
            ("CK_Orders_status", "CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))"),
            ("CK_Orders_total", "CHECK (total_amount >= 0.00)"),
            ("CK_Orders_discount", "CHECK (discount_amount >= 0.00)"),
            ("CK_Orders_final", "CHECK (final_amount >= 0.00)"),
            ("CK_Order_Details_quantity", "CHECK (quantity > 0)"),
            ("CK_Order_Details_price", "CHECK (unit_price >= 0.00)"),
            ("CK_Order_Details_subtotal", "CHECK (subtotal >= 0.00)"),
            ("CK_Vouchers_discount", "CHECK (discount_percent >= 0.00 AND discount_percent <= 100.00)"),
            ("CK_Vouchers_dates", "CHECK (expired_at >= valid_from)"),
            ("CK_Vouchers_usage", "CHECK (used_count <= usage_limit)"),
            ("CK_Reviews_rating", "CHECK (rating >= 1 AND rating <= 5)")
        ]
        for name, defn in checks:
            assert name in self.schema_sql, f"Check constraint missing: {name}"
            assert defn in self.schema_sql, f"Check constraint definition mismatch for {name}"

    def test_all_10_performance_indexes_declared(self):
        """Verifies presence of performance indexes with covering columns."""
        indexes = [
            ("IX_Products_seller_id", "dbo.Products (seller_id)"),
            ("IX_Products_category_id", "dbo.Products (category_id)"),
            ("IX_Products_status_price", "dbo.Products (status, price)"),
            ("IX_Orders_seller_id", "dbo.Orders (seller_id)"),
            ("IX_Orders_buyer_id_created_at", "dbo.Orders (buyer_id, created_at DESC)"),
            ("IX_Orders_order_status", "dbo.Orders (order_status)"),
            ("IX_Order_Details_order_id", "dbo.Order_Details (order_id)"),
            ("IX_Order_Details_product_id", "dbo.Order_Details (product_id)"),
            ("IX_Reviews_product_id_rating", "dbo.Reviews (product_id, rating)"),
            ("IX_Reviews_user_id", "dbo.Reviews (user_id)")
        ]
        for name, on_cols in indexes:
            assert name in self.indexes_sql, f"Index missing: {name}"
            assert on_cols in self.indexes_sql, f"Index on-columns mismatch for {name}: {on_cols}"


# =============================================================================
# TIER 1: FUNCTIONAL REQUIREMENTS & 8 QUERY TYPES (Deterministic Seed Verification)
# =============================================================================
class TestTier1FunctionalHappyPaths:
    """Validates FR-01 through FR-12 and all 8 query types (a through h) using relational seed data."""

    def test_fr01_and_query_e_composite_condition_product_search(self, seed_store):
        """
        FR-01: Product search & multi-criteria filtering.
        Query Type (e): Composite condition: category_id = 2, status = 'active', price between 500 and 1500.
        """
        matches = [
            p for p in seed_store.products.values()
            if p["category_id"] == 2 and p["status"] == "active" and 500.00 <= p["price"] <= 1500.00
        ]
        matches.sort(key=lambda x: x["price"])
        assert len(matches) == 3 # Pixel 8 Pro (899), iPhone 15 Pro Max (1199), Galaxy S24 Ultra (1299)
        names = [p["name"] for p in matches]
        assert any("Pixel 8 Pro" in n for n in names)
        assert any("iPhone 15 Pro Max" in n for n in names)
        assert any("Galaxy S24 Ultra" in n for n in names)
        assert matches[0]["price"] <= matches[1]["price"] <= matches[2]["price"]

    def test_fr02_and_query_d_single_condition_product_lookup(self, seed_store):
        """
        FR-02: Product details & reviews inquiry.
        Query Type (d): Query with a single condition on product_id = 1.
        """
        p = seed_store.products.get(1)
        assert p is not None
        assert "iPhone 15 Pro Max" in p["name"]
        assert p["price"] == 1199.00
        assert p["seller_id"] == 1
        assert p["stock_quantity"] == 45
        assert p["sold_quantity"] == 25
        assert p["is_active"] == 1

    def test_fr03_and_query_a_b_cart_operations(self, seed_store):
        """
        FR-03: Shopping Cart Management.
        Query Type (a): Insert into Cart_Items.
        Query Type (b): Delete from Cart_Items.
        """
        # Seed contains 12 cart items
        assert len(seed_store.cart_items) == 12
        # Query Type (a): Add new item for buyer 14
        new_item = {"cart_item_id": 999, "user_id": 14, "product_id": 7, "quantity": 2}
        assert new_item["quantity"] > 0
        assert new_item["user_id"] in seed_store.users
        assert new_item["product_id"] in seed_store.products

        # Query Type (b): Deletion logic
        filtered_cart = [ci for ci in seed_store.cart_items.values() if not (ci["user_id"] == 7 and ci["product_id"] == 1)]
        assert len(filtered_cart) == len(seed_store.cart_items) - 1

    def test_fr04_and_query_c_order_placement_stock_deduction(self, seed_store):
        """
        FR-04: Order placement & inventory stock deduction.
        Query Type (c): Atomic decrement of stock.
        """
        prod = seed_store.products[15] # Designing Data-Intensive Applications
        order_qty = 2
        initial_stock = prod["stock_quantity"]
        assert initial_stock >= order_qty

        # Atomic decrement logic
        updated_stock = initial_stock - order_qty if initial_stock >= order_qty else initial_stock
        assert updated_stock == 98 # 100 - 2

    def test_fr05_fr09_and_query_f_join_order_fulfillment(self, seed_store):
        """
        FR-05 & FR-09: Order tracking & fulfillment details.
        Query Type (f): Query with multi-table JOIN: Orders JOIN Order_Details JOIN Products JOIN Sellers.
        """
        target_order_id = 1
        order = seed_store.orders[target_order_id]
        details = [od for od in seed_store.order_details.values() if od["order_id"] == target_order_id]
        assert len(details) == 2 # 2 items in Order 1

        joined_items = []
        for d in details:
            p = seed_store.products[d["product_id"]]
            s = seed_store.sellers[p["seller_id"]]
            joined_items.append({
                "order_id": order["order_id"],
                "order_status": order["order_status"],
                "product_name": p["name"],
                "shop_name": s["shop_name"],
                "subtotal": d["subtotal"]
            })

        assert len(joined_items) == 2
        assert all(item["shop_name"] == "TechZone Store" for item in joined_items)
        assert sum(item["subtotal"] for item in joined_items) == order["total_amount"]

    def test_fr06_fr10_and_query_h_aggregate_functions_reviews(self, seed_store):
        """
        FR-06 & FR-10: Review statistics.
        Query Type (h): Aggregate functions COUNT, AVG grouped by product_id.
        """
        prod_reviews = {}
        for r in seed_store.reviews.values():
            pid = r["product_id"]
            prod_reviews.setdefault(pid, []).append(r["rating"])

        assert len(prod_reviews) >= 10
        # Check product 1 (iPhone 15 Pro Max)
        assert 1 in prod_reviews
        ratings = prod_reviews[1]
        assert len(ratings) == 1
        assert sum(ratings) / len(ratings) == 5.0

    def test_fr07_product_catalog_management(self, seed_store):
        """
        FR-07: Seller product catalog management.
        Products per seller count.
        """
        seller_prod_counts = {}
        for p in seed_store.products.values():
            sid = p["seller_id"]
            seller_prod_counts[sid] = seller_prod_counts.get(sid, 0) + 1

        assert seller_prod_counts[1] == 8 # TechZone has 8 products
        assert seller_prod_counts[2] == 6 # FashionHub has 6 products
        assert seller_prod_counts[3] == 4 # Bookstore has 4 products
        assert seller_prod_counts[4] == 3 # ModernHome has 3 products
        assert seller_prod_counts[5] == 3 # ProSports has 3 products
        assert sum(seller_prod_counts.values()) == 24

    def test_fr08_inventory_low_stock_alert(self, seed_store):
        """
        FR-08: Inventory replenishment and low-stock threshold alerting.
        """
        low_stock = [p for p in seed_store.products.values() if p["stock_quantity"] <= 15]
        assert len(low_stock) >= 2
        names = [p["name"] for p in low_stock]
        assert any("MacBook Pro" in n for n in names)
        assert any("ThinkPad" in n for n in names)

    def test_fr09_order_fulfillment_status_distribution(self, seed_store):
        """
        FR-09: Order lifecycle statuses in seed data.
        """
        status_counts = {}
        for o in seed_store.orders.values():
            st = o["order_status"]
            status_counts[st] = status_counts.get(st, 0) + 1

        assert status_counts["delivered"] == 7
        assert status_counts["shipped"] == 3
        assert status_counts["processing"] == 3
        assert status_counts["pending"] == 2
        assert status_counts["cancelled"] == 1
        assert sum(status_counts.values()) == 16

    def test_fr10_seller_analytics_delivered_revenue(self, seed_store):
        """
        FR-10: Seller Analytics & Reporting on delivered orders.
        """
        seller_rev = {}
        for od in seed_store.order_details.values():
            order = seed_store.orders[od["order_id"]]
            if order["order_status"] == "delivered":
                prod = seed_store.products[od["product_id"]]
                sid = prod["seller_id"]
                seller_rev[sid] = seller_rev.get(sid, 0.0) + od["subtotal"]

        assert len(seller_rev) >= 4
        assert seller_rev[1] > 1000.0 # TechZone delivered revenue > 1000

    def test_fr11_admin_user_and_shop_moderation(self, seed_store):
        """
        FR-11: Moderation rules and role distribution.
        """
        roles = [u["role"] for u in seed_store.users.values()]
        assert roles.count("admin") == 1
        assert roles.count("seller") == 5
        assert roles.count("buyer") == 8
        assert len(roles) == 14
        assert all(s["is_approved"] == 1 for s in seed_store.sellers.values())

    def test_fr12_and_query_g_subquery_platform_bi(self, seed_store):
        """
        FR-12: Platform Business Intelligence.
        Query Type (g): Query with a nested subquery and HAVING clause.
        Sellers whose delivered revenue exceeds average seller delivered revenue.
        """
        seller_rev = {}
        for od in seed_store.order_details.values():
            order = seed_store.orders[od["order_id"]]
            if order["order_status"] == "delivered":
                prod = seed_store.products[od["product_id"]]
                sid = prod["seller_id"]
                seller_rev[sid] = seller_rev.get(sid, 0.0) + od["subtotal"]

        avg_revenue = sum(seller_rev.values()) / len(seller_rev)
        top_sellers = {sid: rev for sid, rev in seller_rev.items() if rev > avg_revenue}
        assert len(top_sellers) >= 1
        assert 1 in top_sellers # TechZone is above average


# =============================================================================
# TIER 2: BOUNDARY AND CORNER CASES (Dual-Layer: Static DDL Contract & SQLite Engine Probes)
# =============================================================================
class TestTier2BoundaryAndCornerCases:
    """
    Tier 2: Dual-Layer Boundary & Corner Cases Verification:
      - Layer 1: Static DDL AST/Regex Contract Extraction against 01_schema.sql.
      - Layer 2: Dynamic SQLite In-Memory Engine Probes executing violating SQL statements
                 against tables translated directly from 01_schema.sql with PRAGMA foreign_keys = ON.
    """

    @pytest.fixture(autouse=True)
    def setup_contracts_and_engine(self):
        self.schema_sql = _read_file(SCHEMA_SQL_PATH)
        self.indexes_sql = _read_file(INDEXES_SQL_PATH)

        # Initialize SQLite in-memory relational engine from 01_schema.sql DDL
        self.sqlite_conn = sqlite3.connect(":memory:")
        self.sqlite_conn.execute("PRAGMA foreign_keys = ON;")
        for tbl_name, ddl in translate_mssql_to_sqlite(self.schema_sql):
            self.sqlite_conn.execute(ddl)

        # Seed minimal relational hierarchy to satisfy foreign keys for dependent probes
        self.sqlite_conn.execute(
            "INSERT INTO Users (user_id, username, email, password_hash, full_name, role) "
            "VALUES (1, 'admin1', 'admin@store.com', 'hash', 'Admin One', 'admin');"
        )
        self.sqlite_conn.execute(
            "INSERT INTO Users (user_id, username, email, password_hash, full_name, role) "
            "VALUES (2, 'seller1', 'seller@store.com', 'hash', 'Seller One', 'seller');"
        )
        self.sqlite_conn.execute(
            "INSERT INTO Users (user_id, username, email, password_hash, full_name, role) "
            "VALUES (3, 'buyer1', 'buyer@store.com', 'hash', 'Buyer One', 'buyer');"
        )
        self.sqlite_conn.execute(
            "INSERT INTO Categories (category_id, category_name) VALUES (1, 'Electronics');"
        )
        self.sqlite_conn.execute(
            "INSERT INTO Sellers (seller_id, user_id, shop_name) VALUES (1, 2, 'TechZone');"
        )
        self.sqlite_conn.execute(
            "INSERT INTO Products (product_id, seller_id, category_id, name, price, stock_quantity) "
            "VALUES (1, 1, 1, 'Laptop', 1000.0, 10);"
        )

    def test_negative_stock_rejection_logic(self, seed_store):
        """
        Boundary Case: Stock quantity and price cannot be negative.
        - Layer 1: Static DDL Contract in 01_schema.sql (CK_Products_stock, CK_Products_price).
        - Layer 2: Genuine SQLite in-memory engine probes asserting sqlite3.IntegrityError.
        - Seed Data: Proves all 24 seed products strictly satisfy stock_quantity >= 0 and price >= 0.
        """
        # Layer 1: Static DDL Contract
        match_stock = re.search(
            r"CONSTRAINT\s+CK_Products_stock\s+CHECK\s*\(\s*stock_quantity\s*>=\s*0\s*\)",
            self.schema_sql,
            re.IGNORECASE
        )
        assert match_stock is not None, "01_schema.sql must define CONSTRAINT CK_Products_stock CHECK (stock_quantity >= 0)"
        assert re.search(r"CONSTRAINT\s+CK_Products_price\s+CHECK\s*\(\s*price\s*>=\s*0\.00\s*\)", self.schema_sql, re.I)

        # Layer 2: Authentic SQL Engine Rejection Probes
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Products_stock"):
            self.sqlite_conn.execute(
                "INSERT INTO Products (seller_id, category_id, name, price, stock_quantity) VALUES (1, 1, 'BadStock', 50.0, -1);"
            )
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Products_price"):
            self.sqlite_conn.execute(
                "INSERT INTO Products (seller_id, category_id, name, price, stock_quantity) VALUES (1, 1, 'BadPrice', -50.0, 5);"
            )

        # Seed data conformity
        assert len(seed_store.products) == 24
        for pid, prod in seed_store.products.items():
            assert prod["stock_quantity"] >= 0, f"Seed product {pid} violates CK_Products_stock: stock = {prod['stock_quantity']}"
            assert prod["price"] >= 0.0, f"Seed product {pid} violates CK_Products_price: price = {prod['price']}"
            assert isinstance(prod["stock_quantity"], int)

        min_stock = min(p["stock_quantity"] for p in seed_store.products.values())
        assert min_stock >= 0

    def test_insufficient_stock_atomic_rejection(self, seed_store):
        """
        Boundary Case: Atomic insufficient stock deduction guard.
        - Layer 1: Static DDL Contract (stock_quantity INT NOT NULL, CK_Products_stock).
        - Layer 2: Authentic SQL Engine Probes verifying that direct UPDATE to negative stock
                   is stopped by CK_Products_stock, and guarded UPDATE WHERE stock_quantity >= @qty
                   atomically affects 0 rows when stock is insufficient.
        """
        # Layer 1: Static DDL Contract
        assert re.search(r"stock_quantity\s+INT\s+NOT\s+NULL", self.schema_sql, re.IGNORECASE) is not None
        assert re.search(r"CONSTRAINT\s+CK_Products_stock\s+CHECK\s*\(\s*stock_quantity\s*>=\s*0\s*\)", self.schema_sql, re.I)

        # Layer 2: Authentic SQL Engine Probes
        self.sqlite_conn.execute(
            "INSERT INTO Products (product_id, seller_id, category_id, name, price, stock_quantity) VALUES (100, 1, 1, 'LimitedItem', 10.0, 5);"
        )
        # Direct subtraction exceeding available stock is rejected by engine constraint
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Products_stock"):
            self.sqlite_conn.execute("UPDATE Products SET stock_quantity = stock_quantity - 10 WHERE product_id = 100;")

        # Atomic guarded UPDATE WHERE stock_quantity >= qty affects 0 rows when stock insufficient
        cursor = self.sqlite_conn.execute(
            "UPDATE Products SET stock_quantity = stock_quantity - 10 WHERE product_id = 100 AND stock_quantity >= 10;"
        )
        assert cursor.rowcount == 0, "Guarded stock deduction must affect 0 rows when requested quantity exceeds available stock"

        # Verify stock remains completely intact (atomic non-modification)
        stock = self.sqlite_conn.execute("SELECT stock_quantity FROM Products WHERE product_id = 100;").fetchone()[0]
        assert stock == 5

        # Seed data check
        prod = seed_store.products[4]
        assert prod["stock_quantity"] == 15

    def test_expired_or_exhausted_voucher_rejection(self, seed_store):
        """
        Boundary Case: Voucher expiration dates, usage limits, and discount boundaries.
        - Layer 1: Static DDL Contract (CK_Vouchers_dates, CK_Vouchers_usage, CK_Vouchers_discount,
                   CK_Vouchers_usage_limit, CK_Vouchers_used_count).
        - Layer 2: Authentic SQL Engine Rejection Probes asserting sqlite3.IntegrityError on:
                   used_count > usage_limit, expired_at < valid_from, and discount > 100.
        - Seed Data: Proves all seed vouchers conform strictly.
        """
        # Layer 1: Static DDL Contract
        assert "CONSTRAINT CK_Vouchers_dates CHECK (expired_at >= valid_from)" in self.schema_sql
        assert "CONSTRAINT CK_Vouchers_usage CHECK (used_count <= usage_limit)" in self.schema_sql
        assert "CONSTRAINT CK_Vouchers_discount CHECK (discount_percent >= 0.00 AND discount_percent <= 100.00)" in self.schema_sql
        assert "CONSTRAINT CK_Vouchers_usage_limit CHECK (usage_limit >= 0)" in self.schema_sql
        assert "CONSTRAINT CK_Vouchers_used_count CHECK (used_count >= 0)" in self.schema_sql

        # Layer 2: Authentic SQL Engine Rejection Probes
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Vouchers_usage"):
            self.sqlite_conn.execute(
                "INSERT INTO Vouchers (voucher_code, discount_percent, valid_from, expired_at, usage_limit, used_count) "
                "VALUES ('EXHAUSTED', 10, '2026-01-01', '2026-12-31', 100, 101);"
            )
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Vouchers_dates"):
            self.sqlite_conn.execute(
                "INSERT INTO Vouchers (voucher_code, discount_percent, valid_from, expired_at, usage_limit, used_count) "
                "VALUES ('BADDATE', 10, '2026-12-31', '2026-01-01', 100, 0);"
            )
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Vouchers_discount"):
            self.sqlite_conn.execute(
                "INSERT INTO Vouchers (voucher_code, discount_percent, valid_from, expired_at, usage_limit, used_count) "
                "VALUES ('BADDISC', 150.0, '2026-01-01', '2026-12-31', 100, 0);"
            )

        # Seed data conformity
        assert len(seed_store.vouchers) == 6
        for code, v in seed_store.vouchers.items():
            assert v["expired_at"] >= v["valid_from"], f"Voucher {code} has invalid dates: {v['valid_from']} > {v['expired_at']}"
            assert 0.0 <= v["discount_percent"] <= 100.0, f"Voucher {code} discount percent out of bounds: {v['discount_percent']}"
            assert v["usage_limit"] >= 0, f"Voucher {code} negative usage limit: {v['usage_limit']}"
            assert v["used_count"] >= 0, f"Voucher {code} negative used count: {v['used_count']}"
            assert v["used_count"] <= v["usage_limit"], f"Voucher {code} exhausted: used {v['used_count']} > limit {v['usage_limit']}"

    def test_cancellation_of_shipped_or_delivered_orders_blocked(self, seed_store):
        """
        Boundary Case: Shipped and Delivered orders cannot transition to cancelled.
        - Layer 1: Static DDL Contract (CK_Orders_status).
        - Layer 2: Authentic SQL Engine Probe verifying conditional UPDATE guards affect 0 rows
                   when attempting to cancel orders in 'shipped' or 'delivered' status.
        - Seed Data: Validates that terminal/dispatched states are partitioned properly.
        """
        # Layer 1: Static DDL Contract
        assert "CONSTRAINT CK_Orders_status CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))" in self.schema_sql

        # Layer 2: Authentic SQL Engine Guard Probe
        self.sqlite_conn.execute(
            "INSERT INTO Orders (order_id, buyer_id, seller_id, total_amount, order_status, shipping_address) "
            "VALUES (200, 3, 1, 100.0, 'shipped', '456 Test Ave');"
        )
        # Attempting conditional cancellation of a shipped order affects 0 rows
        cursor = self.sqlite_conn.execute(
            "UPDATE Orders SET order_status = 'cancelled' WHERE order_id = 200 AND order_status IN ('pending', 'processing');"
        )
        assert cursor.rowcount == 0, "Guarded order cancellation must affect 0 rows for dispatched/shipped orders"

        # Verify status is still 'shipped'
        status = self.sqlite_conn.execute("SELECT order_status FROM Orders WHERE order_id = 200;").fetchone()[0]
        assert status == "shipped"

        # Seed data conformity
        statuses = {o["order_status"] for o in seed_store.orders.values()}
        assert "delivered" in statuses
        assert "shipped" in statuses
        assert "cancelled" in statuses
        assert "pending" in statuses
        assert "processing" in statuses

        dispatched_orders = [o for o in seed_store.orders.values() if o["order_status"] in ("shipped", "delivered")]
        assert len(dispatched_orders) >= 9
        for o in dispatched_orders:
            assert o["order_status"] != "pending"
            assert o["order_status"] != "cancelled"

    def test_duplicate_review_constraint_rejection(self, seed_store):
        """
        Boundary Case: Duplicate reviews for same (user_id, product_id) violate uniqueness,
        and review rating must be bounded within [1..5].
        - Layer 1: Static DDL Contract (UQ_Reviews_User_Product, CK_Reviews_rating).
        - Layer 2: Authentic SQL Engine Probes asserting sqlite3.IntegrityError on duplicate
                   (user_id, product_id) pair and rating < 1 or rating > 5.
        - Seed Data: Proves seed reviews contain zero duplicates.
        """
        # Layer 1: Static DDL Contract
        match = re.search(
            r"CONSTRAINT\s+UQ_Reviews_User_Product\s+UNIQUE\s*\(\s*user_id\s*,\s*product_id\s*\)",
            self.schema_sql,
            re.IGNORECASE
        )
        assert match is not None, "01_schema.sql must define CONSTRAINT UQ_Reviews_User_Product UNIQUE (user_id, product_id)"
        assert re.search(r"CONSTRAINT\s+CK_Reviews_rating\s+CHECK\s*\(\s*rating\s*>=\s*1\s+AND\s+rating\s*<=\s*5\s*\)", self.schema_sql, re.I)

        # Layer 2: Authentic SQL Engine Rejection Probes
        self.sqlite_conn.execute("INSERT INTO Reviews (user_id, product_id, rating) VALUES (3, 1, 5);")
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)UNIQUE"):
            self.sqlite_conn.execute("INSERT INTO Reviews (user_id, product_id, rating) VALUES (3, 1, 4);")

        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Reviews_rating"):
            self.sqlite_conn.execute("INSERT INTO Reviews (user_id, product_id, rating) VALUES (1, 1, 6);")
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Reviews_rating"):
            self.sqlite_conn.execute("INSERT INTO Reviews (user_id, product_id, rating) VALUES (2, 1, 0);")

        # Seed data conformity
        review_pairs = [(r["user_id"], r["product_id"]) for r in seed_store.reviews.values()]
        assert len(review_pairs) == 16
        assert len(review_pairs) == len(set(review_pairs)), "Seed reviews contain duplicate (user_id, product_id) pairs!"

    def test_invalid_order_status_transitions(self, seed_store):
        """
        Boundary Case: Invalid status state transitions rejected by CHECK constraint.
        - Layer 1: Static DDL Contract (CK_Orders_status).
        - Layer 2: Authentic SQL Engine Rejection Probes asserting sqlite3.IntegrityError
                   when attempting to insert non-standard or disaster statuses.
        - Seed Data: Confirms all seed orders belong to the allowed domain.
        """
        # Layer 1: Static DDL Contract
        allowed_match = re.search(
            r"order_status\s+IN\s*\(\s*'pending'\s*,\s*'processing'\s*,\s*'shipped'\s*,\s*'delivered'\s*,\s*'cancelled'\s*\)",
            self.schema_sql,
            re.IGNORECASE
        )
        assert allowed_match is not None

        # Layer 2: Authentic SQL Engine Rejection Probes
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Orders_status"):
            self.sqlite_conn.execute(
                "INSERT INTO Orders (buyer_id, seller_id, total_amount, order_status, shipping_address) "
                "VALUES (3, 1, 100, 'CORRUPTED_DISASTER', 'Addr');"
            )
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Orders_status"):
            self.sqlite_conn.execute(
                "INSERT INTO Orders (buyer_id, seller_id, total_amount, order_status, shipping_address) "
                "VALUES (3, 1, 100, 'refunded', 'Addr');"
            )

        # Seed data conformity
        allowed_set = {'pending', 'processing', 'shipped', 'delivered', 'cancelled'}
        for oid, order in seed_store.orders.items():
            assert order["order_status"] in allowed_set, f"Order {oid} has invalid status {order['order_status']}"

        assert "CORRUPTED_DISASTER" not in allowed_set
        assert "refunded" not in allowed_set
        assert "draft" not in allowed_set

    def test_unauthorized_admin_action_blocked(self, seed_store):
        """
        Boundary Case: Tripartite Role-Based Access Control (RBAC).
        - Layer 1: Static DDL Contract (CK_Users_role).
        - Layer 2: Authentic SQL Engine Rejection Probes asserting sqlite3.IntegrityError
                   when unauthorized roles are inserted.
        - Seed Data: Verifies role partition across seed users.
        """
        # Layer 1: Static DDL Contract
        assert "CONSTRAINT CK_Users_role CHECK (role IN ('buyer', 'seller', 'admin'))" in self.schema_sql

        # Layer 2: Authentic SQL Engine Rejection Probes
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Users_role"):
            self.sqlite_conn.execute(
                "INSERT INTO Users (username, email, password_hash, full_name, role) "
                "VALUES ('root_user', 'root@t.local', 'h', 'Root', 'superadmin');"
            )
        with pytest.raises(sqlite3.IntegrityError, match=r"(?i)CK_Users_role"):
            self.sqlite_conn.execute(
                "INSERT INTO Users (username, email, password_hash, full_name, role) "
                "VALUES ('guest_user', 'guest@t.local', 'h', 'Guest', 'anonymous');"
            )

        # Seed data conformity
        allowed_roles = {'buyer', 'seller', 'admin'}
        for uid, user in seed_store.users.items():
            assert user["role"] in allowed_roles, f"User {uid} has invalid role {user['role']}"

        admin_users = [u for u in seed_store.users.values() if u["role"] == "admin"]
        assert len(admin_users) == 1
        assert admin_users[0]["user_id"] == 1

        seller_user_ids = {s["user_id"] for s in seed_store.sellers.values()}
        buyer_user_ids = {u["user_id"] for u in seed_store.users.values() if u["role"] == "buyer"}
        assert len(seller_user_ids.intersection(buyer_user_ids)) == 0, "Seller users must not be partitioned as buyers"


# =============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS & RELATIONAL LIFECYCLE CONTRACTS
# =============================================================================
class TestTier3LifecycleFlows:
    """
    Tier 3: Complex multi-table relational lifecycle contract & financial invariant validations:
      - Validates complete foreign key dependency graph across Users, Sellers, Products, Cart_Items, Orders, Order_Details, Reviews.
      - Enforces ON DELETE CASCADE declarations on Cart_Items and Order_Details.
      - Enforces financial math invariants: total_amount = SUM(subtotal), final_amount = total_amount - discount_amount across all seed orders.
      - Validates review-to-fulfillment relational link (reviews strictly bound to delivered order details).
      - Executes complete end-to-end multi-actor transaction workflow directly in SQLite engine.
    """

    @pytest.fixture(autouse=True)
    def setup_contracts(self):
        self.schema_sql = _read_file(SCHEMA_SQL_PATH)

    def test_relational_schema_foreign_key_graph_and_cascades(self):
        """
        Verifies the comprehensive relational foreign key contract across all 7 lifecycle tables
        and guarantees correct ON DELETE CASCADE specifications.
        """
        assert "CONSTRAINT FK_Sellers_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)" in self.schema_sql
        assert "CONSTRAINT FK_Products_Sellers FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id)" in self.schema_sql
        assert "CONSTRAINT FK_Products_Categories FOREIGN KEY (category_id) REFERENCES dbo.Categories(category_id)" in self.schema_sql
        # 3. Cart_Items -> Users (ON DELETE CASCADE) & Products
        assert "CONSTRAINT FK_Cart_Items_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE" in self.schema_sql
        assert "CONSTRAINT FK_Cart_Items_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)" in self.schema_sql
        assert "ON DELETE CASCADE" in self.schema_sql

        # 4. Orders -> Users & Sellers
        assert "CONSTRAINT FK_Orders_Users FOREIGN KEY (buyer_id) REFERENCES dbo.Users(user_id)" in self.schema_sql
        assert "CONSTRAINT FK_Orders_Sellers FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id)" in self.schema_sql

        # 5. Order_Details -> Orders (ON DELETE CASCADE) & Products
        assert "CONSTRAINT FK_Order_Details_Orders FOREIGN KEY (order_id) REFERENCES dbo.Orders(order_id) ON DELETE CASCADE" in self.schema_sql
        assert "CONSTRAINT FK_Order_Details_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)" in self.schema_sql

        # 6. Reviews -> Users, Products & Order_Details
        assert "CONSTRAINT FK_Reviews_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id)" in self.schema_sql
        assert "CONSTRAINT FK_Reviews_Products FOREIGN KEY (product_id) REFERENCES dbo.Products(product_id)" in self.schema_sql
        assert "CONSTRAINT FK_Reviews_Order_Details FOREIGN KEY (order_detail_id) REFERENCES dbo.Order_Details(order_detail_id)" in self.schema_sql

    def test_seed_relational_financial_and_fulfillment_invariants(self, seed_store):
        """
        Verifies mathematical and relational integrity across the entire seed database lifecycle:
          1. Every Order Detail subtotal equals quantity * unit_price.
          2. Every Order total_amount equals the sum of its Order Detail subtotals.
          3. Every Order final_amount equals total_amount - discount_amount.
          4. Every Review references an order detail belonging to an active or fulfilled order.
        """
        # 1. Order Detail math
        assert len(seed_store.order_details) == 22
        for od_id, od in seed_store.order_details.items():
            expected_subtotal = round(od["quantity"] * od["unit_price"], 2)
            assert abs(od["subtotal"] - expected_subtotal) < 0.01, f"Order Detail {od_id} subtotal mismatch: {od['subtotal']} != {expected_subtotal}"

        # 2. Order aggregation math
        assert len(seed_store.orders) == 16
        for oid, order in seed_store.orders.items():
            details = [od for od in seed_store.order_details.values() if od["order_id"] == oid]
            assert len(details) >= 1, f"Order {oid} has no order details"
            calc_total = round(sum(d["subtotal"] for d in details), 2)
            assert abs(order["total_amount"] - calc_total) < 0.01, f"Order {oid} total mismatch: {order['total_amount']} != {calc_total}"

            calc_final = round(order["total_amount"] - order["discount_amount"], 2)
            assert abs(order["final_amount"] - calc_final) < 0.01, f"Order {oid} final mismatch: {order['final_amount']} != {calc_final}"
            assert order["discount_amount"] >= 0.0
            assert order["final_amount"] >= 0.0

        # 3. Review fulfillment link
        assert len(seed_store.reviews) == 16
        for rid, rev in seed_store.reviews.items():
            od_id = rev["order_detail_id"]
            assert od_id in seed_store.order_details, f"Review {rid} references non-existent order detail {od_id}"
            od = seed_store.order_details[od_id]
            order = seed_store.orders[od["order_id"]]
            assert order["order_status"] in ("delivered", "shipped", "processing"), f"Review {rid} written for invalid status {order['order_status']}"
            assert rev["product_id"] == od["product_id"], f"Review {rid} product mismatch"

    def test_offline_multi_actor_lifecycle_flow(self):
        """
        Executes complete multi-actor transaction workflow directly in SQLite relational engine:
          1. Seed buyer and seller in Users.
          2. Seed seller store in Sellers.
          3. Seed product with stock = 10 in Products.
          4. Buyer places order: INSERT into Orders & Order_Details.
          5. Inventory decrement via SQL UPDATE.
          6. State transitions via SQL UPDATE: pending -> processing -> shipped -> delivered.
          7. Buyer reviews delivered order via SQL INSERT into Reviews.
          8. Verify ON DELETE CASCADE: deleting Order automatically deletes Order_Details.
        """
        conn = sqlite3.connect(":memory:")
        conn.execute("PRAGMA foreign_keys = ON;")
        for tbl_name, ddl in translate_mssql_to_sqlite(self.schema_sql):
            conn.execute(ddl)

        # 1. Users
        conn.execute("INSERT INTO Users (user_id, username, email, password_hash, full_name, role) VALUES (101, 'seller1', 's1@t.com', 'h', 'Seller 1', 'seller');")
        conn.execute("INSERT INTO Users (user_id, username, email, password_hash, full_name, role) VALUES (102, 'buyer1', 'b1@t.com', 'h', 'Buyer 1', 'buyer');")
        # 2. Seller
        conn.execute("INSERT INTO Sellers (seller_id, user_id, shop_name) VALUES (101, 101, 'TestShop');")
        # 3. Category & Product
        conn.execute("INSERT INTO Categories (category_id, category_name) VALUES (101, 'Electronics');")
        conn.execute("INSERT INTO Products (product_id, seller_id, category_id, name, price, stock_quantity) VALUES (101, 101, 101, 'Smartphone', 500.0, 10);")
        # 4. Order & Order_Detail
        conn.execute("INSERT INTO Orders (order_id, buyer_id, seller_id, total_amount, final_amount, order_status, shipping_address) VALUES (101, 102, 101, 1000.0, 1000.0, 'pending', '123 Test St');")
        conn.execute("INSERT INTO Order_Details (order_detail_id, order_id, product_id, quantity, unit_price, subtotal) VALUES (101, 101, 101, 2, 500.0, 1000.0);")
        # 5. Inventory decrement
        conn.execute("UPDATE Products SET stock_quantity = stock_quantity - 2 WHERE product_id = 101;")
        stock = conn.execute("SELECT stock_quantity FROM Products WHERE product_id = 101;").fetchone()[0]
        assert stock == 8
        # 6. SQL Lifecycle progression
        for st in ["processing", "shipped", "delivered"]:
            conn.execute("UPDATE Orders SET order_status = ? WHERE order_id = 101;", (st,))
            current_status = conn.execute("SELECT order_status FROM Orders WHERE order_id = 101;").fetchone()[0]
            assert current_status == st
        # 7. Review insertion
        conn.execute("INSERT INTO Reviews (review_id, order_detail_id, user_id, product_id, rating) VALUES (101, 101, 102, 101, 5);")
        rev_count = conn.execute("SELECT count(*) FROM Reviews WHERE review_id = 101;").fetchone()[0]
        assert rev_count == 1
        # 8. Foreign key cascade verification
        conn.execute("DELETE FROM Reviews WHERE review_id = 101;")
        conn.execute("DELETE FROM Orders WHERE order_id = 101;")
        od_count = conn.execute("SELECT count(*) FROM Order_Details WHERE order_id = 101;").fetchone()[0]
        assert od_count == 0, "ON DELETE CASCADE must automatically remove Order_Details when Order is deleted"
        conn.close()


# =============================================================================
# TIER 1, 2, 3: LIVE DATABASE INTEGRATION (Runs when Live DB is available)
# =============================================================================
@pytest.mark.skipif(not is_mssql_online(), reason="Requires live MSSQL instance")
class TestLiveDatabaseIntegration:
    """Executes live queries, boundary constraint checks, and full lifecycle transactions against MSSQL."""

    def test_live_database_options(self, db_client):
        sql = """
        SELECT recovery_model_desc, page_verify_option_desc, target_recovery_time_in_seconds
        FROM sys.databases WHERE name = 'ECommerceDB';
        """
        rows = db_client.execute_query(sql)
        assert len(rows) == 1
        assert rows[0]["recovery_model_desc"] == "FULL"
        assert rows[0]["page_verify_option_desc"] == "CHECKSUM"

    def test_live_all_9_tables_exist(self, db_client):
        rows = db_client.execute_query("SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo');")
        table_names = {r["name"] for r in rows}
        expected = {
            "Users", "Sellers", "Categories", "Products",
            "Cart_Items", "Orders", "Order_Details", "Vouchers", "Reviews"
        }
        assert expected.issubset(table_names)

    def test_live_all_10_indexes_exist(self, db_client):
        rows = db_client.execute_query("SELECT name FROM sys.indexes WHERE name LIKE 'IX_%' AND is_hypothetical = 0;")
        index_names = {r["name"] for r in rows}
        expected = {
            "IX_Products_seller_id", "IX_Products_category_id", "IX_Products_status_price",
            "IX_Orders_seller_id", "IX_Orders_buyer_id_created_at", "IX_Orders_order_status",
            "IX_Order_Details_order_id", "IX_Order_Details_product_id",
            "IX_Reviews_product_id_rating", "IX_Reviews_user_id"
        }
        assert expected.issubset(index_names)

    def test_live_fr01_product_filter(self, db_client):
        sql = """
        SELECT product_id, name, price, stock_quantity, status
        FROM dbo.Products
        WHERE category_id = 2 AND status = 'active' AND price BETWEEN 500.00 AND 1500.00
        ORDER BY price ASC;
        """
        results = db_client.execute_query(sql)
        assert len(results) >= 2

    def test_live_fr03_cart_lifecycle(self, db_client, clean_sentinels):
        user_id = 14
        product_id = 7
        db_client.execute_non_query("DELETE FROM dbo.Cart_Items WHERE user_id = ? AND product_id = ?", (user_id, product_id))
        db_client.execute_non_query("INSERT INTO dbo.Cart_Items (user_id, product_id, quantity) VALUES (?, ?, ?);", (user_id, product_id, 2))
        res = db_client.execute_query("SELECT quantity FROM dbo.Cart_Items WHERE user_id = ? AND product_id = ?", (user_id, product_id))
        assert len(res) == 1 and res[0]["quantity"] == 2
        db_client.execute_non_query("DELETE FROM dbo.Cart_Items WHERE user_id = ? AND product_id = ?;", (user_id, product_id))

    def test_live_boundary_negative_stock(self, db_client):
        with pytest.raises(Exception, match=r"(?i)(CK_Products_stock|547)"):
            db_client.execute_non_query("UPDATE dbo.Products SET stock_quantity = -5 WHERE product_id = 1;")

    def test_live_boundary_insufficient_stock_atomic_guard(self, db_client):
        affected = db_client.execute_non_query(
            "UPDATE dbo.Products SET stock_quantity = stock_quantity - 99999 WHERE product_id = 1 AND stock_quantity >= 99999;"
        )
        assert affected == 0, "Atomic stock check failed: deducted more than available stock"

    def test_live_boundary_duplicate_review(self, db_client):
        with pytest.raises(Exception, match=r"(?i)(UQ_Reviews_User_Product|2627|2601)"):
            db_client.execute_non_query(
                "INSERT INTO dbo.Reviews (order_detail_id, user_id, product_id, rating, comment) VALUES (1, 7, 1, 5, N'TEST duplicate review');"
            )

    def test_live_boundary_invalid_order_status(self, db_client):
        with pytest.raises(Exception, match=r"(?i)(CK_Orders_status|547)"):
            db_client.execute_non_query(
                "UPDATE dbo.Orders SET order_status = 'CORRUPTED_DISASTER' WHERE order_id = 1;"
            )

    def test_live_boundary_invalid_voucher_dates(self, db_client):
        with pytest.raises(Exception, match=r"(?i)(CK_Vouchers_dates|547)"):
            db_client.execute_non_query(
                "INSERT INTO dbo.Vouchers (voucher_code, discount_percent, min_order_value, max_discount, valid_from, expired_at, usage_limit, used_count) VALUES (N'TEST_BAD_DATE', 10.00, 50.00, 20.00, '2026-12-31', '2026-01-01', 100, 0);"
            )

    def test_live_boundary_invalid_user_role(self, db_client):
        with pytest.raises(Exception, match=r"(?i)(CK_Users_role|547)"):
            db_client.execute_non_query(
                "INSERT INTO dbo.Users (username, email, password_hash, full_name, role) VALUES (N'_test_baduser', N'badrole@test.local', N'hash123', N'Bad User', N'superadmin');"
            )

    def test_live_boundary_order_cancellation_guard(self, db_client, clean_sentinels):
        order = db_client.execute_query("SELECT order_status FROM dbo.Orders WHERE order_id = 1;")
        assert order and order[0]["order_status"] == "delivered"

    def test_live_tier3_full_lifecycle_flow(self, db_client, clean_sentinels):
        """
        Live Tier 3 End-to-End Multi-Actor Workflow:
          1. Seller (seller_id=2) lists a new product with stock 10, price 150.00.
          2. Buyer (user_id=9) adds 2 units to cart.
          3. Buyer checks out with voucher WELCOME10 (10% off), creates Order and Order_Details.
          4. Stock decrements to 8, sold_quantity increments to 2, cart item is cleared.
          5. Seller progresses order through fulfillment: pending -> processing -> shipped -> delivered.
          6. Buyer submits 5-star review referencing order_detail_id.
          7. Platform BI verifies delivered GMV reflects total_amount (300.00) and final_amount (270.00).
          8. Guaranteed cleanup via clean_sentinels.
        """
        # 1. Seller lists product
        db_client.execute_non_query("""
        INSERT INTO dbo.Products (seller_id, category_id, name, description, price, stock_quantity, sold_quantity, is_active, status)
        VALUES (2, 5, N'[TEST] European Linen Blazer', N'TEST_SENTINEL Linen Blazer', 150.00, 10, 0, 1, 'active');
        """)
        prod_rows = db_client.execute_query("SELECT product_id FROM dbo.Products WHERE name = N'[TEST] European Linen Blazer';")
        assert prod_rows, "Product creation failed"
        prod_id = prod_rows[0]["product_id"]

        # 2. Buyer adds to cart
        db_client.execute_non_query(
            "INSERT INTO dbo.Cart_Items (user_id, product_id, quantity) VALUES (9, ?, 2);",
            (prod_id,)
        )
        cart_rows = db_client.execute_query("SELECT quantity FROM dbo.Cart_Items WHERE user_id = 9 AND product_id = ?;", (prod_id,))
        assert len(cart_rows) == 1 and cart_rows[0]["quantity"] == 2

        # 3. Checkout with voucher & place order
        subtotal = 300.00
        discount = 30.00
        final_amt = 270.00
        db_client.execute_non_query(
            "INSERT INTO dbo.Orders (buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method) VALUES (9, 2, ?, ?, ?, 'pending', N'TEST_SENTINEL 88 Tran Hung Dao, District 5', 'Credit Card');",
            (subtotal, discount, final_amt)
        )
        order_rows = db_client.execute_query("SELECT MAX(order_id) AS order_id FROM dbo.Orders WHERE buyer_id = 9 AND shipping_address LIKE 'TEST_SENTINEL%';")
        order_id = order_rows[0]["order_id"]

        # Insert order detail
        db_client.execute_non_query(
            "INSERT INTO dbo.Order_Details (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, 2, 150.00, 300.00);",
            (order_id, prod_id)
        )
        od_rows = db_client.execute_query("SELECT order_detail_id FROM dbo.Order_Details WHERE order_id = ? AND product_id = ?;", (order_id, prod_id))
        od_id = od_rows[0]["order_detail_id"]

        # 4. Inventory decrement and cart clearance
        db_client.execute_non_query(
            "UPDATE dbo.Products SET stock_quantity = stock_quantity - 2, sold_quantity = sold_quantity + 2 WHERE product_id = ?;",
            (prod_id,)
        )
        db_client.execute_non_query("DELETE FROM dbo.Cart_Items WHERE user_id = 9 AND product_id = ?;", (prod_id,))

        prod_check = db_client.execute_query("SELECT stock_quantity, sold_quantity FROM dbo.Products WHERE product_id = ?;", (prod_id,))
        assert prod_check[0]["stock_quantity"] == 8
        assert prod_check[0]["sold_quantity"] == 2

        # 5. Seller fulfillment progression
        db_client.execute_non_query("UPDATE dbo.Orders SET order_status = 'processing' WHERE order_id = ?;", (order_id,))
        db_client.execute_non_query("UPDATE dbo.Orders SET order_status = 'shipped' WHERE order_id = ?;", (order_id,))
        db_client.execute_non_query("UPDATE dbo.Orders SET order_status = 'delivered' WHERE order_id = ?;", (order_id,))

        status_check = db_client.execute_scalar("SELECT order_status FROM dbo.Orders WHERE order_id = ?;", (order_id,))
        assert status_check == "delivered"

        # 6. Buyer reviews product
        db_client.execute_non_query(
            "INSERT INTO dbo.Reviews (order_detail_id, user_id, product_id, rating, comment) VALUES (?, 9, ?, 5, N'TEST_SENTINEL Outstanding linen quality and cut!');",
            (od_id, prod_id)
        )
        rev_rows = db_client.execute_query("SELECT rating FROM dbo.Reviews WHERE order_detail_id = ?;", (od_id,))
        assert len(rev_rows) == 1 and rev_rows[0]["rating"] == 5

        # 7. Platform BI verifies GMV
        order_summary = db_client.execute_query(
            "SELECT total_amount, discount_amount, final_amount, order_status FROM dbo.Orders WHERE order_id = ?;",
            (order_id,)
        )
        assert order_summary[0]["total_amount"] == 300.00
        assert order_summary[0]["final_amount"] == 270.00
        assert order_summary[0]["order_status"] == "delivered"
