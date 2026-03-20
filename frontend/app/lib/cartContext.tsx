'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: number;         // product ID
  variationId?: number;
  title: string;
  price: number;
  color?: string;
  size?: string;
  quantity: number;
  image: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: number, variationId?: number) => void;
  updateQty: (id: number, variationId: number | undefined, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

const KEY = 'cart_items';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const key = (id: number, variationId?: number) => `${id}-${variationId ?? 0}`;

  const addItem = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems(prev => {
      const k = key(item.id, item.variationId);
      const exists = prev.find(i => key(i.id, i.variationId) === k);
      if (exists) {
        return prev.map(i => key(i.id, i.variationId) === k
          ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
          : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity ?? 1 }];
    });
  };

  const removeItem = (id: number, variationId?: number) => {
    setItems(prev => prev.filter(i => key(i.id, i.variationId) !== key(id, variationId)));
  };

  const updateQty = (id: number, variationId: number | undefined, qty: number) => {
    if (qty < 1) { removeItem(id, variationId); return; }
    setItems(prev => prev.map(i =>
      key(i.id, i.variationId) === key(id, variationId) ? { ...i, quantity: qty } : i
    ));
  };

  const clearCart = () => setItems([]);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
