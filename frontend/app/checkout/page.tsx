'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belgium','Bolivia','Brazil','Bulgaria',
  'Cambodia','Canada','Chile','China','Colombia','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Ecuador','Egypt','Estonia','Ethiopia','Finland','France','Georgia','Germany',
  'Ghana','Greece','Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait',
  'Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Mexico','Morocco',
  'Netherlands','New Zealand','Nigeria','Norway','Pakistan','Panama','Peru','Philippines',
  'Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore',
  'Slovakia','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland',
  'Syria','Taiwan','Thailand','Tunisia','Turkey','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Venezuela','Vietnam','Yemen','Zimbabwe',
];

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();

  const [showLogin, setShowLogin] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [orderOpen, setOrderOpen] = useState(true);
  const [terms, setTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    country: '', firstName: '', lastName: '', company: '',
    address: '', address2: '', city: '', state: '', zip: '',
    email: '', phone: '', notes: '',
    sCountry: '', sFirstName: '', sLastName: '', sCompany: '',
    sAddress: '', sAddress2: '', sCity: '', sState: '', sZip: '',
    sEmail: '', sPhone: '',
    username: '', password: '',
    accUsername: '', accPassword: '',
    coupon: '',
    cardName: '', cardNumber: '', cardExpiry: '', cardCvv: '',
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName) e.firstName = 'Required';
    if (!form.lastName) e.lastName = 'Required';
    if (!form.address) e.address = 'Required';
    if (!form.city) e.city = 'Required';
    if (!form.state) e.state = 'Required';
    if (!form.zip) e.zip = 'Required';
    if (!form.email) e.email = 'Required';
    if (!form.phone) e.phone = 'Required';
    if (!terms) e.terms = 'You must accept the terms & conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setPlacing(true);
    setOrderError(null);

    try {
      const billing = {
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        address_2: form.address2,
        city: form.city,
        state: form.state,
        postcode: form.zip,
        country: form.country,
        company: form.company,
      };

      const shipping = shipToDifferent ? {
        first_name: form.sFirstName,
        last_name: form.sLastName,
        phone: form.sPhone,
        address: form.sAddress,
        address_2: form.sAddress2,
        city: form.sCity,
        state: form.sState,
        postcode: form.sZip,
        country: form.sCountry,
        company: form.sCompany,
      } : {};

      const res = await fetch('/store/api/orders/place', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing,
          shipping,
          payment_method: paymentMethod,
          shipping_cost: 0,
          notes: form.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Order placement failed.');
      }

      await clearCart();
      const orderId = data?.data?.orderId;
      router.push(orderId ? `/checkout/success?order=${orderId}` : '/checkout/success');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Order placement failed.');
    } finally {
      setPlacing(false);
    }
  };

  const orderTotal = total;
  const showCardDetails = paymentMethod === 'card';

  if (items.length === 0 && !placing) {
    return (
      <>
        <Header />
        <div className="dima-main" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ fontSize: 18, marginBottom: 20 }}>Your cart is empty.</p>
          <Link href="/shop" className="button fill uppercase">Go to Shop</Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <style>{`
        .checkout-page { padding-bottom: 40px; }
        .checkout-content { padding-top: 24px; }
        .checkout-alert { margin-bottom: 16px; }
        .checkout-box { margin-bottom: 18px; padding: 18px 20px; border: 1px solid #ece7dc; background: #fff; }
        .checkout-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr); gap: 32px; align-items: start; }
        .checkout-main, .checkout-side { min-width: 0; }
        .checkout-side .order-products { padding: 22px; border: 1px solid #ece7dc; background: #fff; position: sticky; top: 96px; }
        .checkout-section-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a1a; }
        .checkout-subsection-title { margin: 26px 0 14px; font-size: 22px; font-weight: 700; color: #1a1a1a; }
        .checkout-inline-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .checkout-toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
        .checkout-card-box, .checkout-account-box, .checkout-shipping-box, .checkout-login-box, .checkout-coupon-box { padding: 18px; border: 1px solid #ece7dc; background: #fff; }
        .checkout-login-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 14px; }
        .checkout-coupon-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
        .checkout-order-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .checkout-order-table-wrap { overflow-x: auto; }
        .checkout-order-table-wrap table { width: 100%; min-width: 320px; }
        .checkout-payment-list { margin: 0; padding: 0; list-style: none; }
        .checkout-payment-list li + li { margin-top: 14px; padding-top: 14px; border-top: 1px solid #efefef; }
        .checkout-payment-label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
        .checkout-payment-copy { font-size: 13px; color: #666; margin: 4px 0 0; }
        .checkout-submit { width: 100%; margin-bottom: 12px; cursor: pointer; }
        .checkout-terms { margin-top: 8px; font-size: 13px; }
        .checkout-terms a { white-space: nowrap; }
        @media (max-width: 991px) {
          .checkout-content { padding-top: 18px; }
          .checkout-grid { grid-template-columns: 1fr; }
          .checkout-side .order-products { position: static; }
        }
        @media (max-width: 767px) {
          .checkout-page { padding-bottom: 28px; }
          .checkout-content { padding-top: 14px; }
          .checkout-box, .checkout-card-box, .checkout-account-box, .checkout-shipping-box, .checkout-login-box, .checkout-coupon-box, .checkout-side .order-products { padding: 16px; }
          .checkout-inline-row, .checkout-coupon-grid { grid-template-columns: 1fr; gap: 12px; }
          .checkout-section-title { font-size: 22px; }
          .checkout-subsection-title { font-size: 20px; }
          .checkout-order-toggle { align-items: stretch; flex-direction: column; }
          .checkout-order-toggle > * { width: 100%; }
        }
        @media (max-width: 480px) {
          .checkout-page .page-section { padding-top: 28px; padding-bottom: 28px; }
          .checkout-section-title { font-size: 20px; }
          .checkout-subsection-title { font-size: 18px; }
          .checkout-login-actions > * { width: 100%; text-align: center; }
          .checkout-terms label { align-items: flex-start !important; }
        }
      `}</style>

      <Header />
      <div className="dima-main checkout-page">
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">Checkout</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span><Link href="/shop">Shop</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">Checkout</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden checkout-content">
            <div className="container">
              <div className="dima-alert dima-alert-info fade in checkout-alert">
                <i className="fa fa-info" />
                <p>Returning customer? <a href="#" onClick={(e) => { e.preventDefault(); setShowLogin((v) => !v); }}>Click here to login</a></p>
              </div>

              {showLogin && (
                <div className="checkout-login-box checkout-box">
                  <p>If you have shopped with us before, please enter your details below. If you are a new customer, continue to the billing and shipping section.</p>
                  <div className="checkout-inline-row">
                    <div className="field">
                      <label className="required">Username or Email</label>
                      <input type="text" placeholder="Username or email" value={form.username} onChange={set('username')} />
                    </div>
                    <div className="field">
                      <label className="required">Password</label>
                      <input type="password" placeholder="Password" value={form.password} onChange={set('password')} />
                    </div>
                  </div>
                  <div className="checkout-login-actions">
                    <a href="#" className="button small fill uppercase">Login</a>
                    <a href="#" className="lost-pass" style={{ fontSize: 13 }}>Lost Password?</a>
                  </div>
                </div>
              )}

              <div className="dima-alert dima-alert-info fade in checkout-alert">
                <i className="fa fa-info" />
                <p>Have a coupon? <a href="#" onClick={(e) => { e.preventDefault(); setShowCoupon((v) => !v); }}>Click here to enter your code</a></p>
              </div>

              {showCoupon && (
                <div className="checkout-coupon-box checkout-box">
                  <div className="checkout-coupon-grid">
                    <div className="field last">
                      <label>Coupon Code</label>
                      <input type="text" placeholder="Coupon Code" value={form.coupon} onChange={set('coupon')} />
                    </div>
                    <a href="#" className="button small fill uppercase" style={{ minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>Apply Coupon</a>
                  </div>
                </div>
              )}

              <form onSubmit={handlePlaceOrder} noValidate className="form-small form">
                <div className="checkout-grid">
                  <div className="checkout-main">
                    <h4 className="checkout-section-title">Billing Details</h4>
                    <div className="field">
                      <label className="required">Country</label>
                      <select className="orderby" value={form.country} onChange={set('country')}>
                        <option value="">Select a country...</option>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">First Name</label>
                        <input type="text" placeholder="First Name" value={form.firstName} onChange={set('firstName')} />
                        {errors.firstName && <span style={errStyle}>{errors.firstName}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Last Name</label>
                        <input type="text" placeholder="Last Name" value={form.lastName} onChange={set('lastName')} />
                        {errors.lastName && <span style={errStyle}>{errors.lastName}</span>}
                      </div>
                    </div>
                    <div className="field">
                      <label>Company Name</label>
                      <input type="text" placeholder="Company Name (optional)" value={form.company} onChange={set('company')} />
                    </div>
                    <div className="field">
                      <label className="required">Address</label>
                      <input type="text" placeholder="Street address" value={form.address} onChange={set('address')} />
                      {errors.address && <span style={errStyle}>{errors.address}</span>}
                    </div>
                    <div className="field">
                      <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={form.address2} onChange={set('address2')} />
                    </div>
                    <div className="field">
                      <label className="required">Town / City</label>
                      <input type="text" placeholder="Town / City" value={form.city} onChange={set('city')} />
                      {errors.city && <span style={errStyle}>{errors.city}</span>}
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">State / County</label>
                        <input type="text" placeholder="State / County" value={form.state} onChange={set('state')} />
                        {errors.state && <span style={errStyle}>{errors.state}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Postcode / Zip</label>
                        <input type="text" placeholder="Postcode / Zip" value={form.zip} onChange={set('zip')} />
                        {errors.zip && <span style={errStyle}>{errors.zip}</span>}
                      </div>
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">Email Address</label>
                        <input type="email" placeholder="Email Address" value={form.email} onChange={set('email')} />
                        {errors.email && <span style={errStyle}>{errors.email}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Phone</label>
                        <input type="tel" placeholder="Phone" value={form.phone} onChange={set('phone')} />
                        {errors.phone && <span style={errStyle}>{errors.phone}</span>}
                      </div>
                    </div>
                    <div className="field">
                      <label className="checkout-toggle-label">
                        <input className="checkbox" type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
                        Create an account?
                      </label>
                    </div>
                    {createAccount && (
                      <div className="checkout-account-box">
                        <p>Create an account by entering the information below. If you are a returning customer please login at the top of the page.</p>
                        <div className="field">
                          <label className="required">Username or Email</label>
                          <input type="text" placeholder="Username" value={form.accUsername} onChange={set('accUsername')} />
                        </div>
                        <div className="field">
                          <label className="required">Password</label>
                          <input type="password" placeholder="Password" value={form.accPassword} onChange={set('accPassword')} />
                        </div>
                      </div>
                    )}

                    <h4 className="checkout-subsection-title">Shipping Address</h4>
                    <div className="field">
                      <label className="checkout-toggle-label">
                        <input className="checkbox" type="checkbox" checked={shipToDifferent} onChange={(e) => setShipToDifferent(e.target.checked)} />
                        Ship to a different address?
                      </label>
                    </div>
                    {shipToDifferent && (
                      <div className="checkout-shipping-box">
                        <div className="field">
                          <label>Country</label>
                          <select className="orderby" value={form.sCountry} onChange={set('sCountry')}>
                            <option value="">Select a country...</option>
                            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label>First Name</label>
                            <input type="text" placeholder="First Name" value={form.sFirstName} onChange={set('sFirstName')} />
                          </div>
                          <div className="field">
                            <label>Last Name</label>
                            <input type="text" placeholder="Last Name" value={form.sLastName} onChange={set('sLastName')} />
                          </div>
                        </div>
                        <div className="field">
                          <label>Company Name</label>
                          <input type="text" placeholder="Company Name" value={form.sCompany} onChange={set('sCompany')} />
                        </div>
                        <div className="field">
                          <label>Address</label>
                          <input type="text" placeholder="Street address" value={form.sAddress} onChange={set('sAddress')} />
                        </div>
                        <div className="field">
                          <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={form.sAddress2} onChange={set('sAddress2')} />
                        </div>
                        <div className="field">
                          <label>Town / City</label>
                          <input type="text" placeholder="Town / City" value={form.sCity} onChange={set('sCity')} />
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label>State / County</label>
                            <input type="text" placeholder="State / County" value={form.sState} onChange={set('sState')} />
                          </div>
                          <div className="field">
                            <label>Postcode / Zip</label>
                            <input type="text" placeholder="Postcode / Zip" value={form.sZip} onChange={set('sZip')} />
                          </div>
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label>Email Address</label>
                            <input type="email" placeholder="Email Address" value={form.sEmail} onChange={set('sEmail')} />
                          </div>
                          <div className="field">
                            <label>Phone</label>
                            <input type="tel" placeholder="Phone" value={form.sPhone} onChange={set('sPhone')} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="field last">
                      <label>Order Notes</label>
                      <textarea rows={4} placeholder="Notes about your order, e.g. special notes for delivery." value={form.notes} onChange={set('notes')} />
                    </div>
                  </div>

                  <div className="checkout-side">
                    <div className="box order-products dima-box">
                      <div className="checkout-order-toggle">
                        <h4 className="box-titel" style={{ margin: 0 }}>Your Order</h4>
                        <button type="button" className="button small fill uppercase" onClick={() => setOrderOpen((v) => !v)} aria-expanded={orderOpen} aria-controls="order-details">
                          {orderOpen ? 'Hide Cart' : 'Show Cart'}
                        </button>
                      </div>

                      <div id="order-details" style={{ display: orderOpen ? 'block' : 'none' }}>
                        <div className="checkout-order-table-wrap">
                          <table className="order-products-table">
                            <thead>
                              <tr>
                                <th className="product-name">Product</th>
                                <th className="product-total">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.cartItemId} className="cart_item">
                                  <td className="product-name">
                                    {item.title}
                                    {(item.color || item.size) && <span style={{ fontSize: 11, color: '#888', display: 'block' }}>{[item.color, item.size].filter(Boolean).join(' / ')}</span>}
                                    <strong className="product-quantity"> x{item.quantity}</strong>
                                  </td>
                                  <td className="product-total">
                                    <span className="amount">${(item.price * item.quantity).toFixed(2)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="cart-subtotal">
                                <th>Cart Subtotal</th>
                                <td><span className="amount">${total.toFixed(2)}</span></td>
                              </tr>
                              <tr className="shipping">
                                <th>Shipping &amp; Handling</th>
                                <td>Free Shipping</td>
                              </tr>
                              <tr className="order-total">
                                <th>Order Total</th>
                                <td><strong><span className="amount">${orderTotal.toFixed(2)}</span></strong></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      <h4 className="checkout-subsection-title" style={{ marginTop: 20 }}>Payment Method</h4>
                      <ul className="with-border checkout-payment-list">
                        <li>
                          <label className="checkout-payment-label">
                            <input className="radio" type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)} />
                            <span>
                              <strong>Card Payment</strong>
                              {paymentMethod === 'card' && <p className="checkout-payment-copy">Pay securely using your debit or credit card.</p>}
                            </span>
                          </label>
                        </li>
                        <li className="field last">
                          <label className="checkout-payment-label">
                            <input className="radio" type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={(e) => setPaymentMethod(e.target.value)} />
                            <span>
                              <strong>Cash on Delivery (COD)</strong>
                              {paymentMethod === 'cod' && <p className="checkout-payment-copy">Pay with cash when your order is delivered.</p>}
                            </span>
                          </label>
                        </li>
                      </ul>

                      {showCardDetails && (
                        <div className="checkout-card-box" style={{ marginTop: 14 }}>
                          <h5 style={{ marginBottom: 10 }}>Card Details</h5>
                          <div className="field">
                            <label className="required">Name on Card</label>
                            <input type="text" placeholder="Full name" value={form.cardName} onChange={set('cardName')} autoComplete="cc-name" />
                          </div>
                          <div className="field">
                            <label className="required">Card Number</label>
                            <input type="text" inputMode="numeric" placeholder="0000 0000 0000 0000" value={form.cardNumber} onChange={set('cardNumber')} autoComplete="cc-number" />
                          </div>
                          <div className="checkout-inline-row">
                            <div className="field">
                              <label className="required">Expiry Date</label>
                              <input type="text" inputMode="numeric" placeholder="MM/YY" value={form.cardExpiry} onChange={set('cardExpiry')} autoComplete="cc-exp" />
                            </div>
                            <div className="field">
                              <label className="required">CVV</label>
                              <input type="password" inputMode="numeric" placeholder="123" value={form.cardCvv} onChange={set('cardCvv')} autoComplete="cc-csc" />
                            </div>
                          </div>
                        </div>
                      )}

                      <button type="submit" className="button fill uppercase checkout-submit" disabled={placing}>
                        {placing ? 'Placing Order...' : 'Place Order'}
                      </button>

                      {orderError && <div style={{ color: '#c62828', fontSize: 13, marginBottom: 10 }}>{orderError}</div>}

                      <div className="field checkout-terms">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input className="checkbox" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                          <span>I've read and accept the <a href="#">terms &amp; conditions</a></span>
                        </label>
                        {errors.terms && <span style={{ ...errStyle, display: 'block', marginTop: 4 }}>{errors.terms}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}

const errStyle: React.CSSProperties = { color: '#c62828', fontSize: 12, marginTop: 2 };
