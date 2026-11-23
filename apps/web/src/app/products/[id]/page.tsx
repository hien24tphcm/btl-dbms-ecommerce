'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingCart,
  Star,
  Store,
  MapPin,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Heart,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { getProductVisual } from '@/lib/product-visuals';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params?.id);
  const { currentUser, refreshCartCount, wishlistIds, toggleWishlist } =
    useAuth();

  const [data, setData] = useState<{
    product: any;
    reviews: any[];
    ratingStats: any;
    relatedProducts?: any[];
  } | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    apiFetch(`/products/${productId}`)
      .then((res) => setData(res))
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleAddToCart = async (redirectCart = false) => {
    if (!currentUser || !data?.product) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      await apiFetch('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.user_id,
          productId: data.product.product_id,
          quantity,
        }),
      });
      await refreshCartCount();
      if (redirectCart) {
        router.push('/cart');
      } else {
        setToastMsg(
          `Đã thêm ${quantity} x "${data.product.name}" vào giỏ hàng!`,
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-96 animate-pulse rounded-3xl border border-slate-200 bg-white p-8" />
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
        <p className="text-base font-bold">
          {errorMsg || 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const { product, reviews, ratingStats, relatedProducts = [] } = data;
  const totalReviews = Number(ratingStats?.review_count || 0);
  const visual = getProductVisual(product.category_id, product.name);
  const liked = wishlistIds.includes(product.product_id);

  const filteredReviews =
    starFilter === null
      ? reviews
      : reviews.filter((r) => Number(r.rating) === starFilter);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-semibold hover:text-indigo-600">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">
            {product.category_name}
          </span>
          <span>/</span>
          <span className="max-w-xs truncate text-slate-400">
            {product.name}
          </span>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tiếp tục mua sắm
        </Link>
      </div>

      {toastMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <Link
            href="/cart"
            className="text-xs font-bold text-indigo-700 hover:underline"
          >
            Xem giỏ hàng →
          </Link>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:grid-cols-12 lg:p-8">
        {/* Left Visual Gallery Card */}
        <div className="lg:col-span-5">
          <div
            className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${visual.gradient} p-6 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold backdrop-blur-xs">
                {visual.tag}
              </span>
              <button
                type="button"
                onClick={() => toggleWishlist(product.product_id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs transition hover:bg-white hover:text-rose-500"
              >
                <Heart
                  className={`h-5 w-5 ${
                    liked ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
              </button>
            </div>

            <div className="my-auto text-center text-8xl drop-shadow-xl">
              {visual.emoji}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-2.5 text-xs backdrop-blur-xs">
              <span>Chính hãng 100%</span>
              <span>•</span>
              <span>Bảo hành toàn quốc</span>
            </div>
          </div>
        </div>

        {/* Center/Right Product Details */}
        <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                NovaMall Chính Hãng
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
                {product.category_name}
              </span>
              {product.stock_quantity > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  Còn hàng ({product.stock_quantity} sản phẩm)
                </span>
              ) : (
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                  Tạm hết hàng
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
              {product.name}
            </h1>

            {/* Rating & Sold Bar */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1 font-bold text-amber-600">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                <span>{Number(product.avg_product_rating || 5).toFixed(1)}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">
                <strong>{product.total_reviews}</strong> Đánh giá
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">
                Đã bán <strong>{product.sold_quantity}</strong>
              </span>
            </div>

            {/* Price Box */}
            <div className="rounded-2xl bg-gradient-to-r from-indigo-50/90 via-violet-50/50 to-slate-50 p-5">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {formatCurrency(product.price)}
                </span>
                <span className="text-sm text-slate-400 line-through">
                  {formatCurrency(Number(product.price) * 1.15)}
                </span>
                <span className="rounded-md bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                  Tiết kiệm 15%
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Đặc điểm nổi bật
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                {product.description}
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>Đổi trả miễn phí trong 15 ngày</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600" />
                <span>Giao hàng nhanh toàn quốc</span>
              </div>
            </div>
          </div>

          {/* Quantity & CTA Buttons */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-bold text-slate-600">Số lượng:</span>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={product.stock_quantity}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 text-center text-sm font-bold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                  }
                  className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {product.stock_quantity} sản phẩm có sẵn
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                disabled={product.stock_quantity <= 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-indigo-600 bg-indigo-50/70 px-6 py-3.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                Thêm vào Giỏ hàng
              </button>

              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                disabled={product.stock_quantity <= 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:bg-slate-300"
              >
                <Zap className="h-4 w-4" />
                Mua ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Store Info & Rating Breakdown Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Official Store Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {product.shop_name}
                </h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  ★ {Number(product.seller_rating).toFixed(2)} Đánh giá Gian hàng
                </span>
              </div>
            </div>

            {product.seller_address && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {product.seller_address}
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <Link
              href="/"
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Xem thêm sản phẩm của Shop
            </Link>
          </div>
        </div>

        {/* Rating Breakdown & Filter */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="text-center sm:text-left">
              <div className="text-3xl font-extrabold text-slate-900">
                {Number(ratingStats?.avg_rating || product.avg_product_rating || 5).toFixed(1)}{' '}
                <span className="text-lg font-normal text-slate-400">/ 5</span>
              </div>
              <div className="mt-1 text-sm text-amber-500">★★★★★</div>
              <div className="mt-1 text-xs text-slate-500">
                {totalReviews} đánh giá đã xác thực
              </div>
            </div>

            {ratingStats && (
              <div className="flex-1 space-y-1.5 text-xs">
                {[
                  { star: 5, count: Number(ratingStats.five_star_count || 0) },
                  { star: 4, count: Number(ratingStats.four_star_count || 0) },
                  { star: 3, count: Number(ratingStats.three_star_count || 0) },
                  { star: 2, count: Number(ratingStats.two_star_count || 0) },
                  { star: 1, count: Number(ratingStats.one_star_count || 0) },
                ].map((row) => {
                  const pct =
                    totalReviews > 0
                      ? Math.round((row.count / totalReviews) * 100)
                      : 0;
                  return (
                    <div key={row.star} className="flex items-center gap-2.5">
                      <span className="w-12 font-semibold text-slate-700">
                        {row.star} sao
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-500">
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Star Filter Pills */}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setStarFilter(null)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                starFilter === null
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Tất cả ({reviews.length})
            </button>
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStarFilter(s)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  starFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s} Sao
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="mb-4 flex items-center gap-2 text-base font-extrabold text-slate-900">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          Nhận xét từ Khách hàng ({filteredReviews.length})
        </h2>

        {filteredReviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Chưa có nhận xét nào ở mức đánh giá này.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredReviews.map((r) => (
              <div key={r.review_id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {(r.reviewer_name || 'K').charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900">
                        {r.reviewer_name}
                      </span>
                      <span className="ml-2 text-xs text-amber-500">
                        {'★'.repeat(r.rating)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <p className="mt-2 pl-10 text-sm text-slate-700">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            Sản phẩm tương tự
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((rp) => {
              const rv = getProductVisual(rp.category_id, rp.name);
              return (
                <Link
                  key={rp.product_id}
                  href={`/products/${rp.product_id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md"
                >
                  <div
                    className={`flex h-28 items-center justify-center rounded-xl bg-gradient-to-br ${rv.gradient} text-4xl`}
                  >
                    {rv.emoji}
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {rp.shop_name}
                    </span>
                    <h4 className="mt-0.5 line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-indigo-600">
                      {rp.name}
                    </h4>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-extrabold text-indigo-600">
                        {formatCurrency(rp.price)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Đã bán {rp.sold_quantity}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
