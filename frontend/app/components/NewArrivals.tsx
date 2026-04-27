'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, getImageUrl, type Product } from '../lib/api';
import { formatPrice, formatPriceRange } from '../lib/price';
import { getDiscountPercent } from '../lib/helpers/pricing';
import { useWishlist } from '../lib/wishlistContext';
import { usePlaceholderImage } from '../lib/siteSettingsContext';
import './NewArrivals.css';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function ProductCard({ p, idx }: { p: Product; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const { hasItem, addItem, removeItem } = useWishlist();
  const PLACEHOLDER = usePlaceholderImage();
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
            src={getImageUrl(p.thumbnail_url, PLACEHOLDER)}
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
          <Link href={href} className="na-quick-view">View Product</Link>
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
        <div className="na-skel-line na-skel-w70" />
        <div className="na-skel-line na-skel-w40 na-skel-mt6" />
        <div className="na-skel-line na-skel-w30 na-skel-mt10" />
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(new URLSearchParams({ limit: '20' }))
      .then(all => {
        const newest = [...all]
          .sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime())
          .slice(0, 5);
        setProducts(newest);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="na-outer na-outer-top">
      <ProductGrid title="Newly Launched" products={products} loading={loading} />
      <div className="na-view-all-wrap">
        <Link href="/shop" className="na-view-all-btn">View All Products</Link>
      </div>
    </section>
  );
}

export function BestSellers() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts(new URLSearchParams({ sort_by: 'best-selling', limit: '5' }))
      .then(all => setProducts(all.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="na-outer na-outer-bs">
      <ProductGrid title="Best Sellers" products={products} loading={loading} />
      <div className="na-view-all-wrap">
        <Link href="/shop" className="na-view-all-btn">View All Products</Link>
      </div>
    </section>
  );
}
