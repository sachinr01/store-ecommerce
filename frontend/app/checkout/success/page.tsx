'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        .success-bg {
          min-height: 82vh;
          background: #f5f5f3;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .success-card {
          background: #ffffff;
          border-radius: 4px;
          border: 1px solid #e8e2da;
          width: 100%;
          max-width: 640px;
          overflow: hidden;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .success-card.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .success-top-bar {
          height: 3px;
          background: #1a1a1a;
          width: 100%;
        }

        .success-body {
          padding: 56px 48px 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        /* ── PhonePe-style animated check ── */
        .success-icon-outer {
          position: relative;
          width: 90px;
          height: 90px;
          margin-bottom: 32px;
        }

        /* Ripple rings */
        .ripple {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #1a1a1a;
          opacity: 0;
          animation: ripple 2s ease-out infinite;
        }
        .ripple:nth-child(2) { animation-delay: 0.4s; }
        .ripple:nth-child(3) { animation-delay: 0.8s; }
        @keyframes ripple {
          0%   { transform: scale(1);    opacity: 0.5; }
          100% { transform: scale(1.9);  opacity: 0; }
        }

        /* Circle fill */
        .success-circle-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .circle-track {
          fill: none;
          stroke: #ece7df;
          stroke-width: 3;
        }
        .circle-progress {
          fill: none;
          stroke: #1a1a1a;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 226;
          stroke-dashoffset: 226;
          transform: rotate(-90deg);
          transform-origin: center;
          animation: fillCircle 0.7s ease 0.2s forwards;
        }
        @keyframes fillCircle {
          to { stroke-dashoffset: 0; }
        }

        /* Inner filled circle + check */
        .success-icon-inner {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: scale(0);
          animation: popIn 0.35s cubic-bezier(0.175,0.885,0.32,1.4) 0.75s forwards;
        }
        @keyframes popIn {
          to { transform: scale(1); }
        }
        .success-icon-inner svg {
          width: 28px;
          height: 28px;
        }
        .check-path {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: drawCheck 0.35s ease 1.05s forwards;
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }

        .success-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 14px;
          display: block;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.1s forwards;
        }

        .success-title {
          margin: 0 0 14px;
          font-size: 30px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.2;
          letter-spacing: -0.5px;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.2s forwards;
        }

        .success-copy {
          margin: 0 0 24px;
          color: #888;
          font-size: 14px;
          line-height: 1.75;
          max-width: 400px;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.3s forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .success-order-chip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #e8e2da;
          border-radius: 2px;
          padding: 10px 20px;
          font-size: 13px;
          color: #555;
          margin-bottom: 40px;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.4s forwards;
        }
        .success-order-chip strong {
          color: #1a1a1a;
          font-weight: 700;
        }
        .success-order-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #1a1a1a;
          flex-shrink: 0;
        }

        .success-divider {
          border: none;
          border-top: 1px solid #ece7df;
          width: 100%;
          margin: 0 0 36px;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.45s forwards;
        }

        /* ── Track button ── */
        .success-actions {
          width: 100%;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.5s forwards;
        }

        .success-btn-primary {
          position: relative;
          display: block;
          width: 100%;
          padding: 17px 24px;
          background: #1a1a1a;
          color: #fff !important;
          border-radius: 2px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-decoration: none !important;
          text-align: center;
          overflow: hidden;
          box-sizing: border-box;
          transition: background 0.3s;
        }
        .success-btn-primary:hover { background: #2a2a2a; }

        /* Shimmer sweep */
        .success-btn-primary::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255,255,255,0.18) 50%,
            transparent 100%
          );
          animation: shimmer 2.2s ease 2s infinite;
        }
        @keyframes shimmer {
          0%   { left: -80%; }
          60%  { left: 130%; }
          100% { left: 130%; }
        }

        .success-note {
          margin-top: 24px;
          font-size: 12px;
          color: #bbb;
          line-height: 1.6;
          opacity: 0;
          animation: fadeUp 0.4s ease 1.6s forwards;
        }

        @media (max-width: 640px) {
          .success-body { padding: 40px 24px 36px; }
          .success-title { font-size: 24px; }
          .success-icon-outer { width: 76px; height: 76px; }
        }
      `}</style>

      <Header />
      <div className="dima-main">
        <div className="success-bg">
          <div className={`success-card ${show ? 'visible' : ''}`}>
            <div className="success-top-bar" />
            <div className="success-body">

              {/* PhonePe-style animated check */}
              <div className="success-icon-outer">
                <div className="ripple" />
                <div className="ripple" />
                <div className="ripple" />

                <svg className="success-circle-svg" viewBox="0 0 90 90">
                  <circle className="circle-track" cx="45" cy="45" r="36" />
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
                Your order has been placed successfully. We&apos;ll send you a confirmation email with your receipt and tracking details shortly.
              </p>

              {orderId && (
                <div className="success-order-chip">
                  <div className="success-order-chip-dot" />
                  Order Reference &nbsp;<strong>#{orderId}</strong>
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
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center' }}>Loading...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
