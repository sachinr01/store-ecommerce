'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from './api';
import { useCart } from './cartContext';
import { wigzoIdentify } from './wigzo';

const API_BASE = '/api';

interface AuthState {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  setUser: (user: AuthUser | { user?: AuthUser | null } | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(user: AuthUser | { user?: AuthUser | null } | null | undefined): AuthUser | null {
  if (!user) return null;
  if (typeof user === 'object' && 'user' in user && user.user) {
    return user.user;
  }
  return user as AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoggedIn: false, isLoading: true });
  const { refresh } = useCart();

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(r => r.json())
      .then((json: { success: boolean; data?: { isLoggedIn: boolean; user?: AuthUser } }) => {
        if (json.success && json.data?.isLoggedIn && json.data.user) {
          const u = normalizeUser(json.data.user);
          setState({ user: u, isLoggedIn: true, isLoading: false });
          if (u) wigzoIdentify({ email: u.email, phone: u.phone, fullName: u.displayName });
        } else {
          setState({ user: null, isLoggedIn: false, isLoading: false });
        }
      })
      .catch(() => setState({ user: null, isLoggedIn: false, isLoading: false }));
  }, []);

  const setUser = useCallback((user: AuthUser | { user?: AuthUser | null } | null) => {
    const normalized = normalizeUser(user);
    setState({ user: normalized, isLoggedIn: !!normalized, isLoading: false });
    if (normalized) {
      wigzoIdentify({ email: normalized.email, phone: normalized.phone, fullName: normalized.displayName });
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setState({ user: null, isLoggedIn: false, isLoading: false });
    await refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...state, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
