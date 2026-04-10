'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getMyOrders, type OrderSummary } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatPrice } from '../lib/price';

type OrderCard = {
  id: number;
  status: string;
  statusLabel: string;
  dateLabel: string;
  totalLabel: string;
  items: string[];
};

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
  if (s.includes('pending')) return 'pending';
  return s;
}

function toTitleCase(value: string) {
  if (!value) return 'Pending';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function OrdersPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      setLoading(true);
      setError('');
      setNeedsLogin(false);

      try {
        const data = await getMyOrders();
        if (!active) return;
        setOrders(data || []);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load orders.';
        setError(msg);
        if (msg.includes('401') || msg.toLowerCase().includes('login')) {
          setNeedsLogin(true);
        }
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';

  const cards: OrderCard[] = useMemo(() => (
    (orders || []).map((o) => {
      const status = normalizeStatus(o.order_status || '');
      return {
        id: Number(o.order_id),
        status,
        statusLabel: toTitleCase(status),
        dateLabel: formatDate(o.order_date || ''),
        totalLabel: o.total ? formatPrice(Number(o.total)) : formatPrice(0),
        items: (o.items || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    })
  ), [orders]);

  return (
    <>
      <style>{`
        .orders-account-page {
          padding-bottom: 48px;
        }

        .orders-account-shell {
          overflow: hidden;
          background: #fff;
        }

        .orders-account-layout {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          align-items: start;
        }

        .orders-account-sidebar {
          min-height: 100%;
          padding: 60px 42px 48px;
          background: #fff;
        }

        .orders-account-sidebar-inner {
          position: sticky;
          top: 104px;
        }

        .orders-account-avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .orders-account-hello {
          margin: 28px 0 10px;
          color: #000;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .orders-account-handle {
          margin: 0;
          color: #42556d;
          font-size: 18px;
          line-height: 1.5;
        }

        .orders-account-nav {
          display: grid;
          gap: 8px;
          margin-top: 66px;
        }

        .orders-account-link,
        .orders-account-button {
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

        .orders-account-link:hover,
        .orders-account-button:hover,
        .orders-account-link.active {
          color: #111;
        }

        .orders-account-main {
          min-width: 0;
          padding: 44px 56px 48px 36px;
          background: #fff;
        }

        .orders-account-top {
          margin-bottom: 28px;
        }

        .orders-section {
          margin-top: 0;
          padding: 0;
        }

        .orders-section-title {
          margin: 0 0 10px;
          color: #101010;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 700;
        }

        .orders-section-copy {
          margin: 0 0 18px;
          color: #5f6977;
          font-size: 14px;
          line-height: 1.7;
        }

        .orders-table {
          width: 100%;
          border-top: 1px solid #ece8df;
          max-width: 980px;
        }

        .orders-head,
        .orders-row {
          display: grid;
          grid-template-columns: minmax(88px, 108px) minmax(165px, 1.15fr) minmax(110px, .78fr) minmax(150px, .95fr) minmax(170px, 1fr);
          gap: 18px;
          align-items: center;
        }

        .orders-head {
          padding: 14px 0;
          border-bottom: 1px solid #ece8df;
        }

        .orders-head-item {
          color: #0c0c0c;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .orders-row {
          padding: 20px 0;
          border-bottom: 1px solid #ece8df;
        }

        .orders-row-id {
          color: #111;
          font-size: 15px;
          font-weight: 700;
        }

        .orders-row-value {
          color: #516276;
          font-size: 15px;
          line-height: 1.6;
        }

        .orders-row-status {
          color: #516276;
          font-size: 15px;
          line-height: 1.6;
        }

        .orders-row-status.pending {
          color: #8a5a13;
        }

        .orders-row-status.processing {
          color: #11606c;
        }

        .orders-row-status.completed {
          color: #1d6a34;
        }

        .orders-row-status.cancelled {
          color: #9b1c1c;
        }

        .orders-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-start;
        }

        .orders-empty,
        .orders-error {
          padding: 24px 0;
          color: #5f6977;
          font-size: 14px;
          line-height: 1.7;
        }

        .orders-empty-actions,
        .orders-login-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 16px;
        }

        .orders-empty-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 96px;
          padding: 18px 38px;
          border: 1px solid #ece8df;
          background: #fff;
        }

        .orders-empty-text {
          color: #5f6977;
          font-size: 17px;
          line-height: 1.7;
        }

        .orders-empty-cta {
          min-width: 276px;
          min-height: 58px;
          padding: 16px 24px;
          background: #172233;
          color: #fff;
          text-decoration: none;
          text-align: center;
          font-size: 14px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .orders-empty-cta:hover {
          background: #0f1827;
          color: #fff;
        }

        .orders-action-btn {
          min-width: 92px;
          min-height: 40px;
          padding: 10px 14px;
          background: #172233;
          color: #fff;
          text-decoration: none;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .orders-action-btn:hover {
          background: #0f1827;
          color: #fff;
        }

        @media (max-width: 991px) {
          .orders-account-layout {
            grid-template-columns: 1fr;
          }

          .orders-account-sidebar {
            padding-bottom: 28px;
          }

          .orders-account-sidebar-inner {
            position: static;
          }

        }

        @media (max-width: 767px) {
          .orders-account-sidebar,
          .orders-account-main {
            padding: 18px;
          }

          .orders-account-copy {
            font-size: 16px;
            line-height: 1.7;
          }

          .orders-head {
            display: none;
          }

          .orders-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 18px 0;
          }

          .orders-table {
            max-width: none;
          }

          .orders-empty-panel {
            flex-direction: column;
            align-items: stretch;
            padding: 18px;
          }

          .orders-empty-text {
            font-size: 16px;
          }

          .orders-empty-cta {
            width: 100%;
            min-width: 0;
          }

          .orders-empty-actions .button,
          .orders-login-actions .button {
            width: 100%;
            text-align: center;
          }

          .orders-actions {
            margin-top: 4px;
          }

          .orders-action-btn {
            width: 100%;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main orders-account-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : !isLoggedIn || !user || needsLogin ? (
                <div className="orders-empty">
                  Please log in to view your orders.
                  <div className="orders-empty-actions">
                    <Link className="button fill uppercase" href="/my-account">Login / Register</Link>
                  </div>
                </div>
              ) : (
                <div className="orders-account-shell">
                  <div className="orders-account-layout">
                    <aside className="orders-account-sidebar">
                      <div className="orders-account-sidebar-inner">
                        <div className="orders-account-avatar" aria-hidden="true">
                          <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h3 className="orders-account-hello">Hello</h3>
                        <p className="orders-account-handle">{accountHandle}</p>

                        <nav className="orders-account-nav" aria-label="Account navigation">
                          <Link href="/my-account" className="orders-account-link">Dashboard</Link>
                          <Link href="/my-account/edit-account" className="orders-account-link">Edit Profile</Link>
                          <Link href="/my-account/edit-address" className="orders-account-link">My Addresses</Link>
                          <Link href="/orders" className="orders-account-link active">My Orders</Link>
                          <Link href="/wishlist" className="orders-account-link">Wishlist</Link>
                          <button className="orders-account-button" onClick={logout}>Logout</button>
                        </nav>
                      </div>
                    </aside>

                    <div className="orders-account-main">
                      <div className="orders-account-top" />

                      <div className="orders-section">
                        {cards.length > 0 && (
                          <>
                            <h3 className="orders-section-title">Orders</h3>
                            <p className="orders-section-copy">
                              You currently have {cards.length} order{cards.length === 1 ? '' : 's'} in your account.
                            </p>
                          </>
                        )}

                        {loading && <div className="orders-empty">Loading your orders...</div>}

                        {!loading && error && !needsLogin && (
                          <div className="orders-error">{error}</div>
                        )}

                        {!loading && !error && cards.length === 0 && (
                          <div className="orders-empty-panel">
                            <div className="orders-empty-text">No order has been made yet.</div>
                            <Link className="orders-empty-cta" href="/shop">Browse Products</Link>
                          </div>
                        )}

                        {!loading && !error && cards.length > 0 && (
                          <div className="orders-table">
                            <div className="orders-head">
                              <div className="orders-head-item">Order</div>
                              <div className="orders-head-item">Date</div>
                              <div className="orders-head-item">Status</div>
                              <div className="orders-head-item">Total</div>
                              <div className="orders-head-item">Actions</div>
                            </div>

                            {cards.map((order) => {
                              const showPendingActions = order.status === 'pending';
                              return (
                                <div key={order.id} className="orders-row">
                                  <div className="orders-row-id">#{order.id}</div>
                                  <div className="orders-row-value">{order.dateLabel}</div>
                                  <div className={`orders-row-status ${order.status}`}>{order.statusLabel}</div>
                                  <div className="orders-row-value">
                                    {order.totalLabel} for {order.items.length || 1} item{order.items.length === 1 ? '' : 's'}
                                  </div>
                                  <div className="orders-actions">
                                    {showPendingActions && (
                                      <Link href={`/orders/${order.id}`} className="orders-action-btn">Pay</Link>
                                    )}
                                    <Link href={`/orders/${order.id}`} className="orders-action-btn">View</Link>
                                    {showPendingActions && (
                                      <Link href={`/orders/${order.id}`} className="orders-action-btn">Cancel</Link>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
