import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <>
      {/* TOP FOOTER */}
      <div className="top-footer">
        <div className="container">
          <div className="ok-row">
            {/* About */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">About</h5>
              <div className="widget-content">
                <ul className="with-border">
                  <li>
                    <Link href="/footer/about">About Us</Link>
                  </li>
                  <li>
                    <Link href="/footer/about?tab=press">Press</Link>
                  </li>
                  <li>
                    <Link href="/footer/about?tab=store-locator">
                      Store Locator
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/about?tab=track-order">
                      Track Order
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/about?tab=customer-support">
                      Customer Support
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/about?tab=careers">Careers</Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Shop */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">Shop</h5>
              <div className="widget-content">
                <ul className="with-border">
                  <li>
                    <Link href="/footer/shop">Sale Corner</Link>
                  </li>
                  <li>
                    <Link href="/footer/shop">Featured Products</Link>
                  </li>
                  <li>
                    <Link href="/footer/shop">Top Products</Link>
                  </li>
                  <li>
                    <Link href="/footer/shop">New Arrivals</Link>
                  </li>
                  <li>
                    <Link href="/footer/shop">Store Locator</Link>
                  </li>
                  <li>
                    <Link href="/footer/shop">Gifting</Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Categories */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">Categories</h5>
              <div className="widget-content">
                <ul className="with-border">
                  <li>
                    <Link href="/footer/categories">Home Decor</Link>
                  </li>
                  <li>
                    <Link href="/footer/categories">Dining</Link>
                  </li>
                  <li>
                    <Link href="/footer/categories">Accessories</Link>
                  </li>
                  <li>
                    <Link href="/footer/categories">Fashion</Link>
                  </li>
                  <li>
                    <Link href="/footer/categories">Furniture</Link>
                  </li>
                  <li>
                    <Link href="/footer/categories">Wall Decor</Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Policies */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">Policies</h5>
              <div className="widget-content">
                <ul className="with-border">
                  <li>
                    <Link href="/footer/policies/nav?type=privacy-policy">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/policies/nav?type=terms-and-conditions">
                      Terms &amp; Conditions of Use
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/policies/nav?type=return-policy">
                      Return Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/policies/nav?type=refund-policy">
                      Refund Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/policies/nav?type=cancellation-policy">
                      Cancellation Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/footer/policies/nav?type=gift-voucher">
                      Gift Voucher T&amp;C
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact Us */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">Contact us</h5>
              <div className="widget-content">
                <ul className="with-border featured-posts contact-icon">
                  <li>
                    <i className="fa fa-map-marker"></i>
                    <p>Bluett Avenue, Seaview, Isle of Wight PO34, UK</p>
                  </li>
                  <li>
                    <i className="fa fa-phone"></i>
                    <p>+213 2020 555013</p>
                    <p>+213 7700 900106</p>
                  </li>
                  <li>
                    <i className="fa fa-envelope"></i>
                    <p>Emal1@domain.com</p>
                    <p>Emal2@domain.com</p>
                  </li>
                </ul>
              </div>
              <div className="widget-content" style={{ marginTop: "10px" }}>
                <Link
                  href="/footer/contact-us"
                  className="button stroke uppercase"
                  style={{ fontSize: "0.75rem", padding: "6px 14px" }}
                >
                  Contact Page
                </Link>
              </div>
            </div>

            {/* Connect */}
            <div className="ok-md-2 ok-xsd-12 ok-sd-6 widget">
              <h5 className="widget-titel">Connect</h5>
              <div className="widget-content">
                <p>
                  An ISO 9001 2015, ISO 14001 2015, ISO 45001 2018 Certified
                  Company.
                </p>
              </div>
              <div className="widget-content">
                <div className="dima-social-footer social-media social-medium">
                  <ul className="inline clearfix">
                    <li>
                      <Link href="/footer/connect">
                        <i className="fa fa-facebook"></i>
                      </Link>
                    </li>
                    <li>
                      <Link href="/footer/connect">
                        <i className="fa fa-twitter"></i>
                      </Link>
                    </li>
                    <li>
                      <Link href="/footer/connect">
                        <i className="fa fa-google-plus"></i>
                      </Link>
                    </li>
                    <li>
                      <Link href="/footer/connect">
                        <i className="fa fa-instagram"></i>
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM FOOTER */}
      <footer role="contentinfo" className="dima-footer e-footre">
        <div className="container">
          <div className="copyright dima-center-full">
            <p>© 2026 ABC Technologies</p>
          </div>
          <ul className="inline clearfix text-end hidden-xsd">
            <li className="no-bottom-margin">
              <Link href="#">
                <Image
                  className="auto-width"
                  src="/store/images/icons/amex.jpg"
                  alt="Amex"
                  width={40}
                  height={25}
                />
              </Link>
            </li>
            <li className="no-bottom-margin">
              <Link href="#">
                <Image
                  className="auto-width"
                  src="/store/images/icons/discover.jpg"
                  alt="Discover"
                  width={40}
                  height={25}
                />
              </Link>
            </li>
            <li className="no-bottom-margin">
              <Link href="#">
                <Image
                  className="auto-width"
                  src="/store/images/icons/visa.jpg"
                  alt="Visa"
                  width={40}
                  height={25}
                />
              </Link>
            </li>
           { /*<li className="no-bottom-margin">
              <Link href="#">
                <Image
                  className="auto-width"
                  src="/store/images/icons/mastercard.jpg"
                  alt="Mastercard"
                  width={40}
                  height={25}
                />
              </Link>
            </li>*/}
          </ul>
        </div>
      </footer>
    </>
  );
}
