'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AccountSidebar from '../components/AccountSidebar';
import { getMyOrders, cancelMyOrder, type OrderSummary } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatPrice } from '../lib/price';

type OrderCard = {
  id: number;
  status: string;
  statusLabel: string;
  dateLabel: string;
  totalLabel: string;
  itemCount: number;
  awb: string;
  courier: string;
  shippingStatus: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizeStatus(status: string) {
  if (!status) return 'pending';
  const s = status.replace('wc-', '').toLowerCase();
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('out_for') || s.includes('out for')) return 'out_for_delivery';
  if (s.includes('ship') || s.includes('in transit') || s.includes('in_transit')) return 'shipped';
  if (s.includes('complete')) return 'delivered';
  if (s.includes('process')) return 'processing';
  if (s.includes('cancel') && (s.includes('request') || s.includes('pending'))) return 'cancellation_pending';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('pending')) return 'pending';
  return s;
}

function toTitleCase(value: string) {
  if (!value) return 'Pending';
  return value.split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ─── shared cancel reason modal ──────────────────────────────────────────────

const CANCEL_REASONS = [
  { key: 'found_better_price', label: 'Found a better price elsewhere' },
  { key: 'delivery_too_long',  label: 'Delivery is taking too long' },
  { key: 'no_longer_needed',   label: 'No longer need this item' },
  { key: 'wrong_product',      label: 'Ordered the wrong product / variant' },
  { key: 'other',              label: 'Other (please specify)' },
] as const;

type CancelReasonKey = typeof CANCEL_REASONS[number]['key'];

function CancelReasonModal({
  onConfirm,
  onClose,
  submitting,
}: {
  onConfirm: (reason: CancelReasonKey, customReason: string) => void;
  onClose: () => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<CancelReasonKey | ''>('');
  const [custom, setCustom]     = useState('');
  const [touched, setTouched]   = useState(false);
  const isOther   = selected === 'other';
  const customOk  = !isOther || custom.trim().length > 0;
  const canSubmit = selected !== '' && customOk;
  const MAX_CHARS = 300;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(selected as CancelReasonKey, isOther ? custom.trim() : '');
  };

  return (
    <div
      className="ot-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cr-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ot-modal ot-modal--reason" onClick={(e) => e.stopPropagation()}>
        <h3 className="ot-modal-title" id="cr-modal-title">Cancel Order</h3>
        <p className="ot-modal-subtitle">Please tell us why you&apos;re cancelling this order</p>

        <fieldset className="cr-reasons" role="radiogroup" aria-label="Cancellation reason">
          <legend className="sr-only">Select a reason</legend>
          {CANCEL_REASONS.map(({ key, label }) => (
            <label key={key} className={`cr-reason${selected === key ? ' cr-reason--selected' : ''}`}>
              <input
                type="radio"
                name="cancel-reason"
                value={key}
                checked={selected === key}
                onChange={() => { setSelected(key); if (key !== 'other') setCustom(''); }}
                disabled={submitting}
              />
              <span className="cr-reason-label">{label}</span>
            </label>
          ))}
          {isOther && (
            <div className="cr-custom-wrap">
              <textarea
                className="cr-custom-textarea"
                placeholder="Please tell us more…"
                value={custom}
                maxLength={MAX_CHARS}
                onChange={(e) => setCustom(e.target.value)}
                disabled={submitting}
                aria-label="Additional details"
              />
              <div className="cr-char-count">{custom.length} / {MAX_CHARS}</div>
              {touched && !custom.trim() && (
                <div className="cr-field-error">Please describe your reason before submitting.</div>
              )}
            </div>
          )}
        </fieldset>

        {touched && !selected && (
          <div className="cr-field-error" style={{ marginTop: 8 }}>Please select a reason to continue.</div>
        )}

        <div className="ot-modal-actions" style={{ marginTop: 24 }}>
          <button type="button" className="ot-modal-btn ot-modal-btn--secondary" onClick={onClose} disabled={submitting}>
            Keep Order
          </button>
          <button type="button" className="ot-modal-btn ot-modal-btn--danger" onClick={handleSubmit} disabled={submitting} aria-busy={submitting}>
            {submitting ? <span className="ot-spinner" aria-hidden="true" /> : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelNotice, setCancelNotice] = useState('');
  const [modalOrderId, setModalOrderId] = useState<number | null>(null);

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

  const handleCancel = async (reason: CancelReasonKey, customReason: string) => {
    const orderId = modalOrderId;
    if (!orderId) return;
    setModalOrderId(null);
    setCancellingId(orderId);
    setCancelError('');
    setCancelNotice('');
    try {
      const result = await cancelMyOrder(orderId, reason, customReason || undefined);
      const nextStatus = result.cancellation_status === 'pending' ? 'cancellation_requested' : 'cancelled';
      setOrders((prev) =>
        prev.map((o) =>
          Number(o.order_id) === orderId ? { ...o, order_status: nextStatus } : o,
        ),
      );
      if (result.requires_manual_review || result.shiprocket_cancelled === false) {
        setCancelNotice(
          result.message ||
            "Your order has been marked for cancellation. We're confirming this with our shipping partner and will notify you if anything needs your attention.",
        );
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  const cards: OrderCard[] = useMemo(() => (
    (orders || []).map((o) => {
      const status = normalizeStatus(o.order_status || '');
      const fallbackCount = (o.items || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean).length;
      const backendCount = Number(o.item_count);
      return {
        id: Number(o.order_id),
        status,
        statusLabel: toTitleCase(status.replace(/_/g, ' ')),
        dateLabel: formatDate(o.order_date || ''),
        totalLabel: o.total ? formatPrice(Number(o.total)) : formatPrice(0),
        itemCount: (o.item_count != null && Number.isFinite(backendCount)) ? backendCount : fallbackCount,
        awb: o.awb_code || '',
        courier: o.courier_name || '',
        shippingStatus: o.shipping_status || '',
      };
    })
  ), [orders]);

  return (
    <>
      <Header />
      <div className="dima-main orders-account-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p className="orders-loading">Loading...</p>
              ) : !isLoggedIn || !user || needsLogin ? (
                <div className="orders-empty">
                  Please log in to view your orders.
                  <div className="orders-empty-actions">
                    <Link className="btn-view-product btn-view-product--inline" href="/my-account">Login / Register</Link>
                  </div>
                </div>
              ) : (
                <div className="account-shell">
                  <div className="account-layout">
                    <AccountSidebar accountHandle={accountHandle} activeLink="orders" onLogout={logout} />

                    <div className="account-main">
                      <div className="account-top" />

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

                        {cancelError && (
                          <div className="orders-error">{cancelError}</div>
                        )}

                        {cancelNotice && (
                          <div className="orders-notice">{cancelNotice}</div>
                        )}

                        {!loading && !error && cards.length === 0 && (
                          <div className="orders-empty-panel">
                            <div className="orders-empty-text">No order has been made yet.</div>
                            <Link className="btn-view-product btn-view-product--inline" href="/shop">Browse Products</Link>
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
                              const showPayAction = order.status === 'pending';
                              const canCancelOrder = order.status === 'pending' || order.status === 'processing' || order.status === 'shipped';
                              return (
                                <div key={order.id} className="orders-row">
                                  <div className="orders-row-id">#{order.id}</div>
                                  <div className="orders-row-value">{order.dateLabel}</div>
                                  <div className="orders-row-status-cell">
                                    <span className={`orders-row-status ${order.status}`}>{order.statusLabel}</span>
                                    {order.shippingStatus && order.shippingStatus !== order.status && (
                                      <span className={`shipping-badge ${order.shippingStatus}`} style={{ marginLeft: 6 }}>
                                        {order.shippingStatus.replace(/_/g, ' ')}
                                      </span>
                                    )}
                                    {order.awb && (
                                      <div className="orders-row-awb">
                                        <a
                                          href={`https://shiprocket.co/tracking/${order.awb}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="orders-awb-link"
                                        >
                                          {order.courier ? `${order.courier} · ` : ''}{order.awb}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                  <div className="orders-row-value">
                                    {order.totalLabel} for {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                                  </div>
                                  <div className="orders-actions">
                                    {showPayAction && (
                                      <Link href={`/orders/${order.id}`} className="btn-view-product">Pay</Link>
                                    )}
                                    <Link href={`/order-tracking`} className="btn-view-product">Track</Link>
                                    <Link href={`/orders/${order.id}`} className="btn-view-product">View</Link>
                                    {canCancelOrder && (
                                      <button
                                        type="button"
                                        className="btn-view-product"
                                        onClick={() => setModalOrderId(order.id)}
                                        disabled={cancellingId === order.id}
                                      >
                                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                                      </button>
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
      {modalOrderId !== null && (
        <CancelReasonModal
          onConfirm={(reason, customReason) => void handleCancel(reason, customReason)}
          onClose={() => setModalOrderId(null)}
          submitting={cancellingId !== null}
        />
      )}
    </>
  );
}
