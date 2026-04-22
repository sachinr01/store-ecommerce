import Link from "next/link";
import TrustBar from "./TrustBar";

export default function Footer() {
  return (
    <footer className="okab-footer">
      <TrustBar />

      {/* footer-top: About Us | Need Help | Company | Contact Us */}
      <div className="footer-top">
        <div className="footer-grid">
          <div>
            <h4>About Us</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#" className="link-faded">B2B Connect</a></li>
              <li><Link href="/about-us" className="link-faded">Our Story</Link></li>
              <li><a href="#" className="link-faded">FAQs</a></li>
            </ul>
          </div>
          <div>
            <h4>Need Help</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href="/contact-us" className="link-faded">Contact Us</Link></li>
              <li><Link href="/orders" className="link-faded">Track Order</Link></li>
              <li><a href="#" className="link-faded">Site Map</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href="/refund_returns" className="link-faded">Return &amp; Exchange</Link></li>
              <li><Link href="/privacy-policy" className="link-faded">Privacy Policy</Link></li>
              <li><Link href="/terms-conditions" className="link-faded">Terms Of Use</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact Us</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#" className="link-faded">Whatsapp: 91 0000000000</a></li>
              <li><a href="#" className="link-faded">Mon-Sat 10AM - 6PM IST</a></li>
              <li><a href="#" className="link-faded">Email: Info@test.com</a></li>
              <li><a href="#" className="link-faded">Instagram</a></li>
              <li><a href="#" className="link-faded">Facebook</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-middle" />
      </div>

      {/* footer-bottom: Shop by Price | Shop by Categories | Popular Products | Latest Products */}
      <div className="footer-bottom">
        <div className="footer-grid">
          <div>
            <h4>Shop by Price</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href="/shop?max=1000" className="link-faded">Gift Under 1000</Link></li>
              <li><Link href="/shop?max=2000" className="link-faded">Gift Under 2000</Link></li>
              <li><Link href="/shop?max=3000" className="link-faded">Gift Under 3000</Link></li>
              <li><Link href="/shop?max=5000" className="link-faded">Gift Under 5000</Link></li>
            </ul>
          </div>
          <div>
            <h4>Shop by Categories</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="/store/shop/glassware" className="link-faded">GLASSWARE</a></li>
              <li><a href="/store/shop/drinkware" className="link-faded">DRINKWARE</a></li>
              <li><a href="/store/shop/jars-and-containers" className="link-faded">JARS AND CONTAINERS</a></li>
            </ul>
          </div>
          <div>
            <h4>Popular Products</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#" className="link-faded">Product 1 here</a></li>
              <li><a href="#" className="link-faded">Product 2 here</a></li>
              <li><a href="#" className="link-faded">Product 3 here</a></li>
              <li><a href="#" className="link-faded">Product 4 here</a></li>
            </ul>
          </div>
          <div>
            <h4>Latest Products</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#" className="link-faded">Product 1 here</a></li>
              <li><a href="#" className="link-faded">Product 2 here</a></li>
              <li><a href="#" className="link-faded">Product 3 here</a></li>
              <li><a href="#" className="link-faded">Product 4 here</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* footer-bottom2: Popular Search */}
      <div className="footer-bottom2">
        <h4>Popular Search</h4>
        <p className="popular_search--p">
          Gifts Under 1000 | Gifts for Women | Low Price Gift Items | Laptop Backpack for Women | Laptop Handbags for Women | Laptop Backpack | Laptop Cover | Small Handbags for Women | Handbags for Women | Office Handbags for Womens | Luggage Trolley Bags | Travel Bag for Women | Women&apos;s Clutch Wallet | Ladies Clutch Wallet | Stainless Steel Watch | Stainless Steel Watch Strap | Metal Strap Watches | Passport Holder | Passport Holder for Women | Crockery Set | Dining Table Accessories | Table Decoration Items | Home Decor Items | Home Decor Products | Home Decor | Wall Decor Items | Wrist Watches for Women | Smart Watch for Women | Ladies Smart Watch | Traveling Bags
        </p>
      </div>

      <style>{`
        .okab-footer {
          border-top: 5px solid #ffcc00;
        }
        .footer-top {
          background: #c4a298;
          padding: 40px 5% 0px;
        }
        .footer-middle {
          height: 0px;
        }
        .footer-bottom {
          background: #c4a298;
          padding: 40px 5% 0px;
        }
        .footer-bottom2 {
          background: #c4a298;
          padding: 40px 5% 40px;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
          align-items: start;
        }
        .footer-grid h4,
        .footer-bottom2 h4 {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 0 0 14px 0;
          color: #884531;
        }
        .footer-nav-list {
          padding: 0;
          margin: 0;
          list-style: none;
          text-align: left;
        }
        .footer-nav-list li {
          margin-bottom: 8px !important;
          list-style: none !important;
          font-size: 15px !important;
          line-height: 1.5 !important;
          text-align: left !important;
        }
        .footer-nav-list li a {
          font-size: 15px !important;
          color: #5f3022 !important;
          text-decoration: none !important;
          letter-spacing: 0.5px !important;
          line-height: 1.5 !important;
          display: block !important;
          padding: 0 !important;
        }
        .footer-nav-list li a:hover {
          text-decoration: underline !important;
        }
        .footer-grid p {
          color: #fff;
        }
        .popular_search--p {
          color: #000 !important;
          text-decoration: none;
          font-size: 14px !important;
          letter-spacing: 0.3px !important;
          line-height: 1.8 !important;
          font-weight: 400 !important;
          display: block;
          word-break: normal;
          overflow-wrap: break-word;
        }
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </footer>
  );
}
