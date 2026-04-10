'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, getImageUrl, type Product } from '../lib/api';
import { formatPrice, formatPriceRange } from '../lib/price';
import { getDiscountPercent } from '../lib/helpers/pricing';

const PLACEHOLDER = '/store/images/dummy.jpg';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function StarRating({ rating = 4 }: { rating?: number }) {
  return (
    <div className="na-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#2bbfaa' : 'none'}
          stroke="#2bbfaa" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function ProductCard({ p, idx }: { p: Product; idx: number }) {
  const priceMin = Number(p.price_min ?? 0);
  const priceMax = Number(p.price_max ?? p.price_min ?? 0);
  const showRange = priceMax > priceMin;
  const salePrice = p._sale_price ? Number(p._sale_price) : null;
  const regularPrice = p._regular_price ? Number(p._regular_price) : null;
  const displayPrice = salePrice ?? regularPrice ?? Number(p.price_min ?? 0);
  const discountPercent = showRange ? null : getDiscountPercent(salePrice, regularPrice);
  const href = `/shop/product/${toSlug(p.slug || p.title)}`;

  return (
    <Link href={href} className="na-card" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className="na-img-wrap">
        <img
          src={getImageUrl(p.thumbnail_url)}
          alt={p.title}
          loading={idx < 4 ? 'eager' : 'lazy'}
          className="na-img"
          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
        />
        {!showRange && salePrice !== null && <span className="na-badge">Sale</span>}
      </div>

      <div className="na-info">
        <p className="na-name">{p.title}</p>
        <div className="na-price-row">
          {!showRange && salePrice !== null && regularPrice !== null && (
            <span className="na-old-price">{formatPrice(regularPrice)}</span>
          )}
          <span className={`na-price${!showRange && salePrice !== null ? ' sale' : ''}`}>
            {showRange ? formatPriceRange(priceMin, priceMax) : formatPrice(displayPrice)}
          </span>
          {discountPercent !== null && (
            <span className="na-save-badge">{discountPercent}% off</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="na-card na-skeleton">
      <div className="na-img-wrap na-skel-img" />
      <div className="na-info">
        <div className="na-skel-line" style={{ width: '70%' }} />
        <div className="na-skel-line" style={{ width: '40%', marginTop: 6 }} />
        <div className="na-skel-line" style={{ width: '30%', marginTop: 10 }} />
      </div>
    </div>
  );
}

function ProductGrid({ title, products, loading }: { title: string; products: Product[]; loading: boolean }) {
  return (
    <div className="na-section">
      <h2 className="na-section-title">{title}</h2>
      <div className="na-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((p, i) => <ProductCard key={p.ID} p={p} idx={i} />)
        }
      </div>
    </div>
  );
}

export default function NewArrivals() {
  const [newlyLaunched, setNewlyLaunched] = useState<Product[]>([]);
  const [bestSellers,   setBestSellers]   = useState<Product[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const bestParams = new URLSearchParams({ sort_by: 'best-selling', limit: '4' });
    const newParams  = new URLSearchParams({ limit: '20' });

    Promise.all([getProducts(newParams), getProducts(bestParams)])
      .then(([all, best]) => {
        const newest = [...all]
          .sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime())
          .slice(0, 4);
        setNewlyLaunched(newest);
        setBestSellers(best.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <style>{`
        .na-outer {
          max-width: 1360px;
          margin: 0 auto;
          padding: 60px 24px;
        }

        .na-section { margin-bottom: 56px; }

        .na-section-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #111;
          margin: 0 0 28px;
          text-align: center;
        }

        .na-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        /* ── Card ── */
        .na-card {
          display: flex;
          flex-direction: column;
          background: #fff;
          border: 1px solid #ececec;
          border-radius: 4px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.22s ease, transform 0.22s ease;
          animation: naFadeIn 0.4s ease both;
        }

        .na-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.10);
          transform: translateY(-3px);
        }

        @keyframes naFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Image ── */
        .na-img-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: #f6f6f6;
        }

        .na-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }

        .na-card:hover .na-img { transform: scale(1.05); }

        .na-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #e74c3c;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 2px;
        }

        /* ── Info ── */
        .na-info {
          padding: 14px 16px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          border-top: 1px solid #f0f0f0;
        }

        .na-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #1b1b1b;
          text-align: center;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .na-stars {
          display: flex;
          gap: 2px;
        }

        .na-price-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .na-price {
          font-size: 18px;
          font-weight: 700;
          color: #111;
        }

        .na-price.sale { color: #e74c3c; }

        .na-old-price {
          font-size: 13px;
          color: #aaa;
          text-decoration: line-through;
        }

        .na-save-badge {
          font-size: 12px;
          font-weight: 600;
          color: #e74c3c;
        }

        /* ── Skeleton ── */
        .na-skeleton { pointer-events: none; }

        .na-skel-img {
          aspect-ratio: 1 / 1;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: naSkel 1.4s infinite;
        }

        .na-skel-line {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: naSkel 1.4s infinite;
        }

        @keyframes naSkel {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── View All ── */
        .na-view-all-wrap {
          text-align: center;
          margin-top: 8px;
        }

        .na-view-all-btn {
          display: inline-block;
          padding: 12px 36px;
          border: 2px solid #111;
          color: #111;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
        }

        .na-view-all-btn:hover {
          background: #111;
          color: #fff;
        }

        @media (max-width: 1024px) {
          .na-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (max-width: 768px) {
          .na-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .na-outer { padding: 40px 16px; }
          .na-section-title { font-size: 18px; }
        }

        @media (max-width: 480px) {
          .na-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .na-price { font-size: 15px; }
        }
      `}</style>

      <section className="na-outer">
        <ProductGrid title="Newly Launched" products={newlyLaunched} loading={loading} />
        <ProductGrid title="Best Sellers"   products={bestSellers}   loading={loading} />
        <div className="na-view-all-wrap">
          <Link href="/shop" className="na-view-all-btn">View All Products</Link>
        </div>
      </section>
    </>
  );
}
