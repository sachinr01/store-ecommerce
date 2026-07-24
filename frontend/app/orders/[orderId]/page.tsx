'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { cancelMyOrder, getMyOrderById, getLiveTracking, getImageUrl, type OrderDetailResponse, type ShiprocketTrackingActivity } from '../../lib/api';
import { formatPrice } from '../../lib/price';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

// Exception statuses displayed as warning badge on last real step.
const EXCEPTION_STATUSES = new Set(['undelivered', 'delayed', 'damaged', 'lost']);

const EXCEPTION_LABEL: Record<string, string> = {
  undelivered: 'Delivery Attempted',
  delayed:     'Delayed',
  damaged:     'Damaged',
  lost:        'Lost',
};

/**
 * Derives canonical timeline key from DB order_status + awb_code presence.
 * AWB present + still "processing" → ready_to_ship.
 */
function normalizeStatus(status: string, awbCode?: string | null): string {
  if (!status) return 'pending';
  const s = status.replace('wc-', '').toLowerCase();

  if (EXCEPTION_STATUSES.has(s)) return s;

  if (s.includes('rto delivered') || s === 'returned') return 'returned';
  if (s.includes('rto') || s.includes('return initiated') || s === 'return_initiated') return 'return_initiated';
  if (s.includes('complete')) return 'delivered';
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('out_for') || s.includes('out for')) return 'out_for_delivery';
  if (s.includes('ship') || s.includes('in transit') || s.includes('in_transit') ||
      s.includes('reached') || s.includes('picked up')) return 'shipped';
  if (s.includes('ready') || s === 'ready_to_ship') return 'ready_to_ship';
  if (s.includes('process') || s.includes('pickup scheduled') || s.includes('pickup queued') ||
      s.includes('pickup generated') || s.includes('pickup error') || s === 'new') {
    return awbCode ? 'ready_to_ship' : 'processing';
  }
  // Must be checked before the generic 'cancel' catch-all.
  if (s.includes('cancel') && (s.includes('request') || s.includes('pending'))) return 'cancellation_pending';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('pending')) return 'pending';
  if (s.includes('confirm')) return 'confirmed';
  return s;
}

function ShipmentActivities({ awb }: { awb: string }) {
  const [activities, setActivities] = useState<ShiprocketTrackingActivity[]>([]);
  const [liveStatus, setLiveStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveTracking(awb)
      .then((res) => {
        if (res.success) {
          setActivities(res.activities || []);
          setLiveStatus(res.current_status || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

// ─── cancellation reason modal — kept in sync with orders/page.tsx and
//     order-tracking/page.tsx so all three cancel entry points collect the
//     same structured reason for the admin email / audit trail. ─────────────

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

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params?.orderId as string | undefined;
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    getMyOrderById(orderId)
      .then(res => {
        if (!active) return;
        setData(res);
      })
      .catch(err => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load order.';
        setError(msg);
        if (msg.includes('401') || msg.toLowerCase().includes('login')) {
          setNeedsLogin(true);
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, [orderId]);

  const summary = useMemo(() => {
    if (!data?.order) return null;
    const order = data.order;
    const itemsSubtotal = (data.items || []).reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const storedSubtotal = Number(order.subtotal || 0);
    const storedShipping = Number(order.shipping || 0);
    const storedTotal = Number(order.total || 0);
    const storedDiscount = Number(order.coupon_discount || 0);
    // _line_total is post-discount in SR webhook orders, pre-discount in direct checkout.
    // Always trust _order_subtotal (pre-discount) from the DB when available.
    const subtotalValue = storedSubtotal > 0
      ? storedSubtotal
      : itemsSubtotal + storedDiscount;
    const totalValue = storedTotal > 0
      ? storedTotal
      : Math.max(0, subtotalValue - storedDiscount) + storedShipping;
    const shipNameRaw = [order.ship_first_name, order.ship_last_name].filter(Boolean).join(' ').trim();
    const billingNameRaw = [order.billing_first_name, order.billing_last_name].filter(Boolean).join(' ').trim();
    const name = shipNameRaw || billingNameRaw || order.user_display_name || '';
    const email = order.billing_email || order.user_email || '';
    const phone = order.ship_phone || order.billing_phone || '';
    const shipAddress = [
      order.ship_address_1,
      order.ship_address_2,
      order.ship_city,
      order.ship_state,
      order.ship_postcode,
      order.ship_country,
    ].filter(Boolean).join(', ');
    const billingAddress = [
      order.billing_address_1,
      order.billing_address_2,
      order.billing_city,
      order.billing_state,
      order.billing_postcode,
      order.billing_country,
    ].filter(Boolean).join(', ');
    return {
      id: Number(order.order_id),
      status: normalizeStatus(order.order_status || '', order.awb_code),
      dateLabel: formatDate(order.order_date || ''),
      totalLabel: formatPrice(totalValue || 0),
      subtotalLabel: formatPrice(subtotalValue || 0),
      shippingLabel: formatPrice(storedShipping || 0),
      payment: order.payment_method || 'cod',
      couponCode: order.coupon_code || null,
      discountLabel: storedDiscount ? formatPrice(storedDiscount) : null,
      name,
      email,
      phone,
      address: shipAddress || billingAddress,

      awb: order.awb_code || '',
      courier: order.courier_name || '',
      shippingStatus: order.shipping_status || '',
      shipmentId: order.shipment_id || '',
    };
  }, [data]);

  const statusSteps = useMemo(() => {
    const current = summary?.status || 'pending';
    const isCancelled = current === 'cancelled' || current === 'cancellation_pending';
    const isException = current in EXCEPTION_LABEL;
    const effectiveStatus = isException ? 'shipped' : current;

    const STEPS = [
      'pending', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered',
    ];
    const STEP_LABELS: Record<string, string> = {
      pending: 'Pending', processing: 'Processing', ready_to_ship: 'Ready to Ship',
      shipped: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
    };
    const STEP_INDEX: Record<string, number> = {
      pending: 0, confirmed: 1, processing: 1, ready_to_ship: 2,
      shipped: 3, out_for_delivery: 4, delivered: 5,
    };
    const activeIndex = isCancelled ? -1 : (STEP_INDEX[effectiveStatus] ?? 0);

    return STEPS.map((step, i) => ({
      key:        step,
      label:      STEP_LABELS[step] ?? step.replace(/_/g, ' '),
      active:     !isCancelled && i <= activeIndex,
      current:    !isCancelled && i === activeIndex && !isException,
      isWarning:  isException && step === 'shipped',
    }));
  }, [summary]);

  const canCancel = summary?.status === 'pending' || summary?.status === 'processing' || summary?.status === 'shipped';

  const handleCancel = () => setShowCancelModal(true);

  const confirmCancel = async (reason: CancelReasonKey, customReason: string) => {
    if (!summary || !orderId) return;
    setCancelling(true);
    setCancelError('');
    setCancelSuccess('');
    try {
      const result = await cancelMyOrder(summary.id, reason, customReason || undefined);
      setShowCancelModal(false);
      // An already-shipped order can't be cancelled outright — it goes to
      // "cancellation_requested" while our team cancels it on Shiprocket,
      // and only becomes truly "cancelled" once that's confirmed.
      if (result.cancellation_status === 'pending') {
        setCancelSuccess(
          result.message ||
            "Your cancellation request has been received. We're confirming this with our shipping partner and will notify you once it's done.",
        );
        setData((prev) =>
          prev
            ? { ...prev, order: { ...prev.order, order_status: 'cancellation_requested' } }
            : prev,
        );
      } else {
        setCancelSuccess(result.message || 'Your order has been cancelled successfully.');
        setData((prev) =>
          prev
            ? { ...prev, order: { ...prev.order, order_status: 'cancelled' } }
            : prev,
        );
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order. Please contact support.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Header />
      <div className="dima-main order-detail-page">
        <nav className="cart-breadcrumb">
          <Link href="/" className="cart-breadcrumb-link">Home</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <Link href="/orders" className="cart-breadcrumb-link">Orders</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <span className="cart-breadcrumb-current">Order #{orderId}</span>
        </nav>
        <div className="order-detail-container">
          <div className="order-detail-wrap">
            <Link href="/orders" className="order-back">{'<- Back to Orders'}</Link>

            {loading && <div className="order-detail-empty">Loading order...</div>}

            {!loading && needsLogin && (
              <div className="order-detail-empty">
                Please log in to view this order.
                <div>
                  <Link className="orders-cta btn-view-product btn-view-product--inline" href="/my-account">Login / Register</Link>
                </div>
              </div>
            )}

            {!loading && !needsLogin && error && (
              <div className="order-detail-error">{error}</div>
            )}

            {!loading && !error && summary && (
              <div className="order-detail-grid">
                <div className="order-detail-main">
                  <div className="order-detail-card order-hero">
                    <div className="order-detail-header">
                      <div>
                        <h1 className="order-detail-title">Order #{summary.id}</h1>
                        <div className="order-detail-meta">Placed on {summary.dateLabel}</div>
                      </div>
                      <span className={`order-detail-status ${summary.status}`}>
                        {summary.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    </div>
                    {/* Order timeline */}
                    {(summary.status === 'return_initiated' || summary.status === 'returned') ? (
                      <div className="order-timeline order-timeline--return">
                        <div className="timeline-return-banner">
                          <span className="timeline-return-icon">↩</span>
                          <span className="timeline-return-label">
                            {summary.status === 'returned' ? 'Order Returned' : 'Return Initiated'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={`order-timeline${summary.status === 'cancelled' || summary.status === 'cancellation_pending' ? ' cancelled' : ''}`}>
                        {statusSteps.map(step => (
                          <div
                            key={step.key}
                            className={[
                              'timeline-step',
                              step.active   ? 'active'  : '',
                              step.current  ? 'current' : '',
                              step.isWarning ? 'warning' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            <span className="timeline-dot">
                              {step.active && !step.isWarning && <span className="timeline-dot-check">✓</span>}
                              {step.isWarning && <span className="timeline-dot-warn">!</span>}
                            </span>
                            <span className="timeline-label">
                              {step.label}
                              {step.isWarning && summary.status in EXCEPTION_LABEL && (
                                <span className="timeline-exception-badge">
                                  {EXCEPTION_LABEL[summary.status]}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="order-detail-card">
                    <h3 className="order-detail-subtitle">Items</h3>
                    <div className="order-items-list">
                      {data!.items.map(item => (
                        <div key={item.order_item_id} className="order-item">
                          <div className="order-item-thumb">
                            {item.thumbnail_url ? (
                              <img src={getImageUrl(item.thumbnail_url)} alt={item.order_item_name} />
                            ) : (
                              <span>{(item.order_item_name || 'Item').slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="order-item-body">
                            <div className="order-item-name">{item.order_item_name}</div>
                            <div className="order-item-meta">
                              Qty: {item.qty ?? 1}
                              {item.color ? ` · Color: ${item.color}` : ''}
                              {item.size ? ` · Size: ${item.size}` : ''}
                            </div>
                          </div>
                          <div className="order-item-price">
                            {formatPrice(Number(item.line_total || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="order-detail-side">
                  <div className="order-detail-card">
                    <h3 className="order-detail-card-title">Delivery details</h3>
                    <div className="order-summary-grid">
                      <div><strong>Name:</strong> {summary.name || '-'}</div>
                      <div><strong>Phone:</strong> {summary.phone || '-'}</div>
                      <div><strong>Address:</strong> {summary.address || '-'}</div>
                      <div><strong>Email:</strong> {summary.email || '-'}</div>
                    </div>
                  </div>

                  <div className="order-detail-card">
                    <h3 className="order-detail-card-title">Price details</h3>
                    <div className="order-details-grid">
                      <div><strong>Subtotal:</strong> {summary.subtotalLabel}</div>
                      {summary.couponCode && (
                        <div><strong>Coupon:</strong> {summary.couponCode}</div>
                      )}
                      {summary.discountLabel && (
                        <div><strong>Discount:</strong> -{summary.discountLabel}</div>
                      )}
                      <div><strong>Shipping:</strong> {summary.shippingLabel}</div>
                      <div><strong>Total:</strong> {summary.totalLabel}</div>
                      <div><strong>Payment:</strong> {summary.payment}</div>
                      {data?.order?.transaction_id && (
                        <div><strong>Transaction ID:</strong> {data.order.transaction_id}</div>
                      )}
                    </div>
                  </div>


                  <div className="order-detail-card">
                    <h3 className="order-detail-card-title">Shipping Details</h3>

                    <div className="order-summary-grid">
                      <div>
                        <strong>Shipping Status:</strong>{' '}
                        <span className={`shipping-badge ${summary.shippingStatus}`}>
                          {summary.shippingStatus || 'Pending'}
                        </span>
                      </div>

                      <div>
                        <strong>Courier:</strong>{' '}
                        {summary.courier || '-'}
                      </div>

                      <div>
                        <strong>AWB Number:</strong>{' '}
                        {summary.awb || '-'}
                      </div>

                      <div>
                        <strong>Shipment ID:</strong>{' '}
                        {summary.shipmentId || '-'}
                      </div>
                    </div>

                    {summary.awb && (
                      <a
                        href={`https://shiprocket.co/tracking/${summary.awb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="track-order-btn btn-view-product btn-view-product--inline na-view-all-btn mt-3"
                      >
                        Track Order
                      </a>
                    )}
                  </div>

                  <div className="order-detail-card">
                    <h3 className="order-detail-card-title">Invoice</h3>
                    {/* <p className="orders-section-copy">Download your tax invoice for this order.</p> */}
                    <a
                      href={`/api/orders/my/invoice/${summary.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-view-product"
                    >
                      Download Invoice
                    </a>
                  </div>

                  {canCancel && (
                    <div className="order-detail-card">
                      <h3 className="order-detail-card-title">Cancel order</h3>
                      <p className="orders-section-copy">
                        You can cancel this order. If it has already shipped, we&apos;ll send your
                        cancellation request to our team and notify you once it&apos;s confirmed.
                      </p>
                      <button
                        type="button"
                        className="btn-view-product ot-btn--cancel"
                        onClick={handleCancel}
                        disabled={cancelling}
                      >
                        {cancelling ? 'Cancelling…' : 'Cancel Order'}
                      </button>
                      {cancelSuccess && <div className="ot-cancel-success">{cancelSuccess}</div>}
                      {cancelError && <div className="order-detail-error">{cancelError}</div>}
                    </div>
                  )}

                  
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
      {showCancelModal && (
        <CancelReasonModal
          onConfirm={(reason, customReason) => void confirmCancel(reason, customReason)}
          onClose={() => setShowCancelModal(false)}
          submitting={cancelling}
        />
      )}
    </>
  );
}
