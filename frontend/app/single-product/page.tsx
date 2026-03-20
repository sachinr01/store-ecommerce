'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './single-product.css';

const IMAGES = [
  '/store/images/dummy.png',
  '/store/images/dummy.png',
  '/store/images/dummy.png',
  '/store/images/dummy.png',
  '/store/images/dummy.png',
  '/store/images/dummy.png',
];

/* accordion icon SVGs */
const AccIcons: Record<string, React.ReactElement> = {
  description: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  shipping: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  returns: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
    </svg>
  ),
};

const ACCORDIONS = [
  {
    key: 'description',
    label: 'Description',
    content: 'A vibrant canvas of tropical florals, these stainless steel tumblers carry the spirit of paradise wherever you go — fresh, free, and full of color.',
  },
  {
    key: 'info',
    label: 'Product Information & Care',
    content: `GENERAL SPECIFICATIONS
SKU: 8907605147371
Weight (gms.): 125
Primary Color: Offwhite

COMPOSITION AND USAGE
Material: Stainless Steel
Care Instructions: Don't microwave. Do not drop the product. Do not use harsh scrub, gentle wash only.

DIMENSIONS
Length (cms.): 7 | Height (cms.): 9 | Width (cms.): 7

SUPPLIER INFORMATION
Country of Origin: India
Manufactured By: Chumbak Design Pvt. Ltd., 520, CMH Road, Indiranagar, Bangalore - 560038`,
  },
  {
    key: 'shipping',
    label: 'Shipping Information',
    content: 'Order will be shipped within 1–2 days of order confirmation. Order status can be checked in My Account page. We charge ₹99 for orders with value below ₹999.',
  },
  {
    key: 'returns',
    label: 'Returns',
    content: 'Hassle free returns up to 14 days from the date of delivery, from "My Orders" or "Track Order" section of our website. Or, you can send a request to help@chumbak.in',
  },
];

export default function SingleProductPage() {
  const [activeImg, setActiveImg]         = useState(0);
  const [openAcc, setOpenAcc]             = useState<string | null>(null);
  const [quantity, setQuantity]           = useState(1);
  const [wishlisted, setWishlisted]       = useState(false);
  const [addedMsg, setAddedMsg]           = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [pincode, setPincode]             = useState('');
  const [pincodeMsg, setPincodeMsg]       = useState<string | null>(null);

  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      if (!ctaRef.current) return;
      setStickyVisible(ctaRef.current.getBoundingClientRect().bottom < 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAdd = () => {
    setAddedMsg(true);
    setTimeout(() => setAddedMsg(false), 2500);
  };

  const handlePincodeCheck = () => {
    if (!pincode.trim()) return;
    setPincodeMsg(pincode.length === 6
      ? 'Delivery available for this pincode!'
      : 'Please enter a valid 6-digit pincode.');
  };

  return (
    <>
      <Header />
      <div className="dima-main">

        {/* ── Breadcrumb ── */}
        <div className="sp-breadcrumb">
          <div className="sp-wrap">
            <Link href="/store">Home</Link>
            <span className="sp-bc-sep">›</span>
            <span className="sp-bc-current">Wild Bloom Steel Tumblers · Set of 2, 220ml | Lost in Paradise</span>
          </div>
        </div>

        <div className="sp-wrap">

          {/* ══ TOP: Gallery + Info ══ */}
          <div className="sp-product-section">

            {/* Gallery */}
            <div className="sp-gallery-col">
              <div className="sp-thumbs">
                {IMAGES.map((src, i) => (
                  <div key={i} className={`sp-thumb${activeImg === i ? ' active' : ''}`} onClick={() => setActiveImg(i)}>
                    <img src={src} alt={`View ${i + 1}`} />
                  </div>
                ))}
              </div>
              <div className="sp-main-img-wrap">
                <img src={IMAGES[activeImg]} alt="Wild Bloom Steel Tumblers" />
              </div>
            </div>

            {/* Info */}
            <div className="sp-info-col">

              <h1 className="sp-title">Wild Bloom Steel Tumblers - Set of 2, 220ml | Lost in Paradise</h1>

              <div className="sp-price-block">
                <span className="sp-mrp-label">MRP : </span>
                <span className="sp-mrp-val">₹ 999</span>
              </div>
              <p className="sp-tax-note">Inclusive of all taxes</p>

              <p className="sp-urgency">Only 11 Left in Stock – Selling Fast!</p>

              {/* Trust badges */}
              <div className="sp-badges">
                <div className="sp-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
                    <rect x="1" y="3" width="15" height="13" rx="1"/>
                    <path d="M16 8h4l3 5v3h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                  <span>Free delivery</span>
                </div>
                <div className="sp-badge-sep" />
                <div className="sp-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 12 11 14 15 10"/>
                  </svg>
                  <span>Secure payments</span>
                </div>
                <div className="sp-badge-sep" />
                <div className="sp-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 3H8L6 7h12l-2-4z"/>
                    <circle cx="12" cy="14" r="3"/>
                  </svg>
                  <span>Cash on delivery</span>
                </div>
              </div>

              {/* Qty */}
              <div className="sp-qty">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                <span className="sp-qty-val">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}>+</button>
              </div>

              {/* Delivery Date */}
              <div className="sp-delivery-section">
                <p className="sp-delivery-label">Delivery Date</p>
                <div className="sp-pincode-row">
                  <input
                    type="text"
                    className="sp-pincode-input"
                    placeholder="Enter pincode to check"
                    maxLength={6}
                    value={pincode}
                    onChange={e => { setPincode(e.target.value); setPincodeMsg(null); }}
                    onKeyDown={e => e.key === 'Enter' && handlePincodeCheck()}
                  />
                  <button className="sp-pincode-btn" onClick={handlePincodeCheck}>CHECK</button>
                </div>
                {pincodeMsg && (
                  <p className={`sp-pincode-msg${pincodeMsg.includes('available') ? ' ok' : ' err'}`}>{pincodeMsg}</p>
                )}
                <div className="sp-nextday-bar">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span>Next day delivery available in select locations!</span>
                </div>
                <div className="sp-express-bar">
                  <div className="sp-express-left">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                      <rect x="1" y="3" width="15" height="13" rx="1"/>
                      <path d="M16 8h4l3 5v3h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    <div className="sp-express-label">
                      <span className="sp-express-brand">CHUMBAK</span>
                      <span className="sp-express-sub">EXPRESS DELIVERY</span>
                    </div>
                  </div>
                  <span className="sp-express-text">SAME DAY DELIVERY IN BANGALORE</span>
                </div>
              </div>

              {/* CTA buttons */}
              <div ref={ctaRef}>
                {/* SHARE row */}
                <div className="sp-share-row">
                  <span className="sp-share-label">SHARE</span>
                  <button className="sp-share-btn" title="Share">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </button>
                </div>

                <button className={`sp-add-btn${addedMsg ? ' added' : ''}`} onClick={handleAdd}>
                  {addedMsg ? '✓ ADDED TO CART' : 'ADD TO CART'}
                </button>

                {/* BUY NOW with payment icons */}
                <Link href="/store/checkout" className="sp-buy-btn">
                  <span className="sp-buy-text">BUY NOW</span>
                  <span className="sp-buy-icons">
                    {/* GPay circle */}
                    <span className="sp-pay-icon sp-pay-g">G</span>
                    {/* PhonePe circle */}
                    <span className="sp-pay-icon sp-pay-p">P</span>
                    {/* UPI circle */}
                    <span className="sp-pay-icon sp-pay-u">U</span>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </span>
                  <span className="sp-buy-powered">Powered by Shiprocket</span>
                </Link>

                {/* Wishlist */}
                <button className={`sp-wishlist-btn${wishlisted ? ' active' : ''}`} onClick={() => setWishlisted(w => !w)}>
                  <svg viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" width="15" height="15">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {wishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                </button>
              </div>

              <p className="sp-sku-row">SKU: <span>8907605147371</span></p>

            </div>
          </div>

          {/* ══ BOTTOM: Accordions LEFT + Delivery RIGHT ══ */}
          <div className="sp-bottom-section">

            {/* Accordions — left 60% */}
            <div className="sp-accordions">
              {ACCORDIONS.map(acc => (
                <div key={acc.key} className={`sp-accordion${openAcc === acc.key ? ' open' : ''}`}>
                  <button className="sp-acc-header" onClick={() => setOpenAcc(openAcc === acc.key ? null : acc.key)}>
                    <span className="sp-acc-left">
                      <span className="sp-acc-icon-wrap">{AccIcons[acc.key]}</span>
                      <span>{acc.label}</span>
                    </span>
                    <span className="sp-acc-plus">+</span>
                  </button>
                  {openAcc === acc.key && (
                    <div className="sp-acc-body">
                      <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{acc.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right spacer — mirrors info col width */}
            <div className="sp-bottom-right" />

          </div>

        </div>
      </div>

      {/* ── Sticky bar ── */}
      {stickyVisible && (
        <div className="sp-sticky-bar">
          <div className="sp-wrap sp-sticky-inner">
            <img className="sp-sticky-img" src={IMAGES[0]} alt="Wild Bloom Steel Tumblers" />
            <div className="sp-sticky-info">
              <div className="sp-sticky-title">Wild Bloom Steel Tumblers - Set of 2, 220ml</div>
              <div className="sp-sticky-price">₹ 999</div>
            </div>
            <div className="sp-sticky-btns">
              <button className="sp-sticky-add" onClick={handleAdd}>ADD TO CART</button>
              <Link href="/store/checkout" className="sp-sticky-buy">BUY NOW</Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
