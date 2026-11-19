"""
SQL Integrity and Relational Consistency Test
Validates relational consistency, foreign keys, constraints, and business logic in seed data.
Strict Alignment with docs/project.md §IV and Downstream Stored Procedures.
"""

import os
import re
import unittest

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class TestSqlIntegrity(unittest.TestCase):
    def setUp(self):
        self.seed_file = os.path.join(WORKSPACE_ROOT, "src", "mssql", "init", "03_seed.sql")
        with open(self.seed_file, "r", encoding="utf-8") as f:
            self.seed_content = f.read()

    def test_seed_foreign_keys_and_relations(self):
        # 1. Extract Users: (user_id, username, email, password_hash, full_name, phone_number, address, role, is_active, ...)
        user_matches = re.findall(
            r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*N'\$2a\$[^']+',\s*N'([^']+)',\s*(?:N'([^']+)'|NULL),\s*(?:N'([^']+)'|NULL),\s*N'([^']+)',\s*([01]),",
            self.seed_content
        )
        users = {}
        for uid, uname, email, fname, phone, addr, role, is_active in user_matches:
            users[int(uid)] = {
                "username": uname, "email": email, "role": role, "is_active": int(is_active)
            }
        user_ids = set(users.keys())
        self.assertGreaterEqual(len(user_ids), 10)
        self.assertTrue(all(u["is_active"] == 1 for u in users.values()))

        # 2. Extract Sellers: (seller_id, user_id, shop_name, store_description, rating, is_approved, address, ...)
        sellers = re.findall(
            r"\((\d+),\s*(\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(\d+\.\d{2}),\s*([01]),\s*N'([^']+)',",
            self.seed_content
        )
        seller_ids = set()
        seller_user_ids = set()
        seller_shop_names = set()
        for sid, uid, sname, sdesc, rating, is_appr, saddr in sellers:
            sid = int(sid)
            uid = int(uid)
            seller_ids.add(sid)
            seller_user_ids.add(uid)
            seller_shop_names.add(sname)
            self.assertIn(uid, user_ids, f"Seller user_id {uid} does not exist in Users")
            self.assertEqual(int(is_appr), 1, f"Seller {sid} is_approved must be 1")
            self.assertGreaterEqual(float(rating), 0.0)
            self.assertLessEqual(float(rating), 5.0)
        self.assertEqual(len(seller_ids), 5)
        self.assertEqual(len(seller_user_ids), 5, "Duplicate user_id assigned to sellers")
        self.assertEqual(len(seller_shop_names), 5, "Duplicate shop_name in sellers")

        # 3. Extract Categories: (category_id, category_name, description, parent_id, ...)
        cat_rows = re.findall(r"\((\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(NULL|\d+)", self.seed_content)
        cat_ids = set()
        for cid, cname, cdesc, pid in cat_rows:
            cat_ids.add(int(cid))
        for cid, cname, cdesc, pid in cat_rows:
            if pid != "NULL":
                self.assertIn(int(pid), cat_ids, f"Category parent_id {pid} does not exist in Categories")
        self.assertGreaterEqual(len(cat_ids), 6)

        # 4. Extract Products: (product_id, seller_id, category_id, name, description, price, stock_quantity, sold_quantity, is_active, status, ...)
        prod_rows = re.findall(
            r"\((\d+),\s*(\d+),\s*(\d+),\s*N'([^']+)',\s*N'([^']+)',\s*(\d+\.\d{2}),\s*(\d+),\s*(\d+),\s*([01]),\s*N'([^']+)'",
            self.seed_content
        )
        prod_ids = set()
        product_seller_map = {}
        for pid, sid, cid, pname, pdesc, price, stock, sold, is_active, status in prod_rows:
            pid = int(pid)
            sid = int(sid)
            cid = int(cid)
            prod_ids.add(pid)
            product_seller_map[pid] = sid
            self.assertIn(sid, seller_ids, f"Product seller_id {sid} does not exist in Sellers")
            self.assertIn(cid, cat_ids, f"Product category_id {cid} does not exist in Categories")
            self.assertIn(status, ['active', 'inactive', 'out_of_stock'])
            self.assertEqual(int(is_active), 1)
            self.assertGreaterEqual(int(sold), 0)
            self.assertGreaterEqual(int(stock), 0)
            self.assertGreaterEqual(float(price), 0.0)
        self.assertGreaterEqual(len(prod_ids), 20)

        # 5. Extract Vouchers: (voucher_code, discount_percent, min_order_value, max_discount, valid_from, expired_at, usage_limit, used_count)
        voucher_rows = re.findall(
            r"\(N'([^']+)',\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)",
            self.seed_content
        )
        self.assertGreaterEqual(len(voucher_rows), 5)
        for code, disc_pct, min_val, max_disc, vfrom, vexp, limit, used in voucher_rows:
            self.assertGreaterEqual(float(disc_pct), 0.0)
            self.assertLessEqual(float(disc_pct), 100.0)
            self.assertGreaterEqual(float(min_val), 0.0)
            self.assertGreaterEqual(float(max_disc), 0.0)
            self.assertLessEqual(int(used), int(limit))
            self.assertGreaterEqual(vexp, vfrom)

        # 6. Extract Cart_Items: (cart_item_id, user_id, product_id, quantity, ...)
        cart_rows = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*SYSUTCDATETIME\(\)\)", self.seed_content)
        cart_user_prod = set()
        for cid, uid, pid, qty in cart_rows:
            self.assertIn(int(uid), user_ids, f"Cart user_id {uid} does not exist in Users")
            self.assertIn(int(pid), prod_ids, f"Cart product_id {pid} does not exist in Products")
            self.assertNotIn((int(uid), int(pid)), cart_user_prod, "Duplicate (user_id, product_id) in Cart_Items")
            cart_user_prod.add((int(uid), int(pid)))
        self.assertGreaterEqual(len(cart_rows), 10)

        # 7. Extract Orders: (order_id, buyer_id, seller_id, total_amount, discount_amount, final_amount, order_status, shipping_address, payment_method, ...)
        order_rows = re.findall(
            r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*(\d+\.\d{2}),\s*N'([^']+)',\s*N'([^']+)',\s*N'([^']+)'",
            self.seed_content
        )
        orders = {}
        for oid, bid, sid, total, discount, final, status, addr, pmethod in order_rows:
            oid = int(oid)
            bid = int(bid)
            sid = int(sid)
            self.assertIn(bid, user_ids, f"Order buyer_id {bid} does not exist in Users")
            self.assertIn(sid, seller_ids, f"Order seller_id {sid} does not exist in Sellers")
            self.assertIn(status, ['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
            self.assertIn(pmethod, ['COD', 'Credit Card', 'Bank Transfer', 'E-Wallet'])
            
            tot = float(total)
            disc = float(discount)
            fin = float(final)
            self.assertAlmostEqual(fin, tot - disc, places=2, msg=f"Order {oid} final_amount calculation mismatch")
            orders[oid] = {
                "buyer_id": bid,
                "seller_id": sid,
                "total": tot,
                "discount": disc,
                "final": fin,
                "status": status,
                "items_sum": 0.0,
            }
        self.assertGreaterEqual(len(orders), 15)

        # 8. Extract Order_Details: (order_detail_id, order_id, product_id, quantity, unit_price, subtotal)
        od_rows = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+\.\d{2}),\s*(\d+\.\d{2})\)", self.seed_content)
        self.assertGreaterEqual(len(od_rows), 15)
        order_details_map = {}
        for od_id, oid, pid, qty, unit_price, subtotal in od_rows:
            od_id = int(od_id)
            oid = int(oid)
            pid = int(pid)
            qty = int(qty)
            u_price = float(unit_price)
            sub = float(subtotal)
            self.assertIn(oid, orders, f"Order_Detail order_id {oid} does not exist in Orders")
            self.assertIn(pid, prod_ids, f"Order_Detail product_id {pid} does not exist in Products")
            
            # Crucial multi-vendor contract check: Order's seller_id must match product's seller_id
            order_seller = orders[oid]["seller_id"]
            prod_seller = product_seller_map[pid]
            self.assertEqual(
                order_seller, prod_seller,
                f"Multi-vendor mismatch: Order {oid} has seller {order_seller} but product {pid} belongs to seller {prod_seller}"
            )

            self.assertAlmostEqual(sub, qty * u_price, places=2, msg=f"Subtotal mismatch in Order_Detail {od_id}")
            orders[oid]["items_sum"] += sub
            order_details_map[od_id] = {
                "order_id": oid,
                "product_id": pid,
                "buyer_id": orders[oid]["buyer_id"],
            }

        # Verify sum of order details equals order total_amount
        for oid, data in orders.items():
            self.assertAlmostEqual(data["total"], data["items_sum"], places=2,
                                   msg=f"Order {oid} total {data['total']} != items sum {data['items_sum']}")

        # 9. Extract Reviews: (review_id, order_detail_id, user_id, product_id, rating, comment, created_at)
        rev_rows = re.findall(r"\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([1-5]),\s*N'", self.seed_content)
        rev_user_prod = set()
        for rid, od_id, uid, pid, rating in rev_rows:
            rid = int(rid)
            od_id = int(od_id)
            uid = int(uid)
            pid = int(pid)
            self.assertIn(uid, user_ids, f"Review user_id {uid} does not exist in Users")
            self.assertIn(pid, prod_ids, f"Review product_id {pid} does not exist in Products")
            self.assertIn(od_id, order_details_map, f"Review order_detail_id {od_id} does not exist in Order_Details")
            
            # Verify review matches the purchasing buyer and product
            od_data = order_details_map[od_id]
            self.assertEqual(uid, od_data["buyer_id"], f"Review {rid} user {uid} != purchasing buyer {od_data['buyer_id']}")
            self.assertEqual(pid, od_data["product_id"], f"Review {rid} product {pid} != order detail product {od_data['product_id']}")

            self.assertNotIn((uid, pid), rev_user_prod, f"Duplicate review for user {uid} product {pid}")
            rev_user_prod.add((uid, pid))
        self.assertGreaterEqual(len(rev_rows), 15)

if __name__ == "__main__":
    unittest.main()