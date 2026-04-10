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
  const [showPayment, setShowPayment] = useState(false);
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
    if (shipToDifferent) {
      if (!form.sFirstName) e.sFirstName = 'Required';
      if (!form.sLastName) e.sLastName = 'Required';
      if (!form.sAddress) e.sAddress = 'Required';
      if (!form.sCity) e.sCity = 'Required';
      if (!form.sState) e.sState = 'Required';
      if (!form.sZip) e.sZip = 'Required';
    }
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
      const shipping = {
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        address: form.address,
        address_2: form.address2,
        city: form.city,
        state: form.state,
        postcode: form.zip,
        country: form.country,
        company: form.company,
      };

      const billing = shipToDifferent ? {
        first_name: form.sFirstName || form.firstName,
        last_name: form.sLastName || form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.sAddress,
        address_2: form.sAddress2,
        city: form.sCity,
        state: form.sState,
        postcode: form.sZip,
        country: form.sCountry,
        company: form.sCompany,
      } : {
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
        .checkout-summary-card { padding: 18px; border: 1px solid #e9e1d5; border-radius: 8px; background: #fff; margin-bottom: 18px; }
        .checkout-summary-title { margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #1a1a1a; }
        .checkout-summary-row { display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #444; padding: 8px 0; border-bottom: 1px solid #f1ece4; }
        .checkout-summary-row:last-child { border-bottom: none; }
        .checkout-summary-total { display: flex; align-items: center; justify-content: space-between; font-size: 18px; font-weight: 700; padding-top: 12px; }
        .checkout-order-items { margin-top: 6px; }
        .checkout-order-items .checkout-subsection-title { margin-bottom: 10px; }
        .checkout-order-items .checkout-order-item:first-of-type { padding-top: 6px; }
        .checkout-order-items .checkout-order-item:last-of-type { padding-bottom: 6px; }
        .checkout-order-item { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1ece4; }
        .checkout-order-item:last-child { border-bottom: none; }
        .checkout-order-thumb { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; border: 1px solid #eee3d6; background: #faf6f0; }
        .checkout-order-meta { font-size: 14px; color: #222; }
        .checkout-order-meta span { display: block; font-size: 12px; color: #777; margin-top: 4px; }
        .checkout-order-price { font-weight: 700; font-size: 14px; color: #222; }
        .checkout-cta { margin: 18px 0; }
        .checkout-page .field > label:not(.checkout-toggle-label) { display: none; }
        .checkout-page .field input,
        .checkout-page .field select,
        .checkout-page .field textarea {
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 4px;
        }
        .checkout-page .field input,
        .checkout-page .field select {
          height: 40px;
        }
        .checkout-page .field textarea {
          min-height: 80px;
        }

        /* ── Custom checkbox (div-based, immune to global input rules) ── */
        .ck-box {
          width: 20px;
          height: 20px;
          min-width: 20px;
          min-height: 20px;
          border: 2px solid #ccc;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, border-color 0.15s;
          box-sizing: border-box;
        }
        .ck-box.checked {
          background: #e53935;
          border-color: #e53935;
        }
        .ck-box.checked::after {
          content: '';
          width: 5px;
          height: 9px;
          border: solid #fff;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg) translateY(-1px);
          display: block;
        }

        .checkout-toggle-label,
        .checkout-terms label {
          gap: 10px;
          font-size: 15px;
          font-weight: 600;
          color: #2563eb;
        }
        .checkout-terms label span,
        .checkout-terms label a {
          color: #2563eb;
          font-weight: 600;
        }
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
        .checkout-payment-list { margin: 0; padding: 0; display: grid; gap: 12px; }
        .checkout-payment-item { border: 1px solid #eee3d6; border-radius: 10px; padding: 12px 14px; background: #fff; }
        .checkout-payment-item.selected { border-color: #00cfc1; background: #f7fffd; }
        .checkout-payment-label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; width: 100%; }
        .checkout-payment-label input { margin-top: 3px; }
        .checkout-payment-copy { font-size: 13px; color: #666; margin: 4px 0 0; }
        .checkout-card-box { border: 1px solid #eee3d6; background: #fff; border-radius: 10px; padding: 14px; }
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
        <nav style={{ padding:'13px 48px', fontSize:13, color:'#888', display:'flex', gap:6, alignItems:'center', borderBottom:'1px solid #ececec', background:'#fff', flexWrap:'wrap' as const }}>
          <Link href="/" style={{ color:'#888', textDecoration:'none' }}>Home</Link>
          <span style={{ color:'#ccc' }}>›</span>
          <Link href="/shop" style={{ color:'#888', textDecoration:'none' }}>Shop</Link>
          <span style={{ color:'#ccc' }}>›</span>
          <span style={{ color:'#1c1c1c', fontWeight:500 }}>Checkout</span>
        </nav>

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
                    <h4 className="checkout-section-title">Contact Information</h4>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">First Name</label>
                        <input type="text" placeholder="First Name *" value={form.firstName} onChange={set('firstName')} aria-label="First Name" />
                        {errors.firstName && <span style={errStyle}>{errors.firstName}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Last Name</label>
                        <input type="text" placeholder="Last Name *" value={form.lastName} onChange={set('lastName')} aria-label="Last Name" />
                        {errors.lastName && <span style={errStyle}>{errors.lastName}</span>}
                      </div>
                    </div>
                    <div className="field">
                      <label className="required">Email Address</label>
                      <input type="email" placeholder="Email Address *" value={form.email} onChange={set('email')} aria-label="Email Address" />
                      {errors.email && <span style={errStyle}>{errors.email}</span>}
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">Mobile</label>
                        <input type="tel" placeholder="Mobile *" value={form.phone} onChange={set('phone')} aria-label="Mobile" />
                        {errors.phone && <span style={errStyle}>{errors.phone}</span>}
                      </div>
                      <div className="field" style={{ display: 'flex', alignItems: 'center', color: '#666', fontSize: 13 }}>
                        Verify your contact details with simple OTP for smooth delivery process.
                      </div>
                    </div>

                    {/* Create account toggle */}
                    <div className="field">
                      <div
                        className="checkout-toggle-label"
                        onClick={() => setCreateAccount(v => !v)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div className={`ck-box ${createAccount ? 'checked' : ''}`} />
                        Create an account?
                      </div>
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
                      <label className="required">Country</label>
                      <select className="orderby" value={form.country} onChange={set('country')} aria-label="Country">
                        <option value="">Country *</option>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">First Name</label>
                        <input type="text" placeholder="First Name *" value={form.firstName} onChange={set('firstName')} aria-label="Shipping First Name" />
                        {errors.firstName && <span style={errStyle}>{errors.firstName}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Last Name</label>
                        <input type="text" placeholder="Last Name *" value={form.lastName} onChange={set('lastName')} aria-label="Shipping Last Name" />
                        {errors.lastName && <span style={errStyle}>{errors.lastName}</span>}
                      </div>
                    </div>
                    <div className="field">
                      <label>Company Name</label>
                      <input type="text" placeholder="Company Name (optional)" value={form.company} onChange={set('company')} aria-label="Company Name" />
                    </div>
                    <div className="field">
                      <label className="required">Address</label>
                      <input type="text" placeholder="Address *" value={form.address} onChange={set('address')} aria-label="Address" />
                      {errors.address && <span style={errStyle}>{errors.address}</span>}
                    </div>
                    <div className="field">
                      <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={form.address2} onChange={set('address2')} aria-label="Address line 2" />
                    </div>
                    <div className="field">
                      <label className="required">Town / City</label>
                      <input type="text" placeholder="Town / City *" value={form.city} onChange={set('city')} aria-label="Town / City" />
                      {errors.city && <span style={errStyle}>{errors.city}</span>}
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">State / County</label>
                        <input type="text" placeholder="State / County *" value={form.state} onChange={set('state')} aria-label="State / County" />
                        {errors.state && <span style={errStyle}>{errors.state}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Postcode / Zip</label>
                        <input type="text" placeholder="Postcode / Zip *" value={form.zip} onChange={set('zip')} aria-label="Postcode / Zip" />
                        {errors.zip && <span style={errStyle}>{errors.zip}</span>}
                      </div>
                    </div>

                    {/* Bill to different address toggle */}
                    <div className="field">
                      <div
                        className="checkout-toggle-label"
                        onClick={() => setShipToDifferent(v => !v)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div className={`ck-box ${shipToDifferent ? 'checked' : ''}`} />
                        Bill to a different address
                      </div>
                    </div>

                    {shipToDifferent && (
                      <div className="checkout-shipping-box">
                        <h5 style={{ marginBottom: 12 }}>Billing Address</h5>
                        <div className="field">
                          <label>Country</label>
                          <select className="orderby" value={form.sCountry} onChange={set('sCountry')} aria-label="Billing Country">
                            <option value="">Country *</option>
                            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label className="required">First Name</label>
                            <input type="text" placeholder="First Name *" value={form.sFirstName} onChange={set('sFirstName')} aria-label="Billing First Name" />
                            {errors.sFirstName && <span style={errStyle}>{errors.sFirstName}</span>}
                          </div>
                          <div className="field">
                            <label className="required">Last Name</label>
                            <input type="text" placeholder="Last Name *" value={form.sLastName} onChange={set('sLastName')} aria-label="Billing Last Name" />
                            {errors.sLastName && <span style={errStyle}>{errors.sLastName}</span>}
                          </div>
                        </div>
                        <div className="field">
                          <label>Company Name</label>
                          <input type="text" placeholder="Company Name (optional)" value={form.sCompany} onChange={set('sCompany')} aria-label="Billing Company Name" />
                        </div>
                        <div className="field">
                          <label className="required">Address</label>
                          <input type="text" placeholder="Address *" value={form.sAddress} onChange={set('sAddress')} aria-label="Billing Address" />
                          {errors.sAddress && <span style={errStyle}>{errors.sAddress}</span>}
                        </div>
                        <div className="field">
                          <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={form.sAddress2} onChange={set('sAddress2')} aria-label="Billing Address line 2" />
                        </div>
                        <div className="field">
                          <label className="required">Town / City</label>
                          <input type="text" placeholder="Town / City *" value={form.sCity} onChange={set('sCity')} aria-label="Billing Town / City" />
                          {errors.sCity && <span style={errStyle}>{errors.sCity}</span>}
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label className="required">State / County</label>
                            <input type="text" placeholder="State / County *" value={form.sState} onChange={set('sState')} aria-label="Billing State / County" />
                            {errors.sState && <span style={errStyle}>{errors.sState}</span>}
                          </div>
                          <div className="field">
                            <label className="required">Postcode / Zip</label>
                            <input type="text" placeholder="Postcode / Zip *" value={form.sZip} onChange={set('sZip')} aria-label="Billing Postcode / Zip" />
                            {errors.sZip && <span style={errStyle}>{errors.sZip}</span>}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="field last">
                      <label>Order Notes</label>
                      <textarea rows={4} placeholder="Order notes (optional)" value={form.notes} onChange={set('notes')} aria-label="Order Notes" />
                    </div>
                  </div>

                  <div className="checkout-side">
                    <div className="box order-products dima-box">
                      <div className="checkout-summary-card">
                        <h4 className="checkout-summary-title">Order Summary</h4>
                        <div className="checkout-summary-row">
                          <span>Cart Subtotal</span>
                          <strong>&#8377;{total.toFixed(2)}</strong>
                        </div>
                        <div className="checkout-summary-row">
                          <span>Discount</span>
                          <strong>&#8377;0.00</strong>
                        </div>
                        <div className="checkout-summary-row">
                          <span>Shipping &amp; Handling</span>
                          <strong>&#8377;0.00</strong>
                        </div>
                        <div className="checkout-summary-total">
                          <span>Order Total</span>
                          <span>&#8377;{orderTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="checkout-order-items">
                        <h4 className="checkout-subsection-title" style={{ marginTop: 0 }}>Your Item</h4>
                        {items.map((item) => (
                          <div key={item.cartItemId} className="checkout-order-item">
                            <img
                              src={item.image || '/store/images/dummy.png'}
                              alt={item.title}
                              className="checkout-order-thumb"
                            />
                            <div className="checkout-order-meta">
                              {item.title}
                              {(item.color || item.size) && (
                                <span>{[item.color, item.size].filter(Boolean).join(' / ')}</span>
                              )}
                              <span>Qty: {item.quantity}</span>
                            </div>
                            <div className="checkout-order-price">
                              &#8377;{(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="checkout-cta">
                        <button
                          type="button"
                          className="button fill uppercase"
                          onClick={() => {
                            setShowPayment(true);
                            setPaymentMethod('cod');
                          }}
                        >
                          Continue to Payment
                        </button>
                      </div>

                      {showPayment && (
                        <>
                          <h4 className="checkout-subsection-title" style={{ marginTop: 20 }}>Payment Method</h4>
                          <div className="checkout-payment-list">
                            <div className={`checkout-payment-item ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                              <label className="checkout-payment-label">
                                <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={(e) => setPaymentMethod(e.target.value)} />
                                <span><strong>Cash on Delivery</strong></span>
                              </label>
                            </div>
                            <div className={`checkout-payment-item ${paymentMethod === 'card' ? 'selected' : ''}`}>
                              <label className="checkout-payment-label">
                                <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)} />
                                <span><strong>Credit/Debit Card</strong></span>
                              </label>
                            </div>
                          </div>

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

                          {/* Terms checkbox */}
                          <div className="field checkout-terms">
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}
                              onClick={() => setTerms(v => !v)}
                            >
                              <div className={`ck-box ${terms ? 'checked' : ''}`} />
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                I&apos;ve read and accept the <a href="#" onClick={e => e.stopPropagation()}>terms &amp; conditions</a>
                              </span>
                            </div>
                            {errors.terms && <span style={{ ...errStyle, display: 'block', marginTop: 4 }}>{errors.terms}</span>}
                          </div>
                        </>
                      )}
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
