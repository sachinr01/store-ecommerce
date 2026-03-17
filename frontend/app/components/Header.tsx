"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import MobileNavbar from "./MobileNavbar";
import { useCart } from "../lib/cartContext";

const PLACEHOLDER = '/store/images/dummy.png';

export default function Header() {
  const { items, count, total, removeItem } = useCart();
  const [cartOpen, setCartOpen]     = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return (
    <>
      <MobileNavbar />
      <header role="banner">
        <div className="dima-navbar-wrap dima-navbar-fixed-top-active dima-topbar-active desk-nav">
          <div className="dima-navbar fix-one">

            {/* Top bar */}
            <div className="dima-topbar dima-theme">
              <div className="container">
                <ul className="float-start text-start dima-menu">
                  <li><a href="#"><i className="fa fa-map-marker"></i>Bluett Avenue Seaview USA</a></li>
                  <li><a href="#"><i className="fa fa-phone"></i>+213 2020 555013</a></li>
                </ul>
                <ul className="float-end text-end dima-menu">
                  <li><Link href="/my-account"><i className="fa fa-user"></i>My Account</Link></li>
                  <li><Link href="/wishlist"><i className="fa fa-heart"></i>Wishlist</Link></li>
                </ul>
              </div>
            </div>

            <div className="clearfix dima-nav-fixed"></div>

            <div className="container">
              {/* Logo */}
              <div className="logo">
                <h1>
                  <Link href="/" title="Okab logo">
                    <span className="vertical-middle"></span>
                    <Image src="/store/images/okab_ecommerce_logo.png" alt="Okab Logo"
                      width={160} height={44} style={{ height: "auto", width: "auto" }} />
                  </Link>
                </h1>
              </div>

              {/* Nav */}
              <nav role="navigation" className="clearfix">
                <ul className="dima-nav-end">

                  {/* Search toggle */}
                  <li className="search-btn">
                    <a href="#" onClick={e => { e.preventDefault(); setSearchOpen(v => !v); }}>
                      <i className="fa fa-search"></i>
                    </a>
                  </li>

                  {/* Cart dropdown */}
                  <li
                    className={`shopping-btn sub-icon menu-item-has-children cart_wrapper${cartOpen ? ' dima-hover' : ''}`}
                    onMouseEnter={() => setCartOpen(true)}
                    onMouseLeave={() => setCartOpen(false)}
                  >
                    <a href="/store/cart" className="start-border">
                      <i className="fa fa-shopping-cart"></i>
                      <span className="total"><span className="amount">${total.toFixed(2)}</span></span>
                      {count > 0 && <span className="badge-number">{count}</span>}
                    </a>
                    <ul className="sub-menu with-border product_list_widget">
                      {items.length === 0 ? (
                        <li><p style={{ padding: '10px 0' }}>Your cart is empty.</p></li>
                      ) : items.map(item => (
                        <li key={`${item.id}-${item.variationId ?? 0}`}>
                          <a href="#" className="dima-close" title="Remove this item"
                            onClick={e => { e.preventDefault(); removeItem(item.id, item.variationId); }} />
                          <Link href={`/product/${toSlug(item.title)}-${item.id}`} title={item.title}>
                            <img width={65} height={70} className="attachment-shop_thumbnail"
                              src={item.image || PLACEHOLDER} alt={item.title} />
                            {item.title}
                          </Link>
                          <span className="price text-start">
                            <ins><span className="amount">
                              {item.quantity}&nbsp;&nbsp;x&nbsp;&nbsp;<span>${item.price.toFixed(2)}</span>
                            </span></ins>
                          </span>
                        </li>
                      ))}
                      {items.length > 0 && (
                        <li><p>SUBTOTAL : <span className="float-end">${total.toFixed(2)}</span></p></li>
                      )}
                      <li style={{ padding: 0 }}>
                        <Link href="/cart"
                          className="button-block button fill cart-btn-link cart-btn-gray"
                          style={{ display: 'block', width: '100%', padding: '0.9em 1em', textAlign: 'center', marginBottom: '8px', boxSizing: 'border-box', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                          VIEW CART
                        </Link>
                        <Link href="/checkout"
                          className="button-block button fill cart-btn-link cart-btn-teal no-bottom-margin"
                          style={{ display: 'block', width: '100%', padding: '0.9em 1em', textAlign: 'center', marginBottom: 0, boxSizing: 'border-box', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                          CHECKOUT
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>

                {/* Main nav */}
                <ul className="dima-nav">
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/">Home</Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/shop">Shop</Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/my-account">My Account</Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/cart">Cart</Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/checkout">Checkout</Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link href="/contact-us">Contact Us</Link>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Search box — React-controlled */}
            <div id="search-box" style={{ display: searchOpen ? 'block' : 'none' }}>
              <div className="container">
                <form onSubmit={e => { e.preventDefault(); setSearchOpen(false); }}>
                  <input type="text" placeholder="Start Typing..." autoFocus={searchOpen} />
                </form>
                <div id="close">
                  <a href="#" onClick={e => { e.preventDefault(); setSearchOpen(false); }}>
                    <i className="di-close"></i>
                  </a>
                </div>
              </div>
            </div>

          </div>
          <div className="clear-nav"></div>
        </div>
      </header>
    </>
  );
}
