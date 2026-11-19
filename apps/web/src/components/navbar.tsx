'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Store,
  ShieldAlert,
  UserCheck,
  Database,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const { users, currentUser, cartCount, switchUser } = useAuth();

  const navItems = [
    {
      href: '/',
      label: 'Storefront (FR-01, 02)',
      icon: ShoppingBag,
    },
    {
      href: '/cart',
      label: 'Giỏ hàng & Checkout (FR-03, 04)',
      icon: ShoppingCart,
      badge: cartCount,
    },
    {
      href: '/orders',
      label: 'Đơn mua & Review (FR-05, 06)',
      icon: Package,
    },
    {
      href: '/seller',
      label: 'Seller Center (FR-07..10)',
      icon: Store,
    },
    {
      href: '/admin',
      label: 'Admin & DBMS Lab (FR-11, 12)',
      icon: ShieldAlert,
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                ECommerceDB
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                MS SQL Server 2022/2025 • BTL DBMS HK261
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-wrap items-center gap-1">
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
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active
                        ? 'bg-white text-indigo-700'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Demo Role Switcher */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <UserCheck className="h-4 w-4 text-indigo-600" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active Account (dbo.Users)
            </span>
            <select
              aria-label="Quick Account Switcher"
              value={currentUser?.username || ''}
              onChange={(e) => switchUser(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.username}>
                  [{u.role.toUpperCase()}] {u.username} —{' '}
                  {u.shop_name ? `${u.shop_name} (Seller #${u.seller_id})` : u.full_name}
                  {!u.is_active ? ' (LOCKED)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
