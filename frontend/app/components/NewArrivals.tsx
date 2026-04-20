'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, getImageUrl, type Product } from '../lib/api';
import { formatPrice, formatPriceRange } from '../lib/price';
import { getDiscountPercent } from '../lib/helpers/pricing';
import { useWishlist } from '../lib/wishlistContext';

const PLACEHOLDER = '/store/images/dummy.jpg';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function ProductCard({ p, idx }: { p: Product; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const { hasItem, addItem, removeItem } = useWishlist();
  const inWishlist = hasItem(p.ID);

  const priceMin = Number(p.price_min ?? 0);
  const priceMax = Number(p.price_max ?? p.price_min ?? 0);
  const showRange = priceMax > priceMin;
  const salePrice = p._sale_price ? Number(p._sale_price) : null;
  const regularPrice = p._regular_price ? Number(p._regular_price) : null;
  const displayPrice = salePrice ?? regularPrice ?? Number(p.price_min ?? 0);
  const discountPercent = showRange ? null : getDiscountPercent(salePrice, regularPrice);
  const isOnSale = !showRange && salePrice !== null;
  const href = `/shop/product/${toSlug(p.slug || p.title)}`;

  return (
    <div
      className="na-card"
      style={{ animationDelay: `${idx * 60}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="na-img-wrap">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <img
            src={getImageUrl(p.thumbnail_url)}
            alt={p.title}
            loading={idx < 4 ? 'eager' : 'lazy'}
            className={`na-img${hovered ? ' zoomed' : ''}`}
            onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          />
        </Link>
        <div className="na-badges">
          {isOnSale && <span className="na-badge sale">Sale</span>}
          {p.stock_status !== 'instock' && p.stock_status !== 'onbackorder' && (
            <span className="na-badge oos">Sold Out</span>
          )}
        </div>
        <button
          className={`na-wishlist${inWishlist ? ' active' : ''}`}
          aria-label={inWishlist ? `Remove ${p.title} from wishlist` : `Add ${p.title} to wishlist`}
          onClick={e => {
            e.preventDefault();
            if (inWishlist) removeItem(p.ID);
            else addItem({ id: p.ID, title: p.title, price: displayPrice, image: getImageUrl(p.thumbnail_url), inStock: p.stock_status === 'instock' || p.stock_status === 'onbackorder' });
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
            fill={inWishlist ? '#e74c3c' : 'none'} stroke={inWishlist ? '#e74c3c' : 'currentColor'} strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <div className={`na-overlay${hovered ? ' show' : ''}`} aria-hidden={!hovered}>
          <Link href={href} className="na-quick-view">Quick View</Link>
        </div>
      </div>
      <div className="na-info">
        <Link href={href} className="na-name">{p.title}</Link>
        <div className="na-price-row">
          {!showRange && salePrice !== null && regularPrice !== null && (
            <span className="na-old-price">{formatPrice(regularPrice)}</span>
          )}
          <span className={`na-price${isOnSale ? ' sale' : ''}`}>
            {showRange ? formatPriceRange(priceMin, priceMax) : formatPrice(displayPrice)}
          </span>
          {discountPercent !== null && <span className="na-save-badge">{discountPercent}% off</span>}
        </div>
      </div>
    </div>
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

const STYLES = (
  <style>{`
    .na-outer { max-width: 1360px; margin: 0 auto; padding: 60px 24px; }
    .na-section { margin-bottom: 56px; }
    .na-section-title { font-size: 22px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #111; margin: 0 0 28px; text-align: center; }
    .na-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    .na-card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; color: inherit; cursor: pointer; transition: box-shadow 240ms ease, transform 240ms ease; animation: naFadeIn 0.4s ease both; will-change: transform; }
    .na-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.10); transform: translateY(-3px); }
    @keyframes naFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    .na-img-wrap { position: relative; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; background: #f3f4f6; }
    .na-img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; transition: transform 500ms ease; }
    .na-img.zoomed { transform: scale(1.05); }
    .na-badges { position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 4px; z-index: 10; }
    .na-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; }
    .na-badge.sale { background: #dc2626; color: #fff; }
    .na-badge.oos  { background: #6b7280; color: #fff; }
    .na-wishlist { position: absolute; top: 10px; right: 10px; z-index: 20; width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(255,255,255,.9); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #9ca3af; transition: all 150ms ease; box-shadow: 0 1px 4px rgba(0,0,0,.1); opacity: 0; backdrop-filter: blur(4px); }
    .na-card:hover .na-wishlist { opacity: 1; }
    .na-wishlist:hover, .na-wishlist.active { color: #dc2626; background: #fff; transform: scale(1.05); }
    .na-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,.95); display: flex; flex-direction: column; gap: 8px; padding: 12px; transform: translateY(100%); transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1); z-index: 15; backdrop-filter: blur(4px); }
    .na-overlay.show { transform: translateY(0); }
    .na-quick-view { display: block; text-align: center; height: 34px; line-height: 34px; border: 1.5px solid #1a8a6e; border-radius: 7px; font-size: 12px; font-weight: 600; color: #1a8a6e; text-decoration: none; letter-spacing: 0.4px; text-transform: uppercase; transition: all 150ms ease; }
    .na-quick-view:hover { background: #1a8a6e; color: #fff; }
    .na-info { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
    .na-name { margin: 0; font-size: 13.5px; font-weight: 500; color: #1c1c1c; text-decoration: none; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color 150ms ease; }
    .na-name:hover { color: #1a8a6e; }
    .na-price-row { display: flex; align-items: baseline; gap: 6px; margin-top: 3px; }
    .na-price { font-size: 15.5px; font-weight: 700; color: #dc2626; }
    .na-price.sale { color: #dc2626; }
    .na-old-price { font-size: 12px; color: #9ca3af; text-decoration: line-through; }
    .na-save-badge { font-size: 12px; font-weight: 600; color: #dc2626; }
    .na-skeleton { pointer-events: none; }
    .na-skel-img { aspect-ratio: 4 / 5; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: naSkel 1.4s infinite; }
    .na-skel-line { height: 12px; border-radius: 4px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: naSkel 1.4s infinite; }
    @keyframes naSkel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .na-view-all-wrap { text-align: center; margin-top: 8px; }
    .na-view-all-btn { display: inline-block; padding: 12px 36px; border: 2px solid #111; color: #111; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: background 0.2s, color 0.2s; }
    .na-view-all-btn:hover { background: #111; color: #fff; }
    @media (max-width: 1024px) { .na-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .na-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } .na-outer { padding: 40px 16px; } .na-section-title { font-size: 18px; } }
    @media (max-width: 480px) { .na-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } .na-price { font-size: 13.5px; } .na-overlay { display: none; } .na-wishlist { opacity: 1; } .na-card:hover { transform: none; box-shadow: none; } }
  `}</style>
);

export default function NewArrivals() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(new URLSearchParams({ limit: '20' }))
      .then(all => {
        const newest = [...all]
          .sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime())
          .slice(0, 4);
        setProducts(newest);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {STYLES}
      <section className="na-outer" style={{ paddingTop: '8px' }}>
        <ProductGrid title="Newly Launched" products={products} loading={loading} />
        <div className="na-view-all-wrap">
          <Link href="/shop" className="na-view-all-btn">View All Products</Link>
        </div>
      </section>
    </>
  );
}

export function BestSellers() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(new URLSearchParams({ sort_by: 'best-selling', limit: '4' }))
      .then(all => setProducts(all.slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="na-outer" style={{ paddingTop: '24px' }}>
      <ProductGrid title="Best Sellers" products={products} loading={loading} />
      <div className="na-view-all-wrap">
        <Link href="/shop" className="na-view-all-btn">View All Products</Link>
      </div>
    </section>
  );
}
