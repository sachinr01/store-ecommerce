'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart } from '../lib/cartContext';
import { getRecentOrderAddresses, getActiveCoupon, applyCoupon, removeCoupon, type RecentOrderAddress, type AppliedCoupon } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { formatPrice } from '../lib/price';
import Script from 'next/script';

// ─── Types ────────────────────────────────────────────────────────────────────

type AddressFields = {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  email: string;
};

const emptyAddress: AddressFields = {
  firstName: '', lastName: '', company: '',
  address1: '', address2: '', city: '',
  state: '', postcode: '', phone: '', email: '',
};

const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

// A "previous order address" card shown in the UI
type PreviousAddressCard = {
  key: string;
  name: string;
  phone: string;
  lines: string[];
  raw: Omit<AddressFields, 'email'>;
};

function recentToCard(row: RecentOrderAddress, index: number): PreviousAddressCard {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const line1 = [row.address_line1, row.address_line2].filter(Boolean).join(', ').trim();
  const location = [row.city, row.state_name, row.zipcode].filter(Boolean).join(', ').trim();
  return {
    key: `${row.address_id}-${index}`,
    name,
    phone: row.phone || '',
    lines: [line1, location].filter(Boolean),
    raw: {
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      company: '',
      address1: row.address_line1 || '',
      address2: row.address_line2 || '',
      city: row.city || '',
      state: row.state_name || '',
      postcode: row.zipcode || '',
      phone: row.phone || '',
    },
  };
}

// Deduplicate address cards by address1+city+postcode
function deduplicateCards(cards: PreviousAddressCard[]): PreviousAddressCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const sig = `${c.raw.address1}|${c.raw.city}|${c.raw.postcode}`.toLowerCase();
    if (!sig.replace(/\|/g, '').trim()) return false; // drop blank cards immediately
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  // ─── UI state ───────────────────────────────────────────────────────────────
  const [showLogin, setShowLogin] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  // ─── Coupon state ────────────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [showPayment, setShowPayment] = useState(false);
  const [terms, setTerms] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Previous order addresses ───────────────────────────────────────────────
  const [prevShippingCards, setPrevShippingCards] = useState<PreviousAddressCard[]>([]);
  const [prevBillingCards, setPrevBillingCards] = useState<PreviousAddressCard[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(false);
  // null = "enter new address" / no card selected
  const [selectedShippingKey, setSelectedShippingKey] = useState<string | null>(null);
  const [selectedBillingKey, setSelectedBillingKey] = useState<string | null>(null);

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [shipForm, setShipForm] = useState<AddressFields>({ ...emptyAddress });
  const [billForm, setBillForm] = useState<AddressFields>({ ...emptyAddress });

  // ─── Load previous order addresses for logged-in users ──────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;

    const load = async () => {
      setLoadingPrev(true);
      try {
        const rows = await getRecentOrderAddresses();
        if (!active) return;

        const shippingRows = rows.filter((r) => r.address_billing !== 'yes');
        const billingRows = rows.filter((r) => r.address_billing === 'yes');

        const shippingCards = deduplicateCards(shippingRows.map((r, i) => recentToCard(r, i)));
        const billingCards = deduplicateCards(billingRows.map((r, i) => recentToCard(r, i)));

        // Only set cards that actually have address data (filter out empty rows)
        const validShipping = shippingCards.filter((c) => c.raw.address1.trim());
        const validBilling = billingCards.filter((c) => c.raw.address1.trim());

        setPrevShippingCards(validShipping);
        setPrevBillingCards(validBilling);

        // Auto-select the most recent if available
        if (validShipping.length > 0) setSelectedShippingKey(validShipping[0].key);
        if (validBilling.length > 0) setSelectedBillingKey(validBilling[0].key);
      } catch {
        // No previous orders — first-time user — show blank forms
      } finally {
        if (active) setLoadingPrev(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [isLoggedIn]);

  // ─── Load active coupon — re-runs whenever cart items change ─────────────────
  // This ensures the discount shown is always live: if the user removes a product
  // that was the only eligible item for the coupon, the discount clears instantly
  // instead of staying stale until Place Order fails server-side.
  useEffect(() => {
    getActiveCoupon().then((c) => {
      if (c) {
        setAppliedCoupon(c);
        setCouponInput(c.code);
        setShowCoupon(true);
      } else {
        // Server said coupon is no longer valid for the current cart — clear it
        setAppliedCoupon(null);
      }
    }).catch(() => { });
  }, [items]); // <-- re-run on every cart change

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

  // ─── Discount calculation ────────────────────────────────────────────────────
  // When include_categories is set, the server returns an eligibleSubtotal
  // (sum of matching items only). We calculate the discount on that base so
  // the Order Summary shows the correct partial discount amount.
  const discount = appliedCoupon?.discount ?? 0;

  const orderTotal = Math.max(0, total - discount);

  // ─── Resolved addresses ─────────────────────────────────────────────────────
  const resolvedShipping = useMemo<AddressFields>(() => {
    if (selectedShippingKey) {
      const card = prevShippingCards.find((c) => c.key === selectedShippingKey);
      if (card) return { ...card.raw, email: contactEmail, phone: card.raw.phone || contactPhone };
    }
    return { ...shipForm, email: contactEmail, phone: shipForm.phone || contactPhone };
  }, [selectedShippingKey, prevShippingCards, shipForm, contactEmail, contactPhone]);

  const resolvedBilling = useMemo<AddressFields>(() => {
    if (billingSameAsShipping) return resolvedShipping;
    if (selectedBillingKey) {
      const card = prevBillingCards.find((c) => c.key === selectedBillingKey);
      if (card) return { ...card.raw, email: contactEmail, phone: card.raw.phone || contactPhone };
    }
    return { ...billForm, email: contactEmail, phone: billForm.phone || contactPhone };
  }, [billingSameAsShipping, selectedBillingKey, prevBillingCards, billForm, resolvedShipping, contactEmail, contactPhone]);

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validate = (withTerms = true) => {
    const e: Record<string, string> = {};

    if (!contactFirstName.trim()) e.contactFirstName = 'Required';
    if (!contactLastName.trim()) e.contactLastName = 'Required';
    if (!contactEmail.trim()) {
      e.contactEmail = 'Required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      e.contactEmail = 'Enter a valid email address';
    }
    if (!contactPhone.trim()) {
      e.contactPhone = 'Required';
    } else if (contactPhone.replace(/\D/g, '').length < 10) {
      e.contactPhone = 'Enter a valid 10-digit phone number';
    }

    // Shipping validation
    if (selectedShippingKey) {
      if (!prevShippingCards.find((c) => c.key === selectedShippingKey)) {
        e.shipping = 'Please select a valid shipping address.';
      }
    } else {
      if (!shipForm.firstName.trim()) e.shipFirstName = 'Required';
      if (!shipForm.lastName.trim()) e.shipLastName = 'Required';
      if (!shipForm.phone.trim()) e.shipPhone = 'Required';
      if (!shipForm.address1.trim()) e.shipAddress = 'Required';
      if (!shipForm.city.trim()) e.shipCity = 'Required';
      if (!shipForm.state.trim()) e.shipState = 'Required';
      if (!shipForm.postcode.trim()) e.shipZip = 'Required';
    }

    if (!billingSameAsShipping) {
      if (selectedBillingKey) {
        if (!prevBillingCards.find((c) => c.key === selectedBillingKey)) {
          e.billing = 'Please select a valid billing address.';
        }
      } else {
        if (!billForm.firstName.trim()) e.billFirstName = 'Required';
        if (!billForm.lastName.trim()) e.billLastName = 'Required';
        if (!billForm.phone.trim()) e.billPhone = 'Required';
        if (!billForm.address1.trim()) e.billAddress = 'Required';
        if (!billForm.city.trim()) e.billCity = 'Required';
        if (!billForm.state.trim()) e.billState = 'Required';
        if (!billForm.postcode.trim()) e.billZip = 'Required';
      }
    }

    if (withTerms && !terms) e.terms = 'You must accept the terms & conditions';

    setErrors(e);
    if (Object.keys(e).length > 0) {
      setTimeout(() => {
        document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    return Object.keys(e).length === 0;
  };

  // ─── Place order ────────────────────────────────────────────────────────────
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setPlacing(true);
    setOrderError(null);

    try {
      const shipping = {
        first_name: resolvedShipping.firstName,
        last_name: resolvedShipping.lastName,
        phone: resolvedShipping.phone,
        address: resolvedShipping.address1,
        address_2: resolvedShipping.address2,
        city: resolvedShipping.city,
        state: resolvedShipping.state,
        postcode: resolvedShipping.postcode,
        company: resolvedShipping.company,
      };

      const billing = {
        first_name: resolvedBilling.firstName,
        last_name: resolvedBilling.lastName,
        email: resolvedBilling.email,
        phone: resolvedBilling.phone,
        address: resolvedBilling.address1,
        address_2: resolvedBilling.address2,
        city: resolvedBilling.city,
        state: resolvedBilling.state,
        postcode: resolvedBilling.postcode,
        company: resolvedBilling.company,
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
          notes,
        }),
      });

      const data = await res.json();

      if (data.razorpay) {

        const options = {
          key: data.key,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpayOrderId,

          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {

            const verifyRes = await fetch('/store/api/orders/place', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                billing,
                shipping,
                payment_method: 'razorpay',
                shipping_cost: 0,
                notes,

                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              router.push(`/checkout/success?order=${verifyData.data.orderId}`);
            }
          }
        };

        const razor = new window.Razorpay(options);
        razor.open();

        setPlacing(false);
        return;
      }


      if (!res.ok || !data.success) {
        // Coupon was invalidated server-side — show error in coupon box, not near Place Order
        if (data.coupon_error) {
          setAppliedCoupon(null);
          setCouponInput('');
          setCouponMsg({ text: data.message, ok: false });
          setShowCoupon(true);
          setPlacing(false);
          setTimeout(() => {
            document.querySelector('.checkout-coupon-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          return;
        }
        throw new Error(data.message || 'Order placement failed.');
      }

      try { await clearCart(); } catch { }
      const orderId = data?.data?.orderId;
      router.push(orderId ? `/checkout/success?order=${orderId}` : '/checkout/success');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Order placement failed.');
    } finally {
      setPlacing(false);
    }
  };

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
        .checkout-order-item { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1ece4; }
        .checkout-order-item:last-child { border-bottom: none; }
        .checkout-order-thumb { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; border: 1px solid #eee3d6; background: #faf6f0; }
        .checkout-order-meta { font-size: 14px; color: #222; }
        .checkout-order-meta span { display: block; font-size: 12px; color: #777; margin-top: 4px; }
        .checkout-order-price { font-weight: 700; font-size: 14px; color: #222; }
        .checkout-cta { margin: 18px 0; }
        .checkout-page .field > label:not(.checkout-toggle-label) { display: none; }
        .checkout-page .field input, .checkout-page .field select, .checkout-page .field textarea { font-size: 13px; padding: 8px 12px; border-radius: 4px; }
        .checkout-page .field input, .checkout-page .field select { height: 40px; }
        .checkout-page .field textarea { min-height: 80px; }
        .ck-box { width: 20px; height: 20px; min-width: 20px; min-height: 20px; border: 2px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background 0.15s, border-color 0.15s; box-sizing: border-box; }
        .ck-box.checked { background: #e53935; border-color: #e53935; }
        .ck-box.checked::after { content: ''; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) translateY(-1px); display: block; }
        .checkout-toggle-label, .checkout-terms label { gap: 10px; font-size: 15px; font-weight: 600; color: #2563eb; }
        .checkout-terms label span, .checkout-terms label a { color: #2563eb; font-weight: 600; }
        .checkout-section-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a1a; }
        .checkout-subsection-title { margin: 26px 0 14px; font-size: 22px; font-weight: 700; color: #1a1a1a; }
        .checkout-inline-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .checkout-toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
        .checkout-card-box, .checkout-account-box, .checkout-shipping-box, .checkout-login-box, .checkout-coupon-box { padding: 18px; border: 1px solid #ece7dc; background: #fff; }
        .checkout-login-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 14px; }
        .checkout-coupon-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
        .checkout-payment-list { margin: 0; padding: 0; display: grid; gap: 12px; }
        .checkout-payment-item { border: 1px solid #eee3d6; border-radius: 10px; padding: 12px 14px; background: #fff; }
        .checkout-payment-item.selected { border-color: #00cfc1; background: #f7fffd; }
        .checkout-payment-label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; width: 100%; }
        .checkout-payment-label input { margin-top: 3px; }
        .checkout-card-box { border: 1px solid #eee3d6; background: #fff; border-radius: 10px; padding: 14px; }
        .checkout-submit { width: 100%; margin-bottom: 12px; cursor: pointer; }
        .checkout-terms { margin-top: 8px; font-size: 13px; }
        .checkout-terms a { white-space: nowrap; }
        .checkout-prev-addr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .address-card { border: 1px solid #e6ded3; border-radius: 10px; padding: 14px 16px; background: #fff; text-align: left; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
        .address-card:hover { border-color: #d2c7b8; box-shadow: 0 10px 22px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .address-card.selected { border-color: #00cfc1; box-shadow: 0 10px 22px rgba(0,207,193,0.15); background: #f7fffd; }
        .address-card-tag { display: inline-flex; align-items: center; padding: 2px 8px; font-size: 11px; border-radius: 999px; background: #eaf0ff; color: #2f5bd6; margin-bottom: 10px; font-weight: 600; }
        .address-card-name { font-size: 14px; font-weight: 700; color: #222; margin-bottom: 6px; }
        .address-card-line { font-size: 13px; color: #5f5a52; line-height: 1.5; }
        .address-card-phone { font-size: 12px; color: #7b746b; margin-top: 6px; }
        .address-card.add-new { border-style: dashed; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: #3a3a3a; min-height: 80px; }
        .address-card.add-new span { font-size: 13px; }
        .address-help { font-size: 13px; color: #6f6a61; margin: 0 0 10px; }
        @media (max-width: 991px) { .checkout-content { padding-top: 18px; } .checkout-grid { grid-template-columns: 1fr; } .checkout-side .order-products { position: static; } }
        @media (max-width: 767px) { .checkout-page { padding-bottom: 28px; } .checkout-content { padding-top: 14px; } .checkout-box, .checkout-card-box, .checkout-account-box, .checkout-shipping-box, .checkout-login-box, .checkout-coupon-box, .checkout-side .order-products { padding: 16px; } .checkout-inline-row, .checkout-coupon-grid { grid-template-columns: 1fr; gap: 12px; } .checkout-section-title { font-size: 22px; } .checkout-subsection-title { font-size: 20px; } .checkout-order-toggle { align-items: stretch; flex-direction: column; } }
        @media (max-width: 480px) { .checkout-page .page-section { padding-top: 28px; padding-bottom: 28px; } .checkout-section-title { font-size: 20px; } .checkout-subsection-title { font-size: 18px; } .checkout-login-actions > * { width: 100%; text-align: center; } .checkout-terms label { align-items: flex-start !important; } }
      `}</style>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <Header />
      <div className="dima-main checkout-page">
        <nav style={{ padding: '13px 48px', fontSize: 13, color: '#888', display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid #ececec', background: '#fff', flexWrap: 'wrap' as const }}>
          <Link href="/" style={{ color: '#888', textDecoration: 'none' }}>Home</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <Link href="/shop" style={{ color: '#888', textDecoration: 'none' }}>Shop</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <span style={{ color: '#1c1c1c', fontWeight: 500 }}>Checkout</span>
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
                      <label>Username or Email</label>
                      <input type="text" placeholder="Username or email" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Password</label>
                      <input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
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
                      <input
                        type="text"
                        placeholder="Coupon Code"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        disabled={!!appliedCoupon}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyCoupon(); } }}
                      />
                    </div>
                    {appliedCoupon ? (
                      <button
                        type="button"
                        className="button small uppercase"
                        style={{ minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e53935', color: '#fff', border: 'none' }}
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button small fill uppercase"
                        style={{ minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={() => void handleApplyCoupon()}
                        disabled={couponLoading}
                      >
                        {couponLoading ? '...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {couponMsg && (
                    <p style={{ marginTop: 8, fontSize: 13, color: couponMsg.ok ? '#2e7d32' : '#c62828' }}>
                      {couponMsg.text}
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handlePlaceOrder} noValidate className="form-small form">
                <div className="checkout-grid">
                  <div className="checkout-main">

                    {/* ── Contact Information ──────────────────────────────── */}
                    <h4 className="checkout-section-title">Contact Information</h4>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">First Name</label>
                        <input type="text" placeholder="First Name *" value={contactFirstName} onChange={(e) => setContactFirstName(e.target.value)} aria-label="First Name" />
                        {errors.contactFirstName && <span data-error style={errStyle}>{errors.contactFirstName}</span>}
                      </div>
                      <div className="field">
                        <label className="required">Last Name</label>
                        <input type="text" placeholder="Last Name *" value={contactLastName} onChange={(e) => setContactLastName(e.target.value)} aria-label="Last Name" />
                        {errors.contactLastName && <span data-error style={errStyle}>{errors.contactLastName}</span>}
                      </div>
                    </div>
                    <div className="field">
                      <label className="required">Email Address</label>
                      <input type="email" placeholder="Email Address *" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} aria-label="Email Address" />
                      {errors.contactEmail && <span data-error style={errStyle}>{errors.contactEmail}</span>}
                    </div>
                    <div className="checkout-inline-row">
                      <div className="field">
                        <label className="required">Mobile</label>
                        <input type="tel" placeholder="Mobile *" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} aria-label="Mobile" />
                        {errors.contactPhone && <span data-error style={errStyle}>{errors.contactPhone}</span>}
                      </div>
                      <div className="field" style={{ display: 'flex', alignItems: 'center', color: '#666', fontSize: 13 }}>
                        Verify your contact details with simple OTP for smooth delivery process.
                      </div>
                    </div>
                    <div className="field">
                      <button
                        type="button"
                        className="checkout-toggle-label"
                        onClick={() => router.push('/my-account')}
                        style={{ cursor: 'pointer', userSelect: 'none', background: 'transparent', border: 'none', padding: 0 }}
                      >
                        <div className="ck-box" />
                        Create an account?
                      </button>
                    </div>

                    {/* ── Shipping Address ─────────────────────────────────── */}
                    <h4 className="checkout-subsection-title">Shipping Address</h4>

                    {isLoggedIn && loadingPrev && (
                      <p className="address-help">Loading your previous addresses...</p>
                    )}

                    {/* Previous order address cards — only shown if user has past orders */}
                    {isLoggedIn && !loadingPrev && prevShippingCards.length > 0 && (
                      <>
                        <p className="address-help">Select a previously used address or enter a new one below.</p>
                        <div className="checkout-prev-addr-grid">
                          {prevShippingCards.map((card) => (
                            <button
                              key={card.key}
                              type="button"
                              className={`address-card ${selectedShippingKey === card.key ? 'selected' : ''}`}
                              onClick={() => setSelectedShippingKey(card.key)}
                            >
                              <span className="address-card-tag">Used before</span>
                              {card.name && <div className="address-card-name">{card.name}</div>}
                              {card.lines.map((line, i) => (
                                <div key={i} className="address-card-line">{line}</div>
                              ))}
                              {card.phone && <div className="address-card-phone">{card.phone}</div>}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`address-card add-new ${selectedShippingKey === null ? 'selected' : ''}`}
                            onClick={() => setSelectedShippingKey(null)}
                          >
                            <span>+ Enter new address</span>
                          </button>
                        </div>
                      </>
                    )}

                    {errors.shipping && <span data-error style={errStyle}>{errors.shipping}</span>}

                    {/* Show shipping form when: no previous cards, or user clicked "new address" */}
                    {(!isLoggedIn || (!loadingPrev && (prevShippingCards.length === 0 || selectedShippingKey === null))) && (
                      <>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label className="required">First Name</label>
                            <input type="text" placeholder="First Name *" value={shipForm.firstName} onChange={(e) => setShipForm((f) => ({ ...f, firstName: e.target.value }))} aria-label="Shipping First Name" />
                            {errors.shipFirstName && <span data-error style={errStyle}>{errors.shipFirstName}</span>}
                          </div>
                          <div className="field">
                            <label className="required">Last Name</label>
                            <input type="text" placeholder="Last Name *" value={shipForm.lastName} onChange={(e) => setShipForm((f) => ({ ...f, lastName: e.target.value }))} aria-label="Shipping Last Name" />
                            {errors.shipLastName && <span data-error style={errStyle}>{errors.shipLastName}</span>}
                          </div>
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label>Phone No.</label>
                            <input type="tel" placeholder="Phone No. *" value={shipForm.phone} onChange={(e) => setShipForm((f) => ({ ...f, phone: e.target.value }))} aria-label="Shipping Phone" />
                            {errors.shipPhone && <span data-error style={errStyle}>{errors.shipPhone}</span>}
                          </div>
                          <div className="field">
                            <label>Company Name</label>
                            <input type="text" placeholder="Company Name (optional)" value={shipForm.company} onChange={(e) => setShipForm((f) => ({ ...f, company: e.target.value }))} />
                          </div>
                        </div>
                        <div className="field">
                          <label className="required">Address</label>
                          <input type="text" placeholder="Address *" value={shipForm.address1} onChange={(e) => setShipForm((f) => ({ ...f, address1: e.target.value }))} aria-label="Address" />
                          {errors.shipAddress && <span data-error style={errStyle}>{errors.shipAddress}</span>}
                        </div>
                        <div className="field">
                          <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={shipForm.address2} onChange={(e) => setShipForm((f) => ({ ...f, address2: e.target.value }))} aria-label="Address line 2" />
                        </div>
                        <div className="field">
                          <label className="required">Town / City</label>
                          <input type="text" placeholder="Town / City *" value={shipForm.city} onChange={(e) => setShipForm((f) => ({ ...f, city: e.target.value }))} aria-label="Town / City" />
                          {errors.shipCity && <span data-error style={errStyle}>{errors.shipCity}</span>}
                        </div>
                        <div className="checkout-inline-row">
                          <div className="field">
                            <label className="required">State</label>
                            <select
                              value={shipForm.state}
                              onChange={(e) => setShipForm((f) => ({ ...f, state: e.target.value }))}
                              aria-label="State"
                            >
                              <option value="">Select State *</option>
                              {INDIA_STATES.map((state) => (
                                <option key={state} value={state}>
                                  {state}
                                </option>
                              ))}
                            </select>
                            {errors.shipState && <span data-error style={errStyle}>{errors.shipState}</span>}
                          </div>
                          <div className="field">
                            <label className="required">Postcode / Zip</label>
                            <input type="text" placeholder="Postcode / Zip *" value={shipForm.postcode} onChange={(e) => setShipForm((f) => ({ ...f, postcode: e.target.value }))} aria-label="Postcode / Zip" />
                            {errors.shipZip && <span data-error style={errStyle}>{errors.shipZip}</span>}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── Billing same as shipping ──────────────────────────── */}
                    <div className="field" style={{ marginTop: 16 }}>
                      <div
                        className="checkout-toggle-label"
                        onClick={() => setBillingSameAsShipping(v => !v)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div className={`ck-box ${billingSameAsShipping ? 'checked' : ''}`} />
                        Same as shipping address
                      </div>
                    </div>

                    {/* ── Billing Address ──────────────────────────────────── */}
                    {!billingSameAsShipping && (
                      <div className="checkout-shipping-box" style={{ marginTop: 12 }}>
                        <h5 style={{ marginBottom: 12 }}>Billing Address</h5>

                        {isLoggedIn && !loadingPrev && prevBillingCards.length > 0 && (
                          <>
                            <p className="address-help">Select a previously used billing address or enter a new one.</p>
                            <div className="checkout-prev-addr-grid">
                              {prevBillingCards.map((card) => (
                                <button
                                  key={card.key}
                                  type="button"
                                  className={`address-card ${selectedBillingKey === card.key ? 'selected' : ''}`}
                                  onClick={() => setSelectedBillingKey(card.key)}
                                >
                                  <span className="address-card-tag">Used before</span>
                                  {card.name && <div className="address-card-name">{card.name}</div>}
                                  {card.lines.map((line, i) => (
                                    <div key={i} className="address-card-line">{line}</div>
                                  ))}
                                  {card.phone && <div className="address-card-phone">{card.phone}</div>}
                                </button>
                              ))}
                              <button
                                type="button"
                                className={`address-card add-new ${selectedBillingKey === null ? 'selected' : ''}`}
                                onClick={() => setSelectedBillingKey(null)}
                              >
                                <span>+ Enter new billing address</span>
                              </button>
                            </div>
                          </>
                        )}

                        {errors.billing && <span data-error style={errStyle}>{errors.billing}</span>}

                        {(!isLoggedIn || (!loadingPrev && (prevBillingCards.length === 0 || selectedBillingKey === null))) && (
                          <>
                            <div className="checkout-inline-row">
                              <div className="field">
                                <label className="required">First Name</label>
                                <input type="text" placeholder="First Name *" value={billForm.firstName} onChange={(e) => setBillForm((f) => ({ ...f, firstName: e.target.value }))} aria-label="Billing First Name" />
                                {errors.billFirstName && <span data-error style={errStyle}>{errors.billFirstName}</span>}
                              </div>
                              <div className="field">
                                <label className="required">Last Name</label>
                                <input type="text" placeholder="Last Name *" value={billForm.lastName} onChange={(e) => setBillForm((f) => ({ ...f, lastName: e.target.value }))} aria-label="Billing Last Name" />
                                {errors.billLastName && <span data-error style={errStyle}>{errors.billLastName}</span>}
                              </div>
                            </div>
                            <div className="checkout-inline-row">
                              <div className="field">
                                <label>Phone No.</label>
                                <input type="tel" placeholder="Phone No. *" value={billForm.phone} onChange={(e) => setBillForm((f) => ({ ...f, phone: e.target.value }))} aria-label="Billing Phone" />
                                {errors.billPhone && <span data-error style={errStyle}>{errors.billPhone}</span>}
                              </div>
                              <div className="field">
                                <label>Company Name</label>
                                <input type="text" placeholder="Company Name (optional)" value={billForm.company} onChange={(e) => setBillForm((f) => ({ ...f, company: e.target.value }))} />
                              </div>
                            </div>
                            <div className="field">
                              <label className="required">Address</label>
                              <input type="text" placeholder="Address *" value={billForm.address1} onChange={(e) => setBillForm((f) => ({ ...f, address1: e.target.value }))} aria-label="Billing Address" />
                              {errors.billAddress && <span data-error style={errStyle}>{errors.billAddress}</span>}
                            </div>
                            <div className="field">
                              <input type="text" placeholder="Apartment, suite, unit etc. (optional)" value={billForm.address2} onChange={(e) => setBillForm((f) => ({ ...f, address2: e.target.value }))} aria-label="Billing Address line 2" />
                            </div>
                            <div className="field">
                              <label className="required">Town / City</label>
                              <input type="text" placeholder="Town / City *" value={billForm.city} onChange={(e) => setBillForm((f) => ({ ...f, city: e.target.value }))} aria-label="Billing Town / City" />
                              {errors.billCity && <span data-error style={errStyle}>{errors.billCity}</span>}
                            </div>
                            <div className="checkout-inline-row">
                              <div className="field">
                                <label className="required">State</label>
                                <select
                                  value={billForm.state}
                                  onChange={(e) => setBillForm((f) => ({ ...f, state: e.target.value }))}
                                  aria-label="Billing State"
                                >
                                  <option value="">Select State *</option>
                                  {INDIA_STATES.map((state) => (
                                    <option key={state} value={state}>
                                      {state}
                                    </option>
                                  ))}
                                </select>
                                {errors.billState && <span data-error style={errStyle}>{errors.billState}</span>}
                              </div>
                              <div className="field">
                                <label className="required">Postcode / Zip</label>
                                <input type="text" placeholder="Postcode / Zip *" value={billForm.postcode} onChange={(e) => setBillForm((f) => ({ ...f, postcode: e.target.value }))} aria-label="Billing Postcode / Zip" />
                                {errors.billZip && <span data-error style={errStyle}>{errors.billZip}</span>}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="field last" style={{ marginTop: 16 }}>
                      <label>Order Notes</label>
                      <textarea rows={4} placeholder="Order notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Order Notes" />
                    </div>
                  </div>

                  {/* ── Side: Order summary + payment ───────────────────────── */}
                  <div className="checkout-side">
                    <div className="box order-products dima-box">
                      <div className="checkout-summary-card">
                        <h4 className="checkout-summary-title">Order Summary</h4>
                        <div className="checkout-summary-row">
                          <span>Cart Subtotal</span>
                          <strong>{formatPrice(total)}</strong>
                        </div>
                        {discount > 0 && (
                          <div className="checkout-summary-row" style={{ color: '#2e7d32' }}>
                            <span>Discount ({appliedCoupon?.code})</span>
                            <strong>−{formatPrice(discount)}</strong>
                          </div>
                        )}
                        <div className="checkout-summary-row">
                          <span>Shipping &amp; Handling</span>
                          <strong style={{ color: '#2e7d32' }}>Free</strong>
                        </div>
                        <div className="checkout-summary-total">
                          <span>Order Total</span>
                          <span>{formatPrice(orderTotal)}</span>
                        </div>
                      </div>

                      <div className="checkout-order-items">
                        <h4 className="checkout-subsection-title" style={{ marginTop: 0 }}>Your Items</h4>
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
                          onClick={() => { if (!validate(false)) return; if (!showPayment) setPaymentMethod('cod'); setShowPayment(true); }}
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
                            <div className={`checkout-payment-item ${paymentMethod === 'razorpay' ? 'selected' : ''}`}>
                              <label className="checkout-payment-label">
                                <input
                                  type="radio"
                                  name="payment"
                                  value="razorpay"
                                  checked={paymentMethod === 'razorpay'}
                                  onChange={(e) => setPaymentMethod(e.target.value)}
                                />
                                <span><strong>Razorpay</strong></span>
                              </label>
                            </div>
                          </div>

                          {showCardDetails && (
                            <div className="checkout-card-box" style={{ marginTop: 14 }}>
                              <h5 style={{ marginBottom: 10 }}>Card Details</h5>
                              <div className="field">
                                <label>Name on Card</label>
                                <input type="text" placeholder="Full name" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" />
                              </div>
                              <div className="field">
                                <label>Card Number</label>
                                <input type="text" inputMode="numeric" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} autoComplete="cc-number" />
                              </div>
                              <div className="checkout-inline-row">
                                <div className="field">
                                  <label>Expiry Date</label>
                                  <input type="text" inputMode="numeric" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} autoComplete="cc-exp" />
                                </div>
                                <div className="field">
                                  <label>CVV</label>
                                  <input type="password" inputMode="numeric" placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} autoComplete="cc-csc" />
                                </div>
                              </div>
                            </div>
                          )}

                          <button type="submit" style={{ marginTop: 20 }} className="button fill uppercase checkout-submit" disabled={placing}>
                            {placing ? 'Placing Order...' : 'Place Order'}
                          </button>

                          {orderError && <div style={{ color: '#c62828', fontSize: 13, marginBottom: 10 }}>{orderError}</div>}

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
                            {errors.terms && <span data-error style={{ ...errStyle, display: 'block', marginTop: 4 }}>{errors.terms}</span>}
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
