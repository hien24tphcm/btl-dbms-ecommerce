'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  TrendingUp,
  Users,
  Database,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';
import { DbmsBadge } from '@/components/dbms-badge';

export default function AdminPortalPage() {
  const { refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'bi' | 'moderation' | 'lab'>('bi');

  const [biData, setBiData] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [introspection, setIntrospection] = useState<any | null>(null);
  const [checkDbResult, setCheckDbResult] = useState<any | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const ADMIN_ID = 1; // admin_root (user_id = 1)

  const loadAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [bi, usersList, sellersList, lab] = await Promise.all([
        apiFetch<any>(`/admin/analytics?adminId=${ADMIN_ID}`),
        apiFetch<any[]>('/admin/users'),
        apiFetch<any[]>('/admin/sellers'),
        apiFetch<any>('/dbms-lab/introspection'),
      ]);
      setBiData(bi);
      setAllUsers(usersList);
      setAllSellers(sellersList);
      setIntrospection(lab);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
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
        `Đã ${nextActive ? 'MỞ KHÓA' : 'KHÓA'} tài khoản "${targetUser.username}"${
          !nextActive && targetUser.role === 'seller'
            ? ' và tự động ẩn toàn bộ sản phẩm của gian hàng liên kết'
            : ''
        } (EXEC dbo.sp_ModerateUserAccount).`,
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
        `Đã ${nextApproved ? 'PHÊ DUYỆT' : 'THU HỒI DUYỆT'} gian hàng "${
          seller.shop_name
        }" (EXEC dbo.sp_ApproveSeller).`,
      );
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
        `Thực thi thành công: ${res.command} (${res.elapsedMs} ms) — ${res.status}`,
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Cổng Quản Trị Toàn Sàn & Phòng Thí Nghiệm DBMS (FR-11, FR-12 & 5
            Topics)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Thực thi với quyền Quản trị viên{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              admin_root (user_id = 1)
            </code>{' '}
            trên CSDL duy nhất{' '}
            <strong className="text-indigo-700">ECommerceDB</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <DbmsBadge
            fr="FR-11"
            queryType="(c) Update Transaction"
            procedure="sp_ModerateUserAccount / sp_ApproveSeller"
          />
          <DbmsBadge
            fr="FR-12"
            queryType="(g) Subquery + (h) Aggregate"
            procedure="EXEC dbo.sp_GetAboveAverageSellers"
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('bi')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'bi'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          1. Phân tích BI & Subquery Seller Vượt chuẩn (FR-12)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('moderation')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'moderation'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          2. Kiểm duyệt Tài khoản & Phê duyệt Gian hàng (FR-11)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lab')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === 'lab'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="h-4 w-4" />
          3. DBMS Topics 1–5 Introspection & DBCC CHECKDB
        </button>
      </div>

      {/* TAB 1: PLATFORM BI & SUBQUERY (FR-12) */}
      {activeTab === 'bi' && (
        <div className="space-y-6">
          {/* GMV KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Tổng GMV Toàn sàn
              </span>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {formatCurrency(biData?.gmvSummary?.total_gmv)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Tổng số đơn: {biData?.gmvSummary?.total_orders || 0}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Doanh thu Đã giao (Delivered GMV)
              </span>
              <div className="mt-2 text-2xl font-extrabold text-indigo-600">
                {formatCurrency(biData?.gmvSummary?.delivered_gmv)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Đơn hoàn tất: {biData?.gmvSummary?.delivered_orders || 0}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Doanh thu TB mỗi Gian hàng (SELECT AVG)
              </span>
              <div className="mt-2 text-2xl font-extrabold text-amber-600">
                {formatCurrency(
                  biData?.gmvSummary?.avg_seller_delivered_revenue,
                )}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Ngưỡng so sánh Subquery (Query g)
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400">
                Phí hoa hồng sàn (5% GMV)
              </span>
              <div className="mt-2 text-2xl font-extrabold text-emerald-600">
                {formatCurrency(biData?.gmvSummary?.platform_commission_5pct)}
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Tính trên các đơn đã giao thành công
              </span>
            </div>
          </div>

          {/* Above-Average Sellers Subquery Result (sp_GetAboveAverageSellers - Query g & h) */}
          <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Các Gian hàng có Doanh thu Vượt mức Trung bình Toàn sàn
                  (FR-12 | Query g: Subquery & Query h: Aggregate)
                </h3>
                <p className="text-xs text-slate-500">
                  <code className="font-mono">
                    EXEC dbo.sp_GetAboveAverageSellers
                  </code>{' '}
                  — Lọc bằng mệnh đề{' '}
                  <code className="font-mono">
                    HAVING SUM(o.final_amount) &gt; (SELECT AVG(shop_rev) FROM
                    ...)
                  </code>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-indigo-50/60 text-indigo-950">
                  <tr>
                    <th className="px-4 py-3">seller_id</th>
                    <th className="px-4 py-3">Tên Gian hàng (shop_name)</th>
                    <th className="px-4 py-3 text-center">
                      Số đơn hoàn tất (COUNT)
                    </th>
                    <th className="px-4 py-3 text-right">
                      Doanh thu hoàn tất (SUM)
                    </th>
                    <th className="px-4 py-3 text-right">
                      So với TB sàn (
                      {formatCurrency(
                        biData?.gmvSummary?.avg_seller_delivered_revenue,
                      )}
                      )
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(biData?.aboveAverageSellers || []).map((s: any) => {
                    const avg = Number(
                      biData?.gmvSummary?.avg_seller_delivered_revenue || 1,
                    );
                    const ratio = ((Number(s.delivered_revenue) / avg) * 100).toFixed(
                      0,
                    );
                    return (
                      <tr key={s.seller_id}>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          Seller #{s.seller_id}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {s.shop_name}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {s.delivered_order_count}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-indigo-600">
                          {formatCurrency(s.delivered_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          Đạt {ratio}% mức TB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Consumption Breakdown (FR-12) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-bold text-slate-900">
              Thống kê Sản lượng Tiêu thụ theo Nhóm Ngành hàng (FR-12 |
              Categories Consumption)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">category_id</th>
                    <th className="px-4 py-2.5">Tên danh mục</th>
                    <th className="px-4 py-2.5 text-center">Số mã SP</th>
                    <th className="px-4 py-2.5 text-center">
                      Sản lượng bán (Units)
                    </th>
                    <th className="px-4 py-2.5 text-right">Doanh số ngành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(biData?.categoryConsumption || []).map((c: any) => (
                    <tr key={c.category_id}>
                      <td className="px-4 py-2.5 font-mono text-slate-500">
                        #{c.category_id}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {c.category_name}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {c.product_count}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold">
                        {c.total_units_sold}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-indigo-600">
                        {formatCurrency(c.gross_category_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER & SELLER MODERATION (FR-11) */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          {/* Seller Approval Table (sp_ApproveSeller) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-base font-bold text-slate-900">
              Thẩm định & Phê duyệt Gian hàng (FR-11: EXEC dbo.sp_ApproveSeller
              & View dbo.v_SellerPerformanceMetrics)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Khi gian hàng bị thu hồi phê duyệt (
              <code className="font-mono">is_approved = 0</code>), hệ thống chặn
              đăng sản phẩm và đặt hàng mới vào gian hàng đó.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">seller_id</th>
                    <th className="px-4 py-2.5">Gian hàng</th>
                    <th className="px-4 py-2.5">Chủ sở hữu</th>
                    <th className="px-4 py-2.5 text-center">Điểm sao</th>
                    <th className="px-4 py-2.5 text-center">SP đang bán</th>
                    <th className="px-4 py-2.5 text-right">Doanh thu</th>
                    <th className="px-4 py-2.5 text-center">Trạng thái</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSellers.map((s) => (
                    <tr key={s.seller_id}>
                      <td className="px-4 py-2.5 font-mono text-slate-500">
                        #{s.seller_id}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {s.shop_name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {s.username} ({s.email})
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-amber-600">
                        ★ {Number(s.rating).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {s.total_products}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-indigo-600">
                        {formatCurrency(s.delivered_revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            s.is_approved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.is_approved ? 'Approved (1)' : 'Unapproved (0)'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleApproveSeller(s)}
                          className={`rounded-lg px-3 py-1 font-bold text-white ${
                            s.is_approved
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {s.is_approved ? 'Thu hồi duyệt' : 'Phê duyệt Shop'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Accounts Moderation Table (sp_ModerateUserAccount) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-base font-bold text-slate-900">
              Quản lý Tài khoản Người dùng (FR-11: EXEC
              dbo.sp_ModerateUserAccount)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              <strong>Ràng buộc Giao dịch (Cascade Transaction):</strong> Nếu
              khóa tài khoản của một Seller (
              <code className="font-mono">@is_active = 0</code>), Stored
              Procedure tự động cập nhật{' '}
              <code className="font-mono">
                is_active = 0, status = &apos;inactive&apos;
              </code>{' '}
              cho toàn bộ sản phẩm của Seller đó.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">user_id</th>
                    <th className="px-4 py-2.5">Username</th>
                    <th className="px-4 py-2.5">Họ tên</th>
                    <th className="px-4 py-2.5">Vai trò</th>
                    <th className="px-4 py-2.5">Gian hàng liên kết</th>
                    <th className="px-4 py-2.5 text-center">Trạng thái</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map((u) => (
                    <tr key={u.user_id}>
                      <td className="px-4 py-2.5 font-mono text-slate-500">
                        #{u.user_id}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                        {u.username}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {u.full_name}
                      </td>
                      <td className="px-4 py-2.5 uppercase font-bold text-indigo-700">
                        {u.role}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {u.shop_name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            u.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.is_active ? 'Active (1)' : 'Locked (0)'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {u.user_id !== ADMIN_ID && (
                          <button
                            type="button"
                            onClick={() => handleModerateUser(u)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 font-bold text-white ${
                              u.is_active
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {u.is_active ? (
                              <>
                                <Lock className="h-3 w-3" />
                                Khóa TK
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

      {/* TAB 3: DBMS TOPICS 1-5 LIVE INTROSPECTION LAB */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* Topic 5: Database Config & DBCC CHECKDB */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Chủ đề 5: Data Backup, WAL Configuration & Online Integrity
                  Check (DBCC CHECKDB)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Thông số thực tế từ <code className="font-mono">sys.databases</code>{' '}
                  & <code className="font-mono">msdb.dbo.backupset</code>:
                  Recovery Model ={' '}
                  <strong>
                    {introspection?.databaseConfig?.recovery_model_desc}
                  </strong>{' '}
                  • Page Verify ={' '}
                  <strong>
                    {introspection?.databaseConfig?.page_verify_option_desc}
                  </strong>{' '}
                  • Indirect Checkpoint ={' '}
                  <strong>
                    {
                      introspection?.databaseConfig
                        ?.target_recovery_time_in_seconds
                    }
                    s
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunCheckDb}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <ShieldCheck className="h-4 w-4" />
                Chạy kiểm tra toàn vẹn (DBCC CHECKDB)
              </button>
            </div>

            {checkDbResult && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="font-bold">
                  Kết quả: {checkDbResult.status} (Thời gian:{' '}
                  {checkDbResult.elapsedMs} ms)
                </div>
                <div className="mt-0.5 font-mono text-[11px]">
                  Lệnh T-SQL: {checkDbResult.command}
                </div>
              </div>
            )}

            {/* LSN Backup History */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Loại Backup</th>
                    <th className="px-3 py-2">first_lsn</th>
                    <th className="px-3 py-2">last_lsn</th>
                    <th className="px-3 py-2">checkpoint_lsn</th>
                    <th className="px-3 py-2">Thời điểm hoàn tất</th>
                    <th className="px-3 py-2 text-right">Kích thước nén</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(introspection?.backupHistory || []).map(
                    (b: any, idx: number) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-indigo-700">
                          {b.backup_type}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {b.first_lsn}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {b.last_lsn}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {b.checkpoint_lsn}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(b.backup_finish_date).toLocaleString(
                            'vi-VN',
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {b.compressed_size_kb} KB
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Topic 1: Storage Engine & 8KB Page Allocation Units */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-900">
              <HardDrive className="h-4 w-4 text-indigo-600" />
              Chủ đề 1: Data Storage & 8KB Page Allocation Units (9 Bảng chuẩn
              hóa trong 01_schema.sql)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Truy vấn trực tiếp từ{' '}
              <code className="font-mono">
                sys.tables ⋈ sys.partitions ⋈ sys.allocation_units
              </code>{' '}
              (IN_ROW_DATA vs LOB_DATA).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Tên bảng (dbo)</th>
                    <th className="px-3 py-2 text-center">Số bản ghi (Rows)</th>
                    <th className="px-3 py-2">Allocation Unit Type</th>
                    <th className="px-3 py-2 text-center">Total Pages (8KB)</th>
                    <th className="px-3 py-2 text-center">Used Pages (8KB)</th>
                    <th className="px-3 py-2 text-right">Dung lượng (KB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(introspection?.tableStorage || []).map(
                    (t: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          dbo.{t.table_name}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">
                          {t.row_count}
                        </td>
                        <td className="px-3 py-2 font-mono text-indigo-700">
                          {t.allocation_unit_type}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {t.total_pages}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {t.used_pages}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {t.total_space_kb} KB
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Topic 2: Clustered & Nonclustered Covering Indexes (02_indexes.sql) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-base font-bold text-slate-900">
              Chủ đề 2: B+Tree Clustered & Nonclustered Covering Indexes
              (02_indexes.sql)
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Danh sách các chỉ mục thực tế từ{' '}
              <code className="font-mono">sys.indexes</code> kèm các cột khóa
              (Key Columns) và cột bao phủ (Included Columns).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Bảng</th>
                    <th className="px-3 py-2">Tên Index</th>
                    <th className="px-3 py-2">Loại Index</th>
                    <th className="px-3 py-2">Key Columns</th>
                    <th className="px-3 py-2">Included Columns (Covering)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(introspection?.indexes || []).map((ix: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono font-bold text-slate-800">
                        {ix.table_name}
                      </td>
                      <td className="px-3 py-2 font-mono text-indigo-700">
                        {ix.index_name}
                      </td>
                      <td className="px-3 py-2">{ix.index_type}</td>
                      <td className="px-3 py-2 font-mono font-semibold">
                        {ix.key_columns}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {ix.included_columns || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
