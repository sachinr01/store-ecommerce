'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getMyOrders, type OrderSummary } from '../lib/api';
import './orders.css';

type OrderCard = {
  id: number;
  status: string;
  dateLabel: string;
  totalLabel: string;
  items: string[];
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function normalizeStatus(status: string) {
  if (!status) return 'pending';
  const s = status.replace('wc-', '').toLowerCase();
  if (s.includes('complete')) return 'completed';
  if (s.includes('process')) return 'processing';
  if (s.includes('pending')) return 'pending';
  return s;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    getMyOrders()
      .then(data => {
        if (!active) return;
        setOrders(data || []);
      })
      .catch(err => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load orders.';
        setError(msg);
        if (msg.includes('401') || msg.toLowerCase().includes('login')) {
          setNeedsLogin(true);
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards: OrderCard[] = useMemo(() => (
    (orders || []).map(o => ({
      id: Number(o.order_id),
      status: normalizeStatus(o.order_status || ''),
      dateLabel: formatDate(o.order_date || ''),
      totalLabel: o.total ? `₹${Number(o.total).toFixed(2)}` : '₹0.00',
      items: (o.items || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    }))
  ), [orders]);

  return (
    <>
      <Header />
      <div className="orders-page">
        <div className="orders-header">
          <h1 className="orders-title">Your Orders</h1>
          <p className="orders-sub">Track order IDs, items, and totals — all in one place.</p>
        </div>

        <div className="orders-wrap">
          {loading && (
            <div className="orders-empty">Loading your orders…</div>
          )}

          {!loading && needsLogin && (
            <div className="orders-empty">
              Please log in to view your orders.
              <div>
                <Link className="orders-cta" href="/my-account">Login / Register</Link>
              </div>
            </div>
          )}

          {!loading && !needsLogin && error && (
            <div className="orders-error">
              {error}
            </div>
          )}

          {!loading && !error && cards.length === 0 && (
            <div className="orders-empty">
              No orders found yet.
              <div>
                <Link className="orders-cta" href="/shop">Continue Shopping</Link>
              </div>
            </div>
          )}

          {!loading && !error && cards.map(order => (
            <Link key={order.id} className="order-card order-link" href={`/orders/${order.id}`}>
              <div className="order-top">
                <div className="order-id">Order #{order.id}</div>
                <span className={`order-status ${order.status}`}>{order.status}</span>
              </div>
              <div className="order-meta">
                <div>Placed: {order.dateLabel}</div>
                <div className="order-total">Total: {order.totalLabel}</div>
              </div>
              <div className="order-items">
                <strong>Items:</strong>{' '}
                {order.items.length
                  ? order.items.map((item, i) => <span key={`${order.id}-${i}`}>{item}{i < order.items.length - 1 ? ',' : ''}</span>)
                  : <span>—</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
