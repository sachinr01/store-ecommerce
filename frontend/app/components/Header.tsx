"use client";

import Link from "next/link";
import Image from "next/image";
import MobileNavbar from "./MobileNavbar";

export default function Header() {
  return (
    <>
      <MobileNavbar />
      <header role="banner">
        {/* DESKTOP MENU */}
        <div className="dima-navbar-wrap dima-navbar-fixed-top-active dima-topbar-active desk-nav">
          <div className="dima-navbar fix-one">
            <div className="dima-topbar dima-theme">
              <div className="container">
                <ul className="float-start text-start dima-menu">
                  <li>
                    <a data-animated-link="fadeOut" href="#">
                      <i className="fa fa-map-marker"></i>Bluett Avenue Seaview USA
                    </a>
                  </li>
                  <li>
                    <a data-animated-link="fadeOut" href="#">
                      <i className="fa fa-phone"></i>+213 2020 555013
                    </a>
                  </li>
                </ul>
                <ul className="float-end text-end dima-menu">
                  <li>
                    <Link data-animated-link="fadeOut" href="/my-account">
                      <i className="fa fa-user"></i>My Account
                    </Link>
                  </li>
                  <li>
                    <Link data-animated-link="fadeOut" href="/wishlist">
                      <i className="fa fa-heart"></i>Wishlist
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="clearfix dima-nav-fixed"></div>
            <div className="container">
              {/* LOGO */}
              <div className="logo">
                <h1>
                  <Link href="/" title="Okab logo">
                    <span className="vertical-middle"></span>
                    <Image
                      src="/store/images/okab_ecommerce_logo.png"
                      alt="Okab Logo"
                      title="Okab"
                      width={160}
                      height={44}
                      style={{ height: "auto", width: "auto" }}
                    />
                  </Link>
                </h1>
              </div>
              {/* MENU */}
              <nav role="navigation" className="clearfix">
                <ul className="dima-nav-end">
                  <li className="search-btn">
                    <a data-animated-link="fadeOut" href="#">
                      <i className="fa fa-search"></i>
                    </a>
                  </li>
                  <li className="shopping-btn sub-icon menu-item-has-children cart_wrapper">
                    <a
                      data-animated-link="fadeOut"
                      href="#"
                      className="start-border"
                    >
                      <i className="fa fa-shopping-cart"></i>
                      <span className="total">
                        <span className="amount">$7.00</span>
                      </span>
                      <span className="badge-number">2</span>
                    </a>
                    <ul className="sub-menu with-border product_list_widget">
                      <li>
                        <a
                          data-animated-link="fadeOut"
                          href="#"
                          className="dima-close"
                          title="Remove this item"
                        ></a>
                        <a data-animated-link="fadeOut" href="#" title="">
                          <Image
                            width={65}
                            height={70}
                            className="attachment-shop_thumbnail"
                            src="https://icmedianew.gumlet.io/pub/media/catalog/product/cache/f2d421546b83b64fb3f7a27d900ed3ed/52152101SD00991/India-Circus-by-Krsnaa-Mehta-Ample-Lilies-Porcelain-Coffee-Mug-52152101SD00991-2.jpg"
                            alt="Product Image"
                          />
                          Product Name Goes Here
                        </a>
                        <span className="price text-start">
                          <ins>
                            <span className="amount">
                              1 &nbsp;&nbsp;x&nbsp;&nbsp; <span>$12.99</span>
                            </span>
                          </ins>
                        </span>
                      </li>
                      <li>
                        <a
                          data-animated-link="fadeOut"
                          href="#"
                          className="dima-close"
                          title="Remove this item"
                        ></a>
                        <a data-animated-link="fadeOut" href="#" title="">
                          <Image
                            width={65}
                            height={70}
                            className="attachment-shop_thumbnail"
                            src="https://icmedianew.gumlet.io/pub/media/catalog/product/cache/f2d421546b83b64fb3f7a27d900ed3ed/52152101SD00991/India-Circus-by-Krsnaa-Mehta-Ample-Lilies-Porcelain-Coffee-Mug-52152101SD00991-2.jpg"
                            alt="Product Image"
                          />
                          Product Name Goes Here
                        </a>
                        <span className="price text-start">
                          <ins>
                            <span className="amount">
                              1 &nbsp;&nbsp;x&nbsp;&nbsp; <span>$92.25</span>
                            </span>
                          </ins>
                        </span>
                      </li>
                      <li>
                        <p>
                          SUBTOTAL : <span className="float-end">$191.98</span>
                        </p>
                      </li>
                      <li>
                        <span className="di_header button-block button fill">
                          VIEW CART{" "}
                        </span>
                        <span className="button-block button fill no-bottom-margin">
                          CHECKOUT
                        </span>
                      </li>
                    </ul>
                  </li>
                </ul>

                <ul className="dima-nav">
                  <li className="sub-icon menu-item-has-children">
                    <Link data-animated-link="fadeOut" href="/">
                      Home
                    </Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <a data-animated-link="fadeOut" href="#">
                      Shop
                    </a>
                    <ul className="sub-menu nav-menu">
                      <li className="sub-icon menu-item-has-children">
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/2-columns-left-sidebar"
                        >
                          2 Columns
                        </Link>
                        <ul className="sub-menu">
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/2-columns-left-sidebar"
                            >
                              2 Columns Left Sidebar
                            </Link>
                          </li>
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/2-columns-right-sidebar"
                            >
                              2 Columns Right Sidebar
                            </Link>
                          </li>
                        </ul>
                      </li>
                      <li className="sub-icon menu-item-has-children">
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/3-columns-full"
                        >
                          3 Columns
                        </Link>
                        <ul className="sub-menu">
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/3-columns-full"
                            >
                              3 Columns Full
                            </Link>
                          </li>
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/3-columns-left-sidebar"
                            >
                              3 Columns Left Sidebar
                            </Link>
                          </li>
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/3-columns-right-sidebar"
                            >
                              3 Columns Right Sidebar
                            </Link>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/4-columns-full"
                        >
                          4 Columns
                        </Link>
                      </li>
                      <li className="sub-icon menu-item-has-children">
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/list-full"
                        >
                          List
                        </Link>
                        <ul className="sub-menu">
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/list-left-sidebar"
                            >
                              List Left Sidebar
                            </Link>
                          </li>
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/list-right-sidebar"
                            >
                              List Right Sidebar
                            </Link>
                          </li>
                          <li>
                            <Link
                              data-animated-link="fadeOut"
                              href="/shop/list-full"
                            >
                              List Full
                            </Link>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <Link data-animated-link="fadeOut" href="/cart">
                          Cart
                        </Link>
                      </li>
                      <li>
                        <Link data-animated-link="fadeOut" href="/wishlist">
                          Wishlist
                        </Link>
                      </li>
                      <li>
                        <Link data-animated-link="fadeOut" href="/checkout">
                          Checkout
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link
                      data-animated-link="fadeOut"
                      href="/product-details"
                    >
                      Product Details
                    </Link>
                    <ul className="sub-menu">
                      <li>
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/product-detail/left-sidebar"
                        >
                          Product Detail Left Sidebar
                        </Link>
                      </li>
                      <li>
                        <Link
                          data-animated-link="fadeOut"
                          href="/shop/product-detail/right-sidebar"
                        >
                          Product Detail Right Sidebar
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link data-animated-link="fadeOut" href="/my-account">
                      My Account
                    </Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link data-animated-link="fadeOut" href="/cart">
                      cart
                    </Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link data-animated-link="fadeOut" href="/checkout">
                      checkout
                    </Link>
                  </li>
                  <li className="sub-icon menu-item-has-children">
                    <Link data-animated-link="fadeOut" href="/contact-us">
                      contact us
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            {/* container */}
            <div id="search-box">
              <div className="container">
                <form>
                  <input type="text" placeholder="Start Typing..." />
                </form>
                <div id="close">
                  <a data-animated-link="fadeOut" href="#">
                    <i className="di-close"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="clear-nav"></div>
        </div>
        {/* !DESKTOP MENU */}
      </header>
    </>
  );
}
