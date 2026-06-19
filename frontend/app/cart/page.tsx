'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';
import { formatPrice } from '../lib/price';
import {
  applyCoupon,
  removeCoupon,
  getActiveCoupon,
  getImageUrl,
  type AppliedCoupon,
} from '../lib/api';
import { usePlaceholderImage } from '../lib/siteSettingsContext';
import Script from 'next/script';

// ── Shiprocket HeadlessCheckout global type ───────────────────────────────────
// Injected by https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js
// loaded below (strategy="lazyOnload") on this page only — see the render
// block at the bottom of this file for why it's not in layout.tsx.
declare global {
  interface Window {
    HeadlessCheckout: {
      addToCart: (
        event: Event,
        token: string,
        options: { fallbackUrl: string }
      ) => void;
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
// Keys stored in sessionStorage (NOT localStorage) so they are always cleared
// when the browser tab is closed — preventing stale data from triggering a
// spurious success redirect on the next visit.
const SR_STORAGE_KEYS = {
  checkoutRef:     'sr_checkout_ref',
  orderId:         'sr_order_id',
  couponCode:      'sr_coupon_code',
  couponDiscount:  'sr_coupon_discount',
  checkoutActive:  'sr_checkout_active',   // flag: iframe is currently open
} as const;

const MAX_POLL_ATTEMPTS = 72; // 72 × 2.5 s = 3 min max

export default function CartPage() {
  const PLACEHOLDER     = usePlaceholderImage();
  const { items, removeItem, updateQty, total, clearCart } = useCart();
  const router          = useRouter();

  // ── Coupon state ──────────────────────────────────────────────────────────
  const [couponInput,   setCouponInput]   = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg,     setCouponMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // ── Checkout state ────────────────────────────────────────────────────────
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // ── Polling refs ──────────────────────────────────────────────────────────
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  // ─────────────────────────────────────────────────────────────────────────
  // On mount: clean up any stale SR storage from previous sessions,
  // then restore the active coupon from the server session.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // CRITICAL FIX: clear leftover SR keys from any previous checkout attempt.
    // Without this, stale sr_order_id causes the cart page to immediately start
    // polling and redirect to success the moment it mounts.
    clearSRStorage();

    // Restore coupon from server session (survives page refresh)
    getActiveCoupon()
      .then((c) => {
        if (c) {
          setAppliedCoupon(c);
          setCouponInput(c.code);
        }
      })
      .catch(() => {}); // non-fatal

    return () => stopPolling();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed totals
  // ─────────────────────────────────────────────────────────────────────────
  const discount   = appliedCoupon?.discount ?? 0;
  const orderTotal = Math.max(0, total - discount);

  // ─────────────────────────────────────────────────────────────────────────
  // SR sessionStorage helpers
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Use sessionStorage so keys die with the tab/session.
   * Falls back to a no-op if sessionStorage is unavailable (SSR guard).
   */
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

  // ─────────────────────────────────────────────────────────────────────────
  // Polling helpers
  // ─────────────────────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  };

  /**
   * Call our backend to check if Shiprocket has confirmed the order.
   * Returns true ONLY after we've created the DB order and redirected.
   *
   * Key guard: we only call this when `sr_checkout_active` flag is set,
   * meaning the iframe was actually opened in this session.
   */
  const finalizeCheckout = async (srOrderId: string, checkoutRef: string): Promise<boolean> => {
    if (!srOrderId) return false;

    // SAFETY: only poll if the iframe was genuinely opened this session
    if (srGet(SR_STORAGE_KEYS.checkoutActive) !== '1') {
      stopPolling();
      return false;
    }

    try {
      const res = await fetch('/api/shiprocket/complete-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: srOrderId, checkout_ref: checkoutRef }),
      });

      // 202 = Shiprocket hasn't confirmed yet → keep polling
      if (res.status === 202) return false;

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        // Pending or error — keep polling
        return false;
      }

      // Order created in DB — stop, clean up, redirect
      stopPolling();
      clearSRStorage();
      try { await clearCart(); } catch { /* non-fatal */ }
      router.push(`/checkout/success?order=${encodeURIComponent(String(data?.order_id ?? srOrderId))}`);
      return true;
    } catch {
      return false; // network error — keep polling
    }
  };

  const startPolling = (srOrderId: string, checkoutRef: string) => {
    stopPolling();
    pollAttemptsRef.current = 0;

    const tick = async () => {
      pollAttemptsRef.current += 1;
      const done = await finalizeCheckout(srOrderId, checkoutRef);
      if (done || pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        stopPolling();
      }
    };

    // First check after 3 s (give Shiprocket time to process after payment)
    // then every 2.5 s thereafter
    const initialDelay = setTimeout(() => {
      void tick();
      pollIntervalRef.current = setInterval(() => void tick(), 2500);
    }, 3000);

    // Store the timeout so we can clear it on unmount
    pollIntervalRef.current = initialDelay as unknown as ReturnType<typeof setInterval>;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SR order_id extractor
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Coupon handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponMsg(null);
    const data = await applyCoupon(couponInput.trim());
    setCouponLoading(false);
    if (data.success && data.data) {
      setAppliedCoupon(data.data);
      setCouponMsg({
        text: data.message || `Coupon "${data.data.code}" applied! You save ${formatPrice(data.data.discount)}.`,
        ok: true,
      });
    } else {
      setAppliedCoupon(null);
      setCouponMsg({ text: data.message || 'Invalid coupon.', ok: false });
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Slug helper
  // ─────────────────────────────────────────────────────────────────────────
  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // ─────────────────────────────────────────────────────────────────────────
  // Shiprocket Headless Checkout
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Full flow:
   *
   * 1.  Generate a unique checkout_ref (idempotency + coupon lookup key).
   * 2.  POST /api/shiprocket/token → backend signs HMAC, calls Shiprocket,
   *     persists checkout context (cart, coupon, user) to DB, returns { token, order_id }.
   * 3.  Set sr_checkout_active = '1' in sessionStorage.
   * 4.  Call window.HeadlessCheckout.addToCart(nativeEvent, token, { fallbackUrl })
   *     → Shiprocket iframe opens over the current page.
   * 5.  Start polling /api/shiprocket/complete-checkout every 2.5 s.
   *     → When Shiprocket confirms the order, backend creates DB order and returns success.
   * 6.  On poll success → clear cart → redirect to /checkout/success?order=DB_ORDER_ID.
   * 7.  If Shiprocket redirects the browser first (via redirect_url=/checkout?order_id=…),
   *     checkout/page.tsx handles that via srOrderId state (CHANGE 1 + CHANGE 2 patch).
   * 8.  On iframe failure → fallbackUrl = /checkout (native checkout form).
   */
  const handleCheckout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (items.length === 0) return;
    setCheckoutLoading(true);

    try {
      // 1. Fresh checkout ref for this attempt
      const checkoutRef =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 2. Build cart payload
      const cartData = {
        items: items.map((item) => ({
          variant_id: String(item.variationId ?? item.productId),
          quantity:   item.quantity,
        })),
      };

      // redirect_url = /checkout (not /success) so the checkout page's
      // useEffect can detect ?order_id= and show the animated success card.
      // The polling path goes to /checkout/success directly with the DB order id.
      const redirectUrl = `${window.location.origin}/checkout`;
      const timestamp   = new Date().toISOString();

      // 3. Get access token from backend
      const res = await fetch('/api/shiprocket/token', {
        method:      'POST',
        credentials: 'include',
        headers: {
          'Accept':       'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cart_data:       cartData,
          redirect_url:    redirectUrl,
          timestamp,
          checkout_ref:    checkoutRef,
          coupon_code:     appliedCoupon?.code    ?? '',
          coupon_discount: discount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[Shiprocket] Token API error:', data);
        alert(
          (data as any)?.error?.message ??
          (data as any)?.message ??
          'Failed to start checkout. Please try again.'
        );
        return;
      }

      const token =
        (data as any)?.token         ??
        (data as any)?.result?.token ??
        (data as any)?.access_token  ??
        (data as any)?.data?.token;

      if (!token) {
        console.error('[Shiprocket] No token in response:', data);
        alert('Unable to initialize checkout. Please try again.');
        return;
      }

      const srOrderId = extractSROrderId(data as Record<string, unknown>);

      // 4. Guard: HeadlessCheckout must be loaded (strategy="beforeInteractive")
      if (typeof window === 'undefined' || typeof window.HeadlessCheckout === 'undefined') {
        console.error('[Shiprocket] HeadlessCheckout not on window');
        alert('Checkout script failed to load. Please refresh and try again.');
        return;
      }

      // 5. Persist to sessionStorage BEFORE opening the iframe
      srSet(SR_STORAGE_KEYS.checkoutRef,    checkoutRef);
      srSet(SR_STORAGE_KEYS.orderId,        srOrderId);
      srSet(SR_STORAGE_KEYS.couponCode,     appliedCoupon?.code ?? '');
      srSet(SR_STORAGE_KEYS.couponDiscount, String(discount));
      // CRITICAL: flag that iframe is open — prevents spurious polling
      srSet(SR_STORAGE_KEYS.checkoutActive, '1');

      // 6. Open Shiprocket iframe
      // IMPORTANT: pass e.nativeEvent (raw DOM Event), not React's synthetic event
      window.HeadlessCheckout.addToCart(e.nativeEvent, token, {
        fallbackUrl: `${window.location.origin}/checkout`,
      });

      // 7. Start polling only if we got an SR order_id
      if (srOrderId) {
        startPolling(srOrderId, checkoutRef);
      }

    } catch (err) {
      console.error('[Shiprocket] Checkout error:', err);
      clearSRStorage();
      alert('Checkout initialization failed. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        ── Shiprocket Checkout scripts ──────────────────────────────────────────
        Loaded ONLY on the cart page — not globally in layout.tsx.
        Loading them globally caused Shiprocket's shopify.js to auto-initialize
        and show its bottom popup widget on every page of the site.

        strategy="lazyOnload" defers loading until after the page is interactive,
        so it does not block the cart page render. HeadlessCheckout is available
        well before the user clicks the checkout button.

        #sellerDomain is the DOM element Shiprocket's script reads to scope the
        checkout session. It must be present BEFORE the script runs.
      */}
      <input type="hidden" value="nestcase.in" id="sellerDomain" />
      <link
        rel="stylesheet"
        href="https://checkout-ui.shiprocket.com/assets/styles/shopify.css"
      />
      <Script
        src="https://checkout-ui.shiprocket.com/assets/js/channels/shopify.js"
        strategy="lazyOnload"
      />

      <Header />
      <div className="dima-main cart-page">

        <nav className="cart-breadcrumb">
          <Link href="/">Home</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <Link href="/shop">Shop</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <span className="cart-breadcrumb-current">Cart</span>
        </nav>

        <div className="cart-content">
          <div className="container">

            {items.length === 0 ? (
              <div className="cart-empty">
                <p>Your cart is empty.</p>
                <Link href="/shop" className="btn-view-product btn-view-product--inline">
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <div className="cart-grid">

                {/* ── Cart item list ─────────────────────────────────── */}
                <div>
                  <div className="cart-list">
                    {items.map((item) => (
                      <article key={item.cartItemId} className="cart-item">
                        <img
                          src={getImageUrl(item.image, PLACEHOLDER)}
                          alt={item.title}
                          className="cart-item-thumb"
                          onError={(ev) => {
                            (ev.target as HTMLImageElement).src = PLACEHOLDER;
                          }}
                        />

                        <div className="cart-item-main">
                          <div className="cart-item-top">
                            <button
                              type="button"
                              className="cart-remove"
                              title="Remove"
                              aria-label={`Remove ${item.title}`}
                              onClick={() => removeItem(item.cartItemId)}
                            >
                              ×
                            </button>
                          </div>

                          <div className="cart-item-details">
                            <div className="cart-detail cart-detail--product">
                              <h5 className="cart-item-title">
                                <Link
                                  href={`/shop/product/${toSlug(item.title)}`}
                                  className="cart-item-title-link"
                                >
                                  {item.title}
                                </Link>
                              </h5>
                              {(item.color || item.size) && (
                                <div className="cart-item-meta">
                                  {item.color && <div>Color: {item.color}</div>}
                                  {item.size  && <div>Size: {item.size}</div>}
                                </div>
                              )}
                              <h6 className="cart-detail-price">{formatPrice(item.price)}</h6>
                            </div>

                            <div className="cart-detail cart-detail--qty">
                              <div className="cart-qty">
                                <button
                                  type="button"
                                  onClick={() => updateQty(item.cartItemId, item.quantity - 1)}
                                  aria-label={`Decrease quantity of ${item.title}`}
                                >−</button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  min={1}
                                  onChange={(ev) =>
                                    updateQty(item.cartItemId, parseInt(ev.target.value, 10) || 1)
                                  }
                                  aria-label={`Quantity of ${item.title}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQty(item.cartItemId, item.quantity + 1)}
                                  aria-label={`Increase quantity of ${item.title}`}
                                >+</button>
                              </div>
                            </div>

                            <div className="cart-detail cart-detail--total">
                              <span className="cart-detail-value">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="cart-actions">
                    <Link href="/shop" className="btn-view-product btn-view-product--inline">
                      ← Continue Shopping
                    </Link>
                  </div>
                </div>

                {/* ── Order summary sidebar ───────────────────────────── */}
                <aside className="cart-summary">
                  <h4 className="cart-summary-title">Your Order</h4>

                  {/* Coupon */}
                  <h5 className="cart-coupon-label">Have a coupon?</h5>
                  <div className="cart-coupon">
                    <input
                      type="text"
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      disabled={!!appliedCoupon}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleApplyCoupon();
                        }
                      }}
                    />
                    {appliedCoupon ? (
                      <button
                        type="button"
                        className="btn-view-product btn-view-product--inline cart-coupon-remove-btn"
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-view-product btn-view-product--inline cart-coupon-apply-btn"
                        onClick={() => void handleApplyCoupon()}
                        disabled={couponLoading}
                      >
                        {couponLoading ? '...' : 'Apply'}
                      </button>
                    )}
                  </div>

                  {couponMsg && (
                    <p className={`cart-coupon-msg ${couponMsg.ok ? 'success' : 'error'}`}>
                      {couponMsg.text}
                    </p>
                  )}

                  {/* Totals */}
                  <div className="cart-summary-table">
                    <div className="cart-summary-row">
                      <span>Cart Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>

                    {discount > 0 && (
                      <div className="cart-summary-row discount">
                        <span>Discount ({appliedCoupon?.code})</span>
                        <span>−{formatPrice(discount)}</span>
                      </div>
                    )}

                    <div className="cart-summary-row total">
                      <span>Order Total</span>
                      <span>{formatPrice(orderTotal)}</span>
                    </div>
                  </div>

                  {/* Checkout button */}
                  <div className="cart-checkout-wrap">
                    <button
                      type="button"
                      className="btn-view-product btn-view-product--inline cart-checkout-link"
                      onClick={handleCheckout}
                      disabled={checkoutLoading || items.length === 0}
                    >
                      {checkoutLoading ? 'Starting Checkout…' : 'Proceed to Checkout'}
                    </button>
                  </div>
                </aside>

              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
