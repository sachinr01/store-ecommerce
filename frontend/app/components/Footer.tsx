import Link from "next/link";

export default function Footer() {
  return (
    <footer className="okab-footer">
      <div className="footer-top">
        <div className="footer-grid">
          <div>
            <h4>NEED HELP</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">FAQs</a></li>
              <li><Link href="/orders" className="link-faded">Track Order</Link></li>
              <li><a href="#." className="link-faded">Store Locator</a></li>
              <li><a href="#." className="link-faded">Return &amp; Exchange</a></li>
              <li><a href="#." className="link-faded">Site Map</a></li>
            </ul>
          </div>
          <div>
            <h4>ABOUT US</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Our Story</a></li>
              <li><a href="#." className="link-faded">Community</a></li>
              <li><a href="#." className="link-faded">Corporate Gifts</a></li>
              <li><a href="#." className="link-faded">Daily Gifts</a></li>
              <li><a href="#." className="link-faded">Store Locator</a></li>
            </ul>
          </div>
          <div>
            <h4>COMPANY</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="/store/footer/policies/nav?type=privacy-policy" className="link-faded">Privacy Policy</a></li>
              <li><a href="#." className="link-faded">Terms Of Use</a></li>
              <li><a href="#." className="link-faded">Contact Us</a></li>
              <li><a href="/store/footer/policies/nav?type=return-policy" className="link-faded">Return Policy</a></li>
            </ul>
          </div>
          <div>
            <h4>POPULAR CATEGORIES</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Crockery Set</a></li>
              <li><a href="#." className="link-faded">Tableware</a></li>
              <li><a href="#." className="link-faded">Jars Online</a></li>
              <li><a href="#." className="link-faded">Buy Bakeware Items</a></li>
            </ul>
          </div>
          <div>
            <h4>GET IN TOUCH</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Whatsapp: 91 0000000000</a></li>
              <li><a href="#." className="link-faded">Mon-Sat 10AM - 6PM IST</a></li>
              <li><a href="#." className="link-faded">Email: Info@test.com</a></li>
              <li>
                <a href="#." className="link-faded">Instagram</a>
                <span className="link-sep"> / </span>
                <a href="#." className="link-faded">Facebook</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-middle" />
      </div>

      <div className="footer-bottom">
        <div className="footer-grid">
          <div>
            <h4>GIFTING</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Festive Gifting</a></li>
              <li><a href="#." className="link-faded">E-Gift Cards</a></li>
              <li><a href="#." className="link-faded">Corporate Gifting</a></li>
              <li><a href="#." className="link-faded">Birthday Gifts</a></li>
            </ul>
          </div>

          <div>
            <h4>SHOP BY PRICE</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href="/shop?max=1000" className="link-faded">Gift Under 1000</Link></li>
              <li><Link href="/shop?max=2000" className="link-faded">Gift Under 2000</Link></li>
              <li><Link href="/shop?max=3000" className="link-faded">Gift Under 3000</Link></li>
              <li><Link href="/shop?max=5000" className="link-faded">Gift Under 5000</Link></li>
            </ul>
          </div>

          <div>
            <h4>DINING ACCESSORIES</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Crockery Set</a></li>
              <li><a href="#." className="link-faded">Tableware</a></li>
              <li><a href="#." className="link-faded">Jars Online</a></li>
              <li><a href="#." className="link-faded">Buy Bakeware Items</a></li>
            </ul>
          </div>

          <div>
            <h4>HOME DECOR ITEMS</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Table Wall Decor</a></li>
              <li><a href="#." className="link-faded">Planters and Pots</a></li>
              <li><a href="#." className="link-faded">Buy Carpets Online</a></li>
              <li><a href="#." className="link-faded">Candles</a></li>
            </ul>
          </div>

          <div>
            <h4>FURNITURE &amp; FURNISHING</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#." className="link-faded">Sofa</a></li>
              <li><a href="#." className="link-faded">Pouffe</a></li>
              <li><a href="#." className="link-faded">Breakfast Table</a></li>
              <li><a href="#." className="link-faded">Bedding</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom2">
        <h4>POPULAR SEARCH</h4>
        <p className="popular_search--p">
          Gifts Under 1000 | Gifts for WomenLow Price Gift Items | Laptop Backpack for Women | Laptop Handbags for Women | Laptop Backpack | Laptop Cover | Small Handbags for Women| Handbags for Women | Office Handbags for Womens | Luggage Trolley Bags | Travel Bag for Women | Women's Clutch Wallet | Ladies Clutch Wallet | Stainless Steel Watch | Stainless Steel Watch Strap | Metal Strap Watches | Passport Holder | Passport Holder for Women | Crockery Set | Dining Table Accessories | Table Decoration Items | Home Decor Items | Home Decor Products | Home Decor | Wall Decor Items | Wrist Watches for Women | Smart Watch for Women | Ladies Smart Watch | Traveling Bags
        </p>
      </div>

      <style>{`
        .okab-footer {
          width: 100%;
          font-family: var(--font-body);
          color: #111;
          margin: 0;
          padding: 0;
          background: #8fb8a8;
        }
        .okab-footer h4 {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 0 0 14px 0;
        }
        .footer-top {
          background: #8fb8a8 url("https://www.chumbak.com/cdn/shop/files/14_footer_d0d56a2f-2df7-41c0-a78b-25436a2cdabc.jpg?v=1695893379") no-repeat bottom center / 100% auto;
          padding: 48px 120px 240px;
        }
        .footer-bottom {
          background: #8fb8a8 url("https://www.chumbak.com/cdn/shop/files/gb.jpg?v=1712319238") no-repeat top center / 100% auto;
          padding: 24px 120px 32px;
        }
        .footer-bottom2 {
          background: #8fb8a8;
          padding: 0 120px 36px;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 28px;
        }
        .footer-nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .footer-nav-list li {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 500;
          color: #222;
        }
        .link-faded {
          color: #222;
          text-decoration: none;
        }
        .link-faded:hover {
          text-decoration: underline;
          opacity: 0.8;
        }
        .link-sep { color: #222; }
        .popular_search--p {
          font-size: 13px;
          font-weight: 500;
          color: #222;
          line-height: 1.9;
          margin: 0;
        }

        @media (max-width: 1200px) {
          .footer-top,
          .footer-bottom,
          .footer-bottom2 { padding-left: 64px; padding-right: 64px; }
          .footer-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .footer-top { padding-bottom: 200px; }
        }
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .footer-top { padding-bottom: 180px; }
        }
        @media (max-width: 540px) {
          .footer-grid { grid-template-columns: 1fr; }
          .footer-top {
            background-image: url("https://www.chumbak.com/cdn/shop/files/14--FOOTER-new.jpg?v=1696327172");
            padding: 24px 20px 160px;
            background-size: 100% auto;
          }
          .footer-bottom,
          .footer-bottom2 { padding-left: 20px; padding-right: 20px; }
        }
      `}</style>
    </footer>
  );
}
