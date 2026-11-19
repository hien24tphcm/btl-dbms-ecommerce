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
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function CartCheckoutPage() {
  const { currentUser, refreshCartCount } = useAuth();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Checkout parameters per seller
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
      if (currentUser.address && !shippingAddress) {
        setShippingAddress(currentUser.address);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setShippingAddress(currentUser.address || '10 Le Loi, District 1, HCMC');
      loadCartAndVouchers();
    }
  }, [currentUser?.user_id]);

  const handleAddOne = async (productId: number) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch<any[]>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.user_id,
          productId,
          quantity: 1,
        }),
      });
      setCartItems(updated);
      await refreshCartCount();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRemoveItem = async (cartItemId: number) => {
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
      setToastMsg(
        `Đã xóa mặt hàng #${cartItemId} khỏi giỏ hàng (EXEC dbo.sp_RemoveFromCart).`,
      );
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
      setToastMsg(
        'Đã làm trống toàn bộ giỏ hàng (@clear_all = 1 trong dbo.sp_RemoveFromCart).',
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handlePlaceOrderForSeller = async (sellerId: number, shopName: string) => {
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
            shippingAddress || currentUser.address || '10 Le Loi, District 1, HCMC',
          paymentMethod,
        }),
      });
      await loadCartAndVouchers();
      await refreshCartCount();
      setToastMsg(
        `Đặt hàng thành công cho gian hàng "${shopName}"! Mã đơn mới: #${res.orderId} (EXEC dbo.sp_PlaceOrder — ACID Transaction).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingSellerId(null);
    }
  };

  // Group cart items by seller_id (since Orders table references buyer_id & seller_id)
  const groupedBySeller: Record<
    number,
    { seller_id: number; shop_name: string; items: any[] }
  > = cartItems.reduce(
    (
      acc: Record<number, { seller_id: number; shop_name: string; items: any[] }>,
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
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Giỏ Hàng & Đặt Hàng Giao Dịch (Shopping Cart & Atomic Checkout)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tài khoản hiện tại:{' '}
            <strong className="text-indigo-700">
              {currentUser?.full_name} ({currentUser?.username})
            </strong>{' '}
            • Khóa tương tranh{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              WITH (UPDLOCK, ROWLOCK)
            </code>{' '}
            chống quá bán (Overselling).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DbmsBadge
            fr="FR-03"
            queryType="(a) Insert / (b) Delete"
            procedure="sp_AddToCart / sp_RemoveFromCart"
          />
          <DbmsBadge
            fr="FR-04"
            queryType="(a, b, c) ACID Transaction"
            procedure="EXEC dbo.sp_PlaceOrder"
            topic="Topic 4: Concurrency"
          />
        </div>
      </div>

      {toastMsg && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
          >
            Xem đơn hàng (FR-05)
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Cart Items Grouped by Seller */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShoppingCart className="h-4 w-4 text-indigo-600" />
              Danh sách sản phẩm trong giỏ ({cartItems.length} dòng trong dbo.Cart_Items)
            </h2>
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa toàn bộ giỏ (@clear_all = 1)
              </button>
            )}
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Đang tải giỏ hàng từ <code className="font-mono">dbo.Cart_Items</code>...
            </div>
          ) : Object.keys(groupedBySeller).length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">
                Giỏ hàng của <strong>{currentUser?.username}</strong> đang trống.
              </p>
              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Khám phá sản phẩm ngay
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

              return (
                <div
                  key={group.seller_id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Store className="h-4 w-4 text-indigo-600" />
                      {group.shop_name}{' '}
                      <span className="font-mono text-xs font-normal text-slate-400">
                        (seller_id = {group.seller_id})
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {group.items.length} mặt hàng
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 p-5">
                    {group.items.map((item) => (
                      <div
                        key={item.cart_item_id}
                        className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-[200px] flex-1">
                          <Link
                            href={`/products/${item.product_id}`}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600"
                          >
                            {item.product_name}
                          </Link>
                          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                            <span>Đơn giá: {formatCurrency(item.unit_price)}</span>
                            <span>•</span>
                            <span>Tồn kho: {item.stock_quantity}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              cart_item_id = {item.cart_item_id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800">
                            SL: {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddOne(item.product_id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            title="Cộng thêm 1 (sp_AddToCart)"
                          >
                            +1
                          </button>
                          <span className="w-24 text-right text-sm font-bold text-indigo-600">
                            {formatCurrency(item.subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.cart_item_id)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            title="Xóa khỏi giỏ (sp_RemoveFromCart - Query b)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-Seller Checkout Footer (sp_PlaceOrder) */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-indigo-50/40 px-5 py-3.5">
                    <div className="text-xs text-slate-600">
                      <span>Tạm tính: </span>
                      <strong>{formatCurrency(grossTotal)}</strong>
                      {discount > 0 && (
                        <>
                          <span className="mx-2 text-emerald-700">
                            • Giảm Voucher ({selectedVoucher}): -
                            {formatCurrency(discount)}
                          </span>
                        </>
                      )}
                      <span className="ml-2 text-sm font-extrabold text-indigo-700">
                        Thành tiền: {formatCurrency(finalTotal)}
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-slate-400"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {submittingSellerId === group.seller_id
                        ? 'Đang xử lý Transaction...'
                        : `Đặt đơn Shop ${group.shop_name} (sp_PlaceOrder)`}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Voucher & Shipping Config (FR-04) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TicketPercent className="h-4 w-4 text-indigo-600" />
              Cấu hình Thanh toán & Voucher (FR-04)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Được kiểm tra nguyên tử trong{' '}
              <code className="font-mono">dbo.sp_PlaceOrder</code> với khóa{' '}
              <code className="font-mono">UPDLOCK, ROWLOCK</code>.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Địa chỉ giao hàng (@shipping_address)
                </label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Phương thức thanh toán (@payment_method)
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="COD">COD (Thanh toán khi nhận hàng)</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="E-Wallet">E-Wallet</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Mã giảm giá (@voucher_code từ dbo.Vouchers)
                </label>
                <select
                  value={selectedVoucher}
                  onChange={(e) => setSelectedVoucher(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Không áp dụng mã giảm giá --</option>
                  {vouchers.map((v) => (
                    <option key={v.voucher_code} value={v.voucher_code}>
                      {v.voucher_code} — Giảm {v.discount_percent}% (Đơn tối thiểu{' '}
                      {formatCurrency(v.min_order_value)}, Tối đa{' '}
                      {formatCurrency(v.max_discount)}) [Còn {v.remaining_uses} lượt]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Voucher Catalog Table */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Danh sách 6 Vouchers trong dbo.Vouchers
              </span>
              <div className="mt-2 space-y-1.5">
                {vouchers.map((v) => (
                  <div
                    key={v.voucher_code}
                    onClick={() =>
                      setSelectedVoucher(
                        selectedVoucher === v.voucher_code ? '' : v.voucher_code,
                      )
                    }
                    className={`cursor-pointer rounded-lg border p-2.5 text-xs transition ${
                      selectedVoucher === v.voucher_code
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-indigo-700">
                        {v.voucher_code}
                      </span>
                      <span className="text-emerald-700">
                        -{v.discount_percent}% (Tối đa{' '}
                        {formatCurrency(v.max_discount)})
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Đơn từ: {formatCurrency(v.min_order_value)}</span>
                      <span>
                        Đã dùng: {v.used_count}/{v.usage_limit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
