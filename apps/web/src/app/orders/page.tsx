'use client';

import React, { useEffect, useState } from 'react';
import {
  Package,
  FileText,
  XCircle,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function BuyerOrdersPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Expanded 5-Table JOIN details state (sp_GetOrderDetailsJoin)
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderDetailsMap, setOrderDetailsMap] = useState<Record<number, any[]>>(
    {},
  );

  // Review Modal state (FR-06: sp_AddReview)
  const [reviewingItem, setReviewingItem] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');

  const loadOrders = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await apiFetch<any[]>(
        `/buyer/orders?buyerId=${currentUser.user_id}&status=${statusFilter}`,
      );
      setOrders(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadOrders();
    }
  }, [currentUser?.user_id, statusFilter]);

  const handleToggleDetailsJoin = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!currentUser) return;
    try {
      const items = await apiFetch<any[]>(
        `/orders/${orderId}?userId=${currentUser.user_id}`,
      );
      setOrderDetailsMap((prev) => ({ ...prev, [orderId]: items }));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updatedItems = await apiFetch<any[]>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ buyerId: currentUser.user_id }),
      });
      setOrderDetailsMap((prev) => ({ ...prev, [orderId]: updatedItems }));
      await loadOrders();
      setToastMsg(
        `Đã hủy đơn hàng #${orderId} và tự động hoàn trả lại tồn kho sản phẩm (EXEC dbo.sp_CancelOrder).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reviewingItem) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.user_id,
          orderDetailId: reviewingItem.order_detail_id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setToastMsg(
        `Đã gửi đánh giá ${reviewRating}★ cho sản phẩm "${reviewingItem.product_name}" và cập nhật điểm trung bình của Shop (EXEC dbo.sp_AddReview).`,
      );
      const orderId = reviewingItem.order_id;
      setReviewingItem(null);
      setReviewComment('');
      const refreshed = await apiFetch<any[]>(
        `/orders/${orderId}?userId=${currentUser.user_id}`,
      );
      setOrderDetailsMap((prev) => ({ ...prev, [orderId]: refreshed }));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const statusTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xác nhận (pending)' },
    { key: 'processing', label: 'Đang xử lý (processing)' },
    { key: 'shipped', label: 'Đang giao (shipped)' },
    { key: 'delivered', label: 'Đã giao (delivered)' },
    { key: 'cancelled', label: 'Đã hủy (cancelled)' },
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'shipped':
        return 'bg-sky-100 text-sky-800';
      case 'processing':
        return 'bg-amber-100 text-amber-800';
      case 'pending':
        return 'bg-indigo-100 text-indigo-800';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Theo Dõi Đơn Hàng, Hủy Đơn & Đánh Giá Sản Phẩm (FR-05 & FR-06)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Khách hàng đang xem:{' '}
            <strong className="text-indigo-700">
              {currentUser?.full_name} ({currentUser?.username})
            </strong>{' '}
            • Truy vấn tổng hợp từ View{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              dbo.v_OrderFulfillmentSummary
            </code>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DbmsBadge
            fr="FR-05"
            queryType="(f) 5-Table JOIN"
            procedure="EXEC dbo.sp_GetOrderDetailsJoin"
          />
          <DbmsBadge
            fr="FR-05"
            queryType="(c) Update Transaction"
            procedure="EXEC dbo.sp_CancelOrder"
          />
          <DbmsBadge
            fr="FR-06"
            queryType="(a) Insert + (c) Update"
            procedure="EXEC dbo.sp_AddReview"
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

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              statusFilter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải lịch sử đơn hàng từ{' '}
          <code className="font-mono">dbo.v_OrderFulfillmentSummary</code>...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Không có đơn hàng nào của <strong>{currentUser?.username}</strong> ở
          trạng thái này. (Gợi ý: Chuyển sang tài khoản{' '}
          <code className="font-mono">buyer_alex</code>,{' '}
          <code className="font-mono">buyer_beatrice</code> hoặc đặt đơn mới từ
          Giỏ hàng).
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const isExpanded = expandedOrderId === o.order_id;
            const joinItems = orderDetailsMap[o.order_id] || [];
            const canCancel =
              o.order_status === 'pending' || o.order_status === 'processing';

            return (
              <div
                key={o.order_id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                        <Package className="h-4 w-4 text-indigo-600" />
                        Đơn hàng #{o.order_id}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${getStatusBadgeClass(
                          o.order_status,
                        )}`}
                      >
                        {o.order_status}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        • Gian hàng: <strong>{o.shop_name}</strong> (Seller #
                        {o.seller_id})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        Ngày đặt:{' '}
                        {new Date(o.order_date).toLocaleString('vi-VN')}
                      </span>
                      <span>•</span>
                      <span>Thanh toán: {o.payment_method}</span>
                      <span>•</span>
                      <span>Giao tới: {o.shipping_address}</span>
                      <span>•</span>
                      <span>
                        Số dòng SP: {o.total_line_items} ({o.total_item_count}{' '}
                        món)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        Tổng: {formatCurrency(o.total_amount)} | Giảm:{' '}
                        {formatCurrency(o.discount_amount)}
                      </div>
                      <div className="text-base font-extrabold text-indigo-600">
                        Thanh toán: {formatCurrency(o.final_amount)}
                      </div>
                    </div>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(o.order_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Hủy đơn & Hoàn kho (sp_CancelOrder)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleDetailsJoin(o.order_id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Chi tiết 5-Table JOIN
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded 5-Table JOIN Invoice Details (sp_GetOrderDetailsJoin) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Kết quả JOIN 5 Bảng: Orders ⋈ Users ⋈ Sellers ⋈
                        Order_Details ⋈ Products (dbo.sp_GetOrderDetailsJoin)
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5">order_detail_id</th>
                            <th className="px-3 py-2.5">Sản phẩm (Products)</th>
                            <th className="px-3 py-2.5">Gian hàng (Sellers)</th>
                            <th className="px-3 py-2.5 text-right">Đơn giá</th>
                            <th className="px-3 py-2.5 text-center">SL</th>
                            <th className="px-3 py-2.5 text-right">
                              Thành tiền
                            </th>
                            <th className="px-3 py-2.5 text-right">
                              Đánh giá (FR-06)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {joinItems.map((item) => (
                            <tr key={item.order_detail_id}>
                              <td className="px-3 py-2.5 font-mono text-slate-500">
                                #{item.order_detail_id}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-900">
                                {item.product_name}{' '}
                                <span className="font-mono font-normal text-slate-400">
                                  (PID #{item.product_id})
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {item.shop_name}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="px-3 py-2.5 text-center font-bold">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-indigo-600">
                                {formatCurrency(item.subtotal)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {item.existing_review ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 font-bold text-amber-700">
                                    ★ {item.existing_review.rating}/5 — Đã đánh
                                    giá
                                  </span>
                                ) : item.order_status === 'delivered' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewingItem(item);
                                      setReviewRating(5);
                                      setReviewComment('');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 font-bold text-white hover:bg-amber-600"
                                  >
                                    <Star className="h-3 w-3" />
                                    Viết đánh giá (sp_AddReview)
                                  </button>
                                ) : (
                                  <span className="text-slate-400">
                                    Chờ giao hoàn tất (delivered)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Submission Modal (FR-06: sp_AddReview) */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSubmitReview}
            className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Đánh giá sản phẩm sau mua (FR-06)
              </h3>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Đóng ✕
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="font-bold text-slate-900">
                {reviewingItem.product_name}
              </div>
              <div className="mt-0.5 text-slate-500">
                Order #{reviewingItem.order_id} • order_detail_id ={' '}
                {reviewingItem.order_detail_id} • Gian hàng:{' '}
                {reviewingItem.shop_name}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Điểm xếp hạng (@rating: 1 đến 5 sao)
              </label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-amber-600"
              >
                <option value={5}>★★★★★ (5 sao - Tuyệt vời)</option>
                <option value={4}>★★★★☆ (4 sao - Hài lòng)</option>
                <option value={3}>★★★☆☆ (3 sao - Bình thường)</option>
                <option value={2}>★★☆☆☆ (2 sao - Kém)</option>
                <option value={1}>★☆☆☆☆ (1 sao - Rất tệ)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Nhận xét chất lượng (@comment)
              </label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Nhập nhận xét thực tế về sản phẩm..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Gửi đánh giá (EXEC dbo.sp_AddReview)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
