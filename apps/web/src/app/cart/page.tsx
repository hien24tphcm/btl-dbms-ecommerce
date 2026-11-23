'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Trash2,
  TicketPercent,
  CheckCircle2,
  AlertCircle,
  Store,
  CreditCard,
  ArrowRight,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { getProductVisual } from '@/lib/product-visuals';

export default function CartCheckoutPage() {
  const { currentUser, refreshCartCount } = useAuth();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [selectedVoucher, setSelectedVoucher] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Credit Card');
  const [submittingSellerId, setSubmittingSellerId] = useState<number | null>(
    null,
  );

  const loadCartAndVouchers = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [cartData, voucherData] = await Promise.all([
        apiFetch<any[]>(`/cart?userId=${currentUser.user_id}`),
        apiFetch<any[]>('/vouchers'),
      ]);
      setCartItems(cartData);
      setVouchers(voucherData);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setShippingAddress(
        currentUser.address || '10 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
      );
      loadCartAndVouchers();
    }
  }, [currentUser?.user_id]);

  const handleUpdateQty = async (cartItemId: number, nextQty: number) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch<any[]>('/cart/items', {
        method: 'PATCH',
        body: JSON.stringify({
          userId: currentUser.user_id,
          cartItemId,
          quantity: nextQty,
        }),
      });
      setCartItems(updated);
      await refreshCartCount();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRemoveItem = async (cartItemId: number, productName: string) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch<any[]>('/cart/items', {
        method: 'DELETE',
        body: JSON.stringify({
          userId: currentUser.user_id,
          cartItemId,
        }),
      });
      setCartItems(updated);
      await refreshCartCount();
      setToastMsg(`Đã xóa "${productName}" khỏi giỏ hàng.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleClearCart = async () => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch<any[]>('/cart/items', {
        method: 'DELETE',
        body: JSON.stringify({
          userId: currentUser.user_id,
          clearAll: true,
        }),
      });
      setCartItems(updated);
      await refreshCartCount();
      setToastMsg('Đã làm trống giỏ hàng.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handlePlaceOrderForSeller = async (
    sellerId: number,
    shopName: string,
  ) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    setSubmittingSellerId(sellerId);
    try {
      const res = await apiFetch<{ orderId: number }>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          buyerId: currentUser.user_id,
          sellerId,
          voucherCode: selectedVoucher || undefined,
          shippingAddress:
            shippingAddress ||
            currentUser.address ||
            '10 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
          paymentMethod,
        }),
      });
      await loadCartAndVouchers();
      await refreshCartCount();
      setToastMsg(
        `Đặt hàng thành công tại "${shopName}"! Mã đơn hàng của bạn là #${res.orderId}.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingSellerId(null);
    }
  };

  const groupedBySeller: Record<
    number,
    { seller_id: number; shop_name: string; items: any[] }
  > = cartItems.reduce(
    (
      acc: Record<
        number,
        { seller_id: number; shop_name: string; items: any[] }
      >,
      item,
    ) => {
      if (!acc[item.seller_id]) {
        acc[item.seller_id] = {
          seller_id: item.seller_id,
          shop_name: item.shop_name,
          items: [],
        };
      }
      acc[item.seller_id].items.push(item);
      return acc;
    },
    {},
  );

  const activeVoucherObj = vouchers.find(
    (v) => v.voucher_code === selectedVoucher,
  );

  const computeSellerDiscount = (grossTotal: number) => {
    if (!activeVoucherObj) return 0;
    if (grossTotal < Number(activeVoucherObj.min_order_value)) return 0;
    let disc = (grossTotal * Number(activeVoucherObj.discount_percent)) / 100;
    if (
      activeVoucherObj.max_discount !== null &&
      disc > Number(activeVoucherObj.max_discount)
    ) {
      disc = Number(activeVoucherObj.max_discount);
    }
    return Number(disc.toFixed(2));
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Giỏ Hàng & Thanh Toán
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kiểm tra danh sách sản phẩm, chọn mã ưu đãi và xác nhận địa chỉ nhận
            hàng của bạn.
          </p>
        </div>

        {cartItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearCart}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa toàn bộ giỏ
          </button>
        )}
      </div>

      {toastMsg && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
          >
            Theo dõi đơn mua
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-medium text-rose-800 shadow-xs">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Cart Items Grouped by Store */}
        <div className="space-y-5 lg:col-span-8">
          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-8" />
          ) : Object.keys(groupedBySeller).length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-14 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <ShoppingCart className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Giỏ hàng của bạn đang trống
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Hãy khám phá hàng loạt sản phẩm công nghệ, sách và thời trang
                đang ưu đãi trên sàn.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                Mua sắm ngay
              </Link>
            </div>
          ) : (
            Object.values(groupedBySeller).map((group) => {
              const grossTotal = group.items.reduce(
                (s, it) => s + Number(it.subtotal),
                0,
              );
              const discount = computeSellerDiscount(grossTotal);
              const finalTotal = Math.max(0, grossTotal - discount);
              const minNeeded = activeVoucherObj
                ? Number(activeVoucherObj.min_order_value) - grossTotal
                : 0;

              return (
                <div
                  key={group.seller_id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                >
                  {/* Shop Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        Mall
                      </span>
                      <Store className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-bold text-slate-900">
                        {group.shop_name}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {group.items.length} sản phẩm
                    </span>
                  </div>

                  {/* Line Items */}
                  <div className="divide-y divide-slate-100 p-5">
                    {group.items.map((item) => {
                      const vis = getProductVisual(undefined, item.product_name);
                      return (
                        <div
                          key={item.cart_item_id}
                          className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-[220px] flex-1 items-center gap-3.5">
                            <Link
                              href={`/products/${item.product_id}`}
                              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${vis.gradient} text-2xl shadow-xs`}
                            >
                              {vis.emoji}
                            </Link>
                            <div>
                              <Link
                                href={`/products/${item.product_id}`}
                                className="text-sm font-bold text-slate-900 hover:text-indigo-600"
                              >
                                {item.product_name}
                              </Link>
                              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                <span>
                                  Đơn giá:{' '}
                                  <strong className="text-slate-700">
                                    {formatCurrency(item.unit_price)}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>Kho còn: {item.stock_quantity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Interactive - / + Stepper */}
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQty(
                                    item.cart_item_id,
                                    Number(item.quantity) - 1,
                                  )
                                }
                                className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200/60"
                              >
                                -
                              </button>
                              <span className="w-9 text-center text-xs font-extrabold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQty(
                                    item.cart_item_id,
                                    Number(item.quantity) + 1,
                                  )
                                }
                                disabled={item.quantity >= item.stock_quantity}
                                className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200/60 disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>

                            <span className="w-24 text-right text-sm font-extrabold text-indigo-600">
                              {formatCurrency(item.subtotal)}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveItem(
                                  item.cart_item_id,
                                  item.product_name,
                                )
                              }
                              className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa sản phẩm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Store Checkout Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-indigo-50/40 px-5 py-4">
                    <div className="space-y-0.5 text-xs">
                      <div className="text-slate-600">
                        Tạm tính: <strong>{formatCurrency(grossTotal)}</strong>
                        {discount > 0 && (
                          <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                            Ưu đãi {selectedVoucher}: -{formatCurrency(discount)}
                          </span>
                        )}
                      </div>
                      {activeVoucherObj && minNeeded > 0 && (
                        <div className="text-[11px] text-amber-700">
                          Mua thêm {formatCurrency(minNeeded)} tại shop này để
                          đủ điều kiện áp mã {selectedVoucher}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="block text-[11px] text-slate-500">
                          Tổng thanh toán
                        </span>
                        <span className="text-lg font-extrabold text-indigo-600">
                          {formatCurrency(finalTotal)}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={submittingSellerId === group.seller_id}
                        onClick={() =>
                          handlePlaceOrderForSeller(
                            group.seller_id,
                            group.shop_name,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:bg-slate-400"
                      >
                        <CreditCard className="h-4 w-4" />
                        {submittingSellerId === group.seller_id
                          ? 'Đang đặt hàng...'
                          : `Đặt hàng (${group.shop_name})`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Shipping & Voucher Panel */}
        <div className="space-y-5 lg:col-span-4">
          {/* Shipping & Payment Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <MapPin className="h-4 w-4 text-indigo-600" />
              Thông Tin Giao Nhận & Thanh Toán
            </h3>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Người nhận
                </label>
                <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800">
                  {currentUser?.full_name} •{' '}
                  {currentUser?.phone_number || '0901234567'}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Địa chỉ giao hàng
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Nhập số nhà, tên đường, quận/huyện..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'Credit Card', label: '💳 Thẻ tín dụng' },
                    { value: 'COD', label: '🚚 Tiền mặt (COD)' },
                    { value: 'E-Wallet', label: '📱 Ví điện tử' },
                    { value: 'Bank Transfer', label: '🏦 Chuyển khoản' },
                  ].map((pm) => (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                        paymentMethod === pm.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Voucher Wallet Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <TicketPercent className="h-4 w-4 text-indigo-600" />
                Kho Mã Giảm Giá NovaMart
              </h3>
              {selectedVoucher && (
                <button
                  type="button"
                  onClick={() => setSelectedVoucher('')}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Bỏ chọn
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chọn 1 mã giảm giá bên dưới để tự động khấu trừ khi đặt đơn:
            </p>

            <div className="mt-3 space-y-2">
              {vouchers.map((v) => {
                const active = selectedVoucher === v.voucher_code;
                return (
                  <div
                    key={v.voucher_code}
                    onClick={() =>
                      setSelectedVoucher(active ? '' : v.voucher_code)
                    }
                    className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs'
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-indigo-600 px-2 py-0.5 font-mono text-xs font-extrabold text-white">
                        {v.voucher_code}
                      </span>
                      <span className="font-bold text-emerald-700">
                        Giảm {v.discount_percent}% (Tối đa{' '}
                        {formatCurrency(v.max_discount)})
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Đơn tối thiểu: {formatCurrency(v.min_order_value)}</span>
                      <span>Còn {v.remaining_uses} lượt</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Đơn hàng được bảo vệ thanh toán và trừ tồn kho tự động ngay khi
                xác nhận.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
