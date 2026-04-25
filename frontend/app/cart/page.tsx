'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';
import { formatPrice } from '../lib/price';
import { applyCoupon, removeCoupon, type AppliedCoupon } from '../lib/api';
import './cart.css';

const PLACEHOLDER = '/store/images/dummy.jpg';

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const discount = appliedCoupon?.discount ?? 0;

  const orderTotal = Math.max(0, total - discount);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponMsg(null);
    const data = await applyCoupon(couponInput.trim());
    setCouponLoading(false);
    if (data.success && data.data) {
      setAppliedCoupon(data.data);
      setCouponMsg({ text: `Coupon "${data.data.code}" applied!`, ok: true });
    } else {
      setAppliedCoupon(null);
      setCouponMsg({ text: data.message || 'Invalid coupon.', ok: false });
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponMsg(null);
  };

  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <>
      <Header />
      <div className="dima-main cart-page">
        <nav className="cart-breadcrumb">
          <Link href="/">Home</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <Link href="/shop">Shop</Link>
          <span className="cart-breadcrumb-separator">›</span>
          <span className="cart-breadcrumb-current">Cart</span>
        </nav>

        <section className="section">
          <div className="page-section-content overflow-hidden cart-content">
            <div className="container">
              {items.length === 0 ? (
                <div className="cart-empty">
                  <p>Your cart is empty.</p>
                  <Link href="/shop" className="button fill uppercase">Continue Shopping</Link>
                </div>
              ) : (
                <div className="cart-grid">
                  <div>
                    <div className="cart-list">
                      {items.map((item) => (
                        <article key={item.cartItemId} className="cart-item">
                          <img
                            src={item.image || PLACEHOLDER}
                            alt={item.title}
                            className="cart-item-thumb"
                          />

                          <div className="cart-item-main">
                            <div className="cart-item-top">
                              <div className="cart-item-title-wrap">
                                <Link href={`/shop/product/${toSlug(item.title)}`} className="cart-item-title">
                                  {item.title}
                                </Link>
                                {(item.color || item.size) && (
                                  <div className="cart-item-meta">
                                    {item.color && <div>Color: {item.color}</div>}
                                    {item.size && <div>Size: {item.size}</div>}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="cart-remove"
                                title="Remove"
                                aria-label={`Remove ${item.title}`}
                                onClick={() => removeItem(item.cartItemId)}
                              >
                                ×
                              </button>
                            </div>

                            <div className="cart-item-details">
                              <div className="cart-detail">
                                <span className="cart-detail-label">Price</span>
                                <span className="cart-detail-value">{formatPrice(item.price)}</span>
                              </div>

                              <div className="cart-detail">
                                <span className="cart-detail-label">Quantity</span>
                                <div className="cart-qty">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.cartItemId, item.quantity - 1)}
                                    aria-label={`Decrease quantity of ${item.title}`}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    min={1}
                                    onChange={(event) => updateQty(item.cartItemId, parseInt(event.target.value, 10) || 1)}
                                    aria-label={`Quantity of ${item.title}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.cartItemId, item.quantity + 1)}
                                    aria-label={`Increase quantity of ${item.title}`}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="cart-detail">
                                <span className="cart-detail-label">Total</span>
                                <span className="cart-detail-value">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="cart-actions">
                      <Link href="/shop" className="button fill uppercase">
                        ← Continue Shopping
                      </Link>
                    </div>
                  </div>

                  <aside className="cart-summary">
                    <h3 className="cart-summary-title">Your Order</h3>

                    <p className="cart-coupon-label">Have a coupon?</p>
                    <div className="cart-coupon">
                      <input
                        type="text"
                        placeholder="Coupon code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        disabled={!!appliedCoupon}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyCoupon(); } }}
                      />
                      {appliedCoupon ? (
                        <button
                          className="button fill uppercase cart-coupon-remove-btn"
                          onClick={handleRemoveCoupon}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          className="button fill uppercase cart-coupon-apply-btn"
                          onClick={() => void handleApplyCoupon()}
                          disabled={couponLoading}
                        >
                          {couponLoading ? '...' : 'Apply'}
                        </button>
                      )}
                    </div>
                    {couponMsg && (
                      <p className={`cart-coupon-msg ${couponMsg.ok ? 'success' : 'error'}`}>
                        {couponMsg.text}
                      </p>
                    )}

                    <div className="cart-summary-table">
                      <div className="cart-summary-row">
                        <span>Cart Subtotal</span>
                        <span>{formatPrice(total)}</span>
                      </div>

                      {discount > 0 && (
                        <div className="cart-summary-row discount">
                          <span>Discount ({appliedCoupon?.code})</span>
                          <span>−{formatPrice(discount)}</span>
                        </div>
                      )}

                      <div className="cart-summary-row">
                        <span>Shipping &amp; Handling</span>
                        <span className="cart-summary-shipping">Free Shipping</span>
                      </div>

                      <div className="cart-summary-row total">
                        <span>Order Total</span>
                        <span>{formatPrice(orderTotal)}</span>
                      </div>
                    </div>

                    <div className="cart-checkout-wrap">
                      <Link href="/checkout" className="button fill uppercase cart-checkout-link">
                        Proceed to Checkout
                      </Link>
                    </div>
                  </aside>
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
