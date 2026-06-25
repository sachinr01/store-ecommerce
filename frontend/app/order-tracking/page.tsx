'use client';

import { useMemo, useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { trackOrder, getLiveTracking, getImageUrl, type OrderDetailResponse, type ShiprocketTrackingActivity } from '../lib/api';
import { formatPrice } from '../lib/price';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizeStatus(raw: string) {
  if (!raw) return 'pending';
  const s = raw.replace('wc-', '').toLowerCase();
  if (s.includes('deliver')) return 'delivered';
  if (s.includes('out_for') || s.includes('out for')) return 'out_for_delivery';
  if (s.includes('ship')) return 'shipped';
  if (s.includes('complete')) return 'delivered';
  if (s.includes('process')) return 'processing';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('pending')) return 'pending';
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

const STEPS = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'] as const;
const STEP_INDEX: Record<string, number> = {
  pending: 0, confirmed: 0, processing: 1, shipped: 2, out_for_delivery: 3, delivered: 4,
};

function TrackingTimeline({ status }: { status: string }) {
  const isCancelled = status === 'cancelled';
  const activeIdx = isCancelled ? -1 : (STEP_INDEX[status] ?? 0);
  return (
    <div className={`order-timeline${isCancelled ? ' cancelled' : ''}`}>
      {STEPS.map((step, i) => {
        const active = !isCancelled && i <= activeIdx;
        const current = !isCancelled && i === activeIdx;
        return (
          <div key={step} className={`timeline-step${active ? ' active' : ''}${current ? ' current' : ''}`}>
            <span className="timeline-dot">
              {active && <span className="timeline-dot-check">✓</span>}
            </span>
            <span className="timeline-label">{toLabel(step)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── shipment activities ──────────────────────────────────────────────────────

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
      .catch(() => { /* silently skip if tracking unavailable */ })
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
            <li key={i} className="tracking-activity-item">
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

// ─── result panel ────────────────────────────────────────────────────────────

function TrackResult({ data }: { data: OrderDetailResponse }) {
  const { order, items } = data;

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
      status:        normalizeStatus(order.order_status || ''),
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
      {/* Hero */}
      <div className="order-detail-card order-hero">
        <div className="order-detail-header">
          <div>
            <h2 className="order-detail-title">Order #{order.sr_cart_id || summary.id}</h2>
            <div className="order-detail-meta">Placed on {summary.dateLabel}</div>
          </div>
          <span className={`order-detail-status ${summary.status}`}>{toLabel(summary.status)}</span>
        </div>
        <TrackingTimeline status={summary.status} />
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

          {summary.awb && <ShipmentActivities awb={summary.awb} />}
        </div>

        {/* Right */}
        <div className="order-detail-side">
          <div className="order-detail-card">
            <h3 className="order-detail-subtitle">Delivery Details</h3>
            <div className="order-summary-grid">
              {summary.name    && <div><strong>Name:</strong> {summary.name}</div>}
              {summary.phone   && <div><strong>Phone:</strong> {summary.phone}</div>}
              {summary.address && <div><strong>Address:</strong> {summary.address}</div>}
            </div>
          </div>

          <div className="order-detail-card">
            <h3 className="order-detail-subtitle">Price Details</h3>
            <div className="order-summary-grid">
              <div><strong>Subtotal:</strong> {summary.subtotalLabel}</div>
              {summary.couponCode   && <div><strong>Coupon:</strong> {summary.couponCode}</div>}
              {summary.discountLabel && <div><strong>Discount:</strong> -{summary.discountLabel}</div>}
              <div><strong>Shipping:</strong> {summary.shippingLabel}</div>
              <div className="order-price-total"><strong>Total:</strong> {summary.totalLabel}</div>
              <div><strong>Payment:</strong> {toLabel(summary.payment)}</div>
            </div>
          </div>

          <div className="tracking-result-actions">
            <Link href={`/orders/${summary.id}`} className="btn-view-product btn-view-product--inline">
              Full Order Details
            </Link>
            <Link href="/orders" className="btn-view-product btn-view-product--inline btn-view-product--outline">
              All Orders
            </Link>
          </div>
        </div>
      </div>
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

    if (!trimId)  { setError('Please enter your Order ID.'); return; }
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
        setError('No order found with that ID. Please double-check your order confirmation email.');
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
                  To track your order please enter your Order ID in the box below and press the &quot;Track&quot; button.
                  <br />This was given to you on your receipt and in the confirmation email you should have received.
                </p>

                {!result ? (
                  <form className="ot-form" onSubmit={handleTrack} noValidate>
                    <div className="ot-field">
                      <label htmlFor="ot-order-id">Order ID</label>
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
                    <span>Showing results for Order #{result.order.sr_cart_id || result.order.order_id}</span>
                    <button type="button" onClick={handleReset} className="ot-reset-btn">
                      Track a different order
                    </button>
                  </div>
                )}

                {error && <div className="ot-error">{error}</div>}

                {result && <TrackResult data={result} />}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
