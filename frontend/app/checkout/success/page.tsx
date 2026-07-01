'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

function OrderSuccessContent() {
  const searchParams = useSearchParams();

  // DB order_id — used to fetch Wigzo event data.
  // Both checkout paths now pass this as `order`:
  //   • Shiprocket checkout  → useShiprocketCheckout.ts pushes ?order=<db_id>&sr_cart_id=<sr_id>
  //   • Direct/Razorpay      → checkout/page.tsx pushes ?order=<db_id>
  const dbOrderId = searchParams.get('order') ?? null;

  // Customer-facing reference — shown in the Order Reference chip.
  // Shiprocket flow passes sr_cart_id separately; direct flow only has order.
  const srCartId =
    searchParams.get('sr_cart_id') ??
    searchParams.get('oid') ??
    dbOrderId ??
    null;

  const [show, setShow] = useState(false);
  const wigzoFiredRef = useRef(false);

  // Fade-in animation
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ── Wigzo `order` event — PDF trigger point: Thank You Page ──────────────
  // Fires once per page load, client-side, exactly as the PDF documents:
  //   wigzo("track", "order", { orderId, phone, fullName, ... })
  // Fetches real order data from our backend using the DB order_id,
  // then calls wigzoOrder() from wigzo.ts.
  useEffect(() => {
    if (!dbOrderId || wigzoFiredRef.current) return;
    wigzoFiredRef.current = true;

    const fireWigzoOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${dbOrderId}/wigzo-data`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.success || !json?.data) return;
        const { wigzoOrder } = await import('../../lib/wigzo');
        wigzoOrder(json.data);
      } catch {
        // Non-fatal — never break the success page for a tracking call.
      }
    };

    void fireWigzoOrder();
  }, [dbOrderId]);

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
                  Order Reference &nbsp;<strong>#{srCartId}</strong>
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
