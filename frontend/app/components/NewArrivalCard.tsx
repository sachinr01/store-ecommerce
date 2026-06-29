// Server component — no 'use client' directive.
// Only WishlistButton (imported below) is a client island.

import Link from 'next/link';
import WishlistButton from './WishlistButton';
import AddToCartButton from './AddToCartButton';
import ProductImageHover from './ProductImageHover';
import ProductCardHoverWrapper from './ProductCardHoverWrapper';
import { formatPrice, formatPriceRange } from '../lib/price';
import { getDiscountPercent, isSaleDateActive } from '../lib/helpers/pricing';
import { getImageUrl, type Product } from '../lib/api';

const toSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface NewArrivalCardProps {
  p: Product;
  idx: number;
  placeholder: string;
  showAddToCart?: boolean;
}

export default function NewArrivalCard({ p, idx, placeholder, showAddToCart = true }: NewArrivalCardProps) {
  const isOutOfStock =
    (p.stock_status !== 'instock' && p.stock_status !== 'onbackorder') ||
    (p.stock_qty !== null && p.stock_qty !== undefined && Number(p.stock_qty) <= 0);

  const priceMin = Number(p.price_min ?? 0);
  const priceMax = Number(p.price_max ?? p.price_min ?? 0);
  const showRange = priceMax > priceMin;
  const salePrice = p._sale_price ? Number(p._sale_price) : null;
  const regularPrice = p._regular_price ? Number(p._regular_price) : null;
  const displayPrice = salePrice ?? regularPrice ?? Number(p.price_min ?? 0);
  const discountPercent = showRange ? null : getDiscountPercent(salePrice, regularPrice);
  const isOnSale =
    !showRange &&
    salePrice !== null &&
    isSaleDateActive(p._sale_price_dates_from, p._sale_price_dates_to);
  const href = `/shop/product/${toSlug(p.slug || p.title)}`;
  const featuredSrc = getImageUrl(p.thumbnail_url, placeholder);
  const gallerySrc = p.gallery_image_url ? getImageUrl(p.gallery_image_url, placeholder) : null;

  return (
    <ProductCardHoverWrapper
      className="na-card"
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      {(cardHovered) => (<>
      <div className="na-img-wrap">
        <Link href={href} tabIndex={-1} aria-hidden="true" style={{ display: 'block', height: '100%' }}>
          <ProductImageHover
            featuredSrc={featuredSrc}
            gallerySrc={gallerySrc}
            alt={p.title}
            loading={idx < 4 ? 'eager' : 'lazy'}
            className="na-img"
            fallback={placeholder}
            cardHovered={cardHovered}
          />
        </Link>
        <div className="na-badges">
          {!isOutOfStock && isOnSale && <span className="na-badge sale">Sale</span>}
          {isOutOfStock && <span className="na-badge oos">Sold Out</span>}
        </div>
        {/* Client island — only this button ships JS */}
        <WishlistButton
          productId={p.ID}
          title={p.title}
          price={displayPrice}
          image={featuredSrc}
          inStock={!isOutOfStock}
          className="na-wishlist"
        />

      </div>
      <div className="na-info">
        <div className="na-info-top">
          <Link href={href} className="na-name">
            {p.title}
          </Link>
          <div className="na-price-row">
            {!showRange && salePrice !== null && regularPrice !== null && isOnSale ? (
              <>
                <span className="na-mrp-label">MRP</span>
                <del className="na-old-price">{formatPrice(regularPrice)}</del>
                <span className="na-price sale">{formatPrice(displayPrice)}</span>
                {discountPercent !== null && (
                  <span className="na-save-badge">{discountPercent}% off</span>
                )}
              </>
            ) : (
              <span className="na-price">
                {showRange ? formatPriceRange(priceMin, priceMax) : formatPrice(displayPrice)}
              </span>
            )}
          </div>
          <div className="na-tax-note">(Excl. of taxes)</div>
        </div>
        {showAddToCart && (
          <AddToCartButton
            productId={p.ID}
            title={p.title}
            image={featuredSrc}
            inStock={!isOutOfStock}
          />
        )}
      </div>
      </>)}
    </ProductCardHoverWrapper>
  );
}
