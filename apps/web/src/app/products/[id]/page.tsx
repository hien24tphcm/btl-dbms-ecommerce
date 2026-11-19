'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params?.id);
  const { currentUser, refreshCartCount } = useAuth();

  const [data, setData] = useState<{
    product: any;
    reviews: any[];
    ratingStats: any;
  } | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
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

  const handleAddToCart = async () => {
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
      setToastMsg(
        `Đã thêm ${quantity} x "${data.product.name}" vào giỏ hàng của ${currentUser.username}.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        Đang thực thi <code className="font-mono">EXEC dbo.sp_GetProductDetails @product_id = {productId}</code>...
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-semibold">
          {errorMsg || 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh mục sản phẩm
        </Link>
      </div>
    );
  }

  const { product, reviews, ratingStats } = data;
  const totalReviews = Number(ratingStats?.review_count || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Storefront
        </Link>
        <div className="flex flex-wrap gap-2">
          <DbmsBadge
            fr="FR-02"
            queryType="(d) Single Condition"
            procedure="EXEC dbo.sp_GetProductDetails"
          />
          <DbmsBadge
            fr="FR-06"
            queryType="(h) Aggregate Functions"
            procedure="EXEC dbo.sp_GetProductRatingStats"
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

      {/* Product Specification Card (Result Set 1 of sp_GetProductDetails) */}
      <div className="grid grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {product.category_name} (Category #{product.category_id})
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Status: {product.status}
            </span>
            <span className="font-mono text-xs text-slate-400">
              product_id = {product.product_id}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-bold text-amber-600">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              {Number(product.avg_product_rating || 0).toFixed(2)} / 5.00
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              <strong>{product.total_reviews}</strong> đánh giá
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              Đã bán: <strong>{product.sold_quantity}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              Tồn kho khả dụng: <strong>{product.stock_quantity}</strong>
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <span className="text-3xl font-extrabold text-indigo-600">
              {formatCurrency(product.price)}
            </span>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mô tả chi tiết sản phẩm
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              {product.description}
            </p>
          </div>

          {/* Add to Cart Box */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center rounded-lg border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
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
                className="w-16 text-center text-sm font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                }
                className="px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.stock_quantity <= 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-slate-300"
            >
              <ShoppingCart className="h-4 w-4" />
              Thêm vào giỏ hàng (EXEC dbo.sp_AddToCart)
            </button>
          </div>
        </div>

        {/* Seller Info & Rating Breakdown (sp_GetProductRatingStats) */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Thông tin Gian hàng (dbo.Sellers)
            </span>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Store className="h-4 w-4 text-indigo-600" />
                {product.shop_name}
              </span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                ★ {Number(product.seller_rating).toFixed(2)}
              </span>
            </div>
            {product.seller_address && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {product.seller_address}
              </p>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* Rating Aggregation Breakdown (Query h: sp_GetProductRatingStats) */}
          {ratingStats && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Phân bố đánh giá (sp_GetProductRatingStats - Query h)
              </span>
              <div className="mt-2.5 space-y-1.5 text-xs">
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
                    <div key={row.star} className="flex items-center gap-2">
                      <span className="w-10 font-semibold text-slate-700">
                        {row.star} sao
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-slate-600">
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews List (Result Set 2 of sp_GetProductDetails) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            Đánh giá từ Khách hàng đã mua ({reviews.length})
          </h2>
          <span className="font-mono text-xs text-slate-400">
            Result Set #2 của dbo.sp_GetProductDetails
          </span>
        </div>

        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có đánh giá nào cho sản phẩm này.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r.review_id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {r.reviewer_name}
                    </span>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {'★'.repeat(r.rating)} ({r.rating}/5)
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Review #{r.review_id} •{' '}
                    {new Date(r.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
