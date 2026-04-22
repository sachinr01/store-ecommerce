"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../lib/cartContext";
import { useAuth } from "../lib/authContext";
import { formatPrice } from "../lib/price";

const PLACEHOLDER = "/store/images/dummy.jpg";

type MegaLink = { label: string; href: string; };
type MegaColumn = { heading: string; links: MegaLink[]; };
type MegaFeature = { image: string; eyebrow: string; title: string; href: string; };
type MegaMenu = {
  featureGroupLabel?: string;
  columns: MegaColumn[];
  featured: MegaFeature[];
  cta?: MegaLink;
  contentColumns?: 2 | 3;
};

export default function Header() {
  const router = useRouter();
  const { items, count, total, removeItem } = useCart();
  const { user, isLoggedIn } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: number; title: string; price: string; image: string; slug: string }>>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const megaLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) setCartOpen(false);
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setActiveMenu(null);
    };
    const handleResize = () => { if (window.innerWidth >= 992) setMobileMenuOpen(false); };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setCartOpen(false); setSearchOpen(false); setMobileMenuOpen(false); setActiveMenu(null); setSuggestions([]); }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen || searchOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return <>{text.slice(0, idx)}<strong>{text.slice(idx, idx + query.length)}</strong>{text.slice(idx + query.length)}</>;
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    closeOverlays();
    setSuggestions([]);
    router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!value.trim()) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(`/store/api/products?search=${encodeURIComponent(value.trim())}&limit=5`, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const items = (json.data ?? json ?? []).slice(0, 5).map((p: any) => ({
          id: p.ID, title: p.title,
          price: p._sale_price ?? p._regular_price ?? p.price_min ?? '',
          image: p.thumbnail_url ? (p.thumbnail_url.startsWith('http') || p.thumbnail_url.startsWith('/') ? p.thumbnail_url : `/uploads/${p.thumbnail_url}`) : '/store/images/dummy.jpg',
          slug: (p.slug || p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        }));
        setSuggestions(items);
      } catch { setSuggestions([]); }
      finally { setSuggestLoading(false); }
    }, 280);
  };

  const navLinks: Array<{ label: string; href: string; mega?: MegaMenu }> = [
    {
      label: "DRINKWARE", href: "/shop/drinkware",
      mega: {
        columns: [
          { heading: "Highlights", links: [{ label: "New Arrivals", href: "/shop" }, { label: "Best Sellers", href: "/shop" }] },
          { heading: "Featured Styles", links: [{ label: "20oz Skinny Tumbler", href: "/shop/product/20oz-skinny-tumbler" }, { label: "26oz Flex Bottle", href: "/shop/product/26oz-flex-bottle-with-lid" }, { label: "Desk Essentials", href: "/shop" }, { label: "View All Products", href: "/shop" }] },
          { heading: "New Arrivals", links: [{ label: "Hoodies", href: "/shop/product/hoodies" }, { label: "Coffee Mug", href: "/shop/product/coffee-mug" }, { label: "Koozies", href: "/shop/product/koozies" }, { label: "Decals", href: "/shop/product/decals" }, { label: "View All New", href: "/shop" }] },
        ],
        featured: [
          { image: "https://topperskit.com/cdn/shop/files/Untitleddesign_6a4f9d08-7fe8-429b-81e0-b26977ba734b.jpg?v=1745325033&width=713", eyebrow: "Smart Sip Tumbler", title: "Smart Sip Tumbler", href: "/shop/product/20oz-skinny-tumbler" },
          { image: "https://rukminim2.flixcart.com/image/1280/1280/xif0q/sweatshirt/w/w/d/l-flhs001-c-flyind-outfit-original-imahhhrrfpzgmynq.jpeg?q=90", eyebrow: "Hoodie", title: "Urban Style Hoodie", href: "/shop/product/hoodies" },
          { image: "https://rukminim1.flixcart.com/image/1280/1280/kumzpu80/water-purifier-bottle/9/x/1/temperature-display-500-ml-flask-pack-of-1-multicolor-steel-original-imag7q4aqmdgvpus.jpeg?q=90", eyebrow: "Bottle", title: "Bottle Collection", href: "/shop" },
          { image: "https://rukminim1.flixcart.com/image/1280/1280/xif0q/t-shirt/v/z/e/xxl-r-145-warriorworld-original-imahhv9p3zhqntbc.jpeg?q=90", eyebrow: "Tshirt", title: "Tshirt Collection", href: "/shop" },
        ],
        contentColumns: 3,
      },
    },
    {
      label: "GLASSWARE", href: "/shop/glassware",
      mega: {
        columns: [], featureGroupLabel: "Category",
        featured: [
          { image: "https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg", eyebrow: "DRINKWARE", title: "DRINKWARE", href: "#" },
          { image: "https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg", eyebrow: "Dining", title: "GLASSWARE", href: "#" },
          { image: "https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg", eyebrow: "Kitchen", title: "KITCHEN ORGANISERS", href: "#" },
        ],
        contentColumns: 2,
      },
    },
    { label: "KITCHEN ORGANISERS", href: "/shop/jars-and-containers" },
    { label: "ABOUT US", href: "/about-us" },
    { label: "B2B CONNECT", href: "/b2b-connect" },
  ];

  const closeOverlays = () => { setCartOpen(false); setSearchOpen(false); setMobileMenuOpen(false); setActiveMenu(null); };
  const openMega = (label: string) => { if (megaLeaveTimer.current) clearTimeout(megaLeaveTimer.current); setActiveMenu(label); };
  const closeMega = () => { megaLeaveTimer.current = setTimeout(() => setActiveMenu(null), 120); };
  const keepMega = () => { if (megaLeaveTimer.current) clearTimeout(megaLeaveTimer.current); };

  return (
    <>
      <style>{`
        .nh-header { position: sticky; top: 0; z-index: 1000; background: #fff; border-bottom: 1px solid #ececec; }
        .nh-inner { max-width: 1360px; margin: 0 auto; height: 84px; padding: 0 24px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; }
        .nh-left, .nh-right { display: flex; align-items: center; min-width: 0; gap: 12px; }
        .nh-left { justify-content: flex-start; }
        .nh-center { display: flex; align-items: center; justify-content: center; }
        .nh-right { justify-content: flex-end; }
        .nh-logo-link { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
        .nh-logo-image { width: auto; height: 64px; max-width: 280px; object-fit: contain; }
        .nh-nav { display: flex; align-items: center; gap: 24px; list-style: none; margin: 0; padding: 0; min-width: 0; }
        .nh-nav a, .nh-login, .nh-account-link { color: #1b1b1b; text-decoration: none; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
        .nh-nav a:hover, .nh-login:hover, .nh-account-link:hover { color: #555; }
        .nh-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border: none; border-radius: 999px; background: transparent; color: #1b1b1b; cursor: pointer; flex-shrink: 0; }
        .nh-icon-btn:hover { background: #f5f5f5; }
        .nh-mobile-search, .nh-hamburger { display: none; }
        .nh-mobile-search { display: inline-flex !important; }
        .nh-hamburger-lines { display: flex; flex-direction: column; gap: 4px; }
        .nh-hamburger-lines span { display: block; width: 20px; height: 2px; border-radius: 999px; background: currentColor; }
        .nh-account-link { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
        .nh-account-avatar { width: 30px; height: 30px; border-radius: 50%; background: #8fb8a8; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
        .nh-account-text { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
        .nh-cart-wrap { position: relative; flex-shrink: 0; }
        .nh-cart-link { display: inline-flex; align-items: center; gap: 8px; padding: 6px 8px; border: none; background: transparent; color: #1b1b1b; cursor: pointer; text-decoration: none; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
        .nh-cart-label { white-space: nowrap; }
        .nh-cart-badge { position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #111; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; line-height: 1; }
        .nh-cart-dropdown { position: absolute; top: calc(100% + 12px); right: 0; width: 320px; max-width: calc(100vw - 24px); padding: 16px; border: 1px solid #ececec; background: #fff; box-shadow: 0 16px 40px rgba(0,0,0,0.12); opacity: 0; pointer-events: none; transform: translateY(-8px); transition: opacity 0.25s ease, transform 0.25s ease; }
        .nh-cart-dropdown.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .nh-cart-item { display: grid; grid-template-columns: 56px minmax(0,1fr) auto; gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid #f1f1f1; }
        .nh-cart-thumb { width: 56px; height: 60px; object-fit: cover; border-radius: 4px; }
        .nh-cart-item-title { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #111; }
        .nh-cart-item-meta { font-size: 12px; color: #666; }
        .nh-cart-remove { border: none; background: transparent; color: #9b9b9b; cursor: pointer; font-size: 18px; line-height: 1; }
        .nh-cart-empty { margin: 8px 0 16px; font-size: 13px; color: #777; text-align: center; }
        .nh-cart-subtotal { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; font-size: 14px; font-weight: 700; }
        .nh-cart-actions { display: grid; gap: 8px; }
        .nh-cart-action { display: block; padding: 12px; text-align: center; text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; font-weight: 700; }
        .nh-cart-action.view { background: #f1f1f1; color: #111; }
        .nh-cart-action.checkout { background: #111; color: #fff; }
        .nh-search-overlay, .nh-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1100; }
        .nh-search-overlay { display: flex; align-items: flex-start; justify-content: center; padding: 88px 16px 16px; }
        .nh-search-box-wrap { position: relative; width: min(640px, 100%); background: #fff; box-shadow: 0 14px 34px rgba(0,0,0,0.16); overflow: visible; }
        .nh-search-box { width: 100%; display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: #fff; }
        .nh-search-box input { flex: 1; min-width: 0; border: none; outline: none; font-size: 16px; }
        .nh-search-close { border: none; background: transparent; cursor: pointer; color: #777; font-size: 24px; line-height: 1; }
        .nh-search-suggestions { position: absolute; top: 100%; left: 0; right: 0; border: 1px solid #e0e0e0; background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.12); padding: 16px; z-index: 1200; max-height: 480px; overflow-y: auto; }
        .nh-ss-section-title { margin: 0 0 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #9a9083; border-bottom: 1px solid #f0ece7; padding-bottom: 6px; }
        .nh-ss-keywords { display: flex; flex-direction: column; }
        .nh-ss-keyword { display: block; padding: 8px 4px; font-size: 13.5px; color: #1a1a1a; text-decoration: none; border-bottom: 1px solid #f5f2ee; transition: color 0.15s; }
        .nh-ss-keyword:hover { color: #888; }
        .nh-ss-keyword strong { font-weight: 700; }
        .nh-ss-products { display: flex; flex-direction: column; }
        .nh-ss-product { display: grid; grid-template-columns: 56px minmax(0,1fr); gap: 12px; align-items: center; padding: 10px 4px; text-decoration: none; border-bottom: 1px solid #f5f2ee; transition: opacity 0.15s; }
        .nh-ss-product:last-child { border-bottom: none; }
        .nh-ss-product:hover { opacity: 0.72; }
        .nh-ss-thumb { width: 56px; height: 68px; object-fit: cover; background: #f5f3ef; flex-shrink: 0; }
        .nh-ss-product-name { font-size: 13px; color: #1a1a1a; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .nh-ss-product-name strong { font-weight: 700; }
        .nh-drawer { position: fixed; top: 0; left: 0; bottom: 0; width: min(320px, calc(100vw - 32px)); background: #fff; z-index: 1200; transform: translateX(-100%); transition: transform 0.25s ease; display: flex; flex-direction: column; }
        .nh-drawer.open { transform: translateX(0); }
        .nh-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #ececec; }
        .nh-drawer-nav { list-style: none; margin: 0; padding: 8px 0; }
        .nh-drawer-nav a { display: block; padding: 14px 20px; color: #111; text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; font-weight: 700; border-bottom: 1px solid #f3f3f3; }
        .nh-drawer-footer { margin-top: auto; padding: 16px 20px 24px; border-top: 1px solid #ececec; display: grid; gap: 10px; }
        .nh-drawer-footer a { color: #444; text-decoration: none; font-size: 13px; font-weight: 600; }
        /* Mega menu */
        .nh-mega-wrap { position: static; }
        .nh-mega-trigger { display: flex; align-items: center; gap: 4px; cursor: pointer; background: none; border: none; padding: 0; color: #1b1b1b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; text-decoration: none; }
        .nh-mega-trigger:hover { color: #555; }
        .nh-mega-trigger svg { transition: transform 0.2s; }
        .nh-mega-trigger.open svg { transform: rotate(180deg); }
        .nh-mega-panel { position: absolute; top: calc(100% - 1px); left: 0; right: 0; background: #fff; border-top: 1px solid #ececec; border-bottom: 1px solid #ececec; box-shadow: 0 12px 40px rgba(0,0,0,0.08); opacity: 0; pointer-events: none; transform: translateY(-6px); transition: opacity 0.22s ease, transform 0.22s ease; z-index: 900; }
        .nh-mega-panel.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .nh-mega-inner { max-width: 1360px; margin: 0 auto; padding: 28px 48px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
        .nh-mega-inner.collections-only { grid-template-columns: 1fr; max-width: 600px; }
        .nh-mega-content { min-width: 0; }
        .nh-mega-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .nh-mega-cta { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #1b1b1b; text-decoration: none; white-space: nowrap; }
        .nh-mega-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 28px; padding-top: 18px; border-top: 1px solid #f0ece7; }
        .nh-mega-grid.cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); max-width: 720px; }
        .nh-mega-grid.cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
        .nh-mega-col-heading { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; margin: 0 0 16px; }
        .nh-mega-col ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .nh-mega-col ul a { font-size: 14px; font-weight: 500; color: #1b1b1b; text-decoration: none; letter-spacing: 0.01em; transition: color 0.15s; }
        .nh-mega-col ul a:hover { color: #888; }
        .nh-mega-feature-block { min-width: 0; }
        .nh-mega-feature-group-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; margin: 0 0 16px; }
        .nh-mega-featured-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 26px; align-content: start; }
        .nh-mega-inner:not(.collections-only) .nh-mega-featured-grid { grid-template-rows: repeat(2, minmax(0,1fr)); gap: 10px; }
        .nh-mega-featured { position: relative; overflow: hidden; min-height: 390px; background: #f6f2ed; }
        .nh-mega-inner:not(.collections-only) .nh-mega-featured { min-height: 180px; }
        .nh-mega-inner.collections-only .nh-mega-featured { min-height: 160px; }
        .nh-mega-featured img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
        .nh-mega-featured:hover img { transform: scale(1.04); }
        .nh-mega-featured-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 28px 14px 14px; background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%); display: flex; flex-direction: column; gap: 3px; z-index: 2; }
        .nh-mega-featured-title { font-size: 13px; font-weight: 700; color: #fff; letter-spacing: 0.02em; line-height: 1.3; }
        @media (max-width: 1199px) { .nh-inner { padding: 0 18px; gap: 12px; } .nh-nav { gap: 18px; } .nh-account-text { max-width: 84px; } .nh-mega-inner { padding: 20px 36px 24px; grid-template-columns: 1fr; gap: 28px; } .nh-mega-grid { gap: 20px; } }
        @media (max-width: 991px) { .nh-inner { grid-template-columns: auto 1fr auto; height: 72px; padding: 0 12px; gap: 10px; } .nh-left { flex: 0 0 auto; } .nh-center, .nh-nav, .nh-mega-panel, .nh-login-label { display: none; } .nh-hamburger, .nh-mobile-search { display: inline-flex; } .nh-right { gap: 4px; } .nh-icon-btn { width: 34px; height: 34px; } .nh-logo-image { height: 52px; max-width: min(240px, 100%); } .nh-account-link, .nh-cart-link { padding: 6px; } .nh-account-text, .nh-cart-label { display: none; } }
        @media (max-width: 575px) { .nh-inner { height: 64px; padding: 0 10px; gap: 8px; } .nh-logo-image { height: 44px; max-width: 200px; } .nh-cart-dropdown { right: -6px; width: min(300px, calc(100vw - 20px)); padding: 14px; } .nh-search-overlay { padding-top: 72px; } }
      `}</style>

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
            <button type="button" className="nh-icon-btn nh-mobile-search" onClick={() => setSearchOpen(true)} aria-label="Open search">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>

            {isLoggedIn && user ? (
              <Link href="/my-account" className="nh-account-link" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </Link>
            ) : (
              <Link href="/my-account" className="nh-account-link nh-login" onClick={() => setCartOpen(false)}>
                <span className="nh-account-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                <span className="nh-login-label">Login</span>
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
                        <Image src={item.image || PLACEHOLDER} alt={item.title} width={56} height={60} className="nh-cart-thumb"/>
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
                  <Link href="/cart" className="nh-cart-action view" onClick={closeOverlays}>View Cart</Link>
                  <Link href="/checkout" className="nh-cart-action checkout" onClick={closeOverlays}>Checkout</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="nh-search-overlay" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSuggestions([]); }}>
          <div className="nh-search-box-wrap" onClick={e => e.stopPropagation()}>
            <form className="nh-search-box" onSubmit={handleSearchSubmit}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} type="text" placeholder="Search products..." value={searchQuery} onChange={e => handleSearchChange(e.target.value)}/>
              <button type="button" className="nh-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSuggestions([]); }} aria-label="Close search">×</button>
            </form>
            {(suggestions.length > 0 || suggestLoading) && (
              <div className="nh-search-suggestions">
                {suggestLoading && <p className="nh-ss-section-title">Searching...</p>}
                {!suggestLoading && suggestions.length > 0 && (
                  <>
                    <p className="nh-ss-section-title">Search Suggestions</p>
                    <div className="nh-ss-keywords">
                      {suggestions.slice(0, 4).map(s => (
                        <Link key={`kw-${s.id}`} href={`/shop?search=${encodeURIComponent(s.title)}`} className="nh-ss-keyword"
                          onClick={() => { closeOverlays(); setSuggestions([]); setSearchQuery(''); }}>
                          {highlight(s.title, searchQuery)}
                        </Link>
                      ))}
                    </div>
                    <p className="nh-ss-section-title" style={{ marginTop: 14 }}>Product Suggestions</p>
                    <div className="nh-ss-products">
                      {suggestions.map(s => (
                        <Link key={`prod-${s.id}`} href={`/shop/product/${s.slug}`} className="nh-ss-product"
                          onClick={() => { closeOverlays(); setSuggestions([]); setSearchQuery(''); }}>
                          <img src={s.image} alt={s.title} className="nh-ss-thumb" onError={e => { (e.target as HTMLImageElement).src = '/store/images/dummy.jpg'; }}/>
                          <span className="nh-ss-product-name">{highlight(s.title, searchQuery)}</span>
                        </Link>
                      ))}
                    </div>
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
