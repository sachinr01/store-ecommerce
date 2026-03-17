'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getProductById, type ProductDetail } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useWishlist } from '../lib/wishlistContext';

const PLACEHOLDER = '/store/images/dummy.png';

type SwatchStyle = { style: { background?: string }; isLight: boolean };

function getSwatchStyle(c: { attr_name?: string; attr_slug?: string }): SwatchStyle {
  // Use slug only for matching — more reliable than name+slug concat
  const slug = (c.attr_slug ?? '').toLowerCase().replace(/[_]+/g, '-').trim();

  // Specific compound slugs first (before generic single-word checks)
  if (slug === 'blue-ocean-camo' || slug === 'blue-camo')
    return { style: { background: 'linear-gradient(135deg, #0f766e 0%, #3b82f6 45%, #1f2937 100%)' }, isLight: false };
  if (slug === 'white-ocean-camo' || slug === 'white-camo')
    return { style: { background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #f8fafc 100%)' }, isLight: true };
  if (slug.includes('camo'))
    return { style: { background: 'linear-gradient(135deg, #4d7c0f 0%, #365314 50%, #1c2a0a 100%)' }, isLight: false };
  if (slug.includes('stripe') || slug.includes('striper'))
    return { style: { background: 'repeating-linear-gradient(45deg, #111 0 6px, #f5f5f5 6px 12px)' }, isLight: false };
  if (slug.includes('multi'))
    return { style: { background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 45%, #3b82f6 100%)' }, isLight: false };
  if (slug === 'ice-blue')        return { style: { background: '#cfe8ff' }, isLight: true };
  if (slug === 'light-blue' || slug === 'aqua' || slug === 'water-blue') return { style: { background: '#8ec5ff' }, isLight: true };
  if (slug === 'navy')            return { style: { background: '#1b2a4a' }, isLight: false };
  if (slug === 'turquoise')       return { style: { background: '#43d5c1' }, isLight: true };
  if (slug === 'mint')            return { style: { background: '#8de6c4' }, isLight: true };
  if (slug === 'pink')            return { style: { background: '#f3a6c8' }, isLight: true };
  if (slug === 'rose')            return { style: { background: '#e9a0b0' }, isLight: true };
  if (slug === 'citrus' || slug === 'yellow') return { style: { background: '#ffd54f' }, isLight: true };
  if (slug === 'orange')          return { style: { background: '#f59e0b' }, isLight: false };
  if (slug === 'gold')            return { style: { background: '#d4af37' }, isLight: false };
  if (slug === 'silver' || slug === 'steel' || slug === 'chrome' || slug === 'metal') return { style: { background: '#b5bcc8' }, isLight: true };
  if (slug === 'gray' || slug === 'grey' || slug === 'smoke' || slug === 'concrete') return { style: { background: '#9ca3af' }, isLight: true };
  if (slug === 'beige' || slug === 'natural' || slug === 'tan') return { style: { background: '#f5f0e6' }, isLight: true };
  if (slug === 'brown' || slug === 'wood')  return { style: { background: '#8b5a2b' }, isLight: false };
  if (slug === 'glass')           return { style: { background: '#e5f6ff' }, isLight: true };
  if (slug === 'white')           return { style: { background: '#ffffff' }, isLight: true };
  if (slug === 'black')           return { style: { background: '#111111' }, isLight: false };
  if (slug === 'blue')            return { style: { background: '#1f6feb' }, isLight: false };
  if (slug === 'red')             return { style: { background: '#dc2626' }, isLight: false };
  if (slug === 'green')           return { style: { background: '#16a34a' }, isLight: false };
  if (slug === 'purple')          return { style: { background: '#7c3aed' }, isLight: false };

  // Fallback: try to parse as a CSS color from the name
  return { style: { background: '#cbd5e1' }, isLight: true };
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke="#f59e0b" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export function ProductDetailsClient({ productId }: { productId?: string } = {}) {
  const searchParams   = useSearchParams();
  const id             = productId ?? searchParams.get('id');
  const { addItem }    = useCart();
  const { hasItem: inWishlist, addItem: addToWishlist, removeItem: removeFromWishlist } = useWishlist();

  const [product,       setProduct]       = useState<ProductDetail | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [mainImage,     setMainImage]     = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize,  setSelectedSize]  = useState('');
  const [quantity,      setQuantity]      = useState(1);
  const [addedFlash,    setAddedFlash]    = useState(false);
  const [pinned,        setPinned]        = useState(false);
  const [activeTab,     setActiveTab]     = useState('description');

  useEffect(() => {
    if (!id) { setError('No product ID provided.'); setLoading(false); return; }
    getProductById(id)
      .then(p => { setProduct(p); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) return (
    <div style={S.centered}>
      <div style={S.spinner} />
      <p style={{ marginTop: 16, fontFamily: 'sans-serif', color: '#888' }}>Loading product…</p>
    </div>
  );
  if (error || !product) return (
    <div style={S.centered}>
      <p style={{ fontFamily: 'sans-serif', color: '#e74c3c' }}>{error ?? 'Product not found.'}</p>
    </div>
  );

  /* -- Variation logic -- */
  const hasColors = product.variations.some(v => v.color) || (product.attributes?.colors?.length ?? 0) > 0;
  const hasSizes  = product.variations.some(v => v.size)  || (product.attributes?.sizes?.length ?? 0) > 0;

  const normalize = (v: string) => v.toLowerCase().trim().replace(/\s+/g, '-');
  const isVariationInStock = (v: { stock_status?: string | null }) =>
    v.stock_status === 'instock' || v.stock_status === 'onbackorder';

  const hasFullSelection = (!hasColors || selectedColor) && (!hasSizes || selectedSize);

  const selectedVariation = hasFullSelection
    ? product.variations.find(v => {
        const colorMatch = !hasColors || normalize(v.color ?? '') === normalize(selectedColor);
        const sizeMatch  = !hasSizes  || normalize(v.size  ?? '') === normalize(selectedSize);
        return colorMatch && sizeMatch;
      })
    : undefined;

  const bestMatch = selectedVariation;

  const currentPrice     = bestMatch ? Number(bestMatch.price || bestMatch.regular_price || 0) || null : null;
  const currentSalePrice = bestMatch?.sale_price && bestMatch.sale_price !== '' ? Number(bestMatch.sale_price) : null;

  const priceMin = Number(product.price_min ?? 0);
  const priceMax = Number(product.price_max ?? 0);

  const simplePrice     = !product.variations.length && product.price     ? Number(product.price)     : null;
  const simpleSalePrice = !product.variations.length && product.sale_price ? Number(product.sale_price) : null;

  const displayPrice     = currentPrice ?? simplePrice ?? (hasFullSelection ? priceMin : null);
  const displaySalePrice = currentSalePrice ?? simpleSalePrice ?? null;
  const showRange = !hasFullSelection && priceMax > priceMin;
  const priceRangeStr = priceMax > priceMin
    ? `$${priceMin.toFixed(2)} � $${priceMax.toFixed(2)}`
    : `$${priceMin.toFixed(2)}`;

  const isAddToCartEnabled = !product.variations.length || hasFullSelection;

  const colorHasStock = (colorSlug: string) => {
    if (!product.variations.length) return true;
    const colorKey = normalize(colorSlug);
    return product.variations.some(v => {
      if (!isVariationInStock(v)) return false;
      if (colorKey && normalize(v.color ?? '') !== colorKey) return false;
      // only filter by size if user has already picked one
      if (selectedSize && normalize(v.size ?? '') !== normalize(selectedSize)) return false;
      return true;
    });
  };

  const sizeHasStock = (sizeSlug: string) => {
    if (!product.variations.length) return true;
    const sizeKey = normalize(sizeSlug);
    return product.variations.some(v => {
      if (!isVariationInStock(v)) return false;
      if (sizeKey && normalize(v.size ?? '') !== sizeKey) return false;
      // only filter by color if user has already picked one
      if (selectedColor && normalize(v.color ?? '') !== normalize(selectedColor)) return false;
      return true;
    });
  };

  const shortDesc = product.short_description?.replace(/<[^>]+>/g, '') || '';
  const fullDesc  = product.description?.replace(/<[^>]+>/g, '')       || shortDesc;

  const anyInStock = product.variations.length
    ? product.variations.some(isVariationInStock)
    : product.stock_status === 'instock';

  const inStock = hasFullSelection
    ? (bestMatch ? isVariationInStock(bestMatch) : false)
    : anyInStock;

  const handleAddToCart = () => {
    if (!isAddToCartEnabled) return;
    addItem({
      id: product.ID,
      variationId: bestMatch?.ID,
      title: product.title,
      price: displaySalePrice ?? displayPrice ?? priceMin,
      color: selectedColor || undefined,
      size: selectedSize || undefined,
      quantity,
      image: PLACEHOLDER,
    });
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 2000);
  };

  const toggleWishlist = () => {
    if (inWishlist(product.ID)) {
      removeFromWishlist(product.ID);
    } else {
      addToWishlist({
        id: product.ID,
        title: product.title,
        price: Number(displaySalePrice ?? displayPrice) || 0,
        image: PLACEHOLDER,
        inStock,
      });
    }
  };

  /* Fake gallery: 4 slots using the same placeholder */
  const galleryImgs = [PLACEHOLDER, PLACEHOLDER, PLACEHOLDER, PLACEHOLDER];

  const reviews: never[] = [];
  const avgRating  = Number(product.avg_rating  ?? 0);
  const reviewCount = Number(product.review_count ?? 0);

  return (
    <>
      <Header />
      <style>{baseCss}</style>

      {/* ── Breadcrumb ── */}
      <nav className="cpd-breadcrumb">
        <Link href="/">Home</Link>
        <span className="cpd-sep">›</span>
        <Link href="/shop">Shop</Link>
        <span className="cpd-sep">›</span>
        <span>{product.title}</span>
      </nav>

      {/* ── Main two-column layout ── */}
      <div className="cpd-wrap">

        {/* ════ LEFT: Gallery ════ */}
        <div className="cpd-gallery-col">
          {/* Vertical thumbnail strip */}
          <div className="cpd-thumbs-strip">
            {galleryImgs.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setMainImage(idx)}
                className={`cpd-thumb${mainImage === idx ? ' active' : ''}`}>
                <img src={img} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          {/* Main image */}
          <div className="cpd-main-img-wrap">
            <img src={galleryImgs[mainImage]} alt={product.title} className="cpd-main-img" />

            {/* Image nav arrows (mobile) */}
            <button className="cpd-img-arrow prev"
              onClick={() => setMainImage(i => Math.max(0, i - 1))}>‹</button>
            <button className="cpd-img-arrow next"
              onClick={() => setMainImage(i => Math.min(galleryImgs.length - 1, i + 1))}>›</button>

            {/* Sale badge */}
            {displaySalePrice && <span className="cpd-sale-badge">Sale</span>}

            {/* Wishlist on image */}
            <button className="cpd-img-wishlist" onClick={toggleWishlist} title="Add to Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={inWishlist(product.ID) ? '#e74c3c' : 'none'}
                stroke={inWishlist(product.ID) ? '#e74c3c' : '#666'} strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div className="cpd-img-dots">
              {galleryImgs.map((_, i) => (
                <button key={i} onClick={() => setMainImage(i)}
                  className={`cpd-dot${mainImage === i ? ' active' : ''}`} />
              ))}
            </div>
          </div>
        </div>

        {/* ════ RIGHT: Info ════ */}
        <div className="cpd-info-col">

          {/* Title */}
          <h1 className="cpd-title">{product.title}</h1>

          {/* Rating row */}
          <div className="cpd-rating-row">
            {avgRating > 0 && <StarRating rating={avgRating} />}
            <span className="cpd-rating-num">{avgRating > 0 ? avgRating.toFixed(1) : ''}</span>
            <button className="cpd-review-count"
              onClick={() => setActiveTab('reviews')}>
              ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </button>
            <span className={`cpd-stock-badge${inStock ? ' in' : ' out'}`}>
              {inStock ? '✓ In Stock' : '✗ Out of Stock'}
            </span>
          </div>

          {/* Price */}
          <div className="cpd-price-block">
            {showRange ? (
              <span className="cpd-price">{priceRangeStr}</span>
            ) : displaySalePrice ? (
              <>
                <span className="cpd-price sale">${displaySalePrice.toFixed(2)}</span>
                <span className="cpd-old-price">${Number(displayPrice).toFixed(2)}</span>
                <span className="cpd-save-badge">
                  Save ${(Number(displayPrice) - displaySalePrice).toFixed(2)}
                </span>
              </>
            ) : displayPrice ? (
              <span className="cpd-price">${Number(displayPrice).toFixed(2)}</span>
            ) : (
              <span className="cpd-price">{priceRangeStr}</span>
            )}
          </div>

          <div className="cpd-divider" />

          {/* Short desc */}
          {shortDesc && (
            <p className="cpd-short-desc">
              {shortDesc.substring(0, 220)}{shortDesc.length > 220 ? '…' : ''}
            </p>
          )}

          {/* ── Color selector ── */}
          {hasColors && product.attributes.colors.length > 0 && (
            <div className="cpd-option-block">
              <div className="cpd-option-label">
                <span>Colour</span>
                {selectedColor && (
                  <span className="cpd-option-selected">— {selectedColor}</span>
                )}
              </div>
              <div className="cpd-color-row">
                {product.attributes.colors.map(c => {
                  const swatch = getSwatchStyle(c);
                  const colorInStock = product.variations.length
                    ? colorHasStock(c.attr_slug)
                    : (c.in_stock !== 0);
                  return (
                    <button
                      key={c.attr_id}
                      title={c.attr_name}
                      onClick={() => setSelectedColor(selectedColor === c.attr_slug ? '' : c.attr_slug)}
                      className={`cpd-color-swatch${selectedColor === c.attr_slug ? ' active' : ''}${swatch.isLight ? ' light' : ''}`}
                      style={swatch.style}>
                      {selectedColor === c.attr_slug && (
                        <svg className="cpd-swatch-check" viewBox="0 0 24 24" fill="none"
                          stroke={swatch.isLight ? '#111' : '#fff'} strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Size selector ── */}
          {hasSizes && product.attributes.sizes.length > 0 && (
            <div className="cpd-option-block">
              <div className="cpd-option-label">
                <span>Size</span>
                {selectedSize && (
                  <span className="cpd-option-selected">— {selectedSize.toUpperCase()}</span>
                )}
                {selectedSize && (
                  <button className="cpd-clear-btn"
                    onClick={() => setSelectedSize('')}>Clear</button>
                )}
              </div>
              <div className="cpd-size-row">
                {product.attributes.sizes.map(s => {
                  const sizeInStock = sizeHasStock(s.attr_slug);
                  return (
                    <button
                      key={s.attr_id}
                      title={!sizeInStock ? `${s.attr_name} — Out of Stock` : s.attr_name}
                      onClick={() => setSelectedSize(selectedSize === s.attr_slug ? '' : s.attr_slug)}
                      className={`cpd-size-pill${selectedSize === s.attr_slug ? ' active' : ''}`}>
                      {s.attr_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variation stock info */}
          {bestMatch && (
            <div className="cpd-variation-info">
              <span className={`cpd-var-stock${bestMatch.stock_status === 'instock' ? ' in' : ' out'}`}>
                {bestMatch.stock_status === 'instock' ? '✓ Available' : '✗ Out of Stock'}
              </span>
              {bestMatch.sku && (
                <span className="cpd-var-sku">SKU: {bestMatch.sku}</span>
              )}
            </div>
          )}

          <div className="cpd-divider" />

          {/* ── Qty + Add to Cart + Wishlist ── */}
          <div className="cpd-cart-row">
            {/* Qty */}
            <div className="cpd-qty-wrap">
              <button className="cpd-qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
              <input
                type="number" className="cpd-qty-input" value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button className="cpd-qty-btn" onClick={() => setQuantity(q => q + 1)}>+</button>
            </div>

            {/* Add to Cart */}
            <button
              disabled={!isAddToCartEnabled}
              onClick={handleAddToCart}
              className={`cpd-atc-btn${isAddToCartEnabled ? ' ready' : ''}${addedFlash ? ' flash' : ''}`}>
              {addedFlash ? '✓ Added to Cart!' :
                !hasColors || selectedColor
                  ? (!hasSizes || selectedSize ? 'Add to Cart' : 'Select Size')
                  : 'Select Colour'}
            </button>

            {/* Wishlist */}
            <button
              className={`cpd-wishlist-btn${inWishlist(product.ID) ? ' active' : ''}`}
              onClick={toggleWishlist}
              title={inWishlist(product.ID) ? 'Remove from Wishlist' : 'Add to Wishlist'}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill={inWishlist(product.ID) ? '#e74c3c' : 'none'}
                stroke={inWishlist(product.ID) ? '#e74c3c' : 'currentColor'} strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* ── Highlights ── */}
          <div className="cpd-highlights">
            {['Premium quality materials', 'Comfortable everyday fit', 'Easy care & long-lasting', 'Gift-ready packaging']
              .map((h, i) => (
                <div key={i} className="cpd-highlight-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a8a6e" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{h}</span>
                </div>
              ))}
          </div>

          {/* ── Meta ── */}
          <div className="cpd-meta">
            {(bestMatch?.sku || product.sku) && (
              <>
                <span className="cpd-meta-item"><strong>SKU:</strong> {bestMatch?.sku || product.sku}</span>
                <span className="cpd-meta-sep">|</span>
              </>
            )}
            <span className="cpd-meta-item">
              <strong>Category:</strong>
              <Link href="/shop" className="cpd-meta-link">Shop</Link>
            </span>
            {bestMatch && (
              <>
                <span className="cpd-meta-sep">|</span>
                <span className="cpd-meta-item cpd-var-id">
                  <strong>Variation:</strong> #{bestMatch.ID}
                </span>
              </>
            )}
          </div>

          {/* ── Trust badges ── */}
          <div className="cpd-trust-row">
            {[
              { icon: '🚚', label: 'Free Shipping', sub: 'Orders over $75' },
              { icon: '↩',  label: 'Easy Returns',  sub: '30-day policy' },
              { icon: '🔒', label: 'Secure Payment', sub: 'SSL encrypted' },
            ].map(b => (
              <div key={b.label} className="cpd-trust-badge">
                <span className="cpd-trust-icon">{b.icon}</span>
                <div>
                  <div className="cpd-trust-label">{b.label}</div>
                  <div className="cpd-trust-sub">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Sticky bar ── */}
      {pinned && (
        <div className="cpd-sticky-bar">
          <img src={PLACEHOLDER} alt="" className="cpd-sticky-thumb" />
          <span className="cpd-sticky-name">{product.title}</span>
          <span className="cpd-sticky-price">
            {displaySalePrice ? `$${displaySalePrice.toFixed(2)}` : displayPrice ? `$${Number(displayPrice).toFixed(2)}` : priceRangeStr}
          </span>
          <button
            disabled={!isAddToCartEnabled}
            onClick={handleAddToCart}
            className={`cpd-sticky-atc${isAddToCartEnabled ? ' ready' : ''}`}>
            Add to Cart
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="cpd-tabs-section">
        <div className="cpd-tabs-nav">
          {[
            { key: 'description', label: 'Description' },
            { key: 'reviews', label: `Reviews (${reviewCount})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`cpd-tab${activeTab === t.key ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="cpd-tab-content">

          {activeTab === 'description' && (
            <div className="cpd-desc-panel">
              <p className="cpd-desc-text">{fullDesc || 'No description available.'}</p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="cpd-reviews-panel">
              {reviewCount > 0 ? (
                <div className="cpd-review-summary">
                  <div className="cpd-review-avg">
                    <span className="cpd-avg-num">{avgRating.toFixed(1)}</span>
                    <StarRating rating={avgRating} size={20} />
                    <span className="cpd-avg-sub">out of 5 ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#888', fontFamily: 'var(--font-body)', fontSize: 15 }}>
                  <p style={{ margin: 0 }}>No reviews yet. Be the first to review this product.</p>
                </div>
              )}
              <button className="cpd-write-review">Write a Review</button>
            </div>
          )}

        </div>
      </div>

      <Footer />
    </>
  );
}

/* ─────────────── Styles ─────────────── */
const S = {
  centered: {
    display: 'flex' as const, alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', flexDirection: 'column' as const,
  },
  spinner: {
    width: 40, height: 40, border: '3px solid #eee',
    borderTopColor: '#1a8a6e', borderRadius: '50%',
    animation: 'cpdSpin .8s linear infinite',
  },
};

const baseCss = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --cpd-brand:       #1a8a6e;
  --cpd-brand-mid:   #12705a;
  --cpd-brand-light: #e6f5f1;
  --cpd-accent:      #e8a020;
  --cpd-text:        #1c1c1c;
  --cpd-muted:       #888;
  --cpd-border:      #ebebeb;
  --cpd-bg:          #fafafa;
  --cpd-white:       #ffffff;
  --cpd-sale:        #e74c3c;
  --font-head: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --radius: 12px;
  --shadow: 0 4px 20px rgba(0,0,0,.09);
}
* { box-sizing: border-box; }

/* Breadcrumb */
.cpd-breadcrumb {
  padding: 13px 48px;
  font-family: var(--font-body); font-size: 13px;
  color: var(--cpd-muted); display: flex; align-items: center; gap: 6px;
  border-bottom: 1px solid var(--cpd-border);
  background: var(--cpd-white); flex-wrap: wrap;
}
.cpd-breadcrumb a { color: var(--cpd-muted); text-decoration: none; transition: color .2s; }
.cpd-breadcrumb a:hover { color: var(--cpd-brand); }
.cpd-breadcrumb span:last-child { color: var(--cpd-text); font-weight: 500; }
.cpd-sep { color: #ccc; }

/* Two-col wrap */
.cpd-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 52px;
  max-width: 1240px; margin: 0 auto;
  padding: 44px 48px 60px;
  background: var(--cpd-white);
  align-items: start;
}

/* ════ GALLERY ════ */
.cpd-gallery-col {
  display: flex; gap: 14px;
  position: sticky; top: 76px;
}

.cpd-thumbs-strip {
  display: flex; flex-direction: column; gap: 9px; width: 74px; flex-shrink: 0;
}
.cpd-thumb {
  width: 74px; height: 74px;
  border: 2px solid transparent; border-radius: 8px;
  overflow: hidden; padding: 0; cursor: pointer; background: #f4f4f4;
  transition: border-color .2s, transform .15s;
}
.cpd-thumb:hover { border-color: var(--cpd-brand); transform: scale(1.04); }
.cpd-thumb.active { border-color: var(--cpd-brand); }
.cpd-thumb img { width:100%; height:100%; object-fit:cover; display:block; }

.cpd-main-img-wrap {
  flex: 1; position: relative; border-radius: 14px; overflow: hidden;
  background: #f6f6f6; aspect-ratio: 4/5;
}
.cpd-main-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .5s ease;
}
.cpd-main-img-wrap:hover .cpd-main-img { transform: scale(1.04); }

/* Arrows (mobile) */
.cpd-img-arrow {
  display: none; position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,.85); border: none; width: 34px; height: 34px;
  border-radius: 50%; font-size: 20px; cursor: pointer; z-index: 10;
  align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.12);
  color: var(--cpd-text); line-height: 1;
}
.cpd-img-arrow.prev { left: 10px; }
.cpd-img-arrow.next { right: 10px; }

.cpd-sale-badge {
  position: absolute; top: 14px; left: 14px; z-index: 10;
  background: var(--cpd-sale); color: #fff;
  font-family: var(--font-body); font-size: 11px; font-weight: 700;
  letter-spacing: .8px; text-transform: uppercase;
  padding: 3px 10px; border-radius: 4px;
}
.cpd-img-wishlist {
  position: absolute; top: 14px; right: 14px; z-index: 10;
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: rgba(255,255,255,.9); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 5px rgba(0,0,0,.1); transition: transform .2s;
}
.cpd-img-wishlist:hover { transform: scale(1.12); }
.cpd-img-dots {
  display: none; position: absolute; bottom: 12px; left: 50%;
  transform: translateX(-50%); gap: 6px; z-index: 10;
}
.cpd-dot {
  width: 7px; height: 7px; border-radius: 50%;
  border: none; padding: 0; cursor: pointer; background: rgba(255,255,255,.5);
}
.cpd-dot.active { background: var(--cpd-brand); }

/* ════ INFO ════ */
.cpd-info-col { display: flex; flex-direction: column; }

.cpd-title {
  font-family: var(--font-head);
  font-size: clamp(22px, 2.6vw, 30px);
  font-weight: 700; color: var(--cpd-text);
  margin: 0 0 14px; line-height: 1.25; letter-spacing: -.3px;
}

/* Rating */
.cpd-rating-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
}
.cpd-rating-num { font-family: var(--font-body); font-weight: 600; font-size: 14px; }
.cpd-review-count {
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: var(--font-body); font-size: 13px; color: var(--cpd-brand);
  text-decoration: underline;
}
.cpd-stock-badge {
  margin-left: auto; font-family: var(--font-body); font-size: 12px; font-weight: 600;
  padding: 3px 10px; border-radius: 20px;
}
.cpd-stock-badge.in  { background: var(--cpd-brand-light); color: var(--cpd-brand); }
.cpd-stock-badge.out { background: #fdecea; color: var(--cpd-sale); }

/* Price */
.cpd-price-block {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px;
}
.cpd-price {
  font-family: var(--font-head); font-size: 30px; font-weight: 700; color: var(--cpd-text);
}
.cpd-price.sale { color: var(--cpd-sale); }
.cpd-price.muted { font-size: 22px; color: var(--cpd-muted); font-weight: 400; }
.cpd-old-price {
  font-family: var(--font-body); font-size: 16px;
  color: #bbb; text-decoration: line-through;
}
.cpd-save-badge {
  font-family: var(--font-body); font-size: 12px; font-weight: 600;
  background: #fef4e8; color: var(--cpd-accent); padding: 3px 9px; border-radius: 20px;
}

.cpd-divider { height: 1px; background: var(--cpd-border); margin: 16px 0; }

/* Short desc */
.cpd-short-desc {
  font-family: var(--font-body); font-size: 14.5px; line-height: 1.75;
  color: #555; margin: 0 0 20px;
}

/* Options */
.cpd-option-block { margin-bottom: 20px; }
.cpd-option-label {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-body); font-size: 12px; font-weight: 700;
  letter-spacing: .6px; text-transform: uppercase; color: var(--cpd-text);
  margin-bottom: 10px;
}
.cpd-option-selected {
  font-weight: 400; text-transform: none; letter-spacing: 0;
  font-size: 13px; color: var(--cpd-muted);
}
.cpd-clear-btn {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-family: var(--font-body); font-size: 12px; color: var(--cpd-muted);
  text-decoration: underline; padding: 0;
}
.cpd-clear-btn:hover { color: var(--cpd-sale); }

/* Color swatches */
.cpd-color-row { display: flex; gap: 10px; flex-wrap: wrap; }
.cpd-color-swatch {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer; padding: 0; position: relative;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.15);
  transition: transform .15s, border-color .15s;
}
.cpd-color-swatch:hover { transform: scale(1.1); }
.cpd-color-swatch.active { border-color: var(--cpd-brand); transform: scale(1.08); }
.cpd-color-swatch.light { border-color: #e2e2e2; }
.cpd-color-swatch.light.active { border-color: var(--cpd-brand); }
.cpd-swatch-check { width: 15px; height: 15px; pointer-events: none; }

/* Size pills */
.cpd-size-row { display: flex; gap: 8px; flex-wrap: wrap; }
.cpd-size-pill {
  min-width: 50px; height: 40px; padding: 0 14px;
  border: 1.5px solid var(--cpd-border); border-radius: 6px;
  font-family: var(--font-body); font-size: 13px; font-weight: 500;
  color: var(--cpd-text); background: var(--cpd-white);
  cursor: pointer; position: relative; transition: all .2s;
}
.cpd-size-pill:hover { border-color: var(--cpd-brand); color: var(--cpd-brand); }
.cpd-size-pill.active { background: var(--cpd-brand); color: #fff; border-color: var(--cpd-brand); font-weight: 600; }

/* Variation info */
.cpd-variation-info {
  display: flex; align-items: center; gap: 12px;
  margin: 8px 0 4px;
  font-family: var(--font-body); font-size: 12.5px;
}
.cpd-var-stock.in  { color: var(--cpd-brand); font-weight: 600; }
.cpd-var-stock.out { color: var(--cpd-sale);  font-weight: 600; }
.cpd-var-sku { color: var(--cpd-muted); }

/* Cart row */
.cpd-cart-row {
  display: flex; gap: 10px; align-items: center;
  margin-bottom: 24px; flex-wrap: wrap;
}
.cpd-qty-wrap {
  display: flex; align-items: center;
  border: 1.5px solid var(--cpd-border); border-radius: 8px;
  overflow: hidden; flex-shrink: 0;
}
.cpd-qty-btn {
  width: 38px; height: 46px; border: none;
  background: #f6f6f6; cursor: pointer; font-size: 18px; font-weight: 300;
  color: var(--cpd-text); transition: background .15s;
}
.cpd-qty-btn:hover { background: var(--cpd-brand-light); }
.cpd-qty-input {
  width: 44px; text-align: center; border: none; outline: none;
  font-family: var(--font-body); font-size: 15px; font-weight: 500; height: 46px;
  -moz-appearance: textfield;
}
.cpd-qty-input::-webkit-outer-spin-button,
.cpd-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; }

.cpd-atc-btn {
  flex: 1; min-width: 150px; height: 46px;
  border: none; border-radius: 8px;
  font-family: var(--font-body); font-size: 13.5px; font-weight: 700;
  letter-spacing: .6px; text-transform: uppercase;
  background: #d4d4d4; color: #999; cursor: not-allowed; transition: all .25s;
}
.cpd-atc-btn.ready {
  background: var(--cpd-brand); color: #fff; cursor: pointer;
  box-shadow: 0 4px 14px rgba(26,138,110,.3);
}
.cpd-atc-btn.ready:hover { background: var(--cpd-brand-mid); transform: translateY(-1px); }
.cpd-atc-btn.ready:active { transform: translateY(0); }
.cpd-atc-btn.flash { background: #2ecc71; }

.cpd-wishlist-btn {
  width: 46px; height: 46px; border-radius: 8px;
  border: 1.5px solid var(--cpd-border); background: var(--cpd-white);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--cpd-muted); transition: all .2s; flex-shrink: 0;
}
.cpd-wishlist-btn:hover { border-color: var(--cpd-sale); color: var(--cpd-sale); background: #fff5f5; }
.cpd-wishlist-btn.active { border-color: var(--cpd-sale); background: #fff5f5; }

/* Highlights */
.cpd-highlights {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px; border-radius: 10px;
  background: var(--cpd-brand-light); margin-bottom: 20px;
}
.cpd-highlight-item {
  display: flex; align-items: flex-start; gap: 9px;
  font-family: var(--font-body); font-size: 13.5px; color: #2c6b5a; line-height: 1.5;
}
.cpd-highlight-item svg { flex-shrink: 0; margin-top: 2px; }

/* Meta */
.cpd-meta {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-family: var(--font-body); font-size: 12.5px; color: var(--cpd-muted);
  margin-bottom: 20px;
}
.cpd-meta-item { display: flex; gap: 5px; align-items: center; }
.cpd-meta-item strong { color: var(--cpd-text); }
.cpd-meta-sep { color: #ddd; }
.cpd-meta-link { color: var(--cpd-brand); text-decoration: none; font-weight: 500; }
.cpd-meta-link:hover { text-decoration: underline; }
.cpd-var-id code { background: #f2f2f2; padding: 2px 7px; border-radius: 4px; font-size: 12px; }

/* Trust badges */
.cpd-trust-row { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid var(--cpd-border); }
.cpd-trust-badge {
  flex: 1; min-width: 90px;
  display: flex; align-items: center; gap: 9px;
  padding: 11px 13px; border-radius: 10px;
  background: #f9f9f9; border: 1px solid var(--cpd-border);
}
.cpd-trust-icon { font-size: 20px; flex-shrink: 0; }
.cpd-trust-label { font-family: var(--font-body); font-size: 12px; font-weight: 600; color: var(--cpd-text); line-height: 1.3; }
.cpd-trust-sub   { font-family: var(--font-body); font-size: 11px; color: var(--cpd-muted); }

/* Sticky bar */
.cpd-sticky-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 900;
  background: var(--cpd-white); border-bottom: 1px solid var(--cpd-border);
  box-shadow: 0 2px 12px rgba(0,0,0,.1);
  display: flex; align-items: center; gap: 14px;
  padding: 10px 48px;
  animation: stickySlide .25s ease;
}
@keyframes stickySlide { from { transform: translateY(-100%); opacity:0; } to { transform:none; opacity:1; } }
.cpd-sticky-thumb { width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0; }
.cpd-sticky-name {
  font-family: var(--font-head); font-size: 15px; font-weight: 600;
  color: var(--cpd-text); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.cpd-sticky-price { font-family: var(--font-head); font-size: 16px; font-weight:700; color: var(--cpd-text); }
.cpd-sticky-atc {
  height: 36px; padding: 0 22px;
  border: none; border-radius: 6px;
  font-family: var(--font-body); font-size: 12.5px; font-weight: 700;
  letter-spacing: .5px; text-transform: uppercase;
  background: #d4d4d4; color: #999; cursor: not-allowed;
}
.cpd-sticky-atc.ready { background: var(--cpd-brand); color: #fff; cursor: pointer; }

/* Tabs */
.cpd-tabs-section { max-width: 1240px; margin: 0 auto 80px; padding: 0 48px; }
.cpd-tabs-nav {
  display: flex; border-bottom: 2px solid var(--cpd-border);
}
.cpd-tab {
  background: none; border: none; cursor: pointer;
  font-family: var(--font-body); font-size: 14px; font-weight: 500;
  color: var(--cpd-muted); padding: 14px 28px;
  border-bottom: 2px solid transparent; margin-bottom: -2px;
  transition: all .2s; letter-spacing: .3px;
}
.cpd-tab:hover { color: var(--cpd-brand); }
.cpd-tab.active { color: var(--cpd-brand); font-weight: 700; border-bottom-color: var(--cpd-brand); }
.cpd-tab-content { padding: 36px 0; font-family: var(--font-body); font-size: 14.5px; line-height: 1.8; color: #444; }

/* Description */
.cpd-desc-panel { max-width: 720px; }
.cpd-desc-text { margin: 0; }

/* Reviews */
.cpd-reviews-panel { max-width: 780px; }
.cpd-review-summary {
  display: flex; gap: 36px; align-items: flex-start;
  padding: 24px; background: #f9f9f9; border-radius: var(--radius);
  margin-bottom: 28px; flex-wrap: wrap;
}
.cpd-review-avg { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 90px; }
.cpd-avg-num { font-family: var(--font-head); font-size: 48px; font-weight: 700; color: var(--cpd-text); line-height: 1; }
.cpd-avg-sub { font-family: var(--font-body); font-size: 12px; color: var(--cpd-muted); }
.cpd-rating-bars { flex:1; display:flex; flex-direction:column; gap: 7px; }
.cpd-bar-row { display:flex; align-items:center; gap:9px; }
.cpd-bar-label { font-family: var(--font-body); font-size:12px; color: var(--cpd-muted); width:28px; flex-shrink:0; }
.cpd-bar-track { flex:1; height:6px; background:#e8e8e8; border-radius:3px; overflow:hidden; }
.cpd-bar-fill { height:100%; background: var(--cpd-accent); border-radius:3px; }
.cpd-bar-count { font-family: var(--font-body); font-size:12px; color: var(--cpd-muted); width:14px; text-align:right; }

.cpd-review-list { display:flex; flex-direction:column; gap:16px; margin-bottom:24px; }
.cpd-review-card {
  padding:20px; border:1px solid var(--cpd-border); border-radius: var(--radius);
  display:flex; flex-direction:column; gap:8px; transition: box-shadow .2s;
}
.cpd-review-card:hover { box-shadow: var(--shadow); }
.cpd-review-header { display:flex; align-items:center; gap:12px; }
.cpd-reviewer-avatar {
  width:40px; height:40px; border-radius:50%;
  background: var(--cpd-brand); color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-family: var(--font-head); font-size:16px; font-weight:700; flex-shrink:0;
}
.cpd-reviewer-name {
  font-family: var(--font-body); font-size:14px; font-weight:600;
  color: var(--cpd-text); display:flex; align-items:center; gap:8px;
}
.cpd-verified { font-size:11px; font-weight:400; color: var(--cpd-brand); }
.cpd-review-date { font-family: var(--font-body); font-size:12px; color: var(--cpd-muted); }
.cpd-review-text { font-family: var(--font-body); font-size:14px; line-height:1.7; color:#555; margin:0; }

.cpd-write-review {
  height:42px; padding:0 26px;
  border:2px solid var(--cpd-brand); border-radius:8px;
  background:none; color: var(--cpd-brand);
  font-family: var(--font-body); font-size:13px; font-weight:700;
  letter-spacing:.5px; text-transform:uppercase; cursor:pointer; transition:all .2s;
}
.cpd-write-review:hover { background: var(--cpd-brand); color:#fff; }

/* Responsive */
@media (max-width: 900px) {
  .cpd-wrap { grid-template-columns:1fr; gap:24px; padding:20px 20px 40px; }
  .cpd-gallery-col { position:static; }
  .cpd-thumbs-strip { flex-direction:row; width:auto; flex-wrap:nowrap; overflow-x:auto; }
  .cpd-thumb { width:60px; height:60px; }
  .cpd-img-arrow { display:flex; }
  .cpd-img-dots { display:flex; }
  .cpd-breadcrumb, .cpd-tabs-section { padding-left:20px; padding-right:20px; }
  .cpd-sticky-bar { padding:10px 20px; gap:10px; }
  .cpd-trust-badge { min-width:80px; }
}
@media (max-width: 480px) {
  .cpd-cart-row { flex-wrap:wrap; }
  .cpd-atc-btn { flex:100%; }
}
@keyframes cpdSpin { to { transform:rotate(360deg); } }
`;

/* ─────────────── Export ─────────────── */
export default function ProductDetailsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 80, textAlign: 'center', fontFamily: 'sans-serif', color: '#888' }}>
        Loading…
      </div>
    }>
      <ProductDetailsClient />
    </Suspense>
  );
}



