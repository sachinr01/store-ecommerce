'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

function OrderSuccessContent() {
  const searchParams = useSearchParams();

  // Show sr_cart_id from our redirect param
  const srCartId =
    searchParams.get('sr_cart_id') ??
    null;

  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

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
