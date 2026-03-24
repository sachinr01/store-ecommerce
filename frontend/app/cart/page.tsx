'use client';

import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';

const PLACEHOLDER = '/store/images/dummy.png';

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCart();

  const shipping = 0;
  const orderTotal = total + shipping;
  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <>
      <style>{`
        .cart-page {
          padding: 0 0 48px;
        }

        .cart-content {
          padding-top: 24px;
        }

        .cart-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
          gap: 32px;
          align-items: start;
        }

        .cart-list {
          display: grid;
          gap: 18px;
        }

        .cart-item {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          gap: 20px;
          padding: 22px;
          border: 1px solid #ededed;
          border-radius: 8px;
          background: #fff;
        }

        .cart-item-thumb {
          width: 110px;
          height: 110px;
          object-fit: cover;
          border-radius: 8px;
          background: #f4f4f4;
        }

        .cart-item-main {
          min-width: 0;
          display: grid;
          gap: 16px;
        }

        .cart-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .cart-item-title {
          color: #12bfb2;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 700;
          text-decoration: none;
          display: inline-block;
        }

        .cart-item-meta {
          margin-top: 8px;
          color: #7b7b7b;
          font-size: 14px;
          line-height: 1.5;
        }

        .cart-remove {
          border: none;
          background: transparent;
          color: #999;
          cursor: pointer;
          font-size: 26px;
          line-height: 1;
          padding: 0;
          flex-shrink: 0;
        }

        .cart-item-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .cart-detail {
          display: grid;
          gap: 6px;
        }

        .cart-detail-label {
          color: #767676;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cart-detail-value {
          color: #222;
          font-size: 20px;
          font-weight: 600;
          word-break: break-word;
        }

        .cart-qty {
          display: inline-flex;
          align-items: center;
          border: 1px solid #dddddd;
          width: fit-content;
          max-width: 100%;
          background: #fff;
        }

        .cart-qty button {
          width: 42px;
          height: 42px;
          border: none;
          background: #f8f8f8;
          color: #444;
          font-size: 20px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .cart-qty input {
          width: 56px;
          height: 42px;
          border: none;
          border-left: 1px solid #dddddd;
          border-right: 1px solid #dddddd;
          text-align: center;
          font-size: 16px;
          outline: none;
        }

        .cart-actions {
          margin-top: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .cart-summary {
          border: 1px solid #e7e3d6;
          background: #fff;
          padding: 24px;
          border-radius: 8px;
          position: sticky;
          top: 96px;
        }

        .cart-summary-title {
          margin: 0 0 20px;
          font-size: 24px;
          font-weight: 700;
          text-transform: uppercase;
          color: #1a1a1a;
        }

        .cart-coupon-label {
          margin: 0 0 10px;
          font-size: 15px;
          color: #555;
        }

        .cart-coupon {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-bottom: 24px;
        }

        .cart-coupon input {
          min-width: 0;
          height: 46px;
          border: 1px solid #dddddd;
          padding: 0 12px;
          font-size: 14px;
        }

        .cart-summary-table {
          border-top: 1px solid #efefef;
          padding-top: 18px;
          display: grid;
          gap: 14px;
        }

        .cart-summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          font-size: 15px;
          color: #444;
        }

        .cart-summary-row.total {
          margin-top: 4px;
          padding-top: 14px;
          border-top: 1px solid #efefef;
          font-size: 18px;
          font-weight: 700;
          color: #111;
        }

        .cart-empty {
          text-align: center;
          padding: 64px 0;
        }

        @media (max-width: 991px) {
          .cart-content {
            padding-top: 20px;
          }

          .cart-grid {
            grid-template-columns: 1fr;
          }

          .cart-summary {
            position: static;
          }
        }

        @media (max-width: 767px) {
          .cart-page {
            padding-bottom: 32px;
          }

          .cart-content {
            padding-top: 16px;
          }

          .cart-item {
            grid-template-columns: 82px minmax(0, 1fr);
            gap: 14px;
            padding: 16px;
          }

          .cart-item-thumb {
            width: 82px;
            height: 82px;
          }

          .cart-item-title {
            font-size: 18px;
          }

          .cart-item-details {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .cart-detail-value {
            font-size: 18px;
          }

          .cart-summary {
            padding: 18px;
          }

          .cart-coupon {
            grid-template-columns: 1fr;
          }

          .cart-summary-row {
            font-size: 14px;
          }

          .cart-actions > * {
            width: 100%;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .cart-page .page-section {
            padding-top: 28px;
            padding-bottom: 28px;
          }

          .cart-item {
            grid-template-columns: 1fr;
          }

          .cart-item-top {
            gap: 10px;
          }

          .cart-item-title {
            font-size: 16px;
          }

          .cart-item-thumb {
            width: 100%;
            max-width: 180px;
            height: auto;
            aspect-ratio: 1 / 1;
          }

          .cart-item-meta {
            font-size: 13px;
          }

          .cart-remove {
            font-size: 22px;
          }

          .cart-qty button {
            width: 38px;
            height: 38px;
          }

          .cart-qty input {
            width: 48px;
            height: 38px;
            font-size: 15px;
          }

          .cart-summary-title {
            font-size: 20px;
          }

          .cart-summary-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main cart-page">
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">Cart</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span><Link href="/shop">Shop</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">Cart</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden cart-content">
            <div className="container">
              {items.length === 0 ? (
                <div className="cart-empty">
                  <p style={{ fontSize: 18, marginBottom: 20 }}>Your cart is empty.</p>
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
                              <div style={{ minWidth: 0 }}>
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
                                <span className="cart-detail-value">${item.price.toFixed(2)}</span>
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
                                <span className="cart-detail-value">${(item.price * item.quantity).toFixed(2)}</span>
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
                      <input type="text" placeholder="Coupon code" />
                      <button className="button fill uppercase" style={{ minHeight: 46 }}>
                        Apply
                      </button>
                    </div>

                    <div className="cart-summary-table">
                      <div className="cart-summary-row">
                        <span>Cart Subtotal</span>
                        <span>${total.toFixed(2)}</span>
                      </div>

                      <div className="cart-summary-row">
                        <span>Shipping &amp; Handling</span>
                        <span style={{ color: '#2e7d32', fontWeight: 600 }}>Free Shipping</span>
                      </div>

                      <div className="cart-summary-row total">
                        <span>Order Total</span>
                        <span>${orderTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: 22 }}>
                      <Link href="/checkout" className="button fill uppercase" style={{ display: 'block', textAlign: 'center' }}>
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
