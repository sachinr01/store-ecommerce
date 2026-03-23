'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Use relative path (via Next.js rewrite proxy) on client to keep cookies same-origin.
// On server (SSR) fall back to the direct URL.
const API_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/store/api')
    : '/store/api';

export interface CartItem {
  cartItemId: number;
  productId: number;
  variationId?: number | null;
  title: string;
  price: number;
  color?: string | null;
  size?: string | null;
  quantity: number;
  image?: string | null;
}

export type AddCartItem = {
  productId: number;
  variationId?: number | null;
  title: string;
  price: number;
  color?: string;
  size?: string;
  quantity?: number;
  image?: string;
};

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  addItem: (item: AddCartItem) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  updateQty: (cartItemId: number, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

type ApiResponse<T> = { success: boolean; message?: string; data?: T };

async function apiRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }

  if (!json) {
    throw new Error(`Request failed (${res.status})`);
  }

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json;
}

function normalizeItem(raw: any): CartItem {
  return {
    cartItemId: Number(raw.id),
    productId: Number(raw.product_id),
    variationId: raw.variation_id !== null && raw.variation_id !== undefined ? Number(raw.variation_id) : null,
    title: raw.title || '',
    price: Number(raw.price || 0),
    color: raw.color ?? null,
    size: raw.size ?? null,
    quantity: Number(raw.quantity || 0),
    image: raw.image ?? null,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ items: any[]; count: number; total: number }>('/cart');
      const nextItems = (res.data?.items || []).map(normalizeItem);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    refresh().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, []);

  const addItem = async (item: AddCartItem) => {
    setError(null);
    const payload = {
      product_id: item.productId,
      variation_id: item.variationId ?? null,
      quantity: item.quantity ?? 1,
      color: item.color ?? null,
      size: item.size ?? null,
      title: item.title,
      price: item.price,
      image: item.image ?? null,
    };
    await apiRequest('/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refresh();
  };

  const updateQty = async (cartItemId: number, qty: number) => {
    if (qty < 1) {
      await removeItem(cartItemId);
      return;
    }
    setError(null);
    await apiRequest(`/cart/update/${cartItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty }),
    });
    await refresh();
  };

  const removeItem = async (cartItemId: number) => {
    setError(null);
    await apiRequest(`/cart/remove/${cartItemId}`, { method: 'DELETE' });
    await refresh();
  };

  const clearCart = async () => {
    setError(null);
    await apiRequest('/cart/clear', { method: 'DELETE' });
    setItems([]);
  };

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, loading, error, addItem, removeItem, updateQty, clearCart, refresh, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
