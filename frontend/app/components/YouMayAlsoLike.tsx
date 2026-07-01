'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getImageUrl, type Product, type ProductDetail } from '../lib/api';
import { formatPrice, formatPriceRange } from '../lib/price';
import { getDiscountPercent, isSaleDateActive } from '../lib/helpers/pricing';
import { usePlaceholderImage } from '../lib/siteSettingsContext';
import WishlistButton from './WishlistButton';
import ProductImageHover from './ProductImageHover';

interface YouMayAlsoLikeProps {
  product: ProductDetail;
}

function SkeletonCard() {
  return (
    <div className="ymal-card ymal-skeleton">
      <div className="ymal-img-wrap ymal-skel-img" />
      <div className="ymal-info">
        <div className="ymal-skel-line ymal-skel-w70" />
        <div className="ymal-skel-line ymal-skel-w40 ymal-skel-mt6" />
        <div className="ymal-skel-line ymal-skel-w30 ymal-skel-mt10" />
      </div>
    </div>
  );
}

export default function YouMayAlsoLike({ product }: YouMayAlsoLikeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const PLACEHOLDER = usePlaceholderImage();

  useEffect(() => {
    const NEED = 5;
    const exclude = new Set([product.ID]);

    const pickRandom = (list: Product[], n: number): Product[] => {
      const filtered = list.filter(p => !exclude.has(p.ID));
      filtered.sort(() => Math.random() - 0.5);
      filtered.forEach(p => exclude.add(p.ID));
      return filtered.slice(0, n);
    };

    const primaryUrl = product.category_slug
      ? `/api/product-categories/${product.category_slug}/products`
      : (() => {
          const price = Number(product.price_min ?? 0);
          if (price > 0) {
            const low  = Math.floor(price * 0.6);
            const high = Math.ceil(price * 1.4);
            return `/api/products?limit=20&filter.v.price.gte=${low}&filter.v.price.lte=${high}&sort_by=best-selling`;
          }
          return null;
        })();

    const fetchJson = (url: string) =>
      fetch(url, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ success: false }));

    (async () => {
      try {
        const result: Product[] = [];

        // Step 1 — primary source (random pick from same category)
        if (primaryUrl) {
          const json = await fetchJson(primaryUrl);
          if (json.success && Array.isArray(json.data)) {
            result.push(...pickRandom(json.data, NEED));
          }
        }

        // Step 2 — fill remaining slots with random best-sellers
        if (result.length < NEED) {
          const json = await fetchJson(`/api/products/best-sellers?limit=20`);
          if (json.success && Array.isArray(json.data)) {
            result.push(...pickRandom(json.data, NEED - result.length));
          }
        }

        // Step 3 — still not enough? pull random from general catalog
        if (result.length < NEED) {
          const json = await fetchJson(`/api/products?limit=30&sort_by=newest`);
          if (json.success && Array.isArray(json.data)) {
            result.push(...pickRandom(json.data, NEED - result.length));
          }
        }

        setProducts(result.slice(0, NEED));
      } catch {
        // keep empty — section stays hidden
      } finally {
        setLoading(false);
      }
    })();
  }, [product.ID, product.category_slug, product.price_min]);

  if (!loading && products.length === 0) return null;

  return (
    <section className="ymal-section">
      <div className="ymal-container">
        <h2 className="ymal-heading">YOU MAY ALSO LIKE</h2>

        <div className="ymal-grid">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((p, idx) => {
                const isOutOfStock = p.stock_status !== 'instock' && p.stock_status !== 'onbackorder';
                const priceMin     = Number(p.price_min ?? 0);
                const priceMax     = Number(p.price_max ?? p.price_min ?? 0);
                const showRange    = priceMax > priceMin;
                const salePrice    = p._sale_price    ? Number(p._sale_price)    : null;
                const regularPrice = p._regular_price ? Number(p._regular_price) : null;
                const displayPrice = salePrice ?? regularPrice ?? priceMin;
                const isOnSale     = !showRange && salePrice !== null &&
                  isSaleDateActive(p._sale_price_dates_from, p._sale_price_dates_to);
                const discountPercent = showRange ? null : getDiscountPercent(salePrice, regularPrice);
                const img  = getImageUrl(p.thumbnail_url, PLACEHOLDER);
                const img2 = p.gallery_image_url ? getImageUrl(p.gallery_image_url, PLACEHOLDER) : null;
                const href = `/product/${p.slug}`;

                return (
                  <div key={p.ID} className="ymal-card" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div className="ymal-img-wrap">
                      <Link href={href} tabIndex={-1} aria-hidden="true" style={{ display: 'block', height: '100%' }}>
                        <ProductImageHover
                          featuredSrc={img}
                          gallerySrc={img2}
                          alt={p.title}
                          loading={idx < 4 ? 'eager' : 'lazy'}
                          className="ymal-img"
                          fallback={PLACEHOLDER}
                        />
                      </Link>

                      <div className="ymal-badges">
                        {!isOutOfStock && isOnSale && <span className="ymal-badge sale">Sale</span>}
                        {isOutOfStock               && <span className="ymal-badge oos">Sold Out</span>}
                      </div>

                      <WishlistButton
                        productId={p.ID}
                        title={p.title}
                        price={displayPrice}
                        image={img}
                        inStock={!isOutOfStock}
                        className="ymal-wishlist"
                      />
                    </div>

                    <div className="ymal-info">
                      <Link href={href} className="ymal-name">{p.title}</Link>

                      <div className="ymal-price-row">
                        {!showRange && salePrice !== null && regularPrice !== null && isOnSale ? (
                          <>
                            <span className="ymal-mrp-label">MRP</span>
                            <del className="ymal-old-price">{formatPrice(regularPrice)}</del>
                            <span className="ymal-price sale">{formatPrice(displayPrice)}</span>
                            {discountPercent !== null && (
                              <span className="ymal-save-badge">{discountPercent}% off</span>
                            )}
                          </>
                        ) : (
                          <span className="ymal-price">
                            {showRange ? formatPriceRange(priceMin, priceMax) : formatPrice(displayPrice)}
                          </span>
                        )}
                      </div>
                      <div className="ymal-tax-note">(Incl. of all taxes)</div>

                    </div>
                  </div>
                );
              })}
        </div>

      </div>
    </section>
  );
}
