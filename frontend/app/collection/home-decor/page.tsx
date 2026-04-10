'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import '../../shop/shop.css';

const ALL_PRODUCTS = [
  { id:1,  name:'SHRI KHATU SHYAM CREATION MDF Wall Photo Frame (Multicolor, 1 Photo(s), 30)', price:1299, oldPrice:1799, rating:4.5, reviews:1203, material:'Cotton',   style:'Floral',     type:'Cushion',    image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/normal-photo-frame/n/m/i/7-horses-wall-photo-frame-1-sksc-ctl-12x24-06-shri-khatu-shyam-original-imahkhnjh5hyjawv.jpeg?q=90' },
  { id:2,  name:'DECOR  Production Wall Painting Scenery for Home Decor, Office etc Digital Reprint 40 inch x 20 inch Painting (Without Frame)',      price:899,  oldPrice:null, rating:4.3, reviews:876,  material:'Ceramic',  style:'Minimalist', type:'Vase',       image:'https://rukminim1.flixcart.com/image/1280/1280/kl175ow0/painting/v/b/t/20-wall-painting-scenery-for-home-decor-etc-self-adhesive-vinyl-original-imagy8y3gpk2a6z6.jpeg?q=90' },
  { id:3,  name:'BHAARUSH9 Multicolor Wild Flower Artificial Flower  with Pot (15 cm, Pack of 8, Flower with Basket)',      price:1599, oldPrice:2199, rating:4.6, reviews:543,  material:'Cotton',   style:'Boho',       type:'Wall Decor', image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/artificial-flower/3/v/y/8-123-bhaarush9-original-imahmf9mnahr8gnr.jpeg?q=90' },
  { id:4,  name:'DECOR  Production Wall Painting Scenery for Home Decor, Office etc Digital Reprint 56 inch x 28 inch Painting (Without Frame)',            price:699,  oldPrice:999,  rating:4.2, reviews:432,  material:'Ceramic',  style:'Rustic',     type:'Planter',    image:'https://rukminim1.flixcart.com/image/1280/1280/kl175ow0/painting/l/f/i/20-largepainting-35-hd-rapid-design-original-imagy8w5dnpfzpgg.jpeg?q=90' },
  { id:5,  name:'GiftzLane Lord KHATU ji Idol for car Dashboard & Home Decorative Showpiece  -  7.62 cm (Wood, Multicolor)',          price:1099, oldPrice:null, rating:4.4, reviews:765,  material:'Seagrass', style:'Boho',       type:'Storage',    image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/showpiece-figurine/s/k/e/0-2-7-62-tran-gzl-d-1919-march-color-splash-7-62-original-imahherzej27gqke.jpeg?q=90' },
  { id:6,  name:'FASTQT 24.2 inch UNIQUE WALL CLOCK FOR HOME ,OFFICE Self Adhesive Sticker (Pack of 1)',   price:2499, oldPrice:3499, rating:4.7, reviews:987,  material:'Canvas',   style:'Modern',     type:'Wall Decor', image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/sticker/f/6/r/large-unique-wall-clock-for-home-office-1-24-2-ts-fastqt-original-imaheaf7qvtf7df2.jpeg?q=90' },
  { id:7,  name:'DAKSHITA 100 cm 12 Hexagon-Silver (Pack of 12) Acrylic Mirror Self Adhesive Sticker (Pack of 12)',    price:599,  oldPrice:799,  rating:4.5, reviews:2103, material:'Soy Wax',  style:'Minimalist', type:'Candle',     image:'https://rukminim1.flixcart.com/image/1280/1280/kmqn3bk0/sticker/m/4/1/large-12-hexagon-silver-each-hexagon-size-size-10-5-x-12-1-3d-original-imagfkjqz33suteh.jpeg?q=90' },
  { id:8,  name:'Painting Mantra Elegant Mandala Round Framed Wall Art Painting For Living Room Digital Reprint 16 inch x 16 inch Painting (With Frame)',            price:849,  oldPrice:null, rating:4.1, reviews:321,  material:'Rattan',   style:'Boho',       type:'Frame',      image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/painting/a/w/u/16-1-asfrp2603056-paintingmantra-original-imahhynmzrzb8rvb.jpeg?q=90' },
  { id:9,  name:'DecorWhiz Luxury Design Gold Candle Stand Set | Decorative Holder for Home Decoration Gold Plated Candle Holder Set (Gold, Pack of 2)',         price:3299, oldPrice:4499, rating:4.8, reviews:654,  material:'Ceramic',  style:'Floral',     type:'Lamp',       image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/candle-tealight-holder/e/u/j/3-75-2-candle-holder-m4-decor-whiz-7-original-imahks92aahjxcyv.jpeg?q=90' },
  { id:10, name:'Rose, Jasmine Diffuser Set deverauxbluecolourdiffuser (5 x 6 ml)',          price:1799, oldPrice:2499, rating:4.3, reviews:432,  material:'Jute',     style:'Rustic',     type:'Rug',        image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/air-freshener/7/a/t/30-deverauxbluecolourdiffuser-liquid-deveraux-original-imahjx5zzyj3g7qe.jpeg?q=90' },
  { id:11, name:'Aatiutik Magic Fruit Diffuser Set Electric Camphor Diffuser Aroma Oil Burner with Ceramic Bowl | Kapoor Dani Electric Burner | Room Freshener, Camphor & Diffuser/Essential Oil Fragrance (20 ml)',          price:499,  oldPrice:null, rating:4.2, reviews:876,  material:'Metal',    style:'Modern',     type:'Candle',     image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/air-freshener/1/w/c/20-electric-camphor-diffuser-aroma-oil-burner-with-ceramic-bowl-original-imahmyyqhss37fuk.jpeg?q=90' },
  { id:12, name:'ambika fashion Premium Premanand Ji Maharaj Wall Hanging for Living Room,Bedroom,Spiritual Acrylic 30 inch x 12 inch Painting (Without Frame)',               price:799,  oldPrice:1099, rating:4.6, reviews:1543, material:'Natural',  style:'Boho',       type:'Vase',       image:'https://rukminim1.flixcart.com/image/1280/1280/xif0q/painting/d/l/f/12-1-premium-premanand-ji-maharaj-wall-hanging-for-living-room-original-imah8s2zpe9hvgvd.jpeg?q=90' },
];

const MATERIALS  = ['Canvas','Ceramic','Cotton','Jute','Metal','Natural','Rattan','Seagrass','Soy Wax'];
const STYLES     = ['Boho','Floral','Minimalist','Modern','Rustic'];
const TYPES      = ['Candle','Cushion','Frame','Lamp','Planter','Rug','Storage','Vase','Wall Decor'];
const SORT_OPTIONS = [
  { label:'Featured',           value:'featured'   },
  { label:'Price: Low to High', value:'price-asc'  },
  { label:'Price: High to Low', value:'price-desc' },
  { label:'Top Rated',          value:'rating'     },
];
const MAX_PRICE = 5000;

function MiniStars({ rating }: { rating: number }) {
  return (
    <span className="csp-stars" aria-label={`${rating} out of 5`}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"
          fill={s <= Math.round(rating) ? '#e8a020' : '#ddd'}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </span>
  );
}

function FilterSection({ label, isOpen, onToggle, children }: {
  label: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="nf-section">
      <button className={`nf-section-btn${isOpen ? ' open' : ''}`} onClick={onToggle}
        aria-expanded={isOpen}>
        <span className="nf-section-label">{label}</span>
        <svg className="nf-chevron" width="12" height="12" viewBox="0 0 12 12"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="2,4 6,8 10,4"/>
        </svg>
      </button>
      <div className={`nf-panel${isOpen ? ' open' : ''}`}>
        <div className="nf-panel-inner">
          <div className="nf-options-list">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CheckOption({ label, checked, onChange, count }: {
  label: string; checked: boolean; onChange: () => void; count: number;
}) {
  return (
    <label className={`nf-option${checked ? ' checked' : ''}`}>
      <span className="nf-checkbox" aria-hidden="true">
        {checked && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <input type="checkbox" className="nf-hidden-input" checked={checked} onChange={onChange} aria-label={label}/>
      <span className="nf-option-text">{label}</span>
      <span style={{marginLeft:'auto',fontSize:11,color:'#9ca3af'}}>({count})</span>
    </label>
  );
}

function ProductCard({ p, idx }: { p: typeof ALL_PRODUCTS[0]; idx: number }) {
  const [hovered,    setHovered]    = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const isOnSale = !!p.oldPrice;
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : null;

  return (
    <div className="csp-card" style={{ animationDelay:`${Math.min(idx*40,400)}ms` }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="csp-img-wrap">
        <Link href="/shop" tabIndex={-1} aria-hidden="true">
          <img src={p.image} alt={p.name} className={`csp-img${hovered ? ' zoomed' : ''}`}
            loading={idx < 8 ? 'eager' : 'lazy'}/>
        </Link>
        <div className="csp-badges">
          {isOnSale && <span className="csp-badge sale">Sale</span>}
        </div>
        <button className={`csp-wishlist${wishlisted ? ' active' : ''}`}
          aria-label={`${wishlisted ? 'Remove' : 'Add'} ${p.name} ${wishlisted ? 'from' : 'to'} wishlist`}
          onClick={e => { e.preventDefault(); setWishlisted(w => !w); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
            fill={wishlisted ? '#e74c3c' : 'none'}
            stroke={wishlisted ? '#e74c3c' : 'currentColor'} strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <div className={`csp-overlay${hovered ? ' show' : ''}`} aria-hidden={!hovered}>
          <Link href="/shop" className="csp-quick-view">Quick View</Link>
        </div>
      </div>
      <div className="csp-info">
        <Link href="/shop" className="csp-name">{p.name}</Link>
        <div className="csp-price-row">
          {isOnSale && p.oldPrice && <span className="csp-old-price">₹{p.oldPrice.toLocaleString()}</span>}
          <span className={`csp-price${isOnSale ? ' sale' : ''}`}>
            ₹{p.price.toLocaleString()}
            {isOnSale && discount && <span style={{fontSize:11,fontWeight:600,color:'#dc2626',marginLeft:6}}>{discount}% off</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomeDecorPage() {
  const [sort,        setSort]        = useState('featured');
  const [viewMode,    setViewMode]    = useState<'grid'|'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openFilters, setOpenFilters] = useState({ price:false, type:false, material:false, style:false });
  const [selMaterials, setSelMaterials] = useState<string[]>([]);
  const [selStyles,    setSelStyles]    = useState<string[]>([]);
  const [selTypes,     setSelTypes]     = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(MAX_PRICE);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const toggleStr = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const totalActive = selMaterials.length + selStyles.length + selTypes.length +
    (priceMin > 0 || priceMax < MAX_PRICE ? 1 : 0);

  const clearAll = () => {
    setSelMaterials([]); setSelStyles([]); setSelTypes([]);
    setPriceMin(0); setPriceMax(MAX_PRICE); setPage(1);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const filtered = useMemo(() => ALL_PRODUCTS.filter(p => {
    if (selMaterials.length && !selMaterials.includes(p.material)) return false;
    if (selStyles.length    && !selStyles.includes(p.style))       return false;
    if (selTypes.length     && !selTypes.includes(p.type))         return false;
    if (p.price < priceMin  || p.price > priceMax)                 return false;
    return true;
  }), [selMaterials, selStyles, selTypes, priceMin, priceMax]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'price-asc')  arr.sort((a,b) => a.price - b.price);
    if (sort === 'price-desc') arr.sort((a,b) => b.price - a.price);
    if (sort === 'rating')     arr.sort((a,b) => b.rating - a.rating);
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const paginated  = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const goToPage = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const SidebarContent = (
    <>
      <div className="nf-sidebar-head">
        <span className="nf-sidebar-title">Filters</span>
        {totalActive > 0 && <button className="nf-clear-all" onClick={clearAll}>Clear all ({totalActive})</button>}
      </div>

      <FilterSection label={priceMin > 0 || priceMax < MAX_PRICE ? 'Price Range (Active)' : 'Price Range'}
        isOpen={openFilters.price} onToggle={() => setOpenFilters(p => ({...p, price:!p.price}))}>
        <div style={{padding:'4px 0 8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <span className="drs-val-bubble">₹{priceMin.toLocaleString()}</span>
            <span className="drs-val-sep">-</span>
            <span className="drs-val-bubble">₹{priceMax.toLocaleString()}</span>
          </div>
          <div className="drs-track-row">
            <div className="drs-track">
              <div className="drs-fill" style={{
                left:`${(priceMin/MAX_PRICE)*100}%`,
                width:`${((priceMax-priceMin)/MAX_PRICE)*100}%`
              }}/>
            </div>
            <input type="range" className="drs-input drs-min" min={0} max={MAX_PRICE} value={priceMin}
              aria-label="Minimum price"
              onChange={e => setPriceMin(Math.min(Number(e.target.value), priceMax - 1))}/>
            <input type="range" className="drs-input drs-max" min={0} max={MAX_PRICE} value={priceMax}
              aria-label="Maximum price"
              onChange={e => setPriceMax(Math.max(Number(e.target.value), priceMin + 1))}/>
          </div>
        </div>
      </FilterSection>

      <FilterSection label={selTypes.length ? `Type (${selTypes.length})` : 'Type'}
        isOpen={openFilters.type} onToggle={() => setOpenFilters(p => ({...p, type:!p.type}))}>
        {TYPES.map(t => (
          <CheckOption key={t} label={t} checked={selTypes.includes(t)}
            onChange={() => setSelTypes(toggleStr(selTypes, t))}
            count={ALL_PRODUCTS.filter(p => p.type === t).length}/>
        ))}
      </FilterSection>

      <FilterSection label={selMaterials.length ? `Material (${selMaterials.length})` : 'Material'}
        isOpen={openFilters.material} onToggle={() => setOpenFilters(p => ({...p, material:!p.material}))}>
        {MATERIALS.map(m => (
          <CheckOption key={m} label={m} checked={selMaterials.includes(m)}
            onChange={() => setSelMaterials(toggleStr(selMaterials, m))}
            count={ALL_PRODUCTS.filter(p => p.material === m).length}/>
        ))}
      </FilterSection>

      <FilterSection label={selStyles.length ? `Style (${selStyles.length})` : 'Style'}
        isOpen={openFilters.style} onToggle={() => setOpenFilters(p => ({...p, style:!p.style}))}>
        {STYLES.map(s => (
          <CheckOption key={s} label={s} checked={selStyles.includes(s)}
            onChange={() => setSelStyles(toggleStr(selStyles, s))}
            count={ALL_PRODUCTS.filter(p => p.style === s).length}/>
        ))}
      </FilterSection>
    </>
  );

  return (
    <>
      <Header/>

      <nav className="csp-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="csp-bsep" aria-hidden="true">&gt;</span>
        <Link href="/collection">Collections</Link>
        <span className="csp-bsep" aria-hidden="true">&gt;</span>
        <span aria-current="page">Home Decor</span>
      </nav>



      <div className="csp-body">
        <aside className="csp-sidebar" aria-label="Product filters">{SidebarContent}</aside>

        {sidebarOpen && (
          <div className="csp-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true"/>
        )}
        <div className={`csp-sidebar-drawer${sidebarOpen ? ' open' : ''}`}
          role="dialog" aria-modal="true" aria-label="Product filters" aria-hidden={!sidebarOpen}>
          <div className="csp-drawer-head">
            <span className="csp-drawer-title">Filters</span>
            <button className="csp-drawer-close" onClick={() => setSidebarOpen(false)} aria-label="Close filters">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="16" y2="16"/><line x1="16" y1="2" x2="2" y2="16"/>
              </svg>
            </button>
          </div>
          <div className="csp-drawer-body">{SidebarContent}</div>
          <div className="csp-drawer-foot">
            <button className="csp-apply-btn" onClick={() => setSidebarOpen(false)}>
              View {sorted.length} Result{sorted.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <main className="csp-main">
          <div className="csp-toolbar">
            <div className="csp-toolbar-left">
              <button className="csp-filter-toggle" onClick={() => setSidebarOpen(true)}
                aria-label={`Open filters${totalActive > 0 ? `, ${totalActive} active` : ''}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
                </svg>
                Filters
                {totalActive > 0 && <span className="csp-filter-badge">{totalActive}</span>}
              </button>
              <span className="csp-count">{sorted.length} product{sorted.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="csp-toolbar-right">
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

          {totalActive > 0 && (
            <div className="csp-chips-bar" role="group" aria-label="Active filters">
              <button className="csp-chips-clear" onClick={clearAll}>Clear all</button>
              {selTypes.map(t => (
                <span key={t} className="csp-chip">{t}
                  <button className="csp-chip-x" onClick={() => setSelTypes(toggleStr(selTypes, t))} aria-label={`Remove ${t}`}>x</button>
                </span>
              ))}
              {selMaterials.map(m => (
                <span key={m} className="csp-chip">{m}
                  <button className="csp-chip-x" onClick={() => setSelMaterials(toggleStr(selMaterials, m))} aria-label={`Remove ${m}`}>x</button>
                </span>
              ))}
              {selStyles.map(s => (
                <span key={s} className="csp-chip">{s}
                  <button className="csp-chip-x" onClick={() => setSelStyles(toggleStr(selStyles, s))} aria-label={`Remove ${s}`}>x</button>
                </span>
              ))}
              {(priceMin > 0 || priceMax < MAX_PRICE) && (
                <span className="csp-chip">₹{priceMin.toLocaleString()}–₹{priceMax.toLocaleString()}
                  <button className="csp-chip-x" onClick={() => { setPriceMin(0); setPriceMax(MAX_PRICE); }} aria-label="Remove price filter">x</button>
                </span>
              )}
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="csp-state-wrap">
              <svg width="52" height="52" fill="none" stroke="#ccc" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="csp-state-text">No products match your filters</p>
              <button className="csp-clear-btn" onClick={clearAll}>Clear all filters</button>
            </div>
          ) : (
            <div className={`csp-grid${viewMode === 'list' ? ' list-mode' : ''}`} aria-label="Products">
              {paginated.map((p, i) => <ProductCard key={p.id} p={p} idx={i}/>)}
            </div>
          )}

          {sorted.length > 0 && totalPages > 1 && (
            <nav className="csp-pagination" aria-label="Pagination">
              <button className="csp-page-btn" onClick={() => goToPage(page - 1)} disabled={page === 1}
                aria-label="Previous page">&lt; Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`csp-page-btn${p === page ? ' active' : ''}`}
                  onClick={() => goToPage(p)} aria-current={p === page ? 'page' : undefined}>{p}</button>
              ))}
              <button className="csp-page-btn next" onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                aria-label="Next page">Next &gt;</button>
            </nav>
          )}
        </main>
      </div>

      <Footer/>
    </>
  );
}
