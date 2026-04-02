'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProducts, type Product } from '../lib/api';

const PLACEHOLDER = '/store/images/dummy.jpg';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function ProductGrid({ title, products, loading }: { title: string; products: Product[]; loading: boolean }) {
  return (
    <div className="product-section">
      <h2 className="section-title">{title}</h2>
      <div className="product-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="product-card product-card--skeleton">
                <div className="product-card-img-wrap skeleton-box" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))
          : products.map(p => {
              const price = Number(p.sale_price_min ?? p.price_min ?? 0);
              const href = `/shop/product/${toSlug(p.slug || p.title)}`;
              return (
                <Link key={p.ID} href={href} className="product-card">
                  <div className="product-card-img-wrap">
                    <img src={PLACEHOLDER} alt={p.title} loading="lazy" />
                  </div>
                  <p>{p.title}</p>
                  <strong>₹{price.toFixed(2)}</strong>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

export default function NewlyLaunched() {
  const [newlyLaunched, setNewlyLaunched] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bestParams = new URLSearchParams({ sort_by: 'best-selling', limit: '4' });
    // Fetch a batch and sort by date_added client-side (no date sort on API)
    const newParams = new URLSearchParams({ limit: '20' });

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
    <section className="home-section-alt">
      <ProductGrid title="Newly Launched" products={newlyLaunched} loading={loading} />
      <ProductGrid title="Best Sellers"   products={bestSellers}   loading={loading} />
      <div className="view-all-wrap">
        <Link href="/shop" className="view-all-btn">View All Products</Link>
      </div>
    </section>
  );
}
