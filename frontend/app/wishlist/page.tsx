'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useWishlist } from '../lib/wishlistContext';
import { useCart } from '../lib/cartContext';
import { getProductById } from '../lib/api';
import type { ProductDetail } from '../lib/api';
import { formatPrice } from '../lib/price';
import '../shop/shop.css';

const PLACEHOLDER = '/store/images/dummy.jpg';

export default function WishlistPage() {
  const { items, removeItem } = useWishlist();
  const [products, setProducts] = useState<Record<number, ProductDetail>>({});
  const [loading, setLoading] = useState(true);
  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Fetch full product data for each wishlist item
  useEffect(() => {
    if (items.length === 0) { setLoading(false); return; }
    const missing = items.filter(i => !products[i.id]).map(i => i.id);
    if (missing.length === 0) { setLoading(false); return; }
    setLoading(true);
    Promise.all(missing.map(id => getProductById(id).then(p => ({ id, p })).catch(() => null)))
      .then(results => {
        const map: Record<number, ProductDetail> = { ...products };
        results.forEach(r => { if (r) map[r.id] = r.p; });
        setProducts(map);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const getPrice = (p: ProductDetail) => {
    const simple = p.price ? Number(p.price) : null;
    const min    = Number(p.price_min ?? 0);
    return simple ?? min;
  };

  const getStock = (p: ProductDetail) =>
    p.stock_status === 'instock' || p.variations.some(v => v.stock_status === 'instock');

  return (
    <>
      <style>{`
        .wl-wrap {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 16px 60px;
          width: 100%;
        }

        @media (max-width: 600px) {
          .wl-wrap { padding: 0 12px 40px; }
          .wl-section-bg .container { padding-left: 12px !important; padding-right: 12px !important; }
        }

        /* ── table layout ── */
        .wl-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .wl-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 560px;
        }
        .wl-table thead tr {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        .wl-table thead th {
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #6b7280;
          text-align: left;
          white-space: nowrap;
        }
        .wl-table tbody tr {
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.15s;
        }
        .wl-table tbody tr:last-child { border-bottom: none; }
        .wl-table tbody tr:hover { background: #fafafa; }
        .wl-table td {
          padding: 16px;
          font-size: 13px;
          color: #374151;
          vertical-align: middle;
        }

        /* ── product cell ── */
        .wl-product-cell {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .wl-product-cell img {
          width: 60px;
          height: 68px;
          object-fit: cover;
          border-radius: 6px;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
        }
        .wl-product-name {
          font-size: 13px;
          font-weight: 500;
          color: #111;
          text-decoration: none;
          line-height: 1.4;
        }
        .wl-product-name:hover { color: #1a8a6e; }

        /* ── stock badge ── */
        .wl-stock {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .wl-stock.in  { background: #ecfdf5; color: #065f46; }
        .wl-stock.out { background: #fef2f2; color: #991b1b; }

        /* ── add to cart btn ── */
        .wl-add-btn {
          display: inline-block;
          padding: 8px 14px;
          background: #111;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          text-decoration: none;
        }
        .wl-add-btn:hover { background: #1a8a6e; color: #fff; }

        /* ── remove btn ── */
        .wl-remove-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
        }
        .wl-remove-btn:hover { color: #dc2626; }

        /* ── empty state ── */
        .wl-empty {
          padding: 64px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .wl-empty p { font-size: 15px; color: #6b7280; margin: 0; }
        .wl-empty-btn {
          display: inline-block;
          padding: 11px 28px;
          background: #111;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s;
        }
        .wl-empty-btn:hover { background: #1a8a6e; }

        /* ── mobile card layout ── */
        @media (max-width: 600px) {
          .wl-table-wrap { border: none; border-radius: 0; overflow: visible; }
          .wl-table, .wl-table thead, .wl-table tbody,
          .wl-table th, .wl-table td, .wl-table tr { display: block; }
          .wl-table { min-width: unset !important; width: 100%; box-sizing: border-box; }
          .wl-table thead { display: none; }
          .wl-table tbody tr {
            position: relative;
            border: 1.5px solid #d1d5db !important;
            border-radius: 10px;
            margin-bottom: 14px;
            padding: 14px 44px 14px 14px;
            background: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
            box-sizing: border-box;
            width: 100%;
          }
          .wl-table tbody tr:hover { background: #fff; }
          .wl-table td { padding: 0; border: none; box-sizing: border-box; }
          .wl-table td:nth-child(1) { padding-bottom: 12px; }
          .wl-product-cell { align-items: flex-start; }
          .wl-table td:nth-child(2),
          .wl-table td:nth-child(3) {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-right: 12px;
            margin-bottom: 10px;
            font-size: 13px;
          }
          .wl-table td:nth-child(2)::before {
            content: 'Price:';
            font-size: 11px;
            font-weight: 700;
            color: #9ca3af;
            text-transform: uppercase;
          }
          .wl-table td:nth-child(3)::before {
            content: 'Stock:';
            font-size: 11px;
            font-weight: 700;
            color: #9ca3af;
            text-transform: uppercase;
          }
          .wl-table td:nth-child(4) { display: block; margin-top: 4px; }
          .wl-add-btn { width: auto; display: inline-block; padding: 9px 20px; }
          .wl-table td:nth-child(5) {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 0;
          }
        }
      `}</style>
      <Header />
      <div className="dima-main">
        <nav className="csp-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <span aria-current="page">Wishlist</span>
        </nav>



        <section className="section wl-section-bg" style={{overflow:'visible'}}>
          <div className="page-section-content overflow-hidden" style={{overflow:'visible'}}>
            <div className="container">
              <div className="wl-wrap">

                {items.length === 0 ? (
                  <div className="wl-empty">
                    <svg width="56" height="56" fill="none" stroke="#d1d5db" strokeWidth="1.2" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <p>Your wishlist is empty.</p>
                    <Link href="/shop" className="wl-empty-btn">Go to Shop</Link>
                  </div>
                ) : loading ? (
                  <p style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>Loading...</p>
                ) : (
                  <div className="wl-table-wrap">
                    <table className="wl-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Unit Price</th>
                          <th>Stock Status</th>
                          <th></th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const p = products[item.id];
                          const price   = p ? getPrice(p) : item.price;
                          const inStock = p ? getStock(p) : item.inStock;
                          const title   = p ? p.title : item.title;
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="wl-product-cell">
                                  <Link href={`/shop/product/${toSlug(title)}`}>
                                    <img src={item.image || PLACEHOLDER} alt={title}/>
                                  </Link>
                                  <Link href={`/shop/product/${toSlug(title)}`} className="wl-product-name">{title}</Link>
                                </div>
                              </td>
                              <td data-label="Price">{formatPrice(price)}</td>
                              <td data-label="Stock">
                                <span className={`wl-stock ${inStock ? 'in' : 'out'}`}>
                                  {inStock ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </td>
                              <td>
                                <button className="wl-remove-btn" aria-label={`Remove ${title}`}
                                  onClick={() => removeItem(item.id)}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}
