'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getProducts, type Product } from '../lib/api';
import { useWishlist } from '../lib/wishlistContext';

const PLACEHOLDER = '/store/images/dummy.png';

/* ─────────────────────── Star Rating ─────────────────────────── */
function MiniStars({ rating = 4 }: { rating?: number }) {
  return (
    <span className="csp-stars">
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24"
          fill={s <= rating ? '#e8a020' : '#ddd'}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </span>
  );
}

/* ─────────────────────── Product Card ─────────────────────────── */
function ShopProductCard({ product, idx }: { product: Product; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const { hasItem, addItem, removeItem } = useWishlist();
  const inWishlist = hasItem(product.ID);
  const slugBase = product.slug || product.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const productHref = `/product/${slugBase}-${product.ID}`;

  const isOnSale =
    product.sale_price_min !== null &&
    product.price_min !== null &&
    product.sale_price_min < product.price_min;

  const priceMin = Number(product.price_min ?? 0);
  const priceMax = Number(product.price_max ?? 0);
  const priceStr = priceMin !== priceMax
    ? `$${priceMin.toFixed(2)} – $${priceMax.toFixed(2)}`
    : `$${priceMin.toFixed(2)}`;



  return (
    <div
      className="csp-card"
      style={{ animationDelay: `${idx * 60}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setTimeout(() => setHovered(false), 400)}
    >
      {/* ── Image area ── */}
      <div className="csp-img-wrap">
        <Link href={productHref} tabIndex={-1}>
          <img
            src={PLACEHOLDER}
            alt={product.title}
            className={`csp-img${hovered ? ' zoomed' : ''}`}
          />
        </Link>

        {/* Badges */}
        <div className="csp-badges">
          {isOnSale && <span className="csp-badge sale">Sale</span>}
          {product.stock_status !== 'instock' && (
            <span className="csp-badge oos">Sold Out</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          className={`csp-wishlist${inWishlist ? ' active' : ''}`}
          title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={e => {
            e.preventDefault();
            if (inWishlist) {
              removeItem(product.ID);
            } else {
              addItem({
                id: product.ID,
                title: product.title,
                price: Number(product.sale_price_min ?? product.price_min ?? 0),
                image: PLACEHOLDER,
                inStock: product.stock_status === 'instock',
              });
            }
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24"
            fill={inWishlist ? '#e74c3c' : 'none'}
            stroke={inWishlist ? '#e74c3c' : 'currentColor'}
            strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        {/* Hover overlay */}
        <div className={`csp-overlay${hovered ? ' show' : ''}`}>
          <Link href={productHref} className="csp-quick-view">
            Quick View
          </Link>
        </div>
      </div>

      {/* ── Info area ── */}
      <div className="csp-info">
        <Link href={productHref} className="csp-name">
          {product.title}
        </Link>
        <MiniStars rating={4} />
        <div className="csp-price-row">
          {isOnSale && product.price_max && (
            <span className="csp-old-price">${Number(product.price_max).toFixed(2)}</span>
          )}
          <span className={`csp-price${isOnSale ? ' sale' : ''}`}>{priceStr}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Shop Page ─────────────────────────────── */
export default function ShopPage({ heading, subheading }: { heading: string; subheading: string }) {
  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [sortBy,      setSortBy]      = useState<'default'|'price_asc'|'price_desc'|'name'>('default');
  const [filterStock, setFilterStock] = useState<'all'|'instock'>('all');
  const [viewMode,    setViewMode]    = useState<'grid'|'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...products]
    .filter(p => filterStock === 'all' || p.stock_status === 'instock')
    .sort((a, b) => {
      if (sortBy === 'price_asc')  return (a.price_min ?? 0) - (b.price_min ?? 0);
      if (sortBy === 'price_desc') return (b.price_min ?? 0) - (a.price_min ?? 0);
      if (sortBy === 'name')       return a.title.localeCompare(b.title);
      return a.menu_order - b.menu_order;
    });

  /* Price range for filter display */
  const maxPrice = Math.max(...products.map(p => Number(p.price_max ?? 0)));

  const categories = ['All', 'Hoodies', 'Koozies', 'Bottles', 'Tumblers', 'Decals', 'Mugs'];

  return (
    <>
      <Header />
      <style>{shopCss}</style>

      {/* ── Breadcrumb ── */}
      <nav className="csp-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="csp-bsep" aria-hidden="true">›</span>
        <span aria-current="page">Shop</span>
      </nav>

      {/* ── Page header ── */}
      <div className="csp-page-header">
        <h1 className="csp-page-title">{heading}</h1>
        <p className="csp-page-sub">{subheading}</p>
      </div>

      {/* ── Category pills ── */}
      <div className="csp-cat-strip">
        {categories.map((c, i) => (
          <button key={c} className={`csp-cat-pill${i === 0 ? ' active' : ''}`}>{c}</button>
        ))}
      </div>

      {/* ── Layout: sidebar + grid ── */}
      <div className="csp-body">

        {/* Sidebar */}
        <aside className={`csp-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Product filters">
          <button className="csp-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>

          <div className="csp-filter-group">
            <h4 className="csp-filter-title">Availability</h4>
            <label className="csp-filter-check">
              <input type="radio" name="stock" checked={filterStock === 'all'}
                onChange={() => setFilterStock('all')}/>
              All Products
            </label>
            <label className="csp-filter-check">
              <input type="radio" name="stock" checked={filterStock === 'instock'}
                onChange={() => setFilterStock('instock')}/>
              In Stock Only
            </label>
          </div>

          <div className="csp-filter-divider"/>

          <div className="csp-filter-group">
            <h4 className="csp-filter-title">Category</h4>
            {categories.map((c, i) => (
              <label key={c} className="csp-filter-check">
                <input type="checkbox" defaultChecked={i === 0}/>
                {c}
              </label>
            ))}
          </div>

          <div className="csp-filter-divider"/>

          <div className="csp-filter-group">
            <h4 className="csp-filter-title">Price Range</h4>
            <div className="csp-price-range-labels">
              <span>$0</span>
              <span>${maxPrice > 0 ? maxPrice.toFixed(0) : '200'}</span>
            </div>
            <input type="range" className="csp-range-slider" min="0"
              max={maxPrice > 0 ? maxPrice : 200} defaultValue={maxPrice > 0 ? maxPrice : 200}/>
          </div>

          <div className="csp-filter-divider"/>

          <div className="csp-filter-group">
            <h4 className="csp-filter-title">Rating</h4>
            {[5,4,3].map(r => (
              <label key={r} className="csp-filter-check">
                <input type="checkbox"/>
                <MiniStars rating={r}/> & up
              </label>
            ))}
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div className="csp-sidebar-overlay" onClick={() => setSidebarOpen(false)}/>
        )}

        {/* Main content */}
        <main className="csp-main">

          {/* Toolbar */}
          <div className="csp-toolbar">
            <div className="csp-toolbar-left">
              {/* Mobile filter toggle */}
              <button className="csp-filter-toggle" onClick={() => setSidebarOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6"/>
                  <line x1="8" y1="12" x2="20" y2="12"/>
                  <line x1="12" y1="18" x2="20" y2="18"/>
                </svg>
                Filters
              </button>
              {!loading && (
                <span className="csp-count">
                  {sorted.length} product{sorted.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="csp-toolbar-right">
              {/* Sort */}
              <div className="csp-sort-wrap">
                <label className="csp-sort-label">Sort by:</label>
                <select
                  className="csp-sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="default">Featured</option>
                  <option value="name">Name A–Z</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="csp-view-toggle">
                <button
                  className={`csp-view-btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setViewMode('grid')} title="Grid view"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="0" y="0" width="6" height="6" rx="1"/>
                    <rect x="10" y="0" width="6" height="6" rx="1"/>
                    <rect x="0" y="10" width="6" height="6" rx="1"/>
                    <rect x="10" y="10" width="6" height="6" rx="1"/>
                  </svg>
                </button>
                <button
                  className={`csp-view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')} title="List view"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="0" y="1" width="16" height="3" rx="1"/>
                    <rect x="0" y="7" width="16" height="3" rx="1"/>
                    <rect x="0" y="13" width="16" height="3" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="csp-state-wrap">
              <div className="csp-spinner"/>
              <p className="csp-state-text">Loading products…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="csp-error-box">
              <svg width="24" height="24" fill="none" stroke="#c0392b" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              <div>
                <strong>Could not load products</strong>
                <p style={{ margin:'4px 0 0', fontFamily:'monospace', fontSize:12 }}>{error}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && sorted.length === 0 && (
            <div className="csp-state-wrap">
              <svg width="56" height="56" fill="none" stroke="#ccc" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="csp-state-text">No products found</p>
              <button className="csp-clear-btn" onClick={() => setFilterStock('all')}>Clear filters</button>
            </div>
          )}

          {/* Grid / List */}
          {!loading && !error && sorted.length > 0 && (
            <div ref={gridRef} className={`csp-grid${viewMode === 'list' ? ' list-mode' : ''}`} aria-label="Products">
              {sorted.map((product, idx) => (
                <ShopProductCard key={product.ID} product={product} idx={idx}/>
              ))}
            </div>
          )}

          {/* Pagination hint */}
          {!loading && !error && sorted.length > 0 && (
            <div className="csp-pagination">
              <button className="csp-page-btn active">1</button>
              <button className="csp-page-btn">2</button>
              <button className="csp-page-btn">3</button>
              <button className="csp-page-btn next">Next →</button>
            </div>
          )}

        </main>
      </div>

      <Footer />
    </>
  );
}

/* ──────────────────────── CSS ──────────────────────────────────── */
const shopCss = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --cs-brand:        #1a8a6e;
  --cs-brand-light:  #e6f5f1;
  --cs-brand-mid:    #12705a;
  --cs-accent:       #e8a020;
  --cs-text:         #1c1c1c;
  --cs-muted:        #888;
  --cs-border:       #ebebeb;
  --cs-bg:           #fafafa;
  --cs-white:        #ffffff;
  --cs-error:        #c0392b;
  --cs-sale:         #e74c3c;
  --font-head: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --card-radius: 12px;
  --shadow-sm: 0 2px 10px rgba(0,0,0,.07);
  --shadow-md: 0 6px 24px rgba(0,0,0,.11);
}
* { box-sizing: border-box; }

/* ── Breadcrumb ── */
.csp-breadcrumb {
  padding: 12px 48px;
  font-family: var(--font-body); font-size: 13px; color: var(--cs-muted);
  border-bottom: 1px solid var(--cs-border);
  display: flex; align-items: center; gap: 6px;
  background: var(--cs-white);
}
.csp-breadcrumb a { color: var(--cs-muted); text-decoration: none; }
.csp-breadcrumb a:hover { color: var(--cs-brand); }
.csp-bsep { color: #ccc; }

/* ── Page header ── */
.csp-page-header {
  text-align: center;
  padding: 40px 20px 8px;
  background: var(--cs-white);
}
.csp-page-title {
  font-family: var(--font-head);
  font-size: clamp(26px, 4vw, 42px);
  font-weight: 700; color: var(--cs-text);
  margin: 0 0 8px; letter-spacing: -.5px;
}
.csp-page-sub {
  font-family: var(--font-body); font-size: 15px;
  color: var(--cs-muted); margin: 0 0 28px;
}

/* ── Category pills ── */
.csp-cat-strip {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; flex-wrap: wrap;
  padding: 0 40px 28px;
  background: var(--cs-white);
}
.csp-cat-pill {
  height: 36px; padding: 0 18px;
  border: 1.5px solid var(--cs-border);
  border-radius: 20px;
  font-family: var(--font-body); font-size: 13px; font-weight: 500;
  color: var(--cs-muted); background: var(--cs-white); cursor: pointer;
  transition: all .2s;
}
.csp-cat-pill:hover { border-color: var(--cs-brand); color: var(--cs-brand); }
.csp-cat-pill.active {
  background: var(--cs-brand); border-color: var(--cs-brand);
  color: #fff; font-weight: 600;
}

/* ── Body layout ── */
.csp-body {
  display: flex;
  max-width: 1340px; margin: 0 auto;
  padding: 0 40px 80px;
  gap: 36px; align-items: flex-start;
  background: var(--cs-bg);
}

/* ══════════ SIDEBAR ══════════ */
.csp-sidebar {
  width: 230px; flex-shrink: 0;
  background: var(--cs-white);
  border: 1px solid var(--cs-border);
  border-radius: var(--card-radius);
  padding: 24px 20px;
  position: sticky; top: 80px;
  max-height: calc(100vh - 100px); overflow-y: auto;
}
.csp-sidebar-close {
  display: none;
  position: absolute; top: 14px; right: 14px;
  background: none; border: none; font-size: 18px;
  cursor: pointer; color: var(--cs-muted);
}

.csp-filter-title {
  font-family: var(--font-body); font-size: 12px; font-weight: 700;
  letter-spacing: 1px; text-transform: uppercase;
  color: var(--cs-text); margin: 0 0 12px;
}
.csp-filter-group { display: flex; flex-direction: column; gap: 9px; }
.csp-filter-check {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-body); font-size: 13.5px; color: #555;
  cursor: pointer;
}
.csp-filter-check input[type=radio],
.csp-filter-check input[type=checkbox] { accent-color: var(--cs-brand); cursor: pointer; }
.csp-filter-divider { height: 1px; background: var(--cs-border); margin: 18px 0; }

.csp-price-range-labels {
  display: flex; justify-content: space-between;
  font-family: var(--font-body); font-size: 12px; color: var(--cs-muted);
  margin-bottom: 8px;
}
.csp-range-slider {
  width: 100%; accent-color: var(--cs-brand); cursor: pointer;
}

/* ══════════ MAIN ══════════ */
.csp-main { flex: 1; min-width: 0; }

/* Toolbar */
.csp-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  padding: 14px 0 20px;
  border-bottom: 1px solid var(--cs-border);
  margin-bottom: 28px;
}
.csp-toolbar-left { display: flex; align-items: center; gap: 14px; }
.csp-toolbar-right { display: flex; align-items: center; gap: 16px; }

.csp-filter-toggle {
  display: none; align-items: center; gap: 6px;
  height: 34px; padding: 0 14px;
  border: 1.5px solid var(--cs-border); border-radius: 6px;
  background: var(--cs-white); cursor: pointer;
  font-family: var(--font-body); font-size: 13px;
  color: var(--cs-text); transition: all .2s;
}
.csp-filter-toggle:hover { border-color: var(--cs-brand); color: var(--cs-brand); }

.csp-count {
  font-family: var(--font-body); font-size: 13px; color: var(--cs-muted);
}

.csp-sort-wrap { display: flex; align-items: center; gap: 8px; }
.csp-sort-label { font-family: var(--font-body); font-size: 13px; color: var(--cs-muted); }
.csp-sort-select {
  height: 34px; padding: 0 10px;
  border: 1.5px solid var(--cs-border); border-radius: 6px;
  font-family: var(--font-body); font-size: 13px; color: var(--cs-text);
  background: var(--cs-white); cursor: pointer;
  outline: none; transition: border-color .2s;
}
.csp-sort-select:focus { border-color: var(--cs-brand); }

.csp-view-toggle { display: flex; gap: 4px; }
.csp-view-btn {
  width: 32px; height: 32px;
  border: 1.5px solid var(--cs-border); border-radius: 6px;
  background: var(--cs-white); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--cs-muted); transition: all .2s;
}
.csp-view-btn:hover { border-color: var(--cs-brand); color: var(--cs-brand); }
.csp-view-btn.active { border-color: var(--cs-brand); color: var(--cs-brand); background: var(--cs-brand-light); }

/* ══════════ GRID ══════════ */
.csp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}
.csp-grid.list-mode {
  grid-template-columns: 1fr;
  gap: 16px;
}
.csp-grid.list-mode .csp-card {
  flex-direction: row;
  align-items: center;
}
.csp-grid.list-mode .csp-img-wrap {
  width: 140px; flex-shrink: 0;
  aspect-ratio: 1;
}
.csp-grid.list-mode .csp-overlay { display: none; }

/* ══════════ CARD ══════════ */
.csp-card {
  background: var(--cs-white);
  border-radius: var(--card-radius);
  overflow: hidden;
  border: 1px solid var(--cs-border);
  display: flex; flex-direction: column;
  transition: box-shadow .25s, transform .25s;
  animation: fadeUpCard .45s both;
  cursor: pointer;
}
.csp-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-4px);
}
@keyframes fadeUpCard {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Image wrapper */
.csp-img-wrap {
  position: relative;
  aspect-ratio: 4/5;
  overflow: hidden;
  background: #f4f4f4;
}
.csp-img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: center;
  display: block;
  transition: transform .5s ease;
}
.csp-img.zoomed { transform: scale(1.06); }

/* Badges */
.csp-badges {
  position: absolute; top: 10px; left: 10px;
  display: flex; flex-direction: column; gap: 5px; z-index: 10;
}
.csp-badge {
  font-family: var(--font-body); font-size: 10px; font-weight: 700;
  letter-spacing: .8px; text-transform: uppercase;
  padding: 3px 8px; border-radius: 4px;
}
.csp-badge.sale  { background: var(--cs-sale);  color: #fff; }
.csp-badge.oos   { background: #555; color: #fff; }

/* Wishlist */
.csp-wishlist {
  position: absolute; top: 10px; right: 10px; z-index: 20;
  width: 32px; height: 32px; border-radius: 50%;
  border: none; background: rgba(255,255,255,.88);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #aaa;
  transition: all .2s; box-shadow: 0 1px 4px rgba(0,0,0,.1);
  opacity: 0;
}
.csp-card:hover .csp-wishlist { opacity: 1; }
.csp-wishlist:hover, .csp-wishlist.active { color: var(--cs-sale); background: #fff; }

/* Hover overlay */
.csp-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,.96);
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px;
  transform: translateY(100%);
  transition: transform .3s cubic-bezier(.22,1,.36,1);
  z-index: 15;
}
.csp-overlay.show { transform: translateY(0); }

.csp-quick-view {
  display: block; text-align: center;
  height: 36px; line-height: 36px;
  border: 1.5px solid var(--cs-brand); border-radius: 6px;
  font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
  color: var(--cs-brand); text-decoration: none; letter-spacing: .4px;
  text-transform: uppercase; transition: all .2s;
}
.csp-quick-view:hover { background: var(--cs-brand); color: #fff; }

.csp-add-cart {
  height: 36px; border: none; border-radius: 6px;
  background: var(--cs-brand); color: #fff;
  font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
  letter-spacing: .4px; text-transform: uppercase;
  cursor: pointer; transition: background .2s;
}
.csp-add-cart:hover { background: var(--cs-brand-mid); }
.csp-add-cart.flash { background: #2ecc71; }

/* Card info */
.csp-info {
  padding: 14px 16px 16px;
  display: flex; flex-direction: column; gap: 5px;
  flex: 1;
}
.csp-name {
  font-family: var(--font-body); font-size: 13.5px; font-weight: 500;
  color: var(--cs-text); text-decoration: none; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color .2s;
}
.csp-name:hover { color: var(--cs-brand); }
.csp-stars { display: inline-flex; gap: 2px; }

.csp-price-row {
  display: flex; align-items: baseline; gap: 7px; margin-top: 4px;
}
.csp-old-price {
  font-family: var(--font-body); font-size: 12px;
  color: #bbb; text-decoration: line-through;
}
.csp-price {
  font-family: var(--font-head); font-size: 16px;
  font-weight: 700; color: var(--cs-text);
}
.csp-price.sale { color: var(--cs-sale); }

/* ══════════ STATES ══════════ */
.csp-state-wrap {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 20px; gap: 14px;
}
.csp-spinner {
  width: 40px; height: 40px;
  border: 3px solid #eee; border-top-color: var(--cs-brand);
  border-radius: 50%; animation: csSpin .8s linear infinite;
}
@keyframes csSpin { to { transform: rotate(360deg); } }
.csp-state-text {
  font-family: var(--font-body); font-size: 15px; color: var(--cs-muted); margin: 0;
}
.csp-clear-btn {
  height: 38px; padding: 0 20px;
  border: 1.5px solid var(--cs-brand); border-radius: 6px;
  background: none; color: var(--cs-brand);
  font-family: var(--font-body); font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all .2s;
}
.csp-clear-btn:hover { background: var(--cs-brand); color: #fff; }

.csp-error-box {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 20px 24px; border-radius: 10px;
  background: #fdf3f3; border: 1px solid #f5c6c6;
  font-family: var(--font-body); font-size: 14px; color: #a94442;
  margin-bottom: 24px;
}

/* ══════════ PAGINATION ══════════ */
.csp-pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 40px 0 0;
}
.csp-page-btn {
  min-width: 38px; height: 38px; padding: 0 10px;
  border: 1.5px solid var(--cs-border); border-radius: 6px;
  font-family: var(--font-body); font-size: 13px; font-weight: 500;
  color: var(--cs-muted); background: var(--cs-white); cursor: pointer;
  transition: all .2s;
}
.csp-page-btn:hover { border-color: var(--cs-brand); color: var(--cs-brand); }
.csp-page-btn.active { background: var(--cs-brand); border-color: var(--cs-brand); color: #fff; font-weight: 600; }
.csp-page-btn.next { padding: 0 18px; }

/* ══════════ RESPONSIVE ══════════ */
@media (max-width: 1024px) {
  .csp-sidebar { width: 200px; }
  .csp-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; }
}

@media (max-width: 768px) {
  .csp-breadcrumb, .csp-body { padding-left: 20px; padding-right: 20px; }
  .csp-cat-strip { padding-left: 20px; padding-right: 20px; }

  .csp-sidebar {
    position: fixed; top: 0; left: -280px; bottom: 0; z-index: 500;
    width: 270px; border-radius: 0;
    transition: left .3s cubic-bezier(.22,1,.36,1);
    box-shadow: none; overflow-y: auto;
  }
  .csp-sidebar.open { left: 0; box-shadow: 4px 0 24px rgba(0,0,0,.15); }
  .csp-sidebar-close { display: block; }
  .csp-sidebar-overlay {
    position: fixed; inset: 0; z-index: 499;
    background: rgba(0,0,0,.4);
  }
  .csp-filter-toggle { display: flex; }
  .csp-body { padding-top: 20px; }
  .csp-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .csp-overlay { padding: 10px; gap: 6px; }
}

@media (max-width: 480px) {
  .csp-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .csp-page-title { font-size: 26px; }
}

/* ══════════ TOUCH DEVICES — always show overlay & wishlist ══════════ */
@media (hover: none) {
  /* Always show the Quick View overlay */
  .csp-overlay {
    transform: translateY(0);
    background: rgba(255,255,255,.92);
  }
  /* Always show wishlist button */
  .csp-wishlist {
    opacity: 1;
  }
  /* Remove the card lift — it looks broken on tap */
  .csp-card:hover {
    transform: none;
    box-shadow: none;
  }
  /* Shrink overlay padding on small cards */
  .csp-overlay {
    padding: 8px;
  }
  .csp-quick-view {
    height: 32px;
    line-height: 32px;
    font-size: 11px;
  }
}
`;
