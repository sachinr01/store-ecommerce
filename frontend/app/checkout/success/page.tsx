'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useCart } from '../../lib/cartContext';

function OrderSuccessContent() {
  const searchParams = useSearchParams();

  const dbOrderId = searchParams.get('order') ?? null;

  // Customer-facing reference — shown in the Order Reference chip.
  // Shiprocket flow passes sr_cart_id separately; direct flow only has order.
  const srCartId =
    searchParams.get('sr_cart_id') ??
    searchParams.get('oid') ??
    dbOrderId ??
    null;

  const { clearCart } = useCart();
  const [show, setShow] = useState(false);
  const wigzoFiredRef = useRef(false);
  const cartClearedRef = useRef(false);

  const isPending = !dbOrderId;
  const [pendingTimedOut, setPendingTimedOut] = useState(false);

  useEffect(() => {
    if (!isPending) return;
    const t = setTimeout(() => setPendingTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, [isPending]);

  // Fade-in animation
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ── Clear cart once on success ───────────────────────────────────────────
  // Covers the direct/Razorpay path where clearCart isn't called before redirect.
  // Shiprocket flow already clears before redirect, but calling it again is safe
  // since clearing an empty cart is a no-op. Only runs once we have a confirmed order.
  useEffect(() => {
    if (isPending || cartClearedRef.current) return;
    cartClearedRef.current = true;
    clearCart().catch((err) => {
      console.error('[checkout/success] clearCart failed:', err);
    });
  }, [isPending, clearCart]);

  // ── Wigzo `order` + `buy` events — PDF trigger point: Thank You Page ─────
  // Fires once per page load, client-side, exactly as the PDF documents:
  //   wigzo("track", "order", { orderId, phone, fullName, ... })
  //   wigzo("track", "buy", ["productId1", "productId2"])   ← optional, point 7
  // Both fire on the same page (Thank You) using the same fetched order data.
  // Fetches real order data from our backend using the DB order_id,
  // then calls wigzoOrder() and wigzoBuy() from wigzo.ts.
  useEffect(() => {
    if (!dbOrderId || wigzoFiredRef.current) return;
    wigzoFiredRef.current = true;

    const fireWigzoOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${dbOrderId}/wigzo-data`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success || !json?.data) return;
        const { wigzoOrder, wigzoBuy } = await import('../../lib/wigzo');
        wigzoOrder(json.data);
        if (Array.isArray(json.data.productIds) && json.data.productIds.length > 0) {
          wigzoBuy(json.data.productIds);
        }
      } catch {
        // Non-fatal — never break the success page for a tracking call.
      }
    };

    void fireWigzoOrder();
  }, [dbOrderId]);

  if (isPending) {
    return (
      <>
        <Header />
        <div className="dima-main">
          <div className="success-bg">
            <div className={`success-card ${show ? 'visible' : ''}`}>
              <div className="success-top-bar" />
              <div className="success-body">
                <div className="success-icon-outer">
                  <div className="ripple" />
                  <div className="ripple" />
                  <div className="ripple" />
                  <div className="success-icon-inner">
                    {/* Simple spinner — order isn't confirmed yet */}
                    <svg viewBox="0 0 28 28" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="14" cy="14" r="10" stroke="#fff" strokeWidth="2.5" strokeDasharray="47" strokeDashoffset="16" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <span className="success-label">Confirming Order</span>
                <h3 className="success-title">Just a moment…</h3>
                <p className="success-copy">
                  We&apos;re confirming your order with our payment/checkout partner.
                  This usually takes just a few seconds — please don&apos;t close this page.
                </p>

                {pendingTimedOut && (
                  <>
                    <hr className="success-divider" />
                    <p className="success-copy">
                      This is taking longer than usual. Your order may already be placed —
                      you can check its status here.
                    </p>
                    <div className="success-actions">
                      <Link href="/orders" className="success-btn-primary">
                        Check My Orders
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Footer />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="dima-main">
        <div className="success-bg">
          <div className={`success-card ${show ? 'visible' : ''}`}>
            <div className="success-top-bar" />
            <div className="success-body">

              {/* Animated check circle */}
              <div className="success-icon-outer">
                <div className="ripple" />
                <div className="ripple" />
                <div className="ripple" />

                <svg className="success-circle-svg" viewBox="0 0 90 90">
                  <circle className="circle-track"    cx="45" cy="45" r="36" />
                  <circle className="circle-progress" cx="45" cy="45" r="36" />
                </svg>

                <div className="success-icon-inner">
                  <svg viewBox="0 0 28 28" fill="none">
                    <path
                      className="check-path"
                      d="M6 14 L11.5 19.5 L22 8"
                      stroke="#fff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <span className="success-label">Order Confirmed</span>
              <h3 className="success-title">Thank you for your order.</h3>
              <p className="success-copy">
                Your order has been placed successfully. We&apos;ll send you a confirmation
                email with your receipt and tracking details shortly.
              </p>

              {srCartId && (
                <div className="success-order-chip">
                  <div className="success-order-chip-dot" />
                  Order Reference &nbsp;<strong>{srCartId}</strong>
                </div>
              )}

              <hr className="success-divider" />

              <div className="success-actions">
                <Link href="/orders" className="success-btn-primary">
                  Track My Order
                </Link>
              </div>

              <p className="success-note">
                Questions? Reach out to our support team — we&apos;re happy to help.
              </p>

            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="success-loading">Loading...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
