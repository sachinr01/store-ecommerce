'use client';

import { useMemo, useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { trackOrder, getLiveTracking, getImageUrl, cancelOrder, type OrderDetailResponse, type ShiprocketTrackingActivity } from '../lib/api';
import { formatPrice } from '../lib/price';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Exception statuses: displayed as a warning badge on the last real step,
// not as a distinct timeline step.
const EXCEPTION_STATUSES = new Set(['undelivered', 'delayed', 'damaged', 'lost']);

/**
 * Derives the canonical timeline key from the DB order_status string and the
 * presence of an AWB code.
 *
 * AWB presence takes priority over raw status for the "ready_to_ship" step:
 * once Shiprocket assigns an AWB the order has a confirmed pickup slot, even
 * if the raw status string is still "processing" / "Pickup Scheduled".
 */
function normalizeStatus(raw: string, awbCode?: string | null): string {
  if (!raw) return 'pending';
  const s = raw.replace('wc-', '').toLowerCase();

  // Exception states — return as-is so the caller can render a warning badge
  if (EXCEPTION_STATUSES.has(s)) return s;

  if (s.includes('rto delivered') || s === 'returned') return 'returned';
  if (s.includes('rto') || s.includes('return initiated') || s === 'return_initiated') return 'return_initiated';
  // out_for_delivery MUST precede the generic 'deliver' check — the string
  // "out for delivery" contains "deliver" as a substring, so checking the
  // generic case first would misclassify it as fully Delivered.
  if (s.includes('out_for') || s.includes('out for')) return 'out_for_delivery';
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('complete')) return 'delivered';
  // AWB present but still showing "processing" → already ready to ship
  if (s.includes('process') || s.includes('pickup scheduled') || s.includes('pickup queued') ||
      s.includes('pickup generated') || s.includes('pickup error') || s === 'new') {
    return awbCode ? 'ready_to_ship' : 'processing';
  }
  if (s.includes('ship') || s.includes('in transit') || s.includes('in_transit') ||
      s.includes('reached') || s.includes('picked up')) return 'shipped';
  if (s.includes('ready') || s.includes('ready_to_ship')) return 'ready_to_ship';
  // AWB assigned but status not yet updated — promote to ready_to_ship
  if (awbCode && (s === 'processing' || s === 'confirmed' || s === 'new')) return 'ready_to_ship';
  if (s.includes('cancel') && (s.includes('request') || s.includes('pending'))) return 'cancellation_pending';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('pending')) return 'pending';
  if (s.includes('confirm')) return 'confirmed';
  return s;
}

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// strip non-digits for phone comparison
function digitsOnly(v: string) {
  return v.replace(/\D/g, '');
}

// ─── timeline ────────────────────────────────────────────────────────────────

// Main forward-journey steps in order.
// "Pending" = local only (pre-Shiprocket). "ready_to_ship" = AWB assigned.
// Return / cancelled states are handled separately below.
const STEPS = [
  'pending',
  'processing',
  'ready_to_ship',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const;

const STEP_LABELS: Record<string, string> = {
  pending:          'Pending',
  processing:       'Processing',
  ready_to_ship:    'Ready to Ship',
  shipped:          'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
};

const STEP_INDEX: Record<string, number> = {
  pending:          0,
  confirmed:        1, // "confirmed" maps to same visual slot as processing
  processing:       1,
  ready_to_ship:    2,
  shipped:          3,
  out_for_delivery: 4,
  delivered:        5,
};

// Exception statuses that overlay a warning badge on the last real step
// rather than advancing the timeline.
const EXCEPTION_LABEL: Record<string, string> = {
  undelivered: 'Delivery Attempted',
  delayed:     'Delayed',
  damaged:     'Damaged',
  lost:        'Lost',
};

function TrackingTimeline({ status }: { status: string }) {
  const isCancelled = status === 'cancelled' || status === 'cancellation_pending';
  const isReturnInitiated = status === 'return_initiated';
  const isReturned = status === 'returned';
  const isException = status in EXCEPTION_LABEL;

  // For exception states, show the timeline up to "shipped" (last safe step)
  const effectiveStatus = isException ? 'shipped' : status;
  const activeIdx = isCancelled ? -1 : (STEP_INDEX[effectiveStatus] ?? 0);

  // Return states: show a distinct terminal banner instead of the main steps
  if (isReturnInitiated || isReturned) {
    return (
      <div className="order-timeline order-timeline--return">
        <div className="timeline-return-banner">
          <span className="timeline-return-icon">↩</span>
          <span className="timeline-return-label">
            {isReturned ? 'Order Returned' : 'Return Initiated'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`order-timeline${isCancelled ? ' cancelled' : ''}`}>
      {STEPS.map((step, i) => {
        const active  = !isCancelled && i <= activeIdx;
        const current = !isCancelled && i === activeIdx && !isException;
        // On exception states highlight the last real step with a warning
        const isWarningStep = isException && step === 'shipped';
        return (
          <div
            key={step}
            className={[
              'timeline-step',
              active        ? 'active'   : '',
              current       ? 'current'  : '',
              isWarningStep ? 'warning'  : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="timeline-dot">
              {active && !isWarningStep && <span className="timeline-dot-check">✓</span>}
              {isWarningStep && <span className="timeline-dot-warn">!</span>}
            </span>
            <span className="timeline-label">
              {STEP_LABELS[step] ?? toLabel(step)}
              {isWarningStep && (
                <span className="timeline-exception-badge">
                  {EXCEPTION_LABEL[status]}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── shipment activities ──────────────────────────────────────────────────────

const LIVE_TRACKING_POLL_MS = 60_000;

function ShipmentActivities({ awb }: { awb: string }) {
  const [activities, setActivities] = useState<ShiprocketTrackingActivity[]>([]);
  const [liveStatus, setLiveStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchTracking = (isFirstLoad: boolean) => {
      if (isFirstLoad) setLoading(true);
      getLiveTracking(awb)
        .then((res) => {
          if (cancelled) return;
          if (res.success) {
            setActivities(res.activities || []);
            setLiveStatus(res.current_status || '');
          }
        })
        .catch(() => { /* silently skip if tracking unavailable */ })
        .finally(() => { if (!cancelled && isFirstLoad) setLoading(false); });
    };

    fetchTracking(true);
    // Keep the live tracking card current without requiring a manual page
    // reload — polls in the background while the page stays open.
    const intervalId = setInterval(() => fetchTracking(false), LIVE_TRACKING_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [awb]);

  if (loading) return <div className="tracking-activities-loading">Loading live tracking…</div>;
  if (!activities.length && !liveStatus) return null;

  return (
    <div className="order-detail-card">
      <h3 className="order-detail-subtitle">Live Tracking</h3>
      {liveStatus && (
        <div className="tracking-current-status">
          Current Status: <span className="shipping-badge">{liveStatus}</span>
        </div>
      )}
      {activities.length > 0 && (
        <ul className="tracking-activities">
          {activities.map((act, i) => (
            <li key={`${act.date}-${act.activity}-${i}`} className="tracking-activity-item">
              <div className="tracking-activity-date">{act.date}</div>
              <div className="tracking-activity-desc">{act.activity}</div>
              {act.location && <div className="tracking-activity-location">{act.location}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── cancellation reason modal ──────────────────────────────────────────────

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

  const isOther    = selected === 'other';
  const customOk   = !isOther || custom.trim().length > 0;
  const canSubmit  = selected !== '' && customOk;
  const MAX_CHARS  = 300;

  // Close on Esc
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
                onChange={() => {
                  setSelected(key);
                  if (key !== 'other') setCustom('');
                }}
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
          <button
            type="button"
            className="ot-modal-btn ot-modal-btn--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Keep Order
          </button>
          <button
            type="button"
            className="ot-modal-btn ot-modal-btn--danger"
            onClick={handleSubmit}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <span className="ot-spinner" aria-hidden="true" />
            ) : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── result panel ────────────────────────────────────────────────────────────

function TrackResult({ data, phone, onOrderCancelled }: { data: OrderDetailResponse; phone: string; onOrderCancelled: (updated: OrderDetailResponse) => void }) {
  const { order, items } = data;
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleCancel = () => setShowCancelModal(true);

  const confirmCancel = async (reason: CancelReasonKey, customReason: string) => {
    setCancelling(true);
    setCancelError('');
    setCancelSuccess('');
    try {
      const result = await cancelOrder(order.sr_cart_id || order.order_id, phone, reason, customReason || undefined);
      // Close modal on success
      setShowCancelModal(false);

      // An already-shipped order can't be cancelled outright — it goes to
      // "cancellation_requested" while our team cancels it on Shiprocket,
      // and only becomes truly "cancelled" once that's confirmed.
      if (result.cancellation_status === 'pending') {
        setCancelSuccess(
          result.message ||
            "Your cancellation request has been received. If your order hasn't been shipped yet, it will be cancelled shortly. You'll receive an email once the cancellation is processed.",
        );
        onOrderCancelled({
          ...data,
          order: { ...data.order, order_status: 'cancellation_requested' },
        });
      } else {
        setCancelSuccess(result.message || 'Your order has been cancelled successfully.');
        onOrderCancelled({
          ...data,
          order: { ...data.order, order_status: 'cancelled' },
        });
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order. Please contact support.');
    } finally {
      setCancelling(false);
    }
  };

  const summary = useMemo(() => {
    const storedSubtotal = Number(order.subtotal || 0);
    const storedShipping = Number(order.shipping || 0);
    const storedTotal    = Number(order.total || 0);
    const storedDiscount = Number(order.coupon_discount || 0);
    const itemsSubtotal  = items.reduce((s, it) => s + Number(it.line_total || 0), 0);
    const subtotal = storedSubtotal > 0 && Math.abs(storedSubtotal - itemsSubtotal) <= 0.01
      ? storedSubtotal : itemsSubtotal || storedSubtotal;
    const derived = Math.max(0, subtotal - storedDiscount) + storedShipping;
    const total   = storedTotal > 0 && Math.abs(storedTotal - derived) <= 0.01 ? storedTotal : derived || storedTotal;

    const shipName = [order.ship_first_name, order.ship_last_name].filter(Boolean).join(' ').trim();
    const billName = [order.billing_first_name, order.billing_last_name].filter(Boolean).join(' ').trim();
    const name     = shipName || billName || order.user_display_name || '';
    const shipAddr = [order.ship_address_1, order.ship_address_2, order.ship_city, order.ship_state, order.ship_postcode].filter(Boolean).join(', ');
    const billAddr = [order.billing_address_1, order.billing_address_2, order.billing_city, order.billing_state, order.billing_postcode].filter(Boolean).join(', ');

    return {
      id:            Number(order.order_id),
      status:        normalizeStatus(order.order_status || '', order.awb_code),
      dateLabel:     formatDate(order.order_date || ''),
      totalLabel:    formatPrice(total || 0),
      subtotalLabel: formatPrice(subtotal || 0),
      shippingLabel: formatPrice(storedShipping || 0),
      discountLabel: storedDiscount ? formatPrice(storedDiscount) : null,
      couponCode:    order.coupon_code || null,
      payment:       order.payment_method || 'cod',
      name,
      phone:         order.ship_phone || order.billing_phone || '',
      address:       shipAddr || billAddr,
      awb:           order.awb_code || '',
      courier:       order.courier_name || '',
      shippingStatus: order.shipping_status || '',
      shipmentId:    order.shipment_id || '',
    };
  }, [order, items]);

  return (
    <div className="ot-result">
      {/* Timeline at the very top */}
      <TrackingTimeline status={summary.status} />

      {/* Hero */}
      <div className="order-detail-card order-hero">
        <div className="order-detail-header">
          <div>
            <h2 className="order-detail-title">Order {order.sr_cart_id || summary.id}</h2>
            <div className="order-detail-meta">Placed on {summary.dateLabel}</div>
          </div>
          <span className={`order-detail-status ${summary.status}`}>{toLabel(summary.status)}</span>
        </div>
      </div>

      <div className="order-detail-grid">
        {/* Left */}
        <div className="order-detail-main">
          <div className="order-detail-card">
            <h3 className="order-detail-subtitle">Items Ordered</h3>
            <div className="order-items-list">
              {items.map((item) => (
                <div key={item.order_item_id} className="order-item">
                  <div className="order-item-thumb">
                    {item.thumbnail_url
                      ? <img src={getImageUrl(item.thumbnail_url)} alt={item.order_item_name} />
                      : <span>{(item.order_item_name || 'Item').slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="order-item-body">
                    <div className="order-item-name">{item.order_item_name}</div>
                    <div className="order-item-meta">
                      Qty: {item.qty ?? 1}
                      {item.color ? ` · Color: ${item.color}` : ''}
                      {item.size  ? ` · Size: ${item.size}`   : ''}
                    </div>
                  </div>
                  <div className="order-item-price">{formatPrice(Number(item.line_total || 0))}</div>
                </div>
              ))}
            </div>
          </div>

          {(summary.awb || summary.courier || summary.shippingStatus) && (
            <div className="order-detail-card">
              <h3 className="order-detail-subtitle">Shipment Info</h3>
              <div className="order-summary-grid">
                {summary.shippingStatus && (
                  <div><strong>Shipping Status:</strong>{' '}
                    <span className={`shipping-badge ${summary.shippingStatus}`}>{toLabel(summary.shippingStatus)}</span>
                  </div>
                )}
                {summary.courier   && <div><strong>Courier:</strong> {summary.courier}</div>}
                {summary.awb       && <div><strong>AWB Number:</strong> {summary.awb}</div>}
                {summary.shipmentId && <div><strong>Shipment ID:</strong> {summary.shipmentId}</div>}
              </div>
              {summary.awb && (
                <a href={`https://shiprocket.co/tracking/${summary.awb}`} target="_blank" rel="noopener noreferrer"
                  className="btn-view-product btn-view-product--inline" style={{ marginTop: 14, display: 'inline-block' }}>
                  Track on Shiprocket ↗
                </a>
              )}
            </div>
          )}

          {summary.awb && summary.status !== 'cancelled' && summary.status !== 'cancellation_pending' && (
            <ShipmentActivities awb={summary.awb} />
          )}
        </div>

        {/* Right */}
        <div className="order-detail-side">
          <div className="order-detail-card">
            <h3 className="order-detail-card-title">Customer Details</h3>
            <div className="order-summary-grid">
              {summary.name    && <div><strong>Name:</strong> {summary.name}</div>}
              {summary.phone   && <div><strong>Phone:</strong> {summary.phone}</div>}
              {summary.address && (
                <div>
                  <strong>Address:</strong>
                  <span style={{ wordWrap: 'break-word' }}>{summary.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="order-detail-card">
            <h3 className="order-detail-card-title">Order Details</h3>
            <div className="order-details-grid">
              <div><strong>Payment:</strong> {toLabel(summary.payment)}</div>
              <div><strong>Subtotal:</strong> {summary.subtotalLabel}</div>
              {summary.couponCode   && <div><strong>Coupon:</strong> {summary.couponCode}</div>}
              <div><strong>Discount:</strong> {summary.discountLabel ? `-${summary.discountLabel}` : formatPrice(0)}</div>
              <div><strong>Shipping:</strong> {summary.shippingLabel}</div>
              <div className="order-price-total"><strong>Total:</strong> {summary.totalLabel}</div>
            </div>
          </div>

          <div className="tracking-result-actions">
            <a
              href={`/api/orders/invoice/${summary.id}?phone=${encodeURIComponent(summary.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ot-btn ot-btn--invoice"
            >
              DOWNLOAD INVOICE
            </a>

            {['pending', 'processing', 'ready_to_ship', 'on-hold', 'shipped'].includes(summary.status) && (
              <button
                type="button"
                className="ot-btn ot-btn--cancel"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'CANCEL ORDER'}
              </button>
            )}

            {cancelSuccess && (
              <div className="ot-cancel-success">
                <strong>{cancelSuccess}</strong>
              </div>
            )}
            {cancelError   && <div className="ot-error">{cancelError}</div>}
          </div>
        </div>
      </div>

      {/* Cancel reason modal */}
      {showCancelModal && (
        <CancelReasonModal
          onConfirm={confirmCancel}
          onClose={() => setShowCancelModal(false)}
          submitting={cancelling}
        />
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const [orderId, setOrderId]     = useState('');
  const [mobile, setMobile]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [result, setResult]       = useState<OrderDetailResponse | null>(null);

  const handleTrack = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimId  = orderId.trim();
    const trimMob = mobile.trim();

    if (!trimId)  { setError('Please enter your Order Reference.'); return; }
    if (!trimMob) { setError('Please enter your Mobile No.'); return; }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const detail = await trackOrder(trimId, trimMob);
      setResult(detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not find this order.';
      if (msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('match')) {
        setError('The mobile number does not match this order. Please check and try again.');
      } else if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
        setError('No order found with that reference. Please double-check your order confirmation email.');
      } else {
        setError('Could not find this order. Please check the details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setOrderId('');
    setMobile('');
  };

  return (
    <>
      <Header />
      <div className="dima-main ot-page">
        <section className="section">
          <div className="page-section-content">
            <div className="container">
              <div className="ot-wrap">

                <p className="ot-description">
                  To track your order please enter your Order Reference in the box below and press the &quot;Track&quot; button.
                  <br />This was given to you on your receipt and in the confirmation email you should have received.
                </p>

                {!result ? (
                  <form className="ot-form" onSubmit={handleTrack} noValidate>
                    <div className="ot-field">
                      <label htmlFor="ot-order-id">Order Reference</label>
                      <input
                        id="ot-order-id"
                        type="text"
                        placeholder="Found in your order confirmation email."
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        autoComplete="off"
                      />
                    </div>

                    <div className="ot-field">
                      <label htmlFor="ot-mobile">Mobile No.</label>
                      <input
                        id="ot-mobile"
                        type="tel"
                        placeholder="Mobile No. you used during checkout."
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        autoComplete="tel"
                      />
                    </div>

                    <div className="ot-action">
                      <button type="submit" className="ot-btn" disabled={loading}>
                        {loading ? 'Tracking…' : 'TRACK'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="ot-reset-bar">
                    <span>Showing results for Order {result.order.sr_cart_id || result.order.order_id}</span>
                    <button type="button" onClick={handleReset} className="ot-reset-btn">
                      Track a different order
                    </button>
                  </div>
                )}

                {error && <div className="ot-error">{error}</div>}

                {result && <TrackResult data={result} phone={mobile} onOrderCancelled={setResult} />}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
