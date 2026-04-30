"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCart } from "../lib/cartContext";
import { useAuth } from "../lib/authContext";
import { formatPrice } from "../lib/price";
import { usePlaceholderImage } from "../lib/siteSettingsContext";
import { getImageUrl } from "../lib/api";
import "./Header.css";


const CATEGORY_PAGE_SLUGS: Record<string, string> = {
  'drinkware': '/shop/drinkware',
  'glassware': '/shop/glassware',
  'jars-and-containers': '/shop/jars-and-containers',
};
const CATEGORY_NAME_TO_SLUG: Record<string, string> = {
  'drinkware': 'drinkware',
  'glassware': 'glassware',
  'jars and containers': 'jars-and-containers',
  'jars & containers': 'jars-and-containers',
  'kitchen organisers': 'jars-and-containers',
  'kitchen organizers': 'jars-and-containers',
};
const getCategoryHref = (slug: string) => {
  const normalized = slug.toLowerCase().trim();
  return CATEGORY_PAGE_SLUGS[normalized] ?? `/shop?category=${encodeURIComponent(normalized)}`;
};

type MegaLink = { label: string; href: string; };
type MegaColumn = { heading: string; links: MegaLink[]; };
type MegaFeature = { image: string; eyebrow: string; title: string; href: string; };
type MegaMenu = {
  featureGroupLabel?: string;
  columns: MegaColumn[];
  featured: MegaFeature[];
  cta?: MegaLink;
  contentColumns?: 2 | 3;
  isKitchen?: boolean;
  isDrinkware?: boolean;
  isGlassware?: boolean;
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { items, count, total, removeItem } = useCart();
  const { user, isLoggedIn } = useAuth();
  const PLACEHOLDER = usePlaceholderImage();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: number; title: string; price: string; image: string; slug: string }>>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<Array<{ id: number; name: string; slug: string; count: number }>>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);
  const megaLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) setCartOpen(false);
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setActiveMenu(null);
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setSuggestions([]);
        setCategorySuggestions([]);
      }
    };
    const handleResize = () => { if (window.innerWidth >= 992) setMobileMenuOpen(false); };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setCartOpen(false); setSearchOpen(false); setMobileSearchOpen(false); setMobileMenuOpen(false); setActiveMenu(null); setSuggestions([]); setCategorySuggestions([]); }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      if (suggestAbort.current) suggestAbort.current.abort();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen || mobileSearchOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, mobileSearchOpen]);

  // Reset scroll lock and close all overlays on route change
  useEffect(() => {
    document.body.style.overflow = "";
    closeOverlays();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (mobileSearchOpen) searchRef.current?.focus();
  }, [mobileSearchOpen]);

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <strong>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </span>
    );
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    closeOverlays();
    setSuggestions([]);
    setCategorySuggestions([]);
    const catSlug = CATEGORY_NAME_TO_SLUG[query.toLowerCase()];
    if (catSlug) {
      router.push(getCategoryHref(catSlug));
    } else {
      router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (suggestAbort.current) suggestAbort.current.abort();
    if (!value.trim()) { setSuggestions([]); setCategorySuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      suggestAbort.current = controller;
      setSuggestLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`/store/api/products?search=${encodeURIComponent(value.trim())}&limit=5`, { headers: { Accept: 'application/json' }, signal: controller.signal }),
          fetch(`/store/api/product-categories/search?q=${encodeURIComponent(value.trim())}&limit=4`, { headers: { Accept: 'application/json' }, signal: controller.signal }),
        ]);
        if (!prodRes.ok || !catRes.ok) throw new Error('fetch failed');
        const prodJson = await prodRes.json();
        const catJson = await catRes.json();
        const items = (prodJson.data ?? prodJson ?? []).slice(0, 5).map((p: any) => ({
          id: p.ID, title: p.title,
          price: p._sale_price ?? p._regular_price ?? p.price_min ?? '',
          image: p.thumbnail_url ? (p.thumbnail_url.startsWith('http') || p.thumbnail_url.startsWith('/') ? p.thumbnail_url : `/uploads/${p.thumbnail_url}`) : PLACEHOLDER,
          slug: (p.slug || p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        }));
        const cats = (catJson.data ?? []).map((c: any) => ({
          id: c.category_id, name: c.category_name, slug: c.category_slug, count: Number(c.product_count),
        }));
        setSuggestions(items);
        setCategorySuggestions(cats);
      } catch (err: any) {
        if (err?.name !== 'AbortError') { setSuggestions([]); setCategorySuggestions([]); }
      } finally {
        setSuggestLoading(false);
      }
    }, 280);
  };

  const navLinks: Array<{ label: string; href: string; mega?: MegaMenu }> = [
    { label: "DRINKWARE", href: "/shop/drinkware", mega: { columns: [], featured: [], isDrinkware: true } },
    { label: "GLASSWARE", href: "/shop/glassware", mega: { columns: [], featured: [], isGlassware: true } },
    { label: "KITCHEN ORGANISERS", href: "/shop/jars-and-containers", mega: { columns: [], featured: [], isKitchen: true } },
    { label: "ABOUT US", href: "/about-us" },
    { label: "B2B CONNECT", href: "/b2b-connect" },
  ];

  const [kitchenProducts, setKitchenProducts] = useState<Array<{ id: number; title: string; price: string; image: string; slug: string }>>([]);
  const [drinkwareProducts, setDrinkwareProducts] = useState<Array<{ id: number; title: string; price: string; image: string; slug: string }>>([]);
  const [glasswareProducts, setGlasswareProducts] = useState<Array<{ id: number; title: string; price: string; image: string; slug: string }>>([]);

  const mapProducts = (raw: any[]) => raw.slice(0, 4).map((p: any) => {
    const raw_img = p.thumbnail_url ?? '';
    const image = raw_img
      ? raw_img.startsWith('http') || raw_img.startsWith('//')
        ? raw_img
        : raw_img.startsWith('/')
          ? raw_img
          : `/uploads/${raw_img}`
      : PLACEHOLDER;
    return {
      id: p.ID ?? p.id,
      title: p.title,
      price: p._sale_price ? `₹${p._sale_price}` : p._regular_price ? `₹${p._regular_price}` : p.price_min ? `₹${p.price_min}` : '',
      image,
      slug: (p.slug || p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    };
  });

  useEffect(() => {
    const fetchCat = (cat: string, setter: (v: any[]) => void) =>
      fetch(`/store/api/product-categories/${cat}/products`, { headers: { Accept: 'application/json' } })
        .then(r => r.json()).then(json => setter(mapProducts(json.data ?? json ?? []))).catch(() => {});
    fetchCat('jars-and-containers', setKitchenProducts);
    fetchCat('drinkware', setDrinkwareProducts);
    fetchCat('glassware', setGlasswareProducts);
  }, []);
  const closeOverlays = () => { setCartOpen(false); setSearchOpen(false); setMobileSearchOpen(false); setMobileMenuOpen(false); setActiveMenu(null); };
  const openMega = (label: string) => { if (megaLeaveTimer.current) clearTimeout(megaLeaveTimer.current); setActiveMenu(label); };
  const closeMega = () => { megaLeaveTimer.current = setTimeout(() => setActiveMenu(null), 120); };
  const keepMega = () => { if (megaLeaveTimer.current) clearTimeout(megaLeaveTimer.current); };

  return (
    <>
      <header className="nh-header" ref={headerRef}>
        <div className="nh-inner">
          <div className="nh-left">
            <button type="button" className="nh-icon-btn nh-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
              <span className="nh-hamburger-lines"><span /><span /><span /></span>
            </button>
            <Link href="/" className="nh-logo-link" onClick={closeOverlays}>
              <Image src="/store/images/logo-white.png" alt="Okab Online Store" width={280} height={64} priority className="nh-logo-image" />
            </Link>
          </div>

          <div className="nh-center">
            <ul className="nh-nav">
              {navLinks.map((link) => (
                <li key={link.label} className={link.mega ? 'nh-mega-wrap' : ''}>
                  {link.mega ? (
                    <>
                      <Link href={link.href} className={`nh-mega-trigger${activeMenu === link.label ? ' open' : ''}`}
                        onMouseEnter={() => openMega(link.label)} onMouseLeave={closeMega} onClick={closeOverlays}>
                        {link.label}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </Link>
                      <div className={`nh-mega-panel${activeMenu === link.label ? ' open' : ''}`} onMouseEnter={keepMega} onMouseLeave={closeMega}>
                        {(link.mega.isKitchen || link.mega.isDrinkware || link.mega.isGlassware) ? (() => {
                          const products = link.mega.isKitchen ? kitchenProducts : link.mega.isDrinkware ? drinkwareProducts : glasswareProducts;
                          const shopHref = link.href;
                          const promos = link.mega.isKitchen
                            ? [
                                { img: '/store/images/category_images/CC_KITCHEN_ORGANISERS.png', title: 'OUR KITCHEN COLLECTION', sub: '150+ Products Available', badge: false, cta: false },
                                { img: '/store/images/category_images/CC_KITCHEN_ORGANISERS.png', title: 'EXCLUSIVE KITCHEN DEALS', sub: 'GET UPTO 40% DISCOUNT', badge: true, cta: true },
                              ]
                            : link.mega.isDrinkware
                            ? [
                                { img: '/store/images/category_images/CC_TUMBLERS.png', title: 'OUR DRINKWARE COLLECTION', sub: '150+ Products Available', badge: false, cta: false },
                                { img: '/store/images/category_images/CC_TUMBLERS.png', title: 'EXCLUSIVE DRINKWARE DEALS', sub: 'GET UPTO 40% DISCOUNT', badge: true, cta: true },
                              ]
                            : [
                                { img: '/store/images/category_images/CC_GLASSWARE.png', title: 'OUR GLASSWARE COLLECTION', sub: '150+ Products Available', badge: false, cta: false },
                                { img: '/store/images/category_images/CC_GLASSWARE.png', title: 'EXCLUSIVE GLASSWARE DEALS', sub: 'GET UPTO 40% DISCOUNT', badge: true, cta: true },
                              ];
                          const placeholder = <span className="nh-km-placeholder"><svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" fill="#e8e8e8"/><path d="M14 34l8-10 6 7 4-5 6 8H14z" fill="#bbb"/><circle cx="30" cy="20" r="4" fill="#bbb"/></svg></span>;
                          return (
                            <div className="nh-km-layout">
                              <div className="nh-km-products">
                                <div className="nh-km-section">
                                  <p className="nh-km-section-title">NEW ARRIVALS</p>
                                  <div className="nh-km-grid">
                                    {(products.length ? products.slice(0, 2) : Array(2).fill(null)).map((p, i) => (
                                      <Link key={p?.id ?? i} href={p ? `/shop/product/${p.slug}` : shopHref} className="nh-km-card" onClick={closeOverlays}>
                                        <div className="nh-km-img-wrap">{p?.image ? <img src={p.image} alt={p.title} loading="lazy" /> : placeholder}</div>
                                        <p className="nh-km-name">{p?.title ?? ''}</p>
                                        <p className="nh-km-price">{p?.price ?? ''}</p>
                                        <span className="nh-km-shop">Shop Now</span>
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                                <div className="nh-km-section">
                                  <p className="nh-km-section-title">BEST SELLER</p>
                                  <div className="nh-km-grid">
                                    {(products.length ? products.slice(2, 4) : Array(2).fill(null)).map((p, i) => (
                                      <Link key={p?.id ?? i} href={p ? `/shop/product/${p.slug}` : shopHref} className="nh-km-card" onClick={closeOverlays}>
                                        <div className="nh-km-img-wrap">{p?.image ? <img src={p.image} alt={p.title} loading="lazy" /> : placeholder}</div>
                                        <p className="nh-km-name">{p?.title ?? ''}</p>
                                        <p className="nh-km-price">{p?.price ?? ''}</p>
                                        <span className="nh-km-shop">Shop Now</span>
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="nh-km-promos">
                                {promos.map(promo => (
                                  <Link key={promo.title} href={shopHref} className="nh-km-promo" onClick={closeOverlays}>
                                    <img src={promo.img} alt={promo.title} loading="lazy" />
                                    {promo.badge && <span className="nh-km-promo-badge">SALE</span>}
                                    <span className="nh-km-promo-overlay">
                                      <span className="nh-km-promo-title">{promo.title}</span>
                                      <span className={`nh-km-promo-sub${promo.cta ? ' nh-km-promo-cta' : ''}`}>{promo.sub}</span>
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          );
                        })() : (
                        <div className={`nh-mega-inner${link.mega.columns.length === 0 ? ' collections-only' : ''}`}>
                          {link.mega.columns.length > 0 && (
                            <div className="nh-mega-content">
                              {link.mega.cta && <div className="nh-mega-title-row"><div/><Link href={link.mega.cta.href} className="nh-mega-cta" onClick={closeOverlays}>{link.mega.cta.label}</Link></div>}
                              <div className={`nh-mega-grid cols-${link.mega.contentColumns ?? 3}`}>
                                {link.mega.columns.map(col => (
                                  <div key={col.heading} className="nh-mega-col">
                                    <p className="nh-mega-col-heading">{col.heading}</p>
                                    <ul>{col.links.map(l => <li key={l.label}><Link href={l.href} onClick={closeOverlays}>{l.label}</Link></li>)}</ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="nh-mega-feature-block">
                            {link.mega.featureGroupLabel && <p className="nh-mega-feature-group-label">{link.mega.featureGroupLabel}</p>}
                            <div className="nh-mega-featured-grid">
                              {link.mega.featured.map(feature => (
                                <Link key={feature.title} href={feature.href} className="nh-mega-featured" onClick={closeOverlays}>
                                  <Image src={feature.image} alt={feature.title} fill sizes="(max-width: 1199px) 50vw, 280px"/>
                                  <span className="nh-mega-featured-overlay"><span className="nh-mega-featured-title">{feature.title}</span></span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <Link href={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="nh-right">
            {/* Desktop inline search bar */}
            <div className="nh-header-search" ref={searchWrapRef}>
              <form className="nh-header-search-form" onSubmit={handleSearchSubmit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  aria-label="Search products"
                  aria-autocomplete="list"
                  aria-expanded={suggestions.length > 0 || categorySuggestions.length > 0}
                />
                {searchQuery && (
                  <button type="button" className="nh-header-search-clear" onClick={() => { setSearchQuery(''); setSuggestions([]); setCategorySuggestions([]); searchRef.current?.focus(); }} aria-label="Clear search">×</button>
                )}
              </form>
              {searchOpen && (suggestions.length > 0 || categorySuggestions.length > 0 || suggestLoading) && (
                <div className="nh-header-search-dropdown">
                  {suggestLoading && <div className="nh-ss-loading">Searching...</div>}
                  {!suggestLoading && (suggestions.length > 0 || categorySuggestions.length > 0) && (
                    <>
                      {categorySuggestions.length > 0 && (
                        <div className="nh-ss-section">
                          <p className="nh-ss-section-title">Category Suggestions</p>
                          <div className="nh-ss-keywords">
                            {categorySuggestions.map(c => (
                              <Link key={`cat-${c.id}`} href={getCategoryHref(c.slug)} className="nh-ss-keyword nh-ss-category"
                                onClick={() => { closeOverlays(); setSuggestions([]); setCategorySuggestions([]); setSearchQuery(''); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                {highlight(c.name, searchQuery)}
                                {c.count > 0 && <span className="nh-ss-cat-count">{c.count}</span>}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {suggestions.length > 0 && (
                        <div className="nh-ss-section">
                          <p className="nh-ss-section-title">Product Suggestions</p>
                          <div className="nh-ss-products">
                            {suggestions.map(s => (
                              <Link key={`prod-${s.id}`} href={`/shop/product/${s.slug}`} className="nh-ss-product"
                                onClick={() => { closeOverlays(); setSuggestions([]); setCategorySuggestions([]); setSearchQuery(''); }}>
                                <img src={s.image} alt={s.title} className="nh-ss-thumb" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}/>
                                <span className="nh-ss-product-name">{highlight(s.title, searchQuery)}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile search icon — only visible on small screens */}
            <button type="button" className="nh-icon-btn nh-mobile-search" onClick={() => setMobileSearchOpen(true)} aria-label="Open search">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>

            {isLoggedIn && user ? (
              <Link href="/my-account" className="nh-account-link" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </Link>
            ) : (
              <Link href="/my-account" className="nh-account-link nh-login" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </Link>
            )}

            <div className="nh-cart-wrap" ref={cartRef}>
              <button type="button" className="nh-cart-link" onClick={() => setCartOpen(prev => !prev)} aria-label="Open cart preview" aria-expanded={cartOpen}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                {count > 0 && <span className="nh-cart-badge">{count}</span>}
              </button>
              <div className={`nh-cart-dropdown${cartOpen ? ' open' : ''}`}>
                {items.length === 0 ? (
                  <p className="nh-cart-empty">Your cart is empty.</p>
                ) : (
                  <>
                    {items.map(item => (
                      <div key={item.cartItemId} className="nh-cart-item">
                        <img src={getImageUrl(item.image, PLACEHOLDER)} alt={item.title} width={56} height={60} className="nh-cart-thumb"
                          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}/>
                        <div>
                          <p className="nh-cart-item-title">{item.title}</p>
                          <div className="nh-cart-item-meta">{item.quantity} x {formatPrice(item.price)}</div>
                        </div>
                        <button type="button" className="nh-cart-remove" onClick={() => removeItem(item.cartItemId)} aria-label={`Remove ${item.title}`}>×</button>
                      </div>
                    ))}
                    <div className="nh-cart-subtotal"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
                  </>
                )}
                <div className="nh-cart-actions">
                  <Link href="/cart" className="btn-view-product" onClick={closeOverlays}>View Cart</Link>
                  <Link href="/checkout" className="btn-view-product" onClick={closeOverlays}>Checkout</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {mobileSearchOpen && (
        <div className="nh-search-overlay" onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); setSuggestions([]); setCategorySuggestions([]); }}>
          <div className="nh-search-box-wrap" onClick={e => e.stopPropagation()}>
            <form className="nh-search-box" onSubmit={handleSearchSubmit}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} type="text" placeholder="Search products..." value={searchQuery} onChange={e => handleSearchChange(e.target.value)}/>
              <button type="button" className="nh-search-close" onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); setSuggestions([]); setCategorySuggestions([]); }} aria-label="Close search">×</button>
            </form>
            {(suggestions.length > 0 || categorySuggestions.length > 0 || suggestLoading) && (
              <div className="nh-search-suggestions">
                {suggestLoading && <div className="nh-ss-loading">Searching...</div>}
                {!suggestLoading && (suggestions.length > 0 || categorySuggestions.length > 0) && (
                  <>
                    {categorySuggestions.length > 0 && (
                      <div className="nh-ss-section">
                        <p className="nh-ss-section-title">Category Suggestions</p>
                        <div className="nh-ss-keywords">
                          {categorySuggestions.map(c => (
                            <Link key={`cat-${c.id}`} href={getCategoryHref(c.slug)} className="nh-ss-keyword nh-ss-category"
                              onClick={() => { closeOverlays(); setSuggestions([]); setCategorySuggestions([]); setSearchQuery(''); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                              {highlight(c.name, searchQuery)}
                              {c.count > 0 && <span className="nh-ss-cat-count">{c.count}</span>}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {suggestions.length > 0 && (
                      <div className="nh-ss-section">
                        <p className="nh-ss-section-title">Product Suggestions</p>
                        <div className="nh-ss-products">
                          {suggestions.map(s => (
                            <Link key={`prod-${s.id}`} href={`/shop/product/${s.slug}`} className="nh-ss-product"
                              onClick={() => { closeOverlays(); setSuggestions([]); setCategorySuggestions([]); setSearchQuery(''); }}>
                              <img src={s.image} alt={s.title} className="nh-ss-thumb" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}/>
                              <span className="nh-ss-product-name">{highlight(s.title, searchQuery)}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {mobileMenuOpen && <div className="nh-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`nh-drawer${mobileMenuOpen ? ' open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="nh-drawer-head">
          <Image src="/store/images/logo-white.png" alt="Okab Online Store" width={160} height={34} style={{ width: 'auto', height: '34px' }}/>
          <button type="button" className="nh-search-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button>
        </div>
        <ul className="nh-drawer-nav">
          {navLinks.concat([{ label: "My Account", href: "/my-account" }, { label: "Cart", href: "/cart" }, { label: "Checkout", href: "/checkout" }]).map(link => (
            <li key={link.label}><Link href={link.href} onClick={closeOverlays}>{link.label}</Link></li>
          ))}
        </ul>
        <div className="nh-drawer-footer">
          <Link href="/wishlist" onClick={closeOverlays}>Wishlist</Link>
          <Link href="/orders" onClick={closeOverlays}>Track Orders</Link>
        </div>
      </aside>
    </>
  );
}
