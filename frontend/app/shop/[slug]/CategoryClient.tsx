'use client';
/* Dynamic Category pages */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { ShopGridSkeleton } from '../ShopSkeleton';
import { getCategoryChildren, getCategoryProducts, getImageUrl, type ProductCategory, type Product } from '../../lib/api';
import { formatPrice, formatPriceRange, CURRENCY } from '../../lib/price';
import { getDiscountPercent, isSaleDateActive } from '../../lib/helpers/pricing';
import { useWishlist } from '../../lib/wishlistContext';
import { usePlaceholderImage } from '../../lib/siteSettingsContext';
import ProductImageHover from '../../components/ProductImageHover';
import AddToCartButton from '../../components/AddToCartButton';
import { wigzoCategoryView } from '../../lib/wigzo';

const toSlug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const normalizeList = (v: string | null | undefined) =>
  (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const toLabel = (slug: string) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/* ── Dual Range Slider ─────────────────────────────────────────────────────── */
function DualRangeSlider({ min, max, valueMin, valueMax, onChangeMin, onChangeMax }: {
  min: number; max: number; valueMin: number; valueMax: number;
  onChangeMin: (v: number) => void; onChangeMax: (v: number) => void;
}) {
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);

  useEffect(() => { setLocalMin(valueMin); }, [valueMin]);
  useEffect(() => { setLocalMax(valueMax); }, [valueMax]);

  const range = max - min || 1;
  const leftPct  = ((localMin - min) / range) * 100;
  const rightPct = ((localMax - min) / range) * 100;
  return (
    <div className="drs-outer">
      <div className="drs-values-row">
        <span className="drs-val-bubble">{CURRENCY}{localMin.toLocaleString()}</span>
        <span className="drs-val-sep">-</span>
        <span className="drs-val-bubble">{CURRENCY}{localMax.toLocaleString()}</span>
      </div>
      <div className="drs-track-row">
        <div className="drs-track">
          <div className="drs-fill" style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}/>
        </div>
        <input type="range" className="drs-input drs-min" min={min} max={max} value={localMin}
          aria-label="Minimum price"
          onChange={e => {
            const v = Math.min(Number(e.target.value), localMax - 1);
            setLocalMin(v);
            onChangeMin(v);
          }}/>
        <input type="range" className="drs-input drs-max" min={min} max={max} value={localMax}
          aria-label="Maximum price"
          onChange={e => {
            const v = Math.max(Number(e.target.value), localMin + 1);
            setLocalMax(v);
            onChangeMax(v);
          }}/>
      </div>
    </div>
  );
}

/* ── Dropdown Filter ────────────────────────────────────────────────────────── */
function FilterDropdown({ label, isOpen, onToggle, isActive, children }: {
  label: string; isOpen: boolean; onToggle: () => void; isActive?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="csp-filter-drop-wrap">
      <button
        type="button"
        className={`csp-filter-drop-btn${isOpen ? ' open' : ''}${isActive ? ' active' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        {label}
        <svg className="csp-filter-drop-chevron" width="10" height="10" viewBox="0 0 12 12"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="2,4 6,8 10,4"/>
        </svg>
      </button>
      {isOpen && (
        <div className="csp-filter-drop-panel">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`nf-option${checked ? ' checked' : ''}`}>
      <span className="nf-checkbox" aria-hidden="true">
        {checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>}
      </span>
      <input type="checkbox" className="nf-hidden-input" checked={checked} onChange={onChange} aria-label={label}/>
      <span className="nf-option-text">{label}</span>
    </label>
  );
}

/* ── Product Card ──────────────────────────────────────────────────────────── */
function ProductCard({ product, idx, listMode }: { product: Product; idx: number; listMode?: boolean }) {
  const { hasItem, addItem, removeItem } = useWishlist();
  const PLACEHOLDER = usePlaceholderImage();
  const inWishlist = hasItem(product.ID);
  const [cardHovered, setCardHovered] = useState(false);
  const href = `/shop/product/${toSlug(product.slug || product.title)}`;
  const isOutOfStock =
    (product.stock_status !== 'instock' && product.stock_status !== 'onbackorder') ||
    (product.stock_qty !== null && product.stock_qty !== undefined && Number(product.stock_qty) <= 0);
  const priceMin = Number(product.price_min ?? 0);
  const priceMax = Number(product.price_max ?? product.price_min ?? 0);
  const showRange = priceMin > 0 && priceMax > priceMin;
  const salePrice    = product._sale_price    ? Number(product._sale_price)    : null;
  const regularPrice = product._regular_price ? Number(product._regular_price) : null;
  const displayPrice = salePrice ?? regularPrice ?? (priceMin > 0 ? priceMin : null);
  const isOnSale  = !showRange && salePrice !== null && salePrice > 0 && isSaleDateActive(product._sale_price_dates_from, product._sale_price_dates_to);
  const priceStr  = showRange ? formatPriceRange(priceMin, priceMax) : (displayPrice ? formatPrice(displayPrice) : '');
  const discount  = showRange ? null : getDiscountPercent(salePrice, regularPrice);

  return (
    <div
      className="csp-card"
      style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      <div className="csp-img-wrap">
        <Link href={href} tabIndex={-1} aria-hidden="true" style={{ display: 'block', height: '100%' }}>
          <ProductImageHover
            featuredSrc={getImageUrl(product.thumbnail_url, PLACEHOLDER)}
            gallerySrc={product.gallery_image_url ? getImageUrl(product.gallery_image_url, PLACEHOLDER) : null}
            alt={product.title}
            className="csp-img"
            loading={idx < 8 ? 'eager' : 'lazy'}
            fallback={PLACEHOLDER}
            cardHovered={cardHovered}
          />
        </Link>
        <div className="csp-badges">
          {!isOutOfStock && isOnSale && <span className="csp-badge sale">Sale</span>}
          {isOutOfStock && <span className="csp-badge oos">Sold Out</span>}
        </div>
        <button className={`csp-wishlist${inWishlist ? ' active' : ''}`}
          aria-label={inWishlist ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          onClick={async e => { e.preventDefault(); try { inWishlist ? await removeItem(product.ID) : await addItem({ id: product.ID, title: product.title, price: displayPrice ?? 0, image: getImageUrl(product.thumbnail_url, PLACEHOLDER), inStock: !isOutOfStock }); } catch {} }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
            fill={inWishlist ? '#e74c3c' : 'none'} stroke={inWishlist ? '#e74c3c' : 'currentColor'} strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

      </div>
      <div className="csp-info">
          <div className="csp-info-top">
            <Link href={href} className="csp-name">{product.title}</Link>
            <div className="csp-price-row">
              {!showRange && salePrice !== null && regularPrice !== null && isOnSale ? (
                <>
                  <span className="csp-mrp-label">MRP</span>
                  <span className="csp-old-price" aria-label="Regular price">
                    {formatPrice(regularPrice)}
                  </span>
                  <span className="csp-price sale">{priceStr}</span>
                  {discount !== null && (
                    <span className="csp-save-badge">{discount}% off</span>
                  )}
                </>
              ) : (
                <span className="csp-price">{priceStr}</span>
              )}
            </div>
            <div className="csp-tax-note">(Excl. of taxes)</div>
            {listMode && product.short_description && (
              <p className="csp-list-desc">{product.short_description.replace(/<[^>]+>/g, '').slice(0, 300)}</p>
            )}
          </div>
          <AddToCartButton
            productId={product.ID}
            title={product.title}
            image={getImageUrl(product.thumbnail_url, PLACEHOLDER)}
            inStock={!isOutOfStock}
            price={displayPrice ?? ''}
            previousPrice={regularPrice ?? ''}
            description={product.short_description || ''}
            category={product.category_name || ''}
          />
        </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function CategoryPage() {
  const params = useParams();
  const pageSlug = (params?.slug as string) ?? '';
  const pageLabel = toLabel(pageSlug);

  const [categories,  setCategories]  = useState<ProductCategory[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [error,       setError]       = useState('');
  const [viewMode,    setViewMode]    = useState<'grid'|'list'>('grid');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // filters
  const [selectedColors,    setSelectedColors]    = useState<string[]>([]);
  const [selectedSizes,     setSelectedSizes]     = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(0);
  const [absoluteMax, setAbsoluteMax] = useState(0);

  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pageSlug) return;
    setLoading(true);
    setNotFound(false);
    setError('');
    Promise.all([
      getCategoryChildren(pageSlug).catch(() => []),
      getCategoryProducts(pageSlug).catch((err: Error) => {
        const msg = err?.message ?? '';
        if (msg.includes('404') || msg.toLowerCase().includes('not found')) return null;
        return [] as Product[];
      }),
    ]).then(([cats, prods]) => {
      if (prods === null) { setNotFound(true); return; }
      setCategories(cats);
      setAllProducts(prods);
      const max = prods.length
        ? Math.max(...prods.map((p: Product) => Number(p.price_max ?? p.price_min ?? 0)))
        : 0;
      setAbsoluteMax(max);
      setSliderMax(max);

      // Wigzo `categoryview` event — Trigger point per integration doc: Category Page
      if (typeof window !== 'undefined') {
        wigzoCategoryView({
          canonicalURL: window.location.href,
          categoryUrl: window.location.href,
          image: prods[0] ? getImageUrl(prods[0].thumbnail_url, '') : '',
          title: pageLabel,
        });
      }
    }).finally(() => setLoading(false));
  }, [pageSlug]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePriceChange = useCallback((min: number, max: number) => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => { setSliderMin(min); setSliderMax(max); }, 200);
  }, []);

  const availableColors = useMemo(() =>
    [...new Set(allProducts.flatMap(p => normalizeList(p.color_slugs)))].sort(), [allProducts]);
  const availableSizes = useMemo(() =>
    [...new Set(allProducts.flatMap(p => normalizeList(p.size_slugs)))].sort(), [allProducts]);
  const availableMaterials = useMemo(() =>
    [...new Set(allProducts.flatMap(p => normalizeList(p.material_slugs)))].sort(), [allProducts]);

  const isPriceActive = sliderMin > 0 || sliderMax < absoluteMax;
  const totalActive = selectedColors.length + selectedSizes.length + selectedMaterials.length + (isPriceActive ? 1 : 0);

  const clearAll = () => {
    setSelectedColors([]); setSelectedSizes([]); setSelectedMaterials([]);
    setSliderMin(0); setSliderMax(absoluteMax);
  };

  const toggleItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const filtered = useMemo(() => allProducts.filter(p => {
    if (selectedColors.length > 0 && !selectedColors.some(c => normalizeList(p.color_slugs).includes(c))) return false;
    if (selectedSizes.length > 0  && !selectedSizes.some(s  => normalizeList(p.size_slugs).includes(s)))  return false;
    if (selectedMaterials.length > 0 && !selectedMaterials.some(m => normalizeList(p.material_slugs).includes(m))) return false;
    if (isPriceActive) {
      const lo = Number(p.price_min ?? 0);
      const hi = Number(p.price_max ?? p.price_min ?? 0);
      if (hi < sliderMin || lo > sliderMax) return false;
    }
    return true;
  }), [allProducts, selectedColors, selectedSizes, selectedMaterials, sliderMin, sliderMax, isPriceActive]);

  const toggleDropdown = (key: string) => setOpenDropdown(prev => prev === key ? null : key);

  if (!loading && notFound) {
    return (
      <>
        <Header/>
        <div className="csp-state-wrap" style={{ minHeight: '60vh' }}>
          <p className="csp-state-text">Category &quot;{pageLabel}&quot; not found.</p>
          <Link href="/shop" className="btn-view-product" style={{ display: 'inline-block', width: 'auto' }}>Back to Shop</Link>
        </div>
        <Footer/>
      </>
    );
  }

  return (
    <>
      <Header/>
      <nav className="csp-breadcrumb" aria-label="Breadcrumb">
        <div className="csp-breadcrumb-left">
          <h1 className="csp-breadcrumb-title">{pageLabel}</h1>
          <h6 className="csp-breadcrumb-sub">Explore our {pageLabel} collection</h6>
        </div>
        <div className="csp-breadcrumb-right">
          <Link href="/">Home</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <Link href="/shop">Shop</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <span aria-current="page">{pageLabel}</span>
        </div>
      </nav>

      <div className="csp-body-top">
        {/* Top Filter Bar */}
        <div className="csp-top-filterbar" ref={dropdownRef}>
          <div className="csp-top-filter-left">
            <span className="csp-filter-label">Filter:</span>
            {/* Price Dropdown */}
            <FilterDropdown
              label={isPriceActive ? 'Price (Active)' : 'Price'}
              isOpen={openDropdown === 'price'}
              onToggle={() => toggleDropdown('price')}
              isActive={isPriceActive}
            >
              <div style={{ padding: '16px', minWidth: 260 }}>
                {loading
                  ? <span className="nf-option-text" style={{ color: 'var(--cs-text-muted)', fontSize: 13 }}>Loading…</span>
                  : absoluteMax === 0
                    ? <span className="nf-option-text" style={{ color: 'var(--cs-text-muted)', fontSize: 13 }}>No price data</span>
                    : <DualRangeSlider
                        min={0} max={absoluteMax}
                        valueMin={sliderMin} valueMax={sliderMax}
                        onChangeMin={v => handlePriceChange(Math.min(v, sliderMax - 1), sliderMax)}
                        onChangeMax={v => handlePriceChange(sliderMin, Math.max(v, sliderMin + 1))}/>
                }
              </div>
            </FilterDropdown>

            {totalActive > 0 && (
              <button className="csp-top-clear-btn" onClick={clearAll}>Clear all ({totalActive})</button>
            )}
          </div>

          <div className="csp-top-filter-right">
            {!loading && (
              <span className="csp-count">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
            )}
            <div className="csp-view-toggle" role="group" aria-label="View mode">
              <button className={`csp-view-btn${viewMode === 'grid' ? ' active' : ''}`}
                onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6" rx="1"/><rect x="10" y="0" width="6" height="6" rx="1"/>
                  <rect x="0" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/>
                </svg>
              </button>
              <button className={`csp-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="0" y="1" width="16" height="3" rx="1"/><rect x="0" y="7" width="16" height="3" rx="1"/>
                  <rect x="0" y="13" width="16" height="3" rx="1"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Active chips */}
        {totalActive > 0 && (
          <div className="csp-chips-bar" role="group" aria-label="Active filters">
            <button className="csp-chips-clear" onClick={clearAll}>Clear all</button>
            {isPriceActive && (
              <span className="csp-chip">{CURRENCY}{sliderMin}–{CURRENCY}{sliderMax}
                <button className="csp-chip-x" onClick={() => { setSliderMin(0); setSliderMax(absoluteMax); }} aria-label="Remove price filter">x</button>
              </span>
            )}
            {selectedColors.map(c => (
              <span key={c} className="csp-chip">{c.charAt(0).toUpperCase() + c.slice(1)}
                <button className="csp-chip-x" onClick={() => toggleItem(setSelectedColors, c)} aria-label={`Remove ${c}`}>x</button>
              </span>
            ))}
            {selectedSizes.map(s => (
              <span key={s} className="csp-chip">{s.toUpperCase()}
                <button className="csp-chip-x" onClick={() => toggleItem(setSelectedSizes, s)} aria-label={`Remove ${s}`}>x</button>
              </span>
            ))}
            {selectedMaterials.map(m => (
              <span key={m} className="csp-chip">{m.charAt(0).toUpperCase() + m.slice(1)}
                <button className="csp-chip-x" onClick={() => toggleItem(setSelectedMaterials, m)} aria-label={`Remove ${m}`}>x</button>
              </span>
            ))}
          </div>
        )}

        <main className="csp-main-full">
          {loading && <ShopGridSkeleton listMode={viewMode === 'list'} />}

          {!loading && filtered.length === 0 && (
            <div className="csp-state-wrap">
              <svg width="52" height="52" fill="none" stroke="#ccc" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="csp-state-text">No products found</p>
              {totalActive > 0 && <button className="csp-clear-btn" onClick={clearAll}>Clear filters</button>}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className={`csp-grid${viewMode === 'list' ? ' list-mode' : ''}`} aria-label={`${pageLabel} products`}>
              {filtered.map((p, i) => <ProductCard key={p.ID} product={p} idx={i} listMode={viewMode === 'list'}/>)}
            </div>
          )}
        </main>
      </div>
      <Footer/>
    </>
  );
}
