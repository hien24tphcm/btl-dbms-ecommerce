'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  XCircle,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Store,
  Truck,
  Clock,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

export default function BuyerOrdersPage() {
  const router = useRouter();
  const { currentUser, refreshCartCount } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderDetailsMap, setOrderDetailsMap] = useState<Record<number, any[]>>(
    {},
  );

  // Review Modal state
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

  const handleToggleDetails = async (orderId: number) => {
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
        `Đã hủy đơn hàng #${orderId} thành công. Số lượng sản phẩm đã được hoàn lại kho.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleBuyAgain = async (item: any) => {
    if (!currentUser) return;
    try {
      await apiFetch('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.user_id,
          productId: item.product_id,
          quantity: 1,
        }),
      });
      await refreshCartCount();
      router.push('/cart');
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
        `Cảm ơn bạn đã đánh giá ${reviewRating}★ cho sản phẩm "${reviewingItem.product_name}"!`,
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
    { key: 'all', label: 'Tất cả đơn' },
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'processing', label: 'Đang đóng gói' },
    { key: 'shipped', label: 'Đang vận chuyển' },
    { key: 'delivered', label: 'Đã giao thành công' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'delivered':
        return {
          label: 'Giao thành công',
          cls: 'bg-emerald-100 text-emerald-800',
          step: 4,
        };
      case 'shipped':
        return {
          label: 'Đang vận chuyển',
          cls: 'bg-sky-100 text-sky-800',
          step: 3,
        };
      case 'processing':
        return {
          label: 'Đang đóng gói',
          cls: 'bg-amber-100 text-amber-800',
          step: 2,
        };
      case 'pending':
        return {
          label: 'Chờ xác nhận',
          cls: 'bg-indigo-100 text-indigo-800',
          step: 1,
        };
      case 'cancelled':
        return {
          label: 'Đã hủy',
          cls: 'bg-rose-100 text-rose-800',
          step: 0,
        };
      default:
        return { label: status, cls: 'bg-slate-100 text-slate-800', step: 1 };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Đơn Mua Của Tôi
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Theo dõi hành trình đơn hàng, xem hóa đơn chi tiết và gửi đánh giá
          chất lượng sản phẩm.
        </p>
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

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              statusFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-14 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">
            Chưa có đơn hàng nào trong mục này
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Bạn có thể chuyển sang tài khoản khách hàng khác hoặc đặt mua sản
            phẩm mới.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const isExpanded = expandedOrderId === o.order_id;
            const joinItems = orderDetailsMap[o.order_id] || [];
            const canCancel =
              o.order_status === 'pending' || o.order_status === 'processing';
            const meta = getStatusMeta(o.order_status);

            return (
              <div
                key={o.order_id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-indigo-200"
              >
                {/* Top Order Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <Store className="h-4 w-4 text-indigo-600" />
                      {o.shop_name}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono text-slate-500">
                      Mã đơn #{o.order_id}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(o.order_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Order Progress Stepper (For non-cancelled orders) */}
                {o.order_status !== 'cancelled' && (
                  <div className="grid grid-cols-4 gap-2 border-b border-slate-100 bg-white px-5 py-3 text-[11px]">
                    {[
                      { step: 1, label: '1. Đặt đơn hàng' },
                      { step: 2, label: '2. Đang đóng gói' },
                      { step: 3, label: '3. Đang giao hàng' },
                      { step: 4, label: '4. Giao thành công' },
                    ].map((s) => {
                      const done = meta.step >= s.step;
                      return (
                        <div key={s.step} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              done ? 'bg-indigo-600' : 'bg-slate-100'
                            }`}
                          />
                          <span
                            className={`block font-semibold ${
                              done ? 'text-indigo-700' : 'text-slate-400'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Order Summary Content */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>Địa chỉ nhận: </span>
                      <strong className="text-slate-800">
                        {o.shipping_address}
                      </strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>
                        Phương thức: <strong>{o.payment_method}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Số lượng: <strong>{o.total_item_count} sản phẩm</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      {Number(o.discount_amount) > 0 && (
                        <div className="text-[11px] text-emerald-600">
                          Đã giảm: -{formatCurrency(o.discount_amount)}
                        </div>
                      )}
                      <div className="text-base font-extrabold text-indigo-600">
                        Tổng tiền: {formatCurrency(o.final_amount)}
                      </div>
                    </div>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(o.order_id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Hủy đơn hàng
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleDetails(o.order_id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <span>Xem chi tiết đơn</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Line Items */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
                      {joinItems.map((item) => (
                        <div
                          key={item.order_detail_id}
                          className="flex flex-wrap items-center justify-between gap-4 py-3.5 text-xs"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {item.product_name}
                            </div>
                            <div className="mt-0.5 text-slate-500">
                              Đơn giá: {formatCurrency(item.unit_price)} ×{' '}
                              <strong>{item.quantity}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-indigo-600">
                              {formatCurrency(item.subtotal)}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleBuyAgain(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Mua lại
                            </button>

                            {item.existing_review ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 font-bold text-amber-700">
                                ★ {item.existing_review.rating}/5 Đã đánh giá
                              </span>
                            ) : item.order_status === 'delivered' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingItem(item);
                                  setReviewRating(5);
                                  setReviewComment('');
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-white shadow-xs hover:bg-amber-600"
                              >
                                <Star className="h-3 w-3 fill-white" />
                                Đánh giá
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive 5-Star Review Modal */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReview}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Đánh giá sản phẩm
              </h3>
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs">
              <div className="font-bold text-slate-900">
                {reviewingItem.product_name}
              </div>
              <div className="mt-0.5 text-slate-500">
                Gian hàng: {reviewingItem.shop_name}
              </div>
            </div>

            {/* Interactive Star Picker */}
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">
                Mức độ hài lòng của bạn
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition ${
                      reviewRating >= star
                        ? 'border-amber-400 bg-amber-50 text-amber-500'
                        : 'border-slate-200 text-slate-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs font-bold text-amber-600">
                  {reviewRating} / 5 Sao
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Chia sẻ trải nghiệm thực tế
              </label>
              <textarea
                rows={3}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Chất lượng sản phẩm, đóng gói, thời gian giao hàng..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                Hoàn tất đánh giá
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
