"""
Milestone 1 Verification Test Suite
Verifies Docker Infrastructure, MSSQL Dockerfile, 9-Table Schema, Indexes, Seed Data, and Baseline Backup.
Strict Alignment with docs/project.md §IV and Downstream Stored Procedures.
"""

import os
import re
import unittest

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class TestMilestone1Infrastructure(unittest.TestCase):
    def setUp(self):
        self.compose_path = os.path.join(WORKSPACE_ROOT, "docker-compose.yml")
        self.env_example_path = os.path.join(WORKSPACE_ROOT, ".env.example")
        self.dockerfile_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "Dockerfile")
        self.schema_sql_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "01_schema.sql")
        self.indexes_sql_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "02_indexes.sql")
        self.seed_sql_path = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "03_seed.sql")

    def test_files_exist_and_non_empty(self):
        for path in [
            self.compose_path,
            self.env_example_path,
            self.dockerfile_path,
            self.schema_sql_path,
            self.indexes_sql_path,
            self.seed_sql_path,
        ]:
            self.assertTrue(os.path.isfile(path), f"File missing: {path}")
            self.assertGreater(os.path.getsize(path), 0, f"File is empty: {path}")

    def test_env_example_contents(self):
        with open(self.env_example_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("MSSQL_SA_PASSWORD=Password_123#", content)
        self.assertIn("MSSQL_PORT=1433", content)
        self.assertIn("NEO4J_PASSWORD=Neo4jSecurePass2025!", content)
        self.assertIn("NEO4J_HTTP_PORT=7474", content)
        self.assertIn("NEO4J_BOLT_PORT=7687", content)

    def test_dockerfile_configuration(self):
        with open(self.dockerfile_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("FROM mcr.microsoft.com/mssql/server:2022-latest", content)
        self.assertIn("USER root", content)
        self.assertIn("/var/opt/mssql/backup", content)
        self.assertIn("chown -R mssql:root", content)
        self.assertIn("COPY init/ /init/", content)
        self.assertIn("USER mssql", content)
        self.assertIn("EXPOSE 1433", content)

    def test_docker_compose_structure(self):
        with open(self.compose_path, "r", encoding="utf-8") as f:
            content = f.read()

        # MSSQL Service build context and image
        self.assertIn("context: ./src/mssql", content)
        self.assertIn("dockerfile: Dockerfile", content)
        self.assertIn("image: ecommerce_mssql:2022", content)
        self.assertIn("ACCEPT_EULA", content)
        self.assertIn("MSSQL_SA_PASSWORD", content)
        self.assertIn("MSSQL_PID", content)
        self.assertIn("${MSSQL_PORT:-1433}:1433", content)
        self.assertIn("mssql_data:/var/opt/mssql/data", content)
        self.assertIn("mssql_backups:/var/opt/mssql/backup", content)
        self.assertIn("./src/mssql/init:/init:ro", content)
        self.assertIn("/opt/mssql-tools18/bin/sqlcmd", content)
        self.assertIn("SELECT 1", content)

        # MSSQL Init Service
        self.assertIn("mssql-init:", content)
        self.assertIn("condition: service_healthy", content)
        self.assertIn("01_schema.sql", content)
        self.assertIn("02_indexes.sql", content)
        self.assertIn("03_seed.sql", content)

        # Neo4j Service
        self.assertIn("neo4j:", content)
        self.assertIn("neo4j:5-community", content)
        self.assertIn("NEO4J_AUTH", content)
        self.assertIn("${NEO4J_HTTP_PORT:-7474}:7474", content)
        self.assertIn("${NEO4J_BOLT_PORT:-7687}:7687", content)
        self.assertIn("neo4j_data:/data", content)
        self.assertIn("profiles:", content)
        self.assertIn("neo4j", content)

        # Volumes
        self.assertIn("mssql_data:", content)
        self.assertIn("mssql_backups:", content)
        self.assertIn("neo4j_data:", content)

    def test_schema_sql_database_options(self):
        with open(self.schema_sql_path, "r", encoding="utf-8") as f:
            sql = f.read()

        self.assertIn("CREATE DATABASE [ECommerceDB]", sql)
        self.assertIn("SET RECOVERY FULL", sql)
        self.assertIn("SET PAGE_VERIFY CHECKSUM", sql)
        self.assertIn("SET TARGET_RECOVERY_TIME = 60 SECONDS", sql)

    def test_schema_sql_all_9_tables_created(self):
        with open(self.schema_sql_path, "r", encoding="utf-8") as f:
            sql = f.read()

        tables = [
            "Users",
            "Sellers",
            "Categories",
            "Products",
            "Cart_Items",
            "Orders",
            "Order_Details",
            "Vouchers",
            "Reviews",
        ]
        for tbl in tables:
            self.assertRegex(
                sql,
                rf"CREATE\s+TABLE\s+dbo\.{tbl}",
                f"Table {tbl} not found in 01_schema.sql",
            )

        # Users columns & checks (includes is_active)
        self.assertIn("user_id INT IDENTITY", sql)
        self.assertIn("username NVARCHAR", sql)
        self.assertIn("email NVARCHAR", sql)
        self.assertIn("password_hash NVARCHAR", sql)
        self.assertIn("full_name NVARCHAR", sql)
        self.assertIn("phone_number NVARCHAR", sql)
        self.assertIn("address NVARCHAR", sql)
        self.assertIn("role NVARCHAR", sql)
        self.assertIn("is_active BIT NOT NULL", sql)
        self.assertIn("DF_Users_is_active", sql)
        self.assertIn("'buyer', 'seller', 'admin'", sql)

        # Sellers columns (shop_name, is_approved, address)
        self.assertIn("seller_id INT IDENTITY", sql)
        self.assertIn("shop_name NVARCHAR(100) NOT NULL", sql)
        self.assertIn("UQ_Sellers_shop_name UNIQUE (shop_name)", sql)
        self.assertIn("is_approved BIT NOT NULL", sql)
        self.assertIn("DF_Sellers_is_approved", sql)
        self.assertIn("rating DECIMAL(3,2)", sql)

        # Categories
        self.assertIn("category_id INT IDENTITY", sql)
        self.assertIn("category_name NVARCHAR", sql)
        self.assertIn("parent_id INT", sql)

        # Products (price DECIMAL(18,2), sold_quantity, is_active)
        self.assertIn("product_id INT IDENTITY", sql)
        self.assertIn("price DECIMAL(18,2)", sql)
        self.assertIn("stock_quantity INT", sql)
        self.assertIn("sold_quantity INT NOT NULL", sql)
        self.assertIn("DF_Products_sold_quantity", sql)
        self.assertIn("is_active BIT NOT NULL", sql)
        self.assertIn("DF_Products_is_active", sql)
        self.assertIn("'active', 'inactive', 'out_of_stock'", sql)

        # Cart_Items
        self.assertIn("cart_item_id INT IDENTITY", sql)
        self.assertIn("UQ_Cart_Items_User_Product UNIQUE (user_id, product_id)", sql)

        # Orders (buyer_id, seller_id, discount_amount, final_amount, order_status)
        self.assertIn("order_id INT IDENTITY", sql)
        self.assertIn("buyer_id INT NOT NULL", sql)
        self.assertIn("seller_id INT NOT NULL", sql)
        self.assertIn("total_amount DECIMAL(18,2)", sql)
        self.assertIn("discount_amount DECIMAL(18,2)", sql)
        self.assertIn("final_amount DECIMAL(18,2)", sql)
        self.assertIn("order_status NVARCHAR(30)", sql)
        self.assertIn("DF_Orders_order_status", sql)
        self.assertIn("FK_Orders_Users FOREIGN KEY (buyer_id) REFERENCES dbo.Users(user_id)", sql)
        self.assertIn("FK_Orders_Sellers FOREIGN KEY (seller_id) REFERENCES dbo.Sellers(seller_id)", sql)
        self.assertIn("CK_Orders_status CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))", sql)

        # Order_Details (DECIMAL(18,2) and UQ_Order_Details_Order_Product)
        self.assertIn("order_detail_id INT IDENTITY", sql)
        self.assertIn("unit_price DECIMAL(18,2)", sql)
        self.assertIn("subtotal DECIMAL(18,2)", sql)
        self.assertIn("UQ_Order_Details_Order_Product UNIQUE (order_id, product_id)", sql)

        # Vouchers (voucher_code PK, discount_percent, min_order_value, expired_at)
        self.assertIn("voucher_code NVARCHAR(50) NOT NULL", sql)
        self.assertIn("PK_Vouchers PRIMARY KEY CLUSTERED (voucher_code)", sql)
        self.assertIn("discount_percent DECIMAL(5,2)", sql)
        self.assertIn("min_order_value DECIMAL(18,2)", sql)
        self.assertIn("max_discount DECIMAL(18,2)", sql)
        self.assertIn("expired_at DATETIME2", sql)

        # Reviews (order_detail_id FK, user_id, product_id)
        self.assertIn("review_id INT IDENTITY", sql)
        self.assertIn("order_detail_id INT NULL", sql)
        self.assertIn("FK_Reviews_Order_Details FOREIGN KEY (order_detail_id) REFERENCES dbo.Order_Details(order_detail_id)", sql)
        self.assertIn("rating >= 1 AND rating <= 5", sql)
        self.assertIn("UQ_Reviews_User_Product UNIQUE (user_id, product_id)", sql)

    def test_indexes_sql(self):
        with open(self.indexes_sql_path, "r", encoding="utf-8") as f:
            sql = f.read()

        required_indexes = [
            "IX_Products_seller_id",
            "IX_Products_category_id",
            "IX_Products_status_price",
            "IX_Orders_seller_id",
            "IX_Orders_buyer_id_created_at",
            "IX_Orders_order_status",
            "IX_Order_Details_order_id",
            "IX_Order_Details_product_id",
            "IX_Reviews_product_id_rating",
            "IX_Reviews_user_id",
        ]
        for idx in required_indexes:
            self.assertIn(idx, sql, f"Index {idx} missing in 02_indexes.sql")

        # Check covering columns on updated indexes
        self.assertIn("IX_Orders_seller_id", sql)
        self.assertIn("IX_Orders_buyer_id_created_at", sql)
        self.assertIn("IX_Orders_order_status", sql)
        self.assertIn("IX_Products_status_price", sql)

    def test_seed_sql_quantities_and_backup(self):
        with open(self.seed_sql_path, "r", encoding="utf-8") as f:
            sql = f.read()

        # Count Users inserted (tuple lines)
        user_matches = re.findall(r"\(\d+,\s*N'(?:admin|seller|buyer)_[^']+',\s*N'[^']+',\s*N'\$2a\$", sql)
        self.assertGreaterEqual(len(user_matches), 10, f"Expected 10+ users, got {len(user_matches)}")

        # Count Sellers inserted (with shop_name and is_approved)
        seller_matches = re.findall(r"\(\d+,\s*\d+,\s*N'[^']+',\s*N'[^']+',\s*4\.\d{2},\s*1,", sql)
        self.assertEqual(len(seller_matches), 5, f"Expected 5 sellers, got {len(seller_matches)}")

        # Count Categories inserted
        cat_matches = re.findall(r"\(\d+,\s*N'[^']+',\s*N'[^']+',\s*(?:NULL|\d+)", sql)
        self.assertGreaterEqual(len(cat_matches), 6, f"Expected 6+ categories, got {len(cat_matches)}")

        # Count Products inserted (with sold_quantity and is_active)
        prod_matches = re.findall(r"\(\d+,\s*\d+,\s*\d+,\s*N'[^']+',\s*N'[^']+',\s*\d+\.\d{2},\s*\d+,\s*\d+,\s*1,\s*N'active'", sql)
        self.assertGreaterEqual(len(prod_matches), 20, f"Expected 20+ products, got {len(prod_matches)}")

        # Count Vouchers inserted (voucher_code PK)
        voucher_matches = re.findall(r"\(N'[A-Z0-9]+',\s*\d+\.\d{2}", sql)
        self.assertGreaterEqual(len(voucher_matches), 5, f"Expected 5+ vouchers, got {len(voucher_matches)}")

        # Count Cart_Items inserted
        cart_matches = re.findall(r"\(\d+,\s*\d+,\s*\d+,\s*\d+,\s*SYSUTCDATETIME\(\)\)", sql)
        self.assertGreaterEqual(len(cart_matches), 10, f"Expected 10+ cart items, got {len(cart_matches)}")

        # Count Orders inserted (with buyer_id, seller_id, discount, final, order_status)
        order_matches = re.findall(r"\(\d+,\s*\d+,\s*\d+,\s*\d+\.\d{2},\s*\d+\.\d{2},\s*\d+\.\d{2},\s*N'(?:pending|processing|shipped|delivered|cancelled)'", sql)
        self.assertGreaterEqual(len(order_matches), 15, f"Expected 15+ orders, got {len(order_matches)}")

        # Count Reviews inserted (with order_detail_id)
        review_matches = re.findall(r"\(\d+,\s*\d+,\s*\d+,\s*\d+,\s*[1-5],\s*N'", sql)
        self.assertGreaterEqual(len(review_matches), 15, f"Expected 15+ reviews, got {len(review_matches)}")

        # Baseline Backup verification
        self.assertIn("BACKUP DATABASE [ECommerceDB]", sql)
        self.assertIn("TO DISK = N'/var/opt/mssql/backup/ECommerceDB_baseline.bak'", sql)
        self.assertIn("WITH FORMAT, INIT, COMPRESSION, CHECKSUM", sql)

if __name__ == "__main__":
    unittest.main()