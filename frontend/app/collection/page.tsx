'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../shop/shop.css';

const ALL_COLLECTIONS = [
  { id:1, name:'Cups & Mugs', href:'/cups-and-mugs', count:12, category:'Drinkware', image:'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg', desc:'Handcrafted cups and mugs for every mood.' },
  { id:2, name:'Home Decor',  href:'/home-decor',    count:12, category:'Decor',     image:'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller01-10.03.2026.jpg', desc:'Transform your space with warmth and character.' },
  { id:3, name:'Dining',      href:'/dining',        count:12, category:'Dining',    image:'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg', desc:'Elevate every meal from everyday to special.' },
  { id:4, name:'Kitchen',     href:'/kitchen',       count:12, category:'Kitchen',   image:'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg', desc:'Quality kitchen essentials for every home chef.' },
];

const CATEGORIES = ['Drinkware','Decor','Dining','Kitchen'];

function FilterSection({ label, isOpen, onToggle, children }: {
  label: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="nf-section">
      <button className={`nf-section-btn${isOpen ? ' open' : ''}`} onClick={onToggle} aria-expanded={isOpen}>
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

function CollectionCard({ c, idx }: { c: typeof ALL_COLLECTIONS[0]; idx: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="csp-card" style={{ animationDelay:`${Math.min(idx*40,400)}ms` }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="csp-img-wrap">
        <Link href={c.href} tabIndex={-1} aria-hidden="true">
          <img src={c.image} alt={c.name} className={`csp-img${hovered ? ' zoomed' : ''}`} loading="eager"/>
        </Link>
        <div className={`csp-overlay${hovered ? ' show' : ''}`} aria-hidden={!hovered}>
          <Link href={c.href} className="csp-quick-view">Shop Now</Link>
        </div>
      </div>
      <div className="csp-info">
        <Link href={c.href} className="csp-name">{c.name}</Link>
        <p style={{fontSize:12,color:'#6b7280',margin:'4px 0 0',lineHeight:1.4}}>{c.desc}</p>
        <div className="csp-price-row" style={{marginTop:6}}>
          <span style={{fontSize:12,color:'#9ca3af'}}>{c.count} products</span>
        </div>
      </div>
    </div>
  );
}

export default function CollectionsPage() {
  const [viewMode,      setViewMode]      = useState<'grid'|'list'>('grid');
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [openFilters,   setOpenFilters]   = useState({ category: false });
  const [selCategories, setSelCategories] = useState<string[]>([]);

  const toggleStr = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const totalActive = selCategories.length;
  const clearAll = () => setSelCategories([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const filtered = useMemo(() =>
    ALL_COLLECTIONS.filter(c => !selCategories.length || selCategories.includes(c.category)),
    [selCategories]
  );

  const SidebarContent = (
    <>
      <div className="nf-sidebar-head">
        <span className="nf-sidebar-title">Filters</span>
        {totalActive > 0 && <button className="nf-clear-all" onClick={clearAll}>Clear all ({totalActive})</button>}
      </div>
      <FilterSection label={selCategories.length ? `Category (${selCategories.length})` : 'Category'}
        isOpen={openFilters.category} onToggle={() => setOpenFilters(p => ({...p, category:!p.category}))}>
        {CATEGORIES.map(cat => (
          <CheckOption key={cat} label={cat} checked={selCategories.includes(cat)}
            onChange={() => setSelCategories(toggleStr(selCategories, cat))}
            count={ALL_COLLECTIONS.filter(c => c.category === cat).length}/>
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
        <span aria-current="page">Collections</span>
      </nav>

      <div className="csp-body">
        <aside className="csp-sidebar" aria-label="Product filters">{SidebarContent}</aside>

        {sidebarOpen && <div className="csp-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true"/>}
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
              View {filtered.length} Result{filtered.length !== 1 ? 's' : ''}
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
              <span className="csp-count">{filtered.length} collection{filtered.length !== 1 ? 's' : ''}</span>
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
              {selCategories.map(cat => (
                <span key={cat} className="csp-chip">{cat}
                  <button className="csp-chip-x" onClick={() => setSelCategories(toggleStr(selCategories, cat))} aria-label={`Remove ${cat}`}>x</button>
                </span>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="csp-state-wrap">
              <svg width="52" height="52" fill="none" stroke="#ccc" strokeWidth="1.2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="csp-state-text">No collections match your filters</p>
              <button className="csp-clear-btn" onClick={clearAll}>Clear all filters</button>
            </div>
          ) : (
            <div className={`csp-grid${viewMode === 'list' ? ' list-mode' : ''}`} aria-label="Collections">
              {filtered.map((c, i) => <CollectionCard key={c.id} c={c} idx={i}/>)}
            </div>
          )}
        </main>
      </div>

      <Footer/>
    </>
  );
}
