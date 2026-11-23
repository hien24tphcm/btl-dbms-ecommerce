'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface DemoUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  phone_number?: string;
  address?: string;
  role: 'buyer' | 'seller' | 'admin';
  is_active: boolean;
  seller_id?: number | null;
  shop_name?: string | null;
  store_description?: string | null;
  seller_rating?: number | null;
  is_approved?: boolean | null;
}

interface AuthContextValue {
  users: DemoUser[];
  currentUser: DemoUser | null;
  cartCount: number;
  wishlistIds: number[];
  loading: boolean;
  switchUser: (username: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshCartCount: () => Promise<void>;
  toggleWishlist: (productId: number) => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<DemoUser | null>>;
}

const AuthContext = createContext<AuthContextValue>({
  users: [],
  currentUser: null,
  cartCount: 0,
  wishlistIds: [],
  loading: true,
  switchUser: async () => {},
  refreshUsers: async () => {},
  refreshCartCount: async () => {},
  toggleWishlist: () => {},
  setCurrentUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCartCount = async (uid: number) => {
    try {
      const items = await apiFetch<any[]>(`/cart?userId=${uid}`);
      const count = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      setCartCount(count);
    } catch {
      setCartCount(0);
    }
  };

  const refreshUsers = async () => {
    try {
      const list = await apiFetch<DemoUser[]>('/auth/users');
      setUsers(list);
      const savedUsername =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('dbms_active_username')
          : null;

      const matched =
        list.find((u) => u.username === savedUsername) ||
        list.find((u) => u.username === 'buyer_alex') ||
        list[0] ||
        null;

      setCurrentUser(matched);
      if (matched) {
        await fetchCartCount(matched.user_id);
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const switchUser = async (username: string) => {
    const found = users.find((u) => u.username === username);
    if (found) {
      setCurrentUser(found);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dbms_active_username', found.username);
      }
      await fetchCartCount(found.user_id);
    }
  };

  const refreshCartCount = async () => {
    if (currentUser) {
      await fetchCartCount(currentUser.user_id);
    }
  };

  const toggleWishlist = (productId: number) => {
    setWishlistIds((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('novamart_wishlist', JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedWish = window.localStorage.getItem('novamart_wishlist');
        if (savedWish) setWishlistIds(JSON.parse(savedWish));
      } catch {}
    }
    refreshUsers();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        users,
        currentUser,
        cartCount,
        wishlistIds,
        loading,
        switchUser,
        refreshUsers,
        refreshCartCount,
        toggleWishlist,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
