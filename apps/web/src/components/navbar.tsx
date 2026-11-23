'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Store,
  ShieldCheck,
  User,
  UserPlus,
  Heart,
  Sparkles,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

export function Navbar() {
  const pathname = usePathname();
  const {
    users,
    currentUser,
    cartCount,
    wishlistIds,
    switchUser,
    refreshUsers,
    setCurrentUser,
  } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'switch' | 'profile' | 'register'>(
    'switch',
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile form states
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Register form states
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regRole, setRegRole] = useState<'buyer' | 'seller'>('buyer');
  const [regShopName, setRegShopName] = useState('');

  const openModal = (tab: 'switch' | 'profile' | 'register') => {
    setAuthTab(tab);
    setFeedback(null);
    setErrorMsg(null);
    if (currentUser) {
      setEditFullName(currentUser.full_name || '');
      setEditPhone(currentUser.phone_number || '');
      setEditAddress(currentUser.address || '');
    }
    setShowAuthModal(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const updated = await apiFetch(`/auth/profile/${currentUser.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editFullName,
          phoneNumber: editPhone,
          address: editAddress,
        }),
      });
      setCurrentUser(updated);
      await refreshUsers();
      setFeedback('Đã lưu thông tin hồ sơ & địa chỉ nhận hàng.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);
    try {
      const created = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          fullName: regFullName,
          phoneNumber: regPhone,
          address: regAddress,
          role: regRole,
          shopName: regRole === 'seller' ? regShopName : undefined,
        }),
      });
      await refreshUsers();
      setCurrentUser(created);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dbms_active_username', created.username);
      }
      setFeedback(`Chào mừng ${created.full_name}! Tài khoản đã được kích hoạt.`);
      setRegUsername('');
      setRegEmail('');
      setRegFullName('');
      setRegShopName('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const navItems = [
    {
      href: '/',
      label: 'Khám phá',
      icon: ShoppingBag,
    },
    {
      href: '/orders',
      label: 'Đơn mua',
      icon: Package,
    },
    {
      href: '/seller',
      label: 'Kênh Người Bán',
      icon: Store,
    },
    {
      href: '/admin',
      label: 'Quản trị sàn',
      icon: ShieldCheck,
    },
  ];

  const getRoleBadge = (role?: string) => {
    if (role === 'admin')
      return { text: 'Quản trị viên', cls: 'bg-rose-100 text-rose-700' };
    if (role === 'seller')
      return { text: 'Đối tác Shop', cls: 'bg-amber-100 text-amber-800' };
    return { text: 'Khách hàng', cls: 'bg-indigo-100 text-indigo-700' };
  };

  const roleBadge = getRoleBadge(currentUser?.role);

  return (
    <>
      {/* Top Announcement Strip */}
      <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-800 px-4 py-1.5 text-center text-xs font-medium text-indigo-50">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          Ưu đãi toàn sàn: Nhập mã <strong className="rounded bg-white/20 px-1.5 py-0.5 text-white">WELCOME10</strong> giảm 10% • <strong className="rounded bg-white/20 px-1.5 py-0.5 text-white">FLASH25</strong> giảm 25% • <strong className="rounded bg-white/20 px-1.5 py-0.5 text-white">FREESHIP</strong> miễn phí giao hàng!
        </span>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5">
          {/* Brand Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200 transition group-hover:scale-105">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                NovaMart
              </span>
              <span className="block text-[11px] font-medium text-slate-400">
                Official Marketplace
              </span>
            </div>
          </Link>

          {/* Main Navigation */}
          <nav className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/'
                  ? pathname === '/' || pathname.startsWith('/products')
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Wishlist, Cart, Account */}
          <div className="flex items-center gap-2.5">
            {/* Wishlist indicator */}
            <Link
              href="/?wishlist=1"
              className="relative flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600"
              title="Sản phẩm đã thích"
            >
              <Heart
                className={`h-4 w-4 ${
                  wishlistIds.length > 0
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">Yêu thích</span>
              {wishlistIds.length > 0 && (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                  {wishlistIds.length}
                </span>
              )}
            </Link>

            {/* Cart Button */}
            <Link
              href="/cart"
              className={`relative flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                pathname === '/cart'
                  ? 'bg-indigo-700 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Giỏ hàng</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                  pathname === '/cart'
                    ? 'bg-white text-indigo-700'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {cartCount}
              </span>
            </Link>

            {/* User Profile & Account Switcher Button */}
            <button
              type="button"
              onClick={() => openModal('switch')}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-left transition hover:border-indigo-300 hover:bg-white"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                {(currentUser?.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-1.5">
                  <span className="max-w-[120px] truncate text-xs font-bold text-slate-900">
                    {currentUser?.shop_name || currentUser?.full_name || 'Tài khoản'}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${roleBadge.cls}`}
                  >
                    {roleBadge.text}
                  </span>
                </div>
                <span className="block text-[11px] text-slate-500">
                  @{currentUser?.username} • Đổi / Hồ sơ ▾
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Account Management / Login / Register / Profile Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Tài khoản & Hồ sơ cá nhân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/50 p-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('switch');
                  setFeedback(null);
                  setErrorMsg(null);
                }}
                className={`rounded-xl py-2 transition ${
                  authTab === 'switch'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chuyển tài khoản
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('profile');
                  setFeedback(null);
                  setErrorMsg(null);
                }}
                className={`rounded-xl py-2 transition ${
                  authTab === 'profile'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sửa hồ sơ & Địa chỉ
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setFeedback(null);
                  setErrorMsg(null);
                }}
                className={`rounded-xl py-2 transition ${
                  authTab === 'register'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Tạo tài khoản mới
              </button>
            </div>

            <div className="p-6">
              {feedback && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{feedback}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
                  {errorMsg}
                </div>
              )}

              {/* TAB 1: Quick Switch Accounts */}
              {authTab === 'switch' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Chọn tài khoản để trải nghiệm theo vai trò tương ứng (Khách
                    hàng, Đối tác Bán hàng, hoặc Quản trị viên):
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {users.map((u) => {
                      const active = u.username === currentUser?.username;
                      const badge = getRoleBadge(u.role);
                      return (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={async () => {
                            await switchUser(u.username);
                            setShowAuthModal(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                            active
                              ? 'border-indigo-500 bg-indigo-50/70'
                              : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                              {u.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {u.shop_name || u.full_name}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}
                                >
                                  {badge.text}
                                </span>
                                {!u.is_active && (
                                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                    Đã khóa
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                @{u.username} • {u.email}
                              </span>
                            </div>
                          </div>
                          {active && (
                            <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white">
                              Đang dùng
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: Edit Profile & Delivery Address */}
              {authTab === 'profile' && currentUser && (
                <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    Đang chỉnh sửa thông tin của{' '}
                    <strong className="text-slate-900">
                      @{currentUser.username}
                    </strong>{' '}
                    ({currentUser.email})
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Họ và tên người nhận
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      Số điện thoại liên hệ
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Địa chỉ nhận hàng mặc định
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: Register New Account / Open Shop */}
              {authTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole('buyer')}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        regRole === 'buyer'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Tài khoản Mua sắm
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('seller')}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        regRole === 'seller'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Mở Gian hàng (Seller)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Tên đăng nhập *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="vd: buyer_minh"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="minh@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn Minh"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        placeholder="0909123456"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  {regRole === 'seller' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-indigo-700">
                        Tên Gian hàng chính thức *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Minh Digital Store"
                        value={regShopName}
                        onChange={(e) => setRegShopName(e.target.value)}
                        className="w-full rounded-xl border border-indigo-300 bg-indigo-50/40 px-3 py-2 text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      placeholder="Quận 1, TP. Hồ Chí Minh"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Đăng ký & Đăng nhập ngay
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
