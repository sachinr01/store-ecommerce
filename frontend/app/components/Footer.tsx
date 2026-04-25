"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TrustBar from "./TrustBar";
import "./Footer.css";

type FooterPage = {
  slug: string;
  title: string;
};

const normalize = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const fetchFooterPages = async (): Promise<FooterPage[]> => {
  try {
    const res = await fetch('/store/api/pages?limit=25', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.data)) return [];
    return data.data;
  } catch {
    return [];
  }
};

const resolvePageHref = (pages: FooterPage[], matchers: string[], fallback: string) => {
  const page = pages.find((item) => {
    const title = normalize(item.title);
    return matchers.some((matcher) => title.includes(normalize(matcher)));
  });
  return `/${page?.slug || fallback}`;
};

export default function Footer() {
  const [pages, setPages] = useState<FooterPage[]>([]);

  useEffect(() => {
    let active = true;
    fetchFooterPages().then((nextPages) => { if (active) setPages(nextPages); });
    return () => { active = false; };
  }, []);

  const aboutHref   = resolvePageHref(pages, ['about us', 'our story'], 'about-us');
  const contactHref = resolvePageHref(pages, ['contact us', 'contact'], 'contact-us');
  const returnsHref = resolvePageHref(pages, ['refund', 'return'], 'refund_returns');
  const privacyHref = resolvePageHref(pages, ['privacy'], 'privacy-policy');
  const termsHref   = resolvePageHref(pages, ['terms', 'conditions'], 'terms-conditions');

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
              <li><Link href={aboutHref} className="link-faded">Our Story</Link></li>
              <li><a href="#" className="link-faded">FAQs</a></li>
            </ul>
          </div>
          <div>
            <h4>Need Help</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href={contactHref} className="link-faded">Contact Us</Link></li>
              <li><Link href="/orders" className="link-faded">Track Order</Link></li>
              <li><a href="#" className="link-faded">Site Map</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul className="footer-nav-list" role="list">
              <li><Link href={returnsHref} className="link-faded">Return &amp; Exchange</Link></li>
              <li><Link href={privacyHref} className="link-faded">Privacy Policy</Link></li>
              <li><Link href={termsHref} className="link-faded">Terms Of Use</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact Us</h4>
            <ul className="footer-nav-list" role="list">
              <li><a href="#" className="link-faded">Whatsapp: 91 0000000000</a></li>
              <li><a href="#" className="link-faded">Mon-Sat 10AM - 6PM IST</a></li>
              <li><a href="#" className="link-faded">Email: Info@test.com</a></li>
              <li style={{display:'flex',alignItems:'center',gap:'16px'}}>
                {/* Instagram logo */}
                <a href="#" className="link-faded" aria-label="Instagram" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                {/* Facebook logo */}
                <a href="#" className="link-faded" aria-label="Facebook" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* X (Twitter) logo */}
                <a href="#" className="link-faded" aria-label="X (Twitter)" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                {/* Whatsapp logo */}
                <a href="https://wa.me/910000000000" className="link-faded" aria-label="WhatsApp" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                {/* Mail Logo */}
                <a href="mailto:Info@test.com" className="link-faded" aria-label="Email" style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </a>
              </li>
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
    </footer>
  );
}
