'use client';

import { useRef, useState } from 'react';

declare global {
  interface Window {
    HeadlessCheckout: {
      addToCart: (event: Event, token: string, options: { fallbackUrl: string }) => void;
    };
  }
}
import { useRouter } from 'next/navigation';
import { useCart } from './cartContext';

export const SR_STORAGE_KEYS = {
  checkoutRef:     'sr_checkout_ref',
  orderId:         'sr_order_id',
  couponCode:      'sr_coupon_code',
  couponDiscount:  'sr_coupon_discount',
  checkoutActive:  'sr_checkout_active',
} as const;

const MAX_POLL_ATTEMPTS = 72;

const SR_OVERLAY_SELECTORS = [
  '[id*="fastrr" i]',
  '[class*="fastrr" i]',
  '[id*="pickrr" i]',
  '[class*="pickrr" i]',
  '[id*="shiprocket" i]',
  '[class*="shiprocket-checkout" i]',
  'iframe[src*="pickrr"]',
  'iframe[src*="fastrr"]',
  'iframe[src*="shiprocket"]',
];

/** True if Shiprocket's checkout overlay/iframe still appears to be on screen. */
const isShiprocketOverlayOpen = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    return SR_OVERLAY_SELECTORS.some((sel) => {
      const els = document.querySelectorAll(sel);
      return Array.from(els).some((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect?.();
        return !!rect && rect.width > 0 && rect.height > 0;
      });
    });
  } catch {
    return false;
  }
};

const MAX_OVERLAY_HOLDS = 8;

export function useShiprocketCheckout() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const overlayHoldsRef = useRef(0);

  const srSet = (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch { /* SSR/private mode */ }
  };
  const srGet = (key: string): string => {
    try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; }
  };
  const clearSRStorage = () => {
    try {
      Object.values(SR_STORAGE_KEYS).forEach((k) => sessionStorage.removeItem(k));
    } catch { /* SSR/private mode */ }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
    overlayHoldsRef.current = 0;
  };

  const finalizeCheckout = async (srOrderId: string, checkoutRef: string): Promise<boolean> => {
    if (!srOrderId) return false;
    if (srGet(SR_STORAGE_KEYS.checkoutActive) !== '1') { stopPolling(); return false; }
    try {
      const res = await fetch('/api/shiprocket/complete-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: srOrderId, checkout_ref: checkoutRef }),
      });
      if (res.status === 202) return false;
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) return false;

      // Order exists — but don't redirect over the top of a still-open
      // checkout iframe. Hold here and let the next tick re-check.
      if (isShiprocketOverlayOpen() && overlayHoldsRef.current < MAX_OVERLAY_HOLDS) {
        overlayHoldsRef.current += 1;
        return false;
      }

      overlayHoldsRef.current = 0;
      stopPolling();
      clearSRStorage();
      try { await clearCart(); } catch { /* non-fatal */ }
      const ref = data.sr_cart_id || data.order_id;
      router.push(`/checkout/success?sr_cart_id=${encodeURIComponent(ref)}`);
      return true;
    } catch {
      return false;
    }
  };

  const startPolling = (srOrderId: string, checkoutRef: string) => {
    stopPolling();
    pollAttemptsRef.current = 0;
    const tick = async () => {
      pollAttemptsRef.current += 1;
      const done = await finalizeCheckout(srOrderId, checkoutRef);
      if (done || pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) stopPolling();
    };
    const initialDelay = setTimeout(() => {
      void tick();
      pollIntervalRef.current = setInterval(() => void tick(), 2500);
    }, 3000);
    pollIntervalRef.current = initialDelay as unknown as ReturnType<typeof setInterval>;
  };

  const extractSROrderId = (payload: Record<string, unknown>): string => {
    const candidates = [
      (payload as any)?.order_id,
      (payload as any)?.orderId,
      (payload as any)?.result?.order_id,
      (payload as any)?.result?.data?.order_id,
      (payload as any)?.data?.order_id,
    ];
    const found = candidates.find((v) => typeof v === 'string' && v.trim());
    return typeof found === 'string' ? found.trim() : '';
  };

  const startCheckout = async (
    e: React.MouseEvent<HTMLButtonElement>,
    discount = 0,
    couponCode = ''
  ) => {
    if (items.length === 0) return;
    setLoading(true);
    clearSRStorage();

    try {
      const checkoutRef =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const cartData = {
        items: items.map((item) => ({
          variant_id: String(item.variationId ?? item.productId),
          quantity:   item.quantity,
        })),
        discount_amount: discount > 0 ? discount : 0,
      };

      const redirectUrl = `${window.location.origin}/checkout`;
      const timestamp   = new Date().toISOString();

      const res = await fetch('/api/shiprocket/token', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_data:       cartData,
          redirect_url:    redirectUrl,
          timestamp,
          checkout_ref:    checkoutRef,
          coupon_code:     couponCode,
          coupon_discount: discount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert((data as any)?.error?.message ?? (data as any)?.message ?? 'Failed to start checkout. Please try again.');
        return;
      }

      const token =
        (data as any)?.token         ??
        (data as any)?.result?.token ??
        (data as any)?.access_token  ??
        (data as any)?.data?.token;

      if (!token) { alert('Unable to initialize checkout. Please try again.'); return; }

      const srOrderId = extractSROrderId(data as Record<string, unknown>);

      if (typeof window === 'undefined' || typeof window.HeadlessCheckout === 'undefined') {
        alert('Checkout script failed to load. Please refresh and try again.');
        return;
      }

      srSet(SR_STORAGE_KEYS.checkoutRef,    checkoutRef);
      srSet(SR_STORAGE_KEYS.orderId,        srOrderId);
      srSet(SR_STORAGE_KEYS.couponCode,     couponCode);
      srSet(SR_STORAGE_KEYS.couponDiscount, String(discount));
      srSet(SR_STORAGE_KEYS.checkoutActive, '1');

      window.HeadlessCheckout.addToCart(e.nativeEvent, token, {
        fallbackUrl: `${window.location.origin}/checkout`,
      });

      if (srOrderId) startPolling(srOrderId, checkoutRef);

    } catch (err) {
      console.error('[Shiprocket] Checkout error:', err);
      clearSRStorage();
      alert('Checkout initialization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, stopPolling };
}