'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { getMyOrderById } from '../../lib/api';
import { useAuth } from '../../lib/authContext';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizeStatus(status: string) {
  if (!status) return 'pending';
  const s = status.replace('wc-', '').toLowerCase();
  if (s.includes('complete')) return 'completed';
  if (s.includes('process')) return 'processing';
  if (s.includes('ship')) return 'shipped';
  if (s.includes('pending')) return 'pending';
  return s;
}

export default function OrderTrackingPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [billingEmail, setBillingEmail] = useState(user?.email || '');
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    id: number;
    status: string;
    dateLabel: string;
    totalLabel: string;
    billingEmail: string;
    name: string;
  } | null>(null);

  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';

  const handleTrack = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orderId.trim()) {
      setError('Please enter your order ID.');
      setResult(null);
      return;
    }
    if (!billingEmail.trim()) {
      setError('Please enter the billing email used during checkout.');
      setResult(null);
      return;
    }

    setLoadingTrack(true);
    setError('');
    setResult(null);

    try {
      const detail = await getMyOrderById(orderId.trim());
      const order = detail.order;
      const orderEmail = (order.billing_email || order.user_email || '').trim().toLowerCase();
      const submittedEmail = billingEmail.trim().toLowerCase();

      if (orderEmail && submittedEmail && orderEmail !== submittedEmail) {
        setError('The billing email does not match this order.');
        return;
      }

      const name = [order.ship_first_name, order.ship_last_name].filter(Boolean).join(' ').trim()
        || [order.billing_first_name, order.billing_last_name].filter(Boolean).join(' ').trim()
        || order.user_display_name
        || 'Customer';

      setResult({
        id: Number(order.order_id),
        status: normalizeStatus(order.order_status || ''),
        dateLabel: formatDate(order.order_date || ''),
        totalLabel: order.total ? `Rs. ${Number(order.total).toFixed(2)}` : 'Rs. 0.00',
        billingEmail: orderEmail || submittedEmail,
        name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not track this order.');
    } finally {
      setLoadingTrack(false);
    }
  };

  return (
    <>
      <style>{`
        .tracking-page {
          padding-bottom: 48px;
        }

        .tracking-shell {
          overflow: hidden;
          background: #fff;
        }

        .tracking-layout {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          align-items: start;
        }

        .tracking-sidebar {
          min-height: 100%;
          padding: 60px 42px 48px;
          background: #fff;
        }

        .tracking-sidebar-inner {
          position: sticky;
          top: 104px;
        }

        .tracking-avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .tracking-hello {
          margin: 28px 0 10px;
          color: #000;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .tracking-handle {
          margin: 0;
          color: #42556d;
          font-size: 18px;
          line-height: 1.5;
        }

        .tracking-nav {
          display: grid;
          gap: 8px;
          margin-top: 66px;
        }

        .tracking-link,
        .tracking-button {
          display: block;
          padding: 2px 0;
          border: 0;
          background: transparent;
          color: #121212;
          text-decoration: none;
          text-align: left;
          font-size: 17px;
          line-height: 1.45;
          cursor: pointer;
        }

        .tracking-link:hover,
        .tracking-button:hover,
        .tracking-link.active {
          color: #111;
        }

        .tracking-main {
          min-width: 0;
          padding: 44px 56px 48px 36px;
          background: #fff;
        }

        .tracking-top {
          margin-bottom: 0;
        }

        .tracking-copy {
          max-width: 900px;
          margin: 0 auto;
          color: #33465c;
          font-size: 18px;
          line-height: 1.7;
          text-align: center;
        }

        .tracking-panel {
          margin-top: 46px;
          padding-top: 34px;
          border-top: 1px solid #ece8df;
        }

        .tracking-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 230px;
          gap: 10px;
          align-items: end;
        }

        .tracking-field label {
          display: block;
          margin-bottom: 10px;
          color: #111;
          font-size: 16px;
          line-height: 1.4;
        }

        .tracking-field input {
          width: 100%;
          min-height: 76px;
          padding: 16px 22px;
          border: 1px solid #ddd8cf;
          background: #fff;
          color: #465468;
          font-size: 15px;
          outline: none;
        }

        .tracking-field input:focus {
          border-color: #14544f;
          box-shadow: 0 0 0 3px rgba(20, 84, 79, 0.08);
        }

        .tracking-action .button {
          width: 100%;
          min-height: 76px;
          font-size: 15px;
          letter-spacing: 0.1em;
          background: #172233;
        }

        .tracking-message {
          margin-top: 18px;
          padding: 14px 16px;
          border: 1px solid #ece8df;
          background: #fff;
          color: #5f6977;
          font-size: 14px;
          line-height: 1.6;
        }

        .tracking-message.error {
          color: #9b1c1c;
          border-color: #efcaca;
          background: #fff5f5;
        }

        .tracking-result {
          margin-top: 22px;
          padding: 24px 0 0;
          border-top: 1px solid #ece8df;
          background: #fff;
        }

        .tracking-result-title {
          margin: 0 0 14px;
          color: #111;
          font-size: 18px;
          font-weight: 700;
        }

        .tracking-result-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .tracking-result-item {
          padding: 14px;
          border: 1px solid #ece8df;
          background: #fcfbf8;
        }

        .tracking-result-item span {
          display: block;
          margin-bottom: 6px;
          color: #7a7a7a;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .tracking-result-item strong {
          color: #111;
          font-size: 15px;
          font-weight: 600;
        }

        .tracking-result-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        @media (max-width: 991px) {
          .tracking-layout,
          .tracking-form,
          .tracking-result-grid {
            grid-template-columns: 1fr;
          }

          .tracking-sidebar {
            padding-bottom: 28px;
          }

          .tracking-sidebar-inner {
            position: static;
          }

        }

        @media (max-width: 767px) {
          .tracking-sidebar,
          .tracking-main {
            padding: 18px;
          }

          .tracking-copy {
            font-size: 16px;
            margin-top: 18px;
          }

          .tracking-action .button,
          .tracking-result-actions .button {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main tracking-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : !isLoggedIn || !user ? (
                <div className="tracking-message">
                  Please log in to track an order from your account.
                  <div style={{ marginTop: 16 }}>
                    <Link href="/my-account" className="button fill uppercase">Login / Register</Link>
                  </div>
                </div>
              ) : (
                <div className="tracking-shell">
                  <div className="tracking-layout">
                    <aside className="tracking-sidebar">
                      <div className="tracking-sidebar-inner">
                        <div className="tracking-avatar" aria-hidden="true">
                          <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h3 className="tracking-hello">Hello</h3>
                        <p className="tracking-handle">{accountHandle}</p>

                        <nav className="tracking-nav" aria-label="Account navigation">
                          <Link href="/my-account" className="tracking-link">Dashboard</Link>
                          <Link href="/my-account/edit-account" className="tracking-link">Edit Profile</Link>
                          <Link href="/my-account/edit-address" className="tracking-link">My Addresses</Link>
                          <Link href="/orders" className="tracking-link">My Orders</Link>
                          <Link href="/my-account/order-tracking" className="tracking-link active">Order Tracking</Link>
                          <Link href="/wishlist" className="tracking-link">Wishlist</Link>
                          <button className="tracking-button" onClick={logout}>Logout</button>
                        </nav>
                      </div>
                    </aside>

                    <div className="tracking-main">
                      <div className="tracking-top">
                        <div style={{ width: '100%' }}>
                          <p className="tracking-copy">
                            To track your order please enter your Order ID in the box below and press the &quot;Track&quot; button.
                            This was given to you on your receipt and in the confirmation email you should have received.
                          </p>
                        </div>
                      </div>

                      <div className="tracking-panel">
                        <form className="tracking-form" onSubmit={handleTrack} noValidate>
                          <div className="tracking-field">
                            <label>Order ID</label>
                            <input
                              type="text"
                              placeholder="Found in your order confirmation email."
                              value={orderId}
                              onChange={(e) => setOrderId(e.target.value)}
                            />
                          </div>

                          <div className="tracking-field">
                            <label>Billing email</label>
                            <input
                              type="email"
                              placeholder="Email you used during checkout."
                              value={billingEmail}
                              onChange={(e) => setBillingEmail(e.target.value)}
                            />
                          </div>

                          <div className="tracking-action">
                            <button type="submit" className="button fill uppercase" disabled={loadingTrack}>
                              {loadingTrack ? 'Tracking...' : 'Track'}
                            </button>
                          </div>
                        </form>

                        {error && <div className="tracking-message error">{error}</div>}

                        {result && (
                          <div className="tracking-result">
                            <h3 className="tracking-result-title">Tracked Order #{result.id}</h3>

                            <div className="tracking-result-grid">
                              <div className="tracking-result-item">
                                <span>Status</span>
                                <strong style={{ textTransform: 'capitalize' }}>{result.status}</strong>
                              </div>
                              <div className="tracking-result-item">
                                <span>Placed</span>
                                <strong>{result.dateLabel}</strong>
                              </div>
                              <div className="tracking-result-item">
                                <span>Total</span>
                                <strong>{result.totalLabel}</strong>
                              </div>
                              <div className="tracking-result-item">
                                <span>Billing Email</span>
                                <strong>{result.billingEmail || billingEmail}</strong>
                              </div>
                            </div>

                            <div className="tracking-result-actions">
                              <Link href={`/orders/${result.id}`} className="button fill uppercase">Open Order</Link>
                              <Link href="/orders" className="button stroke uppercase">View All Orders</Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
