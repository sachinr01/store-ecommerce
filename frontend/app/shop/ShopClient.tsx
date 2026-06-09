'use client';

import { useEffect, useState, useRef, useCallback, type ReactNode, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ShopGridSkeleton } from './ShopSkeleton';
import { getProducts, getAllAttributeGroups, type Product, type AttributeGroup, getProductCategories, getCategoryProducts, type ProductCategory } from '../lib/api';
import { formatPrice, formatPriceRange, CURRENCY } from '../lib/price';
import { usePlaceholderImage } from '../lib/siteSettingsContext';
import ShopProductCard from './ShopProductCard';


const DEFAULT_OPEN_FILTERS: Record<string, boolean> = {};

/* Star Rating */
function MiniStars({ rating = 4 }: { rating?: number }) {
  return (
    <span className="csp-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= rating ? '#e8a020' : '#ddd'}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </span>
  );
}

/* Dual Range Slider */
function DualRangeSlider({
  min, max, valueMin, valueMax, onChangeMin, onChangeMax,
}: {
  min: number; max: number;
  valueMin: number; valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);

  useEffect(() => { setLocalMin(valueMin); }, [valueMin]);
  useEffect(() => { setLocalMax(valueMax); }, [valueMax]);

  const range = max - min || 1;
  const leftPct = ((localMin - min) / range) * 100;
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
          <div
            className="drs-fill"
            style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
          />
        </div>
        <input
          type="range"
          className="drs-input drs-min"
          min={min} max={max} value={localMin}
          aria-label="Minimum price"
          onChange={e => {
            const v = Math.min(Number(e.target.value), localMax - 1);
            setLocalMin(v);
            onChangeMin(v);
          }}
        />
        <input
          type="range"
          className="drs-input drs-max"
          min={min} max={max} value={localMax}
          aria-label="Maximum price"
          onChange={e => {
            const v = Math.max(Number(e.target.value), localMin + 1);
            setLocalMax(v);
            onChangeMax(v);
          }}
        />
      </div>
    </div>
  );
}

/* Dropdown Filter Panel */
function FilterDropdown({
  label,
  isOpen,
  onToggle,
  isActive,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  isActive?: boolean;
  children: ReactNode;
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
        <svg
          className="csp-filter-drop-chevron"
          width="10" height="10" viewBox="0 0 12 12"
          fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="2,4 6,8 10,4" />
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

/* Shop Page */
function ShopInner({ heading, subheading }: { heading: string; subheading: string }) {
  const PLACEHOLDER = usePlaceholderImage();
  const [products, setProducts] = useState<Product[]>([]);
  const [attrGroups, setAttrGroups] = useState<AttributeGroup[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({ ...DEFAULT_OPEN_FILTERS });

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMaxRaw = searchParams.get('max');
  const queryMax = queryMaxRaw ? Number.parseFloat(queryMaxRaw) : Number.NaN;
  const searchTerm = (searchParams.get('search') ?? '').trim().toLowerCase();
  const appliedQueryRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const urlCategories = (searchParams.get('category') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(urlCategories);
  const [categoryProductIds, setCategoryProductIds] = useState<Set<number> | null>(null);

  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string[]>>({});
  const [absoluteMax, setAbsoluteMax] = useState(200);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(200);
  const absoluteMin = 0;

  const updateCategoryUrl = useCallback((cats: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cats.length > 0) params.set('category', cats.join(','));
    else params.delete('category');
    router.replace(`/shop?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    let active = true;
    getAllAttributeGroups().then(groups => {
      if (!active) return;
      setAttrGroups(groups);
    }).catch(() => {});
    getProductCategories().then(cats => {
      if (!active) return;
      setProductCategories(cats);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProducts(new URLSearchParams({ sort_by: 'menu-order' }))
      .then(data => {
        setProducts(data);
        const rawMax = data.length
          ? Math.max(...data.map(p => Number(p.price_max ?? p.price_min ?? 0)))
          : 200;
        const max = rawMax > 0 ? rawMax : 200;
        setAbsoluteMax(max);
        setSliderMin(0);
        setSliderMax(max);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!Number.isFinite(queryMax)) return;
    if (appliedQueryRef.current === queryMax) return;
    if (absoluteMax <= 0) return;
    const cappedMax = Math.max(absoluteMin, Math.min(queryMax, absoluteMax));
    setSliderMin(absoluteMin);
    setSliderMax(cappedMax);
    setOpenFilters(prev => ({ ...prev, price: true }));
    appliedQueryRef.current = queryMax;
  }, [queryMax, absoluteMax, absoluteMin, loading]);

  useEffect(() => {
    if (selectedCategories.length === 0) {
      setCategoryProductIds(null);
      return;
    }
    let active = true;
    Promise.all(selectedCategories.map(slug => getCategoryProducts(slug).catch(() => [])))
      .then(results => {
        if (!active) return;
        const ids = new Set(results.flat().map(p => p.ID));
        setCategoryProductIds(ids);
      });
    return () => { active = false; };
  }, [selectedCategories]);

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

  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePriceChange = useCallback((gte: number, lte: number) => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => {
      setSliderMin(gte);
      setSliderMax(lte);
    }, 300);
  }, []);

  const toggleAttr = useCallback((taxonomy: string, value: string) => {
    setSelectedAttrs(prev => {
      const current = prev[taxonomy] ?? [];
      return {
        ...prev,
        [taxonomy]: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
  }, []);

  const normalizeList = (value?: string | null) =>
    (value ?? '').split(',').map(v => v.trim()).filter(Boolean);

  const matchesSearch = (product: Product, term: string) => {
    if (!term) return true;
    const haystack = [
      product.title,
      product.slug,
      product.short_description,
      product.sku,
      product.color_slugs,
      product.material_slugs,
      product.style_slugs,
      product.occasion_slugs,
      product.feature_slugs,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  };

  const taxonomyToField: Record<string, keyof Product> = {
    pa_color:    'color_slugs',
    pa_material: 'material_slugs',
    pa_style:    'style_slugs',
    pa_occasion: 'occasion_slugs',
    pa_feature:  'feature_slugs',
    pa_size:     'size_slugs',
  };

  const sorted = [...products]
    .filter(p => matchesSearch(p, searchTerm))
    .filter(p => categoryProductIds === null || categoryProductIds.has(p.ID))
    .filter(p => {
      const lo = Number(p.price_min ?? 0);
      const hi = Number(p.price_max ?? p.price_min ?? 0);
      return hi >= sliderMin && lo <= sliderMax;
    })
    .filter(p => {
      return Object.entries(selectedAttrs).every(([taxonomy, selected]) => {
        if (selected.length === 0) return true;
        const field = taxonomyToField[taxonomy];
        if (!field) return true;
        const productSlugs = normalizeList(p[field] as string | null);
        return selected.some(v => productSlugs.includes(v));
      });
    })
    .sort((a, b) => a.menu_order - b.menu_order);

  const toSlugLocal = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const isPriceActive = sliderMin > absoluteMin || sliderMax < absoluteMax;
  const attrActiveCount = Object.values(selectedAttrs).reduce((n, arr) => n + arr.length, 0);
  const totalActive = attrActiveCount + (isPriceActive ? 1 : 0) + selectedCategories.length;
  const hasActive = totalActive > 0;

  const allClear = () => {
    setSelectedAttrs({});
    setSelectedCategories([]);
    updateCategoryUrl([]);
    setSliderMin(absoluteMin);
    setSliderMax(absoluteMax);
  };

  const labelMaps: Record<string, Map<string, string>> = {};
  for (const group of attrGroups) {
    labelMaps[group.taxonomy] = new Map(
      group.options.map(o => [toSlugLocal(o.attr_slug || o.attr_name), o.attr_name.trim()])
    );
  }

  const toggleDropdown = (key: string) => {
    setOpenDropdown(prev => prev === key ? null : key);
  };

  return (
    <>
      <Header />

      <nav className="csp-breadcrumb" aria-label="Breadcrumb">
        <div className="csp-breadcrumb-left">
          <h1 className="csp-breadcrumb-title">Shop</h1>
          <h6 className="csp-breadcrumb-sub">Explore our All Products</h6>
        </div>
        <div className="csp-breadcrumb-right">
          <Link href="/">Home</Link>
          <span className="csp-bsep" aria-hidden="true">&gt;</span>
          <span aria-current="page">Shop</span>
        </div>
      </nav>

      <div className="csp-body-top">
        {/* Top Filter Bar */}
        <div className="csp-top-filterbar" ref={dropdownRef}>
          <div className="csp-top-filter-left">
            <span className="csp-filter-label">Filter:</span>
            {/* Price Dropdown */}
            <FilterDropdown
              label={isPriceActive ? `Price (Active)` : 'Price'}
              isOpen={openDropdown === 'price'}
              onToggle={() => toggleDropdown('price')}
              isActive={isPriceActive}
            >
              <div style={{ padding: '16px', minWidth: 260 }}>
                <DualRangeSlider
                  min={absoluteMin}
                  max={absoluteMax > 0 ? absoluteMax : 200}
                  valueMin={sliderMin}
                  valueMax={sliderMax}
                  onChangeMin={v => handlePriceChange(Math.min(v, sliderMax - 1), sliderMax)}
                  onChangeMax={v => handlePriceChange(sliderMin, Math.max(v, sliderMin + 1))}
                />
              </div>
            </FilterDropdown>

            {/* Category Dropdown */}
            <FilterDropdown
              label={selectedCategories.length > 0 ? `Category (${selectedCategories.length})` : 'Category'}
              isOpen={openDropdown === 'category'}
              onToggle={() => toggleDropdown('category')}
              isActive={selectedCategories.length > 0}
            >
              <div className="csp-filter-drop-options">
                {productCategories
                  .filter(c => c.parent_id === 0)
                  .map(parent => {
                    const children = productCategories.filter(c => c.parent_id === parent.category_id);
                    const isExpanded = !!openFilters[`cat_${parent.category_id}`];
                    const renderOption = (cat: typeof productCategories[0], isChild: boolean) => {
                      const checked = selectedCategories.includes(cat.category_slug);
                      return (
                        <label key={cat.category_id}
                          className={`nf-option${checked ? ' checked' : ''}`}
                          style={isChild ? { paddingLeft: 20 } : undefined}>
                          <span className="nf-checkbox" aria-hidden="true">
                            {checked && (
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <input type="checkbox" className="nf-hidden-input" checked={checked}
                            onChange={() => {
                              const next = selectedCategories.includes(cat.category_slug)
                                ? selectedCategories.filter(c => c !== cat.category_slug)
                                : [...selectedCategories, cat.category_slug];
                              setSelectedCategories(next);
                              updateCategoryUrl(next);
                            }}
                            aria-label={cat.category_name} />
                          <span className="nf-option-text" style={isChild ? { fontSize: 12, color: '#6b7280' } : undefined}>
                            {cat.category_name}
                          </span>
                        </label>
                      );
                    };
                    return (
                      <div key={parent.category_id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ flex: 1 }}>{renderOption(parent, false)}</div>
                          {children.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpenFilters(p => ({ ...p, [`cat_${parent.category_id}`]: !p[`cat_${parent.category_id}`] }))}
                              aria-label={isExpanded ? 'Collapse subcategories' : 'Expand subcategories'}
                              aria-expanded={isExpanded}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#9ca3af', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                style={{ transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                <polyline points="2,4 6,8 10,4"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        {isExpanded && children.map(child => renderOption(child, true))}
                      </div>
                    );
                  })}
              </div>
            </FilterDropdown>

            {hasActive && (
              <button className="csp-top-clear-btn" onClick={allClear}>
                Clear all ({totalActive})
              </button>
            )}
          </div>

          <div className="csp-top-filter-right">
            {!loading && (
              <span className="csp-count">{sorted.length} product{sorted.length !== 1 ? 's' : ''}</span>
            )}
            <div className="csp-view-toggle" role="group" aria-label="View mode">
              <button
                className={`csp-view-btn${viewMode === 'grid' ? ' active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6" rx="1" />
                  <rect x="10" y="0" width="6" height="6" rx="1" />
                  <rect x="0" y="10" width="6" height="6" rx="1" />
                  <rect x="10" y="10" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                className={`csp-view-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="0" y="1" width="16" height="3" rx="1" />
                  <rect x="0" y="7" width="16" height="3" rx="1" />
                  <rect x="0" y="13" width="16" height="3" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {(hasActive || searchTerm) && (
          <div className="csp-chips-bar" role="group" aria-label="Active filters">
            <button className="csp-chips-clear" onClick={() => { allClear(); if (searchTerm) router.push('/shop'); }}>Clear all</button>
            {searchTerm && (
              <span className="csp-chip">
                Search: &ldquo;{searchTerm}&rdquo;
                <button className="csp-chip-x" onClick={() => router.push('/shop')} aria-label="Remove search filter">x</button>
              </span>
            )}
            {isPriceActive && (
              <span className="csp-chip">
                {CURRENCY}{sliderMin}-{CURRENCY}{sliderMax}
                <button className="csp-chip-x" onClick={() => { setSliderMin(absoluteMin); setSliderMax(absoluteMax); }} aria-label="Remove price filter">x</button>
              </span>
            )}
            {selectedCategories.map(slug => {
              const cat = productCategories.find(c => c.category_slug === slug);
              return cat ? (
                <span key={slug} className="csp-chip">
                  {cat.category_name}
                  <button className="csp-chip-x"
                    onClick={() => {
                      const next = selectedCategories.filter(c => c !== slug);
                      setSelectedCategories(next);
                      updateCategoryUrl(next);
                    }}
                    aria-label={`Remove ${cat.category_name}`}>x</button>
                </span>
              ) : null;
            })}
            {Object.entries(selectedAttrs).flatMap(([taxonomy, values]) =>
              values.map(val => (
                <span key={`${taxonomy}-${val}`} className="csp-chip">
                  {labelMaps[taxonomy]?.get(val) ?? val}
                  <button className="csp-chip-x" onClick={() => toggleAttr(taxonomy, val)} aria-label={`Remove ${labelMaps[taxonomy]?.get(val) ?? val}`}>x</button>
                </span>
              ))
            )}
          </div>
        )}

        {/* Products Grid */}
        <main className="csp-main-full">
          {loading && <ShopGridSkeleton listMode={viewMode === 'list'} />}

          {error && (
            <div className="csp-error-box" role="alert">
              <svg width="22" height="22" fill="none" stroke="#c0392b" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              <div>
                <strong>Could not load products</strong>
                <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 12 }}>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && sorted.length === 0 && (
            <div className="csp-state-wrap">
              <svg width="52" height="52" fill="none" stroke="#ccc" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <p className="csp-state-text">No products match your filters</p>
              <button className="csp-clear-btn" onClick={allClear}>Clear all filters</button>
            </div>
          )}

          {!loading && !error && sorted.length > 0 && (
            <div className={`csp-grid${viewMode === 'list' ? ' list-mode' : ''}`} aria-label="Products">
              {sorted.map((product, idx) => (
                <ShopProductCard key={product.ID} product={product} idx={idx} listMode={viewMode === 'list'} placeholder={PLACEHOLDER} />
              ))}
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}

export default function ShopPage({ heading, subheading }: { heading: string; subheading: string }) {
  return (
    <Suspense fallback={null}>
      <ShopInner heading={heading} subheading={subheading} />
    </Suspense>
  );
}
