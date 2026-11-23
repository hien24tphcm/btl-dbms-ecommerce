'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  ShieldCheck,
  TicketPercent,
  Plus,
  Award,
  Search,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

export default function AdminPortalPage() {
  const { refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'bi' | 'moderation' | 'vouchers' | 'system'
  >('bi');

  const [biData, setBiData] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [introspection, setIntrospection] = useState<any | null>(null);
  const [checkDbResult, setCheckDbResult] = useState<any | null>(null);
  const [userSearch, setUserSearch] = useState<string>('');

  // New Voucher Form
  const [vCode, setVCode] = useState('');
  const [vDiscount, setVDiscount] = useState('15');
  const [vMinOrder, setVMinOrder] = useState('100');
  const [vMaxDiscount, setVMaxDiscount] = useState('50');
  const [vLimit, setVLimit] = useState('200');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const ADMIN_ID = 1;

  const loadAdminData = async () => {
    setErrorMsg(null);
    try {
      const [bi, usersList, sellersList, vList, lab] = await Promise.all([
        apiFetch<any>(`/admin/analytics?adminId=${ADMIN_ID}`),
        apiFetch<any[]>('/admin/users'),
        apiFetch<any[]>('/admin/sellers'),
        apiFetch<any[]>('/vouchers'),
        apiFetch<any>('/dbms-lab/introspection'),
      ]);
      setBiData(bi);
      setAllUsers(usersList);
      setAllSellers(sellersList);
      setVouchers(vList);
      setIntrospection(lab);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleModerateUser = async (targetUser: any) => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const nextActive = !targetUser.is_active;
      const updated = await apiFetch<any[]>(
        `/admin/users/${targetUser.user_id}/moderate`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            adminId: ADMIN_ID,
            isActive: nextActive,
          }),
        },
      );
      setAllUsers(updated);
      await refreshUsers();
      setToastMsg(
        `Đã ${nextActive ? 'mở khóa' : 'khóa'} tài khoản @${targetUser.username}.`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleApproveSeller = async (seller: any) => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const nextApproved = !seller.is_approved;
      const updated = await apiFetch<any[]>(
        `/admin/sellers/${seller.seller_id}/approve`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            adminId: ADMIN_ID,
            isApproved: nextApproved,
          }),
        },
      );
      setAllSellers(updated);
      await refreshUsers();
      setToastMsg(
        `Đã ${nextApproved ? 'phê duyệt' : 'tạm ngừng'} hoạt động gian hàng "${
          seller.shop_name
        }".`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const updated = await apiFetch<any[]>('/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucherCode: vCode,
          discountPercent: Number(vDiscount),
          minOrderValue: Number(vMinOrder),
          maxDiscount: Number(vMaxDiscount),
          usageLimit: Number(vLimit),
        }),
      });
      setVouchers(updated);
      setToastMsg(`Đã lưu mã giảm giá "${vCode.toUpperCase()}" thành công!`);
      setVCode('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRunCheckDb = async () => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const res = await apiFetch('/dbms-lab/integrity-check', {
        method: 'POST',
      });
      setCheckDbResult(res);
      setToastMsg(
        `Kiểm tra toàn vẹn dữ liệu hoàn tất trong ${res.elapsedMs} ms — Không phát hiện lỗi!`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const filteredUsers = allUsers.filter((u) =>
    userSearch.trim() === ''
      ? true
      : u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Admin Hero Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-violet-950 p-6 text-white shadow-lg md:flex-row md:items-center">
        <div>
          <span className="rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold text-indigo-200">
            NovaMart Administration
          </span>
          <h1 className="mt-1.5 text-xl font-extrabold sm:text-2xl">
            Trung Tâm Điều Hành & Phân Tích Kinh Doanh Toàn Sàn
          </h1>
          <p className="mt-0.5 text-xs text-slate-300">
            Giám sát doanh số GMV, kiểm duyệt đối tác bán hàng, quản lý khuyến
            mãi và bảo trì hệ thống.
          </p>
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
          onClick={() => setActiveTab('bi')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'bi'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Báo cáo Doanh số & Gian hàng Xuất sắc
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('moderation')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'moderation'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Người dùng & Đối tác ({allUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vouchers')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'vouchers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TicketPercent className="h-4 w-4" />
          Chiến dịch Mã giảm giá ({vouchers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'system'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          An toàn & Lưu trữ Hệ thống
        </button>
      </div>

      {/* TAB 1: PLATFORM BI */}
      {activeTab === 'bi' && (
        <div className="space-y-6">
          {/* GMV KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-400">
                Tổng Giá Trị Giao Dịch (GMV)
              </span>
              <div className="mt-1.5 text-2xl font-extrabold text-slate-900">
                {formatCurrency(biData?.gmvSummary?.total_gmv)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Trên tổng số {biData?.gmvSummary?.total_orders || 0} đơn đặt
                hàng
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-400">
                Doanh Thu Giao Thành Công
              </span>
              <div className="mt-1.5 text-2xl font-extrabold text-indigo-600">
                {formatCurrency(biData?.gmvSummary?.delivered_gmv)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                {biData?.gmvSummary?.delivered_orders || 0} đơn hoàn tất
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-400">
                Doanh Thu Bình Quân Mỗi Shop
              </span>
              <div className="mt-1.5 text-2xl font-extrabold text-amber-600">
                {formatCurrency(
                  biData?.gmvSummary?.avg_seller_delivered_revenue,
                )}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Mốc chuẩn đánh giá hiệu suất Shop
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-bold text-slate-400">
                Doanh Thu Phí Hoa Hồng Sàn (5%)
              </span>
              <div className="mt-1.5 text-2xl font-extrabold text-emerald-600">
                {formatCurrency(biData?.gmvSummary?.platform_commission_5pct)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Chiết khấu từ các đơn hoàn tất
              </span>
            </div>
          </div>

          {/* Above-Average Sellers Leaderboard */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Bảng Vinh Danh Gian Hàng Xuất Sắc (Doanh Thu Vượt Chuẩn Trung
                  Bình Sàn)
                </h3>
                <p className="text-xs text-slate-500">
                  Các đối tác có tổng doanh số cao hơn mức bình quân toàn sàn (
                  {formatCurrency(
                    biData?.gmvSummary?.avg_seller_delivered_revenue,
                  )}
                  )
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Gian hàng</th>
                    <th className="px-4 py-3 text-center">Đơn hoàn tất</th>
                    <th className="px-4 py-3 text-right">Doanh thu đạt được</th>
                    <th className="px-4 py-3 text-right">
                      Tỷ lệ vượt chuẩn trung bình
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(biData?.aboveAverageSellers || []).map((s: any) => {
                    const avg = Number(
                      biData?.gmvSummary?.avg_seller_delivered_revenue || 1,
                    );
                    const ratio = (
                      (Number(s.delivered_revenue) / avg) *
                      100
                    ).toFixed(0);
                    return (
                      <tr key={s.seller_id}>
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {s.shop_name}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {s.delivered_order_count} đơn
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-indigo-600">
                          {formatCurrency(s.delivered_revenue)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                            {ratio}% mức TB sàn
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Performance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="mb-4 text-base font-extrabold text-slate-900">
              Thống Kê Sức Mua Theo Ngành Hàng
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(biData?.categoryConsumption || []).map((c: any) => (
                <div
                  key={c.category_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {c.category_name}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {c.product_count} sản phẩm • Đã bán{' '}
                      <strong>{c.total_units_sold}</strong>
                    </div>
                  </div>
                  <div className="text-right font-extrabold text-indigo-600">
                    {formatCurrency(c.gross_category_revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          {/* Sellers Approval Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="mb-1 text-base font-extrabold text-slate-900">
              Quản Lý Đối Tác Gian Hàng
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              Kiểm duyệt hồ sơ mở shop hoặc tạm đình chỉ quyền kinh doanh của
              gian hàng
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tên Gian hàng</th>
                    <th className="px-4 py-3">Tài khoản chủ shop</th>
                    <th className="px-4 py-3 text-center">Đánh giá</th>
                    <th className="px-4 py-3 text-center">Số SP</th>
                    <th className="px-4 py-3 text-right">Doanh số</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSellers.map((s) => (
                    <tr key={s.seller_id}>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.shop_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        @{s.username} ({s.email})
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">
                        ★ {Number(s.rating).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.total_products}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">
                        {formatCurrency(s.delivered_revenue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            s.is_approved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.is_approved ? 'Đã duyệt' : 'Tạm đình chỉ'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleApproveSeller(s)}
                          className={`rounded-xl px-3 py-1.5 font-bold text-white ${
                            s.is_approved
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {s.is_approved ? 'Đình chỉ Shop' : 'Phê duyệt'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Users Moderation Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Danh Sách Tài Khoản Người Dùng
                </h3>
                <p className="text-xs text-slate-500">
                  Khi khóa một tài khoản Đối tác Bán hàng, toàn bộ sản phẩm của
                  gian hàng đó sẽ tự động được tạm ẩn.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm theo tên, email..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tài khoản</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Gian hàng</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.user_id}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          @{u.username}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {u.full_name}
                      </td>
                      <td className="px-4 py-3 uppercase font-bold text-indigo-700">
                        {u.role}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {u.shop_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            u.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.user_id !== ADMIN_ID && (
                          <button
                            type="button"
                            onClick={() => handleModerateUser(u)}
                            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-bold text-white ${
                              u.is_active
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {u.is_active ? (
                              <>
                                <Lock className="h-3 w-3" />
                                Khóa
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3 w-3" />
                                Mở khóa
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VOUCHER CAMPAIGN MANAGER */}
      {activeTab === 'vouchers' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleCreateVoucher}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
          >
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Plus className="h-4 w-4 text-indigo-600" />
              Phát Hành Mã Giảm Giá Mới
            </h3>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Mã Code (In hoa) *
              </label>
              <input
                type="text"
                required
                placeholder="VD: SUMMER20"
                value={vCode}
                onChange={(e) => setVCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mức giảm (%) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={vDiscount}
                  onChange={(e) => setVDiscount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Giảm tối đa ($)
                </label>
                <input
                  type="number"
                  min={1}
                  value={vMaxDiscount}
                  onChange={(e) => setVMaxDiscount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Đơn tối thiểu ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={vMinOrder}
                  onChange={(e) => setVMinOrder(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Giới hạn lượt dùng
                </label>
                <input
                  type="number"
                  min={1}
                  value={vLimit}
                  onChange={(e) => setVLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              Phát hành Mã giảm giá
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
            <h3 className="mb-4 text-base font-extrabold text-slate-900">
              Danh Sách Mã Giảm Giá Đang Hoạt Động ({vouchers.length})
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {vouchers.map((v) => {
                const usedPct = Math.min(
                  100,
                  Math.round(
                    (Number(v.used_count) / Number(v.usage_limit || 1)) * 100,
                  ),
                );
                return (
                  <div
                    key={v.voucher_code}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-indigo-600 px-2.5 py-1 font-mono text-xs font-extrabold text-white">
                        {v.voucher_code}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700">
                        -{v.discount_percent}%
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      Đơn tối thiểu: <strong>{formatCurrency(v.min_order_value)}</strong>{' '}
                      • Tối đa: <strong>{formatCurrency(v.max_discount)}</strong>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                        <span>Đã dùng: {v.used_count}</span>
                        <span>Tổng: {v.usage_limit} lượt</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${usedPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM HEALTH & STORAGE */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Trạng Thái Lưu Trữ & Toàn Vẹn Cơ Sở Dữ Liệu
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chế độ phục hồi:{' '}
                  <strong>
                    {introspection?.databaseConfig?.recovery_model_desc}
                  </strong>{' '}
                  • Kiểm chứng trang:{' '}
                  <strong>
                    {introspection?.databaseConfig?.page_verify_option_desc}
                  </strong>{' '}
                  • Trạng thái:{' '}
                  <strong className="text-emerald-600">
                    {introspection?.databaseConfig?.state_desc}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunCheckDb}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <ShieldCheck className="h-4 w-4" />
                Kiểm tra toàn vẹn hệ thống
              </button>
            </div>

            {checkDbResult && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900">
                ✓ {checkDbResult.status} (Thời gian phản hồi:{' '}
                {checkDbResult.elapsedMs} ms)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
