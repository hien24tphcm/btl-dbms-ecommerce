'use client';

import React, { useEffect, useState } from 'react';
import {
  Store,
  BarChart3,
  Boxes,
  Truck,
  Plus,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function SellerCenterPage() {
  const { users, currentUser } = useAuth();
  const sellerUsers = users.filter((u) => u.seller_id);

  const [activeSellerId, setActiveSellerId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'catalog' | 'orders'
  >('analytics');

  const [categories, setCategories] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<{
    summary: any;
    topProducts: any[];
  } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);

  // Date filters for FR-10 sp_GetSellerAnalytics
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Upsert Product Modal state (FR-07 sp_UpsertProduct)
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [formCategoryId, setFormCategoryId] = useState<number>(2);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('100');
  const [formStock, setFormStock] = useState<string>('20');
  const [formStatus, setFormStatus] = useState<string>('active');

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.seller_id) {
      setActiveSellerId(currentUser.seller_id);
    }
  }, [currentUser?.seller_id]);

  const loadSellerData = async (sid = activeSellerId) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = new URLSearchParams({ sellerId: String(sid) });
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);

      const [cats, ana, prods, ords] = await Promise.all([
        apiFetch<any[]>('/categories'),
        apiFetch<any>(`/seller/analytics?${qs.toString()}`),
        apiFetch<any[]>(`/seller/products?sellerId=${sid}`),
        apiFetch<any[]>(`/seller/orders?sellerId=${sid}`),
      ]);
      setCategories(cats);
      setAnalytics(ana);
      setProducts(prods);
      setSellerOrders(ords);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellerData(activeSellerId);
  }, [activeSellerId]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormCategoryId(categories[0]?.category_id || 2);
    setFormName('');
    setFormDescription('');
    setFormPrice('99.00');
    setFormStock('15');
    setFormStatus('active');
    setShowProductModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setFormCategoryId(p.category_id);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormPrice(String(p.price));
    setFormStock(String(p.stock_quantity));
    setFormStatus(p.status);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const endpoint = editingProduct
        ? `/seller/products/${editingProduct.product_id}`
        : '/seller/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({
          sellerId: activeSellerId,
          categoryId: Number(formCategoryId),
          name: formName,
          description: formDescription,
          price: Number(formPrice),
          stockQuantity: Number(formStock),
          status: formStatus,
        }),
      });
      setProducts(res.products);
      setShowProductModal(false);
      setToastMsg(
        editingProduct
          ? `Đã cập nhật sản phẩm #${editingProduct.product_id} (EXEC dbo.sp_UpsertProduct — Query c).`
          : `Đã thêm mới sản phẩm #${res.productId} vào gian hàng (EXEC dbo.sp_UpsertProduct — Query a).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAdjustStock = async (productId: number, delta: number) => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch(
        `/seller/products/${productId}/inventory`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            sellerId: activeSellerId,
            stockDelta: delta,
            lowStockThreshold: 5,
          }),
        },
      );
      await loadSellerData(activeSellerId);
      setToastMsg(
        `Đã điều chỉnh kho (${delta > 0 ? `+${delta}` : delta}) cho "${updated?.name}". Tồn mới: ${updated?.stock_quantity} ${
          updated?.is_low_stock ? '⚠️ [CẢNH BÁO TỒN KHO THẤP <= 5]' : ''
        } (EXEC dbo.sp_AdjustInventory).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAdvanceOrderStatus = async (
    orderId: number,
    nextStatus: string,
  ) => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      await apiFetch(`/seller/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          sellerId: activeSellerId,
          newStatus: nextStatus,
        }),
      });
      await loadSellerData(activeSellerId);
      setToastMsg(
        `Đã chuyển trạng thái đơn hàng #${orderId} sang "${nextStatus}" (EXEC dbo.sp_UpdateOrderFulfillment).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Group seller orders by order_id (since sp_GetSellerOrders returns 4-table JOIN line items)
  const groupedOrders: Record<number, { order: any; items: any[] }> =
    sellerOrders.reduce(
      (acc: Record<number, { order: any; items: any[] }>, row) => {
        if (!acc[row.order_id]) {
          acc[row.order_id] = { order: row, items: [] };
        }
        acc[row.order_id].items.push(row);
        return acc;
      },
      {},
    );

  const getNextMonotonicStatus = (
    current: string,
  ): { next: string; label: string } | null => {
    if (current === 'pending')
      return { next: 'processing', label: 'Xác nhận & Đóng gói (processing)' };
    if (current === 'processing')
      return { next: 'shipped', label: 'Giao ĐVVC (shipped)' };
    if (current === 'shipped')
      return { next: 'delivered', label: 'Hoàn tất giao hàng (delivered)' };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header & Shop Selector */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Kênh Người Bán & Thống Kê Gian Hàng (Seller Center: FR-07 .. FR-10)
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Chọn Gian hàng quản lý (dbo.Sellers):
            </span>
            <select
              value={activeSellerId}
              onChange={(e) => setActiveSellerId(Number(e.target.value))}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-900 focus:outline-none"
            >
              {sellerUsers.map((s) => (
                <option key={s.seller_id} value={Number(s.seller_id)}>
                  Seller #{s.seller_id}: {s.shop_name} ({s.username}) — ★{' '}
                  {Number(s.seller_rating).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <DbmsBadge
            fr="FR-07"
            queryType="(a, c) Upsert"
            procedure="sp_UpsertProduct"
          />
          <DbmsBadge
            fr="FR-08"
            queryType="(c) Update"
            procedure="sp_AdjustInventory"
          />
          <DbmsBadge
            fr="FR-09"
            queryType="(f) Join & (c) Update"
            procedure="sp_GetSellerOrders / sp_UpdateOrderFulfillment"
          />
          <DbmsBadge
            fr="FR-10"
            queryType="(h) Aggregate"
            procedure="sp_GetSellerAnalytics"
          />
        </div>
      </div>

      {toastMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          1. Thống kê Doanh thu & Top 5 SP (FR-10)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'catalog'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Boxes className="h-4 w-4" />
          2. Quản lý Sản phẩm & Tồn kho (FR-07, FR-08) [{products.length}]
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="h-4 w-4" />
          3. Điều phối Đơn hàng Gian hàng (FR-09) [
          {Object.keys(groupedOrders).length}]
        </button>
      </div>

      {/* TAB 1: SELLER ANALYTICS (FR-10: sp_GetSellerAnalytics) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Date Filter Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadSellerData(activeSellerId);
            }}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Từ ngày (@start_date)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Đến ngày (@end_date)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Thống kê (EXEC dbo.sp_GetSellerAnalytics)
            </button>
          </form>

          {/* KPI Summary Cards (Result Set 1 of sp_GetSellerAnalytics) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Tổng doanh thu hoàn tất (SUM(final_amount))
              </span>
              <div className="mt-2 text-2xl font-extrabold text-indigo-600">
                {formatCurrency(analytics?.summary?.total_revenue)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Gian hàng: {analytics?.summary?.shop_name}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Số đơn giao thành công (COUNT(DISTINCT order_id))
              </span>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600">
                {analytics?.summary?.completed_order_count || 0} đơn
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Chỉ tính đơn ở trạng thái delivered
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Tổng sản lượng tiêu thụ (SUM(quantity))
              </span>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {analytics?.summary?.total_items_sold || 0} sản phẩm
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Result Set #1 của sp_GetSellerAnalytics
              </span>
            </div>
          </div>

          {/* Top 5 Best-Selling Products Table (Result Set 2 of sp_GetSellerAnalytics) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Top 5 Sản phẩm bán chạy nhất Gian hàng (FR-10 | Query h: GROUP BY
                & SUM)
              </h3>
              <span className="font-mono text-xs text-slate-400">
                Result Set #2 của dbo.sp_GetSellerAnalytics
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Hạng</th>
                    <th className="px-4 py-3">product_id</th>
                    <th className="px-4 py-3">Tên sản phẩm</th>
                    <th className="px-4 py-3 text-center">
                      Tổng SL bán (SUM(od.quantity))
                    </th>
                    <th className="px-4 py-3 text-right">
                      Doanh thu SP (SUM(od.subtotal))
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analytics?.topProducts || []).map((tp, idx) => (
                    <tr key={tp.product_id}>
                      <td className="px-4 py-3 font-bold text-indigo-600">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        PID #{tp.product_id}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {tp.product_name}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {tp.total_sold_quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(tp.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT CATALOG & INVENTORY (FR-07 & FR-08) */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Danh mục Sản phẩm & Quản trị Tồn kho (FR-07 & FR-08)
              </h3>
              <p className="text-xs text-slate-500">
                Cảnh báo tự động khi{' '}
                <code className="font-mono">
                  stock_quantity &lt;= @low_stock_threshold (5)
                </code>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm mới (sp_UpsertProduct)
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3 text-right">Giá niêm yết</th>
                  <th className="px-4 py-3 text-center">Tồn kho (FR-08)</th>
                  <th className="px-4 py-3 text-center">Đã bán</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">
                    Điều chỉnh kho (sp_AdjustInventory) & Sửa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      #{p.product_id}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.category_name}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${
                          p.is_low_stock
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.is_low_stock ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : null}
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {p.sold_quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(p.product_id, 10)}
                          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-100"
                          title="Nhập kho +10 (sp_AdjustInventory)"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(p.product_id, -5)}
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
                          title="Xuất kho -5 (sp_AdjustInventory)"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3 w-3" />
                          Sửa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SELLER ORDER FULFILLMENT (FR-09) */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
              Tiếp nhận & Luân chuyển trạng thái đơn hàng một chiều (FR-09)
            </h3>
            <p className="text-xs text-slate-500">
              Quy trình chuyển trạng thái nghiêm ngặt trong{' '}
              <code className="font-mono">dbo.sp_UpdateOrderFulfillment</code>:{' '}
              <strong>pending → processing → shipped → delivered</strong>.
            </p>
          </div>

          {Object.values(groupedOrders).map(({ order, items }) => {
            const nextTransition = getNextMonotonicStatus(order.order_status);
            return (
              <div
                key={order.order_id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-sm font-bold text-slate-900">
                      Order #{order.order_id}
                    </span>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-bold uppercase text-indigo-800">
                      {order.order_status}
                    </span>
                    <span className="text-slate-600">
                      Khách mua: <strong>{order.buyer_name}</strong> (
                      {order.buyer_email})
                    </span>
                    <span className="text-slate-500">
                      • Giao tới: {order.shipping_address}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-indigo-600">
                      {formatCurrency(order.final_amount)}
                    </span>
                    {nextTransition && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAdvanceOrderStatus(
                            order.order_id,
                            nextTransition.next,
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                      >
                        <span>{nextTransition.label}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 px-5 py-3">
                  {items.map((it) => (
                    <div
                      key={it.order_detail_id}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        {it.product_name}{' '}
                        <span className="font-mono font-normal text-slate-400">
                          (PID #{it.product_id})
                        </span>
                      </span>
                      <span className="text-slate-600">
                        {it.quantity} x {formatCurrency(it.unit_price)} ={' '}
                        <strong className="text-slate-900">
                          {formatCurrency(it.subtotal)}
                        </strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upsert Product Modal (FR-07: sp_UpsertProduct) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct
                  ? `Cập nhật Sản phẩm #${editingProduct.product_id} (sp_UpsertProduct)`
                  : 'Thêm Sản phẩm mới vào Gian hàng (sp_UpsertProduct)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tên sản phẩm (@name)
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Danh mục (@category_id)
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Trạng thái (@status)
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="out_of_stock">out_of_stock</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Giá bán USD (@price)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tồn kho (@stock_quantity)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mô tả (@description)
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Lưu sản phẩm (EXEC dbo.sp_UpsertProduct)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
