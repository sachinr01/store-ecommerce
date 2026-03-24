"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useCart } from "../lib/cartContext";
import { useAuth } from "../lib/authContext";

const PLACEHOLDER = "/store/images/dummy.png";

const toSlug = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function Header() {
  const { items, count, total, removeItem } = useCart();
  const { user, isLoggedIn } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);

  /* close cart on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) {
        setCartOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* lock body scroll when mobile menu open */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  /* focus search input when opened */
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const navLinks = [
    { label: "Shop",        href: "/shop" },
    { label: "Collections", href: "/shop" },
    { label: "Gifting",     href: "/shop" },
  ];

  return (
    <>
      <style>{`
        /* ── HEADER BASE ── */
        .nh-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #fff;
          border-bottom: 1px solid #eee;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        /* ── INNER LAYOUT ── */
        .nh-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 72px;
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
        }

        /* ── LEFT NAV ── */
        .nh-nav {
          display: flex;
          gap: 28px;
          list-style: none;
          margin: 0;
          padding: 0;
          flex: 1;
        }
        .nh-nav a {
          text-decoration: none;
          color: #1a1a1a;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.2s;
        }
        .nh-nav a:hover { color: #555; }

        /* ── CENTER LOGO ── */
        .nh-logo {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
        }
        .nh-logo img { height: 44px; width: auto; }

        /* ── RIGHT ICONS ── */
        .nh-icons {
          display: flex;
          align-items: center;
          gap: 18px;
          flex: 1;
          justify-content: flex-end;
        }

        /* Search pill */
        .nh-search-pill {
          display: flex;
          align-items: center;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 5px 14px;
          gap: 8px;
          background: #fff;
          transition: border-color 0.2s;
        }
        .nh-search-pill:focus-within { border-color: #999; }
        .nh-search-pill input {
          border: none;
          outline: none;
          font-size: 13px;
          color: #333;
          background: transparent;
          width: 130px;
          font-family: inherit;
        }
        .nh-search-pill svg { flex-shrink: 0; color: #888; }

        /* Login link */
        .nh-login {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          text-decoration: none;
          letter-spacing: 0.04em;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .nh-login:hover { color: #555; }

        /* Cart button */
        .nh-cart-wrap { position: relative; }
        .nh-cart-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          font-family: inherit;
          padding: 0;
          white-space: nowrap;
        }
        .nh-cart-badge {
          background: #1a1a1a;
          color: #fff;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        /* Cart dropdown */
        .nh-cart-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 300px;
          background: #fff;
          border: 1px solid #eee;
          box-shadow: 0 8px 24px rgba(0,0,0,0.10);
          z-index: 200;
          padding: 16px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-6px);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .nh-cart-dropdown.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .nh-cart-item {
          display: flex;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          align-items: flex-start;
        }
        .nh-cart-item img { width: 56px; height: 60px; object-fit: cover; border-radius: 3px; flex-shrink: 0; }
        .nh-cart-item-info { flex: 1; font-size: 12px; color: #333; }
        .nh-cart-item-title { font-weight: 600; margin-bottom: 3px; }
        .nh-cart-item-price { color: #666; }
        .nh-cart-remove {
          background: none; border: none; cursor: pointer;
          color: #aaa; font-size: 16px; padding: 0; line-height: 1;
          flex-shrink: 0;
        }
        .nh-cart-remove:hover { color: #e00; }
        .nh-cart-subtotal {
          display: flex; justify-content: space-between;
          padding: 12px 0 14px;
          font-size: 13px; font-weight: 700; color: #1a1a1a;
        }
        .nh-cart-actions { display: flex; flex-direction: column; gap: 8px; }
        .nh-cart-actions a {
          display: block; text-align: center;
          padding: 11px; font-size: 12px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          text-decoration: none; transition: background 0.2s, color 0.2s;
        }
        .nh-btn-view { background: #f0f0f0; color: #1a1a1a; }
        .nh-btn-view:hover { background: #e0e0e0; }
        .nh-btn-checkout { background: #1a1a1a; color: #fff; }
        .nh-btn-checkout:hover { background: #333; }
        .nh-cart-empty { font-size: 13px; color: #888; padding: 8px 0 16px; text-align: center; }

        /* ── SEARCH OVERLAY ── */
        .nh-search-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 1100;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
        }
        .nh-search-box {
          background: #fff;
          width: 100%;
          max-width: 600px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .nh-search-box input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 16px;
          font-family: inherit;
          color: #1a1a1a;
        }
        .nh-search-close {
          background: none; border: none; cursor: pointer;
          font-size: 22px; color: #888; padding: 0; line-height: 1;
        }

        /* ── MOBILE HAMBURGER (hidden on desktop) ── */
        .nh-hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          flex-direction: column;
          gap: 5px;
          align-items: center;
          justify-content: center;
        }
        .nh-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: #1a1a1a;
          border-radius: 2px;
          transition: all 0.3s;
        }

        /* ── MOBILE DRAWER ── */
        .nh-drawer-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 1200;
        }
        .nh-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          background: #fff;
          z-index: 1300;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .nh-drawer.open { transform: translateX(0); }
        .nh-drawer-overlay.open { display: block; }
        .nh-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 64px;
          border-bottom: 1px solid #eee;
          flex-shrink: 0;
        }
        .nh-drawer-close {
          background: none; border: none; cursor: pointer;
          font-size: 24px; color: #555; padding: 0; line-height: 1;
        }
        .nh-drawer-nav { list-style: none; margin: 0; padding: 0; }
        .nh-drawer-nav li a {
          display: block;
          padding: 15px 20px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1a1a1a;
          text-decoration: none;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.15s;
        }
        .nh-drawer-nav li a:hover { background: #fafafa; }
        .nh-drawer-footer {
          padding: 20px;
          border-top: 1px solid #eee;
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .nh-drawer-footer a {
          font-size: 13px;
          color: #555;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .nh-drawer-footer a:hover { color: #1a1a1a; }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .nh-inner { padding: 0 24px; }
          .nh-search-pill input { width: 100px; }
        }

        @media (max-width: 767px) {
          .nh-nav { display: none; }
          .nh-search-pill { display: none; }
          .nh-login { display: none; }
          .nh-hamburger { display: flex; }
          .nh-inner { padding: 0 16px; height: 60px; }
          .nh-logo img { height: 36px; }
        }
      `}</style>

      {/* ── MAIN HEADER ── */}
      <header className="nh-header">
        <div className="nh-inner">

          {/* LEFT — nav links (desktop) + hamburger (mobile) */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <button
              className="nh-hamburger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <span /><span /><span />
            </button>
            <ul className="nh-nav">
              {navLinks.map((l) => (
                <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* CENTER — logo */}
          <div className="nh-logo">
            <Link href="/">
              <Image
                src="/store/images/okab_ecommerce_logo.png"
                alt="Logo"
                width={160}
                height={44}
                style={{ height: "44px", width: "auto" }}
                priority
              />
            </Link>
          </div>

          {/* RIGHT — search + login + cart */}
          <div className="nh-icons">
            {/* Search pill */}
            <form className="nh-search-pill" onSubmit={(e) => e.preventDefault()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Search..." aria-label="Search" />
            </form>

            {/* Mobile search icon */}
            <button
              onClick={() => setSearchOpen(true)}
              style={{ display: "none", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
              aria-label="Search"
              className="nh-mobile-search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Login / Account */}
            {isLoggedIn && user ? (
              <Link href="/my-account" className="nh-login" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "#8fb8a8",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                {user.displayName}
              </Link>
            ) : (
              <Link href="/my-account" className="nh-login" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Login
              </Link>
            )}

            {/* Cart */}
            <div className="nh-cart-wrap" ref={cartRef}>
              <button className="nh-cart-btn" aria-label="Cart" onClick={() => setCartOpen(o => !o)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <Link href="/cart" className="nh-login">Cart</Link>
                {count > 0 && <span className="nh-cart-badge">{count}</span>}
              </button>

              {/* Cart dropdown */}
              <div className={`nh-cart-dropdown${cartOpen ? " open" : ""}`}>
                {items.length === 0 ? (
                  <p className="nh-cart-empty">Your cart is empty.</p>
                ) : (
                  <>
                    {items.map((item) => (
                      <div key={item.cartItemId} className="nh-cart-item">
                        <img src={item.image || PLACEHOLDER} alt={item.title} />
                        <div className="nh-cart-item-info">
                          <div className="nh-cart-item-title">{item.title}</div>
                          <div className="nh-cart-item-price">
                            {item.quantity} × ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <button
                          className="nh-cart-remove"
                          onClick={() => removeItem(item.cartItemId)}
                          aria-label="Remove item"
                        >×</button>
                      </div>
                    ))}
                    <div className="nh-cart-subtotal">
                      <span>Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="nh-cart-actions">
                  <Link href="/cart" className="nh-btn-view">View Cart</Link>
                  <Link href="/checkout" className="nh-btn-checkout">Checkout</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── SEARCH OVERLAY (mobile) ── */}
      {searchOpen && (
        <div className="nh-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="nh-search-box" onClick={(e) => e.stopPropagation()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input ref={searchRef} type="text" placeholder="Search products..." />
            <button className="nh-search-close" onClick={() => setSearchOpen(false)}>×</button>
          </div>
        </div>
      )}

      {/* ── MOBILE DRAWER ── */}
      <div
        className={`nh-drawer-overlay${mobileMenuOpen ? " open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className={`nh-drawer${mobileMenuOpen ? " open" : ""}`}>
        <div className="nh-drawer-head">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <Image
              src="/store/images/okab_ecommerce_logo.png"
              alt="Logo"
              width={120}
              height={34}
              style={{ height: "34px", width: "auto" }}
            />
          </Link>
          <button className="nh-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button>
        </div>

        <ul className="nh-drawer-nav">
          {[
            { label: "Home",        href: "/" },
            { label: "Shop",        href: "/shop" },
            { label: "Collections", href: "/shop" },
            { label: "Gifting",     href: "/shop" },
            { label: "My Account",  href: "/my-account" },
            { label: "Cart",        href: "/cart" },
            { label: "Checkout",    href: "/checkout" },
          ].map((l) => (
            <li key={l.label}>
              <Link href={l.href} onClick={() => setMobileMenuOpen(false)}>{l.label}</Link>
            </li>
          ))}
        </ul>

        <div className="nh-drawer-footer">
          <Link href="/my-account" onClick={() => setMobileMenuOpen(false)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {isLoggedIn && user ? user.displayName : "Login / Register"}
          </Link>
          <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Wishlist
          </Link>
        </div>
      </div>
    </>
  );
}
