'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ShoppingCart,
  Star,
  Store,
  RotateCcw,
  Heart,
  Zap,
  TicketPercent,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  Flame,
  CreditCard,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { getProductVisual } from '@/lib/product-visuals';

export default function StorefrontPage() {
  const { currentUser, refreshCartCount, wishlistIds, toggleWishlist } =
    useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter states
  const [keyword, setKeyword] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [sellerId, setSellerId] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [onlyWishlist, setOnlyWishlist] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Direct Buy Now Modal state
  const [buyNowProduct, setBuyNowProduct] = useState<any | null>(null);
  const [buyNowQty, setBuyNowQty] = useState<number>(1);
  const [buyNowVoucher, setBuyNowVoucher] = useState<string>('');
  const [buyNowAddress, setBuyNowAddress] = useState<string>('');
  const [buyNowPayment, setBuyNowPayment] = useState<string>('Credit Card');
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);

  const fetchCatalog = async (overrideParams?: Record<string, any>) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = new URLSearchParams();
      const kw =
        overrideParams?.keyword !== undefined ? overrideParams.keyword : keyword;
      const cat =
        overrideParams?.categoryId !== undefined
          ? overrideParams.categoryId
          : categoryId;
      const sel =
        overrideParams?.sellerId !== undefined
          ? overrideParams.sellerId
          : sellerId;
      const minP =
        overrideParams?.minPrice !== undefined
          ? overrideParams.minPrice
          : minPrice;
      const maxP =
        overrideParams?.maxPrice !== undefined
          ? overrideParams.maxPrice
          : maxPrice;
      const minR =
        overrideParams?.minRating !== undefined
          ? overrideParams.minRating
          : minRating;
      const stock =
        overrideParams?.inStockOnly !== undefined
          ? overrideParams.inStockOnly
          : inStockOnly;
      const sort =
        overrideParams?.sortBy !== undefined ? overrideParams.sortBy : sortBy;

      if (kw) qs.set('keyword', kw);
      if (cat) qs.set('categoryId', cat);
      if (sel) qs.set('sellerId', sel);
      if (minP !== '') qs.set('minPrice', minP);
      if (maxP !== '') qs.set('maxPrice', maxP);
      if (minR !== '') qs.set('minRating', minR);
      if (stock) qs.set('inStockOnly', '1');
      if (sort) qs.set('sortBy', sort);

      const data = await apiFetch<any[]>(`/products?${qs.toString()}`);
      setProducts(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      apiFetch<any[]>('/categories').catch(() => []),
      apiFetch<any[]>('/shops').catch(() => []),
      apiFetch<any[]>('/vouchers').catch(() => []),
    ]).then(([cats, shps, vchs]) => {
      setCategories(cats);
      setShops(shps);
      setVouchers(vchs);
    });
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('wishlist') === '1') {
        setOnlyWishlist(true);
      }
    }
  }, []);

  const handleResetFilters = () => {
    setKeyword('');
    setCategoryId('');
    setSellerId('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setInStockOnly(false);
    setOnlyWishlist(false);
    setSortBy('newest');
    fetchCatalog({
      keyword: '',
      categoryId: '',
      sellerId: '',
      minPrice: '',
      maxPrice: '',
      minRating: '',
      inStockOnly: false,
      sortBy: 'newest',
    });
  };

  const handleAddToCart = async (product: any) => {
    if (!currentUser) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      await apiFetch('/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.user_id,
          productId: product.product_id,
          quantity: 1,
        }),
      });
      await refreshCartCount();
      setToastMsg(`Đã thêm "${product.name}" vào giỏ hàng!`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const openBuyNow = (product: any) => {
    setBuyNowProduct(product);
    setBuyNowQty(1);
    setBuyNowVoucher('');
    setBuyNowAddress(
      currentUser?.address || '10 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    );
    setBuyNowPayment('Credit Card');
  };

  const handleConfirmBuyNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !buyNowProduct) return;
    setPlacingOrder(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ orderId: number }>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          buyerId: currentUser.user_id,
          sellerId: buyNowProduct.seller_id,
          productId: buyNowProduct.product_id,
          quantity: buyNowQty,
          voucherCode: buyNowVoucher || undefined,
          shippingAddress: buyNowAddress,
          paymentMethod: buyNowPayment,
        }),
      });
      setBuyNowProduct(null);
      await fetchCatalog();
      setToastMsg(
        `Đặt mua thành công "${buyNowProduct.name}"! Mã đơn hàng của bạn là #${res.orderId}.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const displayedProducts = onlyWishlist
    ? products.filter((p) => wishlistIds.includes(p.product_id))
    : products;

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 p-7 text-white shadow-xl md:p-10">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold tracking-wide text-amber-300 backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5" />
              SIÊU HỘI MUA SẮM CHÍNH HÃNG NOVAMART
            </span>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Công Nghệ Đỉnh Cao, Thời Trang & Phong Cách Sống Hiện Đại
            </h1>
            <p className="text-sm text-indigo-100 sm:text-base">
              Trải nghiệm mua sắm đa gian hàng với bảo chứng chính hãng 100%,
              áp mã giảm giá trực tiếp và giao hàng siêu tốc.
            </p>
          </div>

          {/* Quick Search inside Hero */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchCatalog();
            }}
            className="w-full max-w-md rounded-2xl bg-white/10 p-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-inner">
              <Search className="ml-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm iPhone 15, MacBook, Sách, Thời trang..."
                className="w-full bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                Tìm kiếm
              </button>
            </div>
          </form>
        </div>

        {/* Voucher Strip inside Hero */}
        {vouchers.length > 0 && (
          <div className="relative z-10 mt-7 border-t border-white/15 pt-5">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-200">
              <TicketPercent className="h-4 w-4 text-amber-300" />
              Mã giảm giá nổi bật hôm nay (Bấm để lưu mã)
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {vouchers.slice(0, 6).map((v) => (
                <button
                  key={v.voucher_code}
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(v.voucher_code);
                    }
                    setToastMsg(
                      `Đã sao chép mã giảm giá "${v.voucher_code}" (Giảm ${v.discount_percent}% cho đơn từ ${formatCurrency(v.min_order_value)})!`,
                    );
                  }}
                  className="group flex flex-col justify-between rounded-xl border border-white/20 bg-white/10 p-2.5 text-left backdrop-blur-xs transition hover:border-amber-300 hover:bg-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-amber-300">
                      {v.voucher_code}
                    </span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      -{v.discount_percent}%
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] text-indigo-100">
                    Đơn từ {formatCurrency(v.min_order_value)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast & Error Alerts */}
      {toastMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold text-rose-600 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Official Stores Strip */}
      {shops.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Store className="h-5 w-5 text-indigo-600" />
              Gian Hàng Chính Hãng (Official Stores)
            </h2>
            {sellerId && (
              <button
                type="button"
                onClick={() => {
                  setSellerId('');
                  fetchCatalog({ sellerId: '' });
                }}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Xem tất cả gian hàng
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {shops.map((s) => {
              const active = String(s.seller_id) === sellerId;
              return (
                <button
                  key={s.seller_id}
                  type="button"
                  onClick={() => {
                    const nextId = active ? '' : String(s.seller_id);
                    setSellerId(nextId);
                    fetchCatalog({ sellerId: nextId });
                  }}
                  className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {s.shop_name}
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {Number(s.rating).toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {s.store_description}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-semibold text-indigo-600">
                    <span>{s.product_count} sản phẩm</span>
                    <span>{active ? 'Đang lọc ✓' : 'Xem shop →'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setCategoryId('');
            fetchCatalog({ categoryId: '' });
          }}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
            categoryId === ''
              ? 'bg-slate-900 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Tất cả ngành hàng
        </button>
        {categories.map((cat) => {
          const active = String(cat.category_id) === categoryId;
          return (
            <button
              key={cat.category_id}
              type="button"
              onClick={() => {
                const nextCat = active ? '' : String(cat.category_id);
                setCategoryId(nextCat);
                fetchCatalog({ categoryId: nextCat });
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
              }`}
            >
              {cat.category_name}
            </button>
          );
        })}
      </div>

      {/* Filter & Sort Toolbar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchCatalog();
        }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Price Range */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Khoảng giá (USD)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Giá từ ($)"
                className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <span className="text-slate-400">—</span>
              <input
                type="number"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Đến ($)"
                className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Min Rating */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Đánh giá Gian hàng
            </label>
            <select
              value={minRating}
              onChange={(e) => {
                setMinRating(e.target.value);
                fetchCatalog({ minRating: e.target.value });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="">Tất cả mức sao</option>
              <option value="4.8">Từ 4.8 ★ trở lên</option>
              <option value="4.7">Từ 4.7 ★ trở lên</option>
              <option value="4.5">Từ 4.5 ★ trở lên</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sắp xếp theo
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                fetchCatalog({ sortBy: e.target.value });
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            >
              <option value="newest">Sản phẩm mới nhất</option>
              <option value="sold_desc">Bán chạy nhất</option>
              <option value="price_asc">Giá: Thấp đến Cao</option>
              <option value="price_desc">Giá: Cao đến Thấp</option>
            </select>
          </div>

          {/* Quick toggles & buttons */}
          <div className="flex flex-wrap items-end justify-end gap-2 lg:col-span-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  fetchCatalog({ inStockOnly: e.target.checked });
                }}
                className="h-3.5 w-3.5 rounded text-indigo-600"
              />
              Còn hàng
            </label>

            <button
              type="button"
              onClick={() => setOnlyWishlist(!onlyWishlist)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                onlyWishlist
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${
                  onlyWishlist ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
              Yêu thích
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Áp dụng
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Product Count Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-extrabold text-slate-900">
            {onlyWishlist ? 'Danh sách sản phẩm yêu thích' : 'Gợi ý hôm nay'}
          </h2>
          <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {displayedProducts.length} sản phẩm
          </span>
        </div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="h-36 rounded-xl bg-slate-100" />
              <div className="mt-4 h-4 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center">
          <p className="text-base font-bold text-slate-700">
            Không tìm thấy sản phẩm phù hợp
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hãy thử thay đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ sản phẩm trên sàn.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white"
          >
            Xem tất cả sản phẩm
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {displayedProducts.map((p) => {
            const visual = getProductVisual(p.category_id, p.name);
            const liked = wishlistIds.includes(p.product_id);
            const totalPool = Number(p.stock_quantity) + Number(p.sold_quantity);
            const soldPct =
              totalPool > 0
                ? Math.min(
                    95,
                    Math.max(12, Math.round((p.sold_quantity / totalPool) * 100)),
                  )
                : 20;

            return (
              <div
                key={p.product_id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
              >
                <div>
                  {/* Visual Product Thumbnail Banner */}
                  <div
                    className={`relative flex h-44 flex-col justify-between bg-gradient-to-br ${visual.gradient} p-4 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur-xs">
                        {visual.tag}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(p.product_id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xs transition hover:bg-white hover:text-rose-500"
                        title="Yêu thích"
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            liked ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <Link
                      href={`/products/${p.product_id}`}
                      className="my-auto flex items-center justify-center text-5xl drop-shadow-md transition duration-300 group-hover:scale-110"
                    >
                      {visual.emoji}
                    </Link>

                    <div className="flex items-center justify-between text-[11px] font-medium text-white/90">
                      <span className="truncate">{p.category_name}</span>
                      {p.stock_quantity <= 5 && p.stock_quantity > 0 && (
                        <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Chỉ còn {p.stock_quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4">
                    {/* Shop & Rating */}
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold text-slate-500">
                        <Store className="h-3 w-3 text-indigo-600" />
                        <span className="max-w-[130px] truncate">
                          {p.shop_name}
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5 font-bold text-amber-600">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {Number(p.seller_rating).toFixed(1)}
                      </span>
                    </div>

                    <Link
                      href={`/products/${p.product_id}`}
                      className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-slate-900 transition group-hover:text-indigo-600"
                    >
                      {p.name}
                    </Link>

                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-slate-100 p-4 pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-extrabold text-indigo-600">
                      {formatCurrency(p.price)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      Đã bán <strong className="text-slate-800">{p.sold_quantity}</strong>
                    </span>
                  </div>

                  {/* Sold / Stock Bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: `${soldPct}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      disabled={p.stock_quantity <= 0}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Thêm giỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => openBuyNow(p)}
                      disabled={p.stock_quantity <= 0}
                      className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Mua ngay
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct Buy Now Checkout Modal */}
      {buyNowProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmBuyNow}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Mua ngay nhanh chóng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBuyNowProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-indigo-600">
                  {buyNowProduct.shop_name}
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">
                  {buyNowProduct.name}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>Đơn giá: {formatCurrency(buyNowProduct.price)}</span>
                  <span>Kho còn: {buyNowProduct.stock_quantity}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Số lượng đặt mua
                </label>
                <div className="flex items-center rounded-xl border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="px-4 text-xs font-bold">{buyNowQty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBuyNowQty((q) =>
                        Math.min(buyNowProduct.stock_quantity, q + 1),
                      )
                    }
                    className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mã giảm giá (Tùy chọn)
                </label>
                <select
                  value={buyNowVoucher}
                  onChange={(e) => setBuyNowVoucher(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="">-- Không dùng mã giảm giá --</option>
                  {vouchers.map((v) => (
                    <option key={v.voucher_code} value={v.voucher_code}>
                      {v.voucher_code} (-{v.discount_percent}% • Đơn tối thiểu{' '}
                      {formatCurrency(v.min_order_value)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Địa chỉ nhận hàng
                </label>
                <input
                  type="text"
                  required
                  value={buyNowAddress}
                  onChange={(e) => setBuyNowAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Phương thức thanh toán
                </label>
                <select
                  value={buyNowPayment}
                  onChange={(e) => setBuyNowPayment(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="Credit Card">Thẻ tín dụng (Credit Card)</option>
                  <option value="COD">Thanh toán khi nhận hàng (COD)</option>
                  <option value="Bank Transfer">Chuyển khoản ngân hàng</option>
                  <option value="E-Wallet">Ví điện tử (E-Wallet)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-500">
                  Tạm tính ({buyNowQty} sản phẩm):
                </span>
                <span className="text-lg font-extrabold text-indigo-600">
                  {formatCurrency(Number(buyNowProduct.price) * buyNowQty)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBuyNowProduct(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={placingOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-400"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  {placingOrder ? 'Đang xử lý...' : 'Xác nhận Đặt mua'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
