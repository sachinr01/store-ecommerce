"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../lib/cartContext";
import { useAuth } from "../lib/authContext";

const PLACEHOLDER = "/store/images/dummy.png";

export default function Header() {
  const { items, count, total, removeItem } = useCart();
  const { user, isLoggedIn } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) {
        setCartOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Collections", href: "/shop" },
    { label: "Gifting", href: "/shop" },
  ];

  const closeOverlays = () => {
    setCartOpen(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <style>{`
        .nh-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #fff;
          border-bottom: 1px solid #ececec;
        }

        .nh-inner {
          max-width: 1360px;
          margin: 0 auto;
          height: 84px;
          padding: 0 24px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 16px;
        }

        .nh-left,
        .nh-right {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 12px;
        }

        .nh-left {
          justify-content: flex-start;
        }

        .nh-right {
          justify-content: flex-end;
        }

        .nh-logo-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
        }

        .nh-logo-image {
          width: auto;
          height: 64px;
          max-width: 280px;
          object-fit: contain;
        }

        .nh-nav {
          display: flex;
          align-items: center;
          gap: 24px;
          list-style: none;
          margin: 0;
          padding: 0;
          min-width: 0;
        }

        .nh-nav a,
        .nh-login,
        .nh-account-link {
          color: #1b1b1b;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .nh-nav a:hover,
        .nh-login:hover,
        .nh-account-link:hover {
          color: #555;
        }

        .nh-search-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          padding: 7px 12px;
          border: 1px solid #dddddd;
          border-radius: 999px;
          background: #fff;
        }

        .nh-search-pill input {
          width: 120px;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: #333;
          font-size: 13px;
        }

        .nh-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: #1b1b1b;
          cursor: pointer;
          flex-shrink: 0;
        }

        .nh-icon-btn:hover {
          background: #f5f5f5;
        }

        .nh-mobile-search,
        .nh-hamburger {
          display: none;
        }

        .nh-hamburger-lines {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nh-hamburger-lines span {
          display: block;
          width: 20px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }

        .nh-account-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .nh-account-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #8fb8a8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
        }

        .nh-account-text {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nh-cart-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .nh-cart-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border: none;
          background: transparent;
          color: #1b1b1b;
          cursor: pointer;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .nh-cart-label {
          white-space: nowrap;
        }

        .nh-cart-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #111;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .nh-cart-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 320px;
          max-width: calc(100vw - 24px);
          padding: 16px;
          border: 1px solid #ececec;
          background: #fff;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
          opacity: 0;
          pointer-events: none;
          transform: translateY(-8px);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .nh-cart-dropdown.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .nh-cart-item {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
          padding: 10px 0;
          border-bottom: 1px solid #f1f1f1;
        }

        .nh-cart-thumb {
          width: 56px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
        }

        .nh-cart-item-title {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 600;
          color: #111;
        }

        .nh-cart-item-meta {
          font-size: 12px;
          color: #666;
        }

        .nh-cart-remove {
          border: none;
          background: transparent;
          color: #9b9b9b;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .nh-cart-empty {
          margin: 8px 0 16px;
          font-size: 13px;
          color: #777;
          text-align: center;
        }

        .nh-cart-subtotal {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 0;
          font-size: 14px;
          font-weight: 700;
        }

        .nh-cart-actions {
          display: grid;
          gap: 8px;
        }

        .nh-cart-action {
          display: block;
          padding: 12px;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 12px;
          font-weight: 700;
        }

        .nh-cart-action.view {
          background: #f1f1f1;
          color: #111;
        }

        .nh-cart-action.checkout {
          background: #111;
          color: #fff;
        }

        .nh-search-overlay,
        .nh-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          z-index: 1100;
        }

        .nh-search-overlay {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 88px 16px 16px;
        }

        .nh-search-box {
          width: min(640px, 100%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 20px;
          background: #fff;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
        }

        .nh-search-box input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          font-size: 16px;
        }

        .nh-search-close {
          border: none;
          background: transparent;
          cursor: pointer;
          color: #777;
          font-size: 24px;
          line-height: 1;
        }

        .nh-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: min(320px, calc(100vw - 32px));
          background: #fff;
          z-index: 1200;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          display: flex;
          flex-direction: column;
        }

        .nh-drawer.open {
          transform: translateX(0);
        }

        .nh-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid #ececec;
        }

        .nh-drawer-nav {
          list-style: none;
          margin: 0;
          padding: 8px 0;
        }

        .nh-drawer-nav a {
          display: block;
          padding: 14px 20px;
          color: #111;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid #f3f3f3;
        }

        .nh-drawer-footer {
          margin-top: auto;
          padding: 16px 20px 24px;
          border-top: 1px solid #ececec;
          display: grid;
          gap: 10px;
        }

        .nh-drawer-footer a {
          color: #444;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }

        @media (max-width: 1199px) {
          .nh-inner {
            padding: 0 18px;
            gap: 12px;
          }

          .nh-nav {
            gap: 18px;
          }

          .nh-search-pill input {
            width: 88px;
          }

          .nh-account-text {
            max-width: 84px;
          }
        }

        @media (max-width: 991px) {
          .nh-inner {
            grid-template-columns: auto minmax(0, 1fr) auto;
            height: 72px;
            padding: 0 12px;
            gap: 10px;
          }

          .nh-left {
            flex: 0 0 auto;
          }

          .nh-nav,
          .nh-search-pill,
          .nh-login-label {
            display: none;
          }

          .nh-hamburger,
          .nh-mobile-search {
            display: inline-flex;
          }

          .nh-right {
            gap: 2px;
          }

          .nh-logo-link {
            justify-self: center;
            min-width: 0;
          }

          .nh-logo-image {
            height: 52px;
            max-width: min(240px, 100%);
          }

          .nh-account-link,
          .nh-cart-link {
            padding: 6px;
          }

          .nh-account-text,
          .nh-cart-label {
            display: none;
          }
        }

        @media (max-width: 575px) {
          .nh-inner {
            height: 64px;
            padding: 0 10px;
            gap: 8px;
          }

          .nh-logo-image {
            height: 44px;
            max-width: 200px;
          }

          .nh-cart-dropdown {
            right: -6px;
            width: min(300px, calc(100vw - 20px));
            padding: 14px;
          }

          .nh-search-overlay {
            padding-top: 72px;
          }

          .nh-search-box {
            padding: 16px;
          }
        }
      `}</style>

      <header className="nh-header">
        <div className="nh-inner">
          <div className="nh-left">
            <button
              type="button"
              className="nh-icon-btn nh-hamburger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <span className="nh-hamburger-lines">
                <span />
                <span />
                <span />
              </span>
            </button>

            <ul className="nh-nav">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <Link href="/" className="nh-logo-link" onClick={closeOverlays}>
            <Image
              src="/store/images/logo-white.png"
              alt="Okab Online Store"
              width={280}
              height={64}
              priority
              className="nh-logo-image"
            />
          </Link>

          <div className="nh-right">
            <form className="nh-search-pill" onSubmit={(event) => event.preventDefault()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Search..." aria-label="Search products" />
            </form>

            <button
              type="button"
              className="nh-icon-btn nh-mobile-search"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {isLoggedIn && user ? (
              <Link href="/my-account" className="nh-account-link" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="nh-account-text">{user.displayName}</span>
              </Link>
            ) : (
              <Link href="/my-account" className="nh-account-link nh-login" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="nh-login-label">Login</span>
              </Link>
            )}

            <div className="nh-cart-wrap" ref={cartRef}>
              <button
                type="button"
                className="nh-cart-link"
                onClick={() => setCartOpen((prev) => !prev)}
                aria-label="Open cart preview"
                aria-expanded={cartOpen}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span className="nh-cart-label">Cart</span>
                {count > 0 && <span className="nh-cart-badge">{count}</span>}
              </button>

              <div className={`nh-cart-dropdown${cartOpen ? " open" : ""}`}>
                {items.length === 0 ? (
                  <p className="nh-cart-empty">Your cart is empty.</p>
                ) : (
                  <>
                    {items.map((item) => (
                      <div key={item.cartItemId} className="nh-cart-item">
                        <img
                          src={item.image || PLACEHOLDER}
                          alt={item.title}
                          className="nh-cart-thumb"
                        />
                        <div>
                          <p className="nh-cart-item-title">{item.title}</p>
                          <div className="nh-cart-item-meta">
                            {item.quantity} x ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="nh-cart-remove"
                          onClick={() => removeItem(item.cartItemId)}
                          aria-label={`Remove ${item.title}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div className="nh-cart-subtotal">
                      <span>Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="nh-cart-actions">
                  <Link href="/cart" className="nh-cart-action view" onClick={closeOverlays}>
                    View Cart
                  </Link>
                  <Link href="/checkout" className="nh-cart-action checkout" onClick={closeOverlays}>
                    Checkout
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="nh-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="nh-search-box" onClick={(event) => event.stopPropagation()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input ref={searchRef} type="text" placeholder="Search products..." />
            <button type="button" className="nh-search-close" onClick={() => setSearchOpen(false)} aria-label="Close search">
              ×
            </button>
          </div>
        </div>
      )}

      {mobileMenuOpen && <div className="nh-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />}

      <aside className={`nh-drawer${mobileMenuOpen ? " open" : ""}`} aria-hidden={!mobileMenuOpen}>
        <div className="nh-drawer-head">
          <Image
            src="/store/images/logo-white.png"
            alt="Okab Online Store"
            width={160}
            height={34}
            style={{ width: "auto", height: "34px" }}
          />
          <button type="button" className="nh-search-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>

        <ul className="nh-drawer-nav">
          {navLinks.concat([
            { label: "My Account", href: "/my-account" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout", href: "/checkout" },
          ]).map((link) => (
            <li key={link.label}>
              <Link href={link.href} onClick={closeOverlays}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nh-drawer-footer">
          <Link href="/wishlist" onClick={closeOverlays}>Wishlist</Link>
          <Link href="/orders" onClick={closeOverlays}>Track Orders</Link>
        </div>
      </aside>
    </>
  );
}
