'use client';

import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';

const PLACEHOLDER = '/store/images/dummy.png';

export default function CartPage() {
  const { items, removeItem, updateQty, total } = useCart();

  const shipping = 0; // free shipping
  const orderTotal = total + shipping;

  return (
    <>
      <Header />
      <div className="dima-main">

        {/* Breadcrumb */}
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
          <div className="page-section-content overflow-hidden">
            <div className="container">

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <p style={{ fontSize: 18, marginBottom: 20 }}>Your cart is empty.</p>
                  <Link href="/shop" className="button fill uppercase">Continue Shopping</Link>
                </div>
              ) : (
                <div className="ok-row">

                  {/* ── Left: Cart Table ── */}
                  <div className="ok-md-8 ok-xsd-12">

                    {/* Cart table */}
                    <table className="order-products-table" style={{ width: '100%', marginBottom: 30 }}>
                      <thead>
                        <tr>
                          <th style={th}></th>
                          <th style={th}>Product</th>
                          <th style={th}>Price</th>
                          <th style={th}>Quantity</th>
                          <th style={th}>Total</th>
                          <th style={th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={`${item.id}-${item.variationId ?? 0}`}>
                            {/* Thumbnail */}
                            <td style={td}>
                              <img src={item.image || PLACEHOLDER} alt={item.title}
                                style={{ width: 60, height: 60, objectFit: 'cover', display: 'block' }} />
                            </td>

                            {/* Name + meta */}
                            <td style={td}>
                              <Link href={`/product-details?id=${item.id}`} style={{ fontWeight: 600 }}>
                                {item.title}
                              </Link>
                              {(item.color || item.size) && (
                                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                  {item.color && <span>Color: {item.color}</span>}
                                  {item.color && item.size && <span> / </span>}
                                  {item.size && <span>Size: {item.size}</span>}
                                </div>
                              )}
                            </td>

                            {/* Unit price */}
                            <td style={td}>${item.price.toFixed(2)}</td>

                            {/* Qty stepper */}
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button className="qty-btn"
                                  onClick={() => updateQty(item.id, item.variationId, item.quantity - 1)}
                                  style={qtyBtn}>−</button>
                                <input
                                  type="number" value={item.quantity} min={1}
                                  onChange={e => updateQty(item.id, item.variationId, parseInt(e.target.value) || 1)}
                                  style={{ width: 48, textAlign: 'center', border: '1px solid #ddd', padding: '4px 0' }}
                                />
                                <button className="qty-btn"
                                  onClick={() => updateQty(item.id, item.variationId, item.quantity + 1)}
                                  style={qtyBtn}>+</button>
                              </div>
                            </td>

                            {/* Line total */}
                            <td style={td}>${(item.price * item.quantity).toFixed(2)}</td>

                            {/* Remove */}
                            <td style={td}>
                              <button
                                onClick={() => removeItem(item.id, item.variationId)}
                                title="Remove"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18, lineHeight: 1 }}
                              >×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Continue shopping */}
                    <Link href="/shop" className="button fill uppercase" style={{ marginRight: 12 }}>
                      ← Continue Shopping
                    </Link>
                  </div>

                  {/* ── Right: Order Summary ── */}
                  <div className="ok-md-4 ok-xsd-12">
                    <div className="box dima-box" style={{ padding: 24 }}>
                      <h4 className="undertitle" style={{ marginBottom: 20 }}>Your Order</h4>

                      {/* Coupon */}
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 13, marginBottom: 8 }}>Have a coupon?</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="text" placeholder="Coupon code"
                            style={{ flex: 1, border: '1px solid #ddd', padding: '6px 10px', fontSize: 13 }} />
                          <button className="button fill uppercase" style={{ fontSize: 12, padding: '6px 14px' }}>
                            Apply
                          </button>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
                        {/* Subtotal */}
                        <div style={summaryRow}>
                          <span>Cart Subtotal</span>
                          <span>${total.toFixed(2)}</span>
                        </div>

                        {/* Shipping */}
                        <div style={summaryRow}>
                          <span>Shipping &amp; Handling</span>
                          <span style={{ color: '#2e7d32' }}>Free Shipping</span>
                        </div>

                        {/* Order total */}
                        <div style={{ ...summaryRow, fontWeight: 700, fontSize: 16, borderTop: '1px solid #eee', paddingTop: 12, marginTop: 8 }}>
                          <span>Order Total</span>
                          <span>${orderTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Link href="/checkout" className="button fill uppercase" style={{ textAlign: 'center' }}>
                          Proceed to Checkout
                        </Link>
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

// ── Inline styles ──────────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #eee', fontWeight: 600, fontSize: 13 };
const td: React.CSSProperties = { padding: '14px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' };
const qtyBtn: React.CSSProperties = { width: 28, height: 28, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontSize: 16, lineHeight: 1 };
const summaryRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 };
