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
  Search,
  DollarSign,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { getProductVisual } from '@/lib/product-visuals';

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
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Product Modal state
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
          ? `Đã cập nhật thông tin sản phẩm "${formName}".`
          : `Đã đăng bán sản phẩm mới "${formName}" thành công!`,
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
        `Đã cập nhật tồn kho cho "${updated?.name}". Tồn kho hiện tại: ${updated?.stock_quantity}.`,
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
      setToastMsg(`Đã cập nhật trạng thái đơn hàng #${orderId} thành công!`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

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

  const filteredOrderGroups = Object.values(groupedOrders).filter(({ order }) =>
    orderStatusFilter === 'all'
      ? true
      : order.order_status === orderStatusFilter,
  );

  const filteredProducts = products.filter((p) =>
    catalogSearch.trim() === ''
      ? true
      : p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.category_name.toLowerCase().includes(catalogSearch.toLowerCase()),
  );

  const getNextMonotonicStatus = (
    current: string,
  ): { next: string; label: string } | null => {
    if (current === 'pending')
      return { next: 'processing', label: 'Xác nhận & Đóng gói' };
    if (current === 'processing')
      return { next: 'shipped', label: 'Bàn giao Vận chuyển' };
    if (current === 'shipped')
      return { next: 'delivered', label: 'Xác nhận Đã giao' };
    return null;
  };

  const currentShopObj = sellerUsers.find(
    (s) => Number(s.seller_id) === activeSellerId,
  );

  return (
    <div className="space-y-6">
      {/* Seller Studio Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <Store className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200">
                Kênh Đối Tác Bán Hàng
              </span>
              <span className="text-xs font-bold text-amber-400">
                ★ {Number(currentShopObj?.seller_rating || 4.8).toFixed(2)}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">
              {currentShopObj?.shop_name || 'Trung Tâm Quản Lý Gian Hàng'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-xs">
            <span className="text-xs text-slate-300">Gian hàng:</span>
            <select
              value={activeSellerId}
              onChange={(e) => setActiveSellerId(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-white focus:outline-none"
            >
              {sellerUsers.map((s) => (
                <option
                  key={s.seller_id}
                  value={Number(s.seller_id)}
                  className="text-slate-900"
                >
                  {s.shop_name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Đăng sản phẩm mới
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Tổng quan Doanh thu
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Boxes className="h-4 w-4" />
          Sản phẩm & Kho hàng ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="h-4 w-4" />
          Quản lý Đơn hàng ({Object.keys(groupedOrders).length})
        </button>
      </div>

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400">
                  Doanh thu đơn hoàn tất
                </span>
                <div className="mt-0.5 text-2xl font-extrabold text-slate-900">
                  {formatCurrency(analytics?.summary?.total_revenue)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400">
                  Đơn giao thành công
                </span>
                <div className="mt-0.5 text-2xl font-extrabold text-emerald-600">
                  {analytics?.summary?.completed_order_count || 0} đơn
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400">
                  Tổng sản phẩm đã bán
                </span>
                <div className="mt-0.5 text-2xl font-extrabold text-slate-900">
                  {analytics?.summary?.total_items_sold || 0} sản phẩm
                </div>
              </div>
            </div>
          </div>

          {/* Date Filter & Top 5 Best-Selling Products */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Top 5 Sản Phẩm Bán Chạy Nhất Gian Hàng
                </h3>
                <p className="text-xs text-slate-500">
                  Xếp hạng theo số lượng tiêu thụ và doanh thu đóng góp
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadSellerData(activeSellerId);
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                />
                <span className="text-xs text-slate-400">đến</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Lọc kỳ
                </button>
              </form>
            </div>

            {(analytics?.topProducts || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Chưa có dữ liệu đơn hàng hoàn tất trong khoảng thời gian này.
              </p>
            ) : (
              <div className="space-y-4">
                {(analytics?.topProducts || []).map((tp, idx) => {
                  const maxRev = Number(
                    analytics?.topProducts?.[0]?.total_revenue || 1,
                  );
                  const pct = Math.max(
                    15,
                    Math.round((Number(tp.total_revenue) / maxRev) * 100),
                  );
                  return (
                    <div
                      key={tp.product_id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {tp.product_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-600">
                            Đã bán: <strong>{tp.total_sold_quantity}</strong>
                          </span>
                          <span className="text-sm font-extrabold text-indigo-600">
                            {formatCurrency(tp.total_revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT CATALOG & INVENTORY */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm nhanh sản phẩm trong kho..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Sản phẩm</th>
                  <th className="px-4 py-3.5">Danh mục</th>
                  <th className="px-4 py-3.5 text-right">Giá bán</th>
                  <th className="px-4 py-3.5 text-center">Tồn kho</th>
                  <th className="px-4 py-3.5 text-center">Đã bán</th>
                  <th className="px-4 py-3.5 text-center">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">
                    Nhập/Xuất kho nhanh & Chỉnh sửa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const vis = getProductVisual(p.category_id, p.name);
                  return (
                    <tr key={p.product_id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${vis.gradient} text-lg`}
                          >
                            {vis.emoji}
                          </div>
                          <span className="font-bold text-slate-900">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {p.category_name}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-indigo-600">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
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
                      <td className="px-4 py-3.5 text-center font-semibold">
                        {p.sold_quantity}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            p.status === 'active'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.status === 'active'
                            ? 'Đang bán'
                            : p.status === 'out_of_stock'
                              ? 'Hết hàng'
                              : 'Tạm ẩn'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(p.product_id, 10)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustStock(p.product_id, -5)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800 hover:bg-amber-100"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit3 className="h-3 w-3" />
                            Sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ORDER FULFILLMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
            {[
              { key: 'all', label: 'Tất cả đơn' },
              { key: 'pending', label: 'Chờ xác nhận' },
              { key: 'processing', label: 'Đang đóng gói' },
              { key: 'shipped', label: 'Đang giao' },
              { key: 'delivered', label: 'Đã giao' },
              { key: 'cancelled', label: 'Đã hủy' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setOrderStatusFilter(t.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  orderStatusFilter === t.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredOrderGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Không có đơn hàng nào ở trạng thái này.
            </div>
          ) : (
            filteredOrderGroups.map(({ order, items }) => {
              const nextTransition = getNextMonotonicStatus(order.order_status);
              return (
                <div
                  key={order.order_id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-sm font-bold text-slate-900">
                        Đơn hàng #{order.order_id}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-bold uppercase text-indigo-800">
                        {order.order_status}
                      </span>
                      <span className="text-slate-600">
                        Khách hàng: <strong>{order.buyer_name}</strong>
                      </span>
                      <span className="text-slate-500">
                        • Địa chỉ: {order.shipping_address}
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
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
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
                          {it.product_name}
                        </span>
                        <span className="text-slate-600">
                          {it.quantity} × {formatCurrency(it.unit_price)} ={' '}
                          <strong className="text-slate-900">
                            {formatCurrency(it.subtotal)}
                          </strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct
                  ? 'Chỉnh sửa thông tin sản phẩm'
                  : 'Đăng sản phẩm mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tên sản phẩm
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Ngành hàng
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Trạng thái hiển thị
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                >
                  <option value="active">Đang mở bán</option>
                  <option value="inactive">Tạm ẩn</option>
                  <option value="out_of_stock">Hết hàng</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Giá niêm yết (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số lượng tồn kho
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mô tả chi tiết
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                Lưu sản phẩm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
