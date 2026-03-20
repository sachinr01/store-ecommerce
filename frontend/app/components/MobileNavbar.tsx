"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "../lib/cartContext";

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="13" height="13" viewBox="0 0 12 12" fill="none"
    style={{
      flexShrink: 0,
      transition: "transform 0.25s ease",
      display: "inline-block",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
    }}
  >
    <path d="M2 4L6 8L10 4" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function MobileNavbar() {
  const { count } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setActiveSubmenu(null);
  };

  const toggleSubmenu = (name: string) => {
    setActiveSubmenu((prev) => (prev === name ? null : name));
  };

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const topLinkStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 22px",
    borderBottom: "1px solid #e5e5e5",
    fontSize: "12.5px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#222",
    textTransform: "uppercase",
    textDecoration: "none",
    background: "#fff",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  };

  const topButtonStyle: React.CSSProperties = {
    ...topLinkStyle,
    border: "none",
    borderBottom: "1px solid #e5e5e5",
    textAlign: "left",
  };

  const subLinkStyle: React.CSSProperties = {
    display: "block",
    padding: "13px 22px 13px 34px",
    fontSize: "13.5px",
    color: "#333",
    borderBottom: "1px solid #efefef",
    textDecoration: "none",
    background: "#fff",
  };

  const nestedLinkStyle: React.CSSProperties = {
    display: "block",
    padding: "11px 22px 11px 50px",
    fontSize: "13px",
    color: "#555",
    borderBottom: "1px solid #f5f5f5",
    textDecoration: "none",
    background: "#fafafa",
  };

  const subButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 22px 13px 34px",
    fontSize: "13.5px",
    color: "#333",
    borderBottom: "1px solid #efefef",
    background: "#fff",
    border: "none",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
    boxSizing: "border-box",
  };

  return (
    <>
      {/* Inject breakpoint CSS — hides mobile nav above 989px to match .desk-nav */}
      <style>{`
        .mobile-nav-wrapper { display: block; }
        @media only screen and (min-width: 990px) {
          .mobile-nav-wrapper { display: none !important; }
        }
      `}</style>
      {/* ══ MOBILE HEADER ══ — visible below 989px to match .desk-nav CSS breakpoint */}
      <div
        className="mobile-nav-wrapper"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "70px",
          background: "#fff",
          zIndex: 300,
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
          padding: "0 14px",
          position: "relative",
        }}>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: "48px",
              height: "48px",
              border: "1.5px solid #d0d0d0",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              flexShrink: 0,
              borderRadius: "2px",
              zIndex: 2,
            }}
            aria-label="Open menu"
          >
            <span style={{ display: "block", width: "22px", height: "2.5px", background: "#333", borderRadius: "2px" }} />
            <span style={{ display: "block", width: "22px", height: "2.5px", background: "#333", borderRadius: "2px" }} />
            <span style={{ display: "block", width: "22px", height: "2.5px", background: "#333", borderRadius: "2px" }} />
          </button>

          {/* Centered logo — uses flexbox, NOT transform */}
          <Link
            href="/"
            onClick={closeMenu}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ pointerEvents: "auto" }}>
              <Image
                src="/store/images/okab_ecommerce_logo.png"
                alt="Okab Logo"
                width={160}
                height={44}
                style={{ height: "44px", width: "auto", objectFit: "contain", maxWidth: "160px" }}
              />
            </span>
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "relative",
              padding: "8px",
              flexShrink: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa fa-shopping-cart" style={{ fontSize: "22px", color: "#333" }} />
            {count > 0 && (
              <span style={{
                position: "absolute", top: "2px", right: "2px",
                background: "#00cfc1", color: "#fff", borderRadius: "50%",
                width: "18px", height: "18px", fontSize: "10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, lineHeight: 1,
              }}>{count}</span>
            )}
          </Link>
        </div>
      </div>

      {/* ══ MENU OVERLAY ══ */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-wrapper"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 490 }}
          onClick={closeMenu}
        />
      )}

      {/* ══ FULL-WIDTH DROPDOWN MENU ══ */}
      <div
        className="mobile-nav-wrapper"
        style={{
          display: mobileMenuOpen ? "block" : "none",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          maxHeight: "100vh",
          overflowY: "auto",
          background: "#fff",
          zIndex: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}
      >
        {/* Menu header: logo + X */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: "70px",
          borderBottom: "2px solid #e5e5e5",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 501,
        }}>
          {/* Logo in drawer — also uses flexbox centering */}
          <Link
            href="/"
            onClick={closeMenu}
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Image
              src="/store/images/okab_ecommerce_logo.png"
              alt="Okab Logo"
              width={160}
              height={44}
              style={{ height: "44px", width: "auto", objectFit: "contain", maxWidth: "160px" }}
            />
          </Link>

          {/* Close button */}
          <button
            type="button"
            onClick={closeMenu}
            style={{
              width: "44px",
              height: "44px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "24px",
              color: "#444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* ── NAV LINKS ── */}
        <nav style={{ paddingBottom: "40px" }}>

          {/* HOME */}
          <Link href="/" onClick={closeMenu} style={topLinkStyle}>Home</Link>

          {/* SHOP */}
          <Link href="/shop" onClick={closeMenu} style={topLinkStyle}>Shop</Link>

          {/* SHOP DROPDOWN — commented out for now, will revisit later
          <div>
            <button type="button" onClick={() => toggleSubmenu("shop")} style={topButtonStyle}>
              <span>Shop</span>
              <ChevronDown open={activeSubmenu === "shop"} />
            </button>
            {activeSubmenu === "shop" && (
              <div>
                <div>
                  <button type="button" onClick={() => toggleNested("2col")} style={{ ...subButtonStyle, borderBottom: "1px solid #efefef" }}>
                    <span>2 Columns</span>
                    <ChevronDown open={activeNestedSubmenu === "2col"} />
                  </button>
                  {activeNestedSubmenu === "2col" && (
                    <div>
                      <Link href="/shop/2-columns-left-sidebar" onClick={closeMenu} style={nestedLinkStyle}>2 Columns Left Sidebar</Link>
                      <Link href="/shop/2-columns-right-sidebar" onClick={closeMenu} style={nestedLinkStyle}>2 Columns Right Sidebar</Link>
                    </div>
                  )}
                </div>
                <div>
                  <button type="button" onClick={() => toggleNested("3col")} style={{ ...subButtonStyle, borderBottom: "1px solid #efefef" }}>
                    <span>3 Columns</span>
                    <ChevronDown open={activeNestedSubmenu === "3col"} />
                  </button>
                  {activeNestedSubmenu === "3col" && (
                    <div>
                      <Link href="/shop/3-columns-full" onClick={closeMenu} style={nestedLinkStyle}>3 Columns Full</Link>
                      <Link href="/shop/3-columns-left-sidebar" onClick={closeMenu} style={nestedLinkStyle}>3 Columns Left Sidebar</Link>
                      <Link href="/shop/3-columns-right-sidebar" onClick={closeMenu} style={nestedLinkStyle}>3 Columns Right Sidebar</Link>
                    </div>
                  )}
                </div>
                <Link href="/shop/4-columns-full" onClick={closeMenu} style={subLinkStyle}>4 Columns</Link>
                <div>
                  <button type="button" onClick={() => toggleNested("list")} style={{ ...subButtonStyle, borderBottom: "1px solid #efefef" }}>
                    <span>List</span>
                    <ChevronDown open={activeNestedSubmenu === "list"} />
                  </button>
                  {activeNestedSubmenu === "list" && (
                    <div>
                      <Link href="/shop/list-left-sidebar" onClick={closeMenu} style={nestedLinkStyle}>List Left Sidebar</Link>
                      <Link href="/shop/list-right-sidebar" onClick={closeMenu} style={nestedLinkStyle}>List Right Sidebar</Link>
                      <Link href="/shop/list-full" onClick={closeMenu} style={nestedLinkStyle}>List Full</Link>
                    </div>
                  )}
                </div>
                <Link href="/cart" onClick={closeMenu} style={subLinkStyle}>Cart</Link>
                <Link href="/wishlist" onClick={closeMenu} style={subLinkStyle}>Wishlist</Link>
                <Link href="/checkout" onClick={closeMenu} style={{ ...subLinkStyle, borderBottom: "2px solid #e5e5e5" }}>Checkout</Link>
              </div>
            )}
          </div>
          */}

          {/* PRODUCT DETAILS — commented out, navigating directly from shop page
          <div>
            <button type="button" onClick={() => toggleSubmenu("product")} style={topButtonStyle}>
              <span>Product Details</span>
              <ChevronDown open={activeSubmenu === "product"} />
            </button>
            {activeSubmenu === "product" && (
              <div>
                <Link href="/shop/product-detail/left-sidebar" onClick={closeMenu} style={subLinkStyle}>Product Detail Left Sidebar</Link>
                <Link href="/shop/product-detail/right-sidebar" onClick={closeMenu} style={{ ...subLinkStyle, borderBottom: "2px solid #e5e5e5" }}>Product Detail Right Sidebar</Link>
              </div>
            )}
          </div>
          */}

          {/* MY ACCOUNT */}
          <Link href="/my-account" onClick={closeMenu} style={topLinkStyle}>My Account</Link>
          <Link href="/cart" onClick={closeMenu} style={topLinkStyle}>Cart</Link>

          {/* CHECKOUT */}
          <Link href="/checkout" onClick={closeMenu} style={topLinkStyle}>Checkout</Link>

          {/* CONTACT US */}
          <Link href="/contact-us" onClick={closeMenu} style={topLinkStyle}>Contact Us</Link>

        </nav>
      </div>

      {/* Spacer so page content doesn't sit under the fixed mobile header */}
      <div className="mobile-nav-wrapper" style={{ height: "70px" }} />
    </>
  );
}