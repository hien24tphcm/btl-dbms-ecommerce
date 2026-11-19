'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  ShoppingCart,
  Star,
  Store,
  RotateCcw,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function StorefrontPage() {
  const { currentUser, refreshCartCount } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // FR-01 Composite Filter states matching dbo.sp_SearchProducts parameters
  const [keyword, setKeyword] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minRating, setMinRating] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('newest');

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
      if (minP !== '') qs.set('minPrice', minP);
      if (maxP !== '') qs.set('maxPrice', maxP);
      if (minR !== '') qs.set('minRating', minR);
      if (stock) qs.set('inStockOnly', '1');
      if (sort) qs.set('sortBy', sort);

      const data = await apiFetch<any[]>(`/products?${qs.toString()}`);
      setProducts(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi truy vấn sp_SearchProducts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<any[]>('/categories')
      .then(setCategories)
      .catch(() => {});
    fetchCatalog();
  }, []);

  const handleResetFilters = () => {
    setKeyword('');
    setCategoryId('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setInStockOnly(false);
    setSortBy('newest');
    fetchCatalog({
      keyword: '',
      categoryId: '',
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
      setToastMsg(
        `Đã thêm "${product.name}" vào giỏ hàng của ${currentUser.username} (EXEC dbo.sp_AddToCart).`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & DBMS Traceability */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Sàn Thương Mại Điện Tử Đa Gian Hàng (Storefront Catalog)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tìm kiếm & lọc kết hợp đa điều kiện trên bảng{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              dbo.Products
            </code>
            ,{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              dbo.Categories
            </code>{' '}
            &{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              dbo.Sellers
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 md:items-end">
          <DbmsBadge
            fr="FR-01"
            queryType="(e) Composite Condition"
            procedure="EXEC dbo.sp_SearchProducts"
            topic="Topic 2: IX_Products_status_price"
          />
        </div>
      </div>

      {/* Notifications */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Multi-Criteria Filter Form (FR-01) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchCatalog();
        }}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            Bộ lọc đa điều kiện (sp_SearchProducts Parameters)
          </span>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đặt lại bộ lọc
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Keyword */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Từ khóa (@keyword)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên sản phẩm, mô tả (iPhone, Book, Chair...)"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category (Hierarchical) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Danh mục (@category_id)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.parent_id ? `↳ ${cat.category_name}` : `■ ${cat.category_name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Khoảng giá (@min_price - @max_price)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min $"
                className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="number"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max $"
                className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Min Seller Rating */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Đánh giá Shop (@min_rating)
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Mọi mức sao</option>
              <option value="4.8">Từ 4.8 ★ trở lên</option>
              <option value="4.7">Từ 4.7 ★ trở lên</option>
              <option value="4.5">Từ 4.5 ★ trở lên</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Sắp xếp (@sort_by)
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="newest">Mới nhất (newest)</option>
              <option value="sold_desc">Bán chạy nhất (sold_desc)</option>
              <option value="price_asc">Giá tăng dần (price_asc)</option>
              <option value="price_desc">Giá giảm dần (price_desc)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Chỉ hiển thị sản phẩm còn tồn kho (@in_stock_only = 1)
          </label>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Search className="h-3.5 w-3.5" />
            Thực thi truy vấn lọc (sp_SearchProducts)
          </button>
        </div>
      </form>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">
          Tìm thấy <strong className="text-slate-900">{products.length}</strong>{' '}
          sản phẩm đang kinh doanh
        </span>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Đang thực thi <code className="font-mono">EXEC dbo.sp_SearchProducts</code>...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Không tìm thấy sản phẩm nào khớp điều kiện lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.product_id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    {p.category_name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    ID #{p.product_id}
                  </span>
                </div>

                <Link
                  href={`/products/${p.product_id}`}
                  className="text-base font-bold text-slate-900 hover:text-indigo-600"
                >
                  {p.name}
                </Link>

                <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                  {p.description}
                </p>

                {/* Shop & Rating */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Store className="h-3.5 w-3.5 text-indigo-600" />
                    {p.shop_name}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {Number(p.seller_rating).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-indigo-600">
                    {formatCurrency(p.price)}
                  </span>
                  <div className="text-right text-[11px] text-slate-500">
                    <span>Kho: </span>
                    <strong
                      className={
                        p.stock_quantity <= 5
                          ? 'text-rose-600'
                          : 'text-slate-800'
                      }
                    >
                      {p.stock_quantity}
                    </strong>
                    <span className="mx-1.5">•</span>
                    <span>Đã bán: </span>
                    <strong className="text-slate-800">{p.sold_quantity}</strong>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/products/${p.product_id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Chi tiết (FR-02)
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(p)}
                    disabled={p.stock_quantity <= 0}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Thêm giỏ (FR-03)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
