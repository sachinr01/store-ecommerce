'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getProducts, type Product } from '../lib/api';

// Placeholder shown when a product has no image URL in the DB
const PLACEHOLDER = '/store/images/dummy.png';

function ShopProductCard({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState<number | null>(null);

  const isOnSale =
    product.sale_price_min !== null &&
    product.price_min !== null &&
    product.sale_price_min < product.price_min;

  const displayPrice = Number(product.price_min ?? 0);
  const oldPrice     = isOnSale ? product.price_max : undefined;

  const iconActions = [
    { icon: 'fa-search',       title: 'Quick View' },
    { icon: 'fa-shopping-cart',title: 'Add to Cart' },
    { icon: 'fa-heart',        title: 'Wishlist' },
    { icon: 'fa-share-alt',    title: 'Share' },
  ];

  return (
    <li
      className="dima-product ok-md-3 ok-xsd-12 ok-sd-6"
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredIcon(null); }}
    >
      {/* Image + overlay */}
      <div className="product-img">
        <div className="fix-chrome" style={{ position: 'relative', overflow: 'hidden', display: 'block' }}>
          <figure style={{ margin: 0, display: 'block', lineHeight: 0 }}>
            <img
              src={PLACEHOLDER}
              alt={product.title}
              style={{
                width: '100%',
                display: 'block',
                transition: 'transform 0.4s ease',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          </figure>

          {/* Teal hover overlay */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: hovered ? 'rgba(0,191,165,0.72)' : 'rgba(0,191,165,0)',
            transition: 'background 0.32s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            {/* Border frame */}
            <div style={{
              position: 'absolute', top: 10, left: 10, right: 10, bottom: 10,
              border: '1px solid rgba(255,255,255,0.7)',
              opacity: hovered ? 1 : 0, transition: 'opacity 0.35s ease',
              pointerEvents: 'none', zIndex: 11,
            }} />

            {/* Icon grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '50px 50px', gridTemplateRows: '50px 50px',
              gap: 20,
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              zIndex: 20,
            }}>
              {iconActions.map((action, i) => (
                <a key={i} href="#" title={action.title}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 50, height: 50,
                    border: '1px solid #fff',
                    color: hoveredIcon === i ? '#00bfa5' : '#fff',
                    background: hoveredIcon === i ? '#fff' : 'transparent',
                    fontSize: 18, textDecoration: 'none',
                    transition: 'background 0.2s ease, color 0.2s ease',
                  }}
                  onMouseEnter={() => setHoveredIcon(i)}
                  onMouseLeave={() => setHoveredIcon(null)}
                  onClick={e => e.stopPropagation()}
                >
                  <i className={`fa ${action.icon}`} />
                </a>
              ))}
            </div>
          </div>

          {isOnSale && (
            <span className="onsale"><span>SALE</span></span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="product-content">
        <Link href={`/product-details?id=${product.ID}`}>
          <h5 className="product-name">{product.title}</h5>
        </Link>
        <div className="rating">
          <span /><span /><span /><span /><span className="star" />
        </div>
      </div>

      {/* Price */}
      <span className="price text-center">
        {oldPrice && (
          <del><span className="amount">${Number(oldPrice).toFixed(2)}</span></del>
        )}
        <ins>
          <span className="amount">
            {product.price_min !== null && product.price_max !== null && Number(product.price_min) !== Number(product.price_max)
              ? `$${Number(product.price_min).toFixed(2)} – $${Number(product.price_max).toFixed(2)}`
              : `$${displayPrice.toFixed(2)}`}
          </span>
        </ins>
      </span>
    </li>
  );
}

export default function ShopPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [sortBy, setSortBy]       = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default');
  const [filterStock, setFilterStock] = useState<'all' | 'instock'>('all');

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

  return (
    <>
      <Header />
      <div className="dima-main">

        {/* Breadcrumb */}
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">Shop</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">Shop</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">

              {/* Toolbar */}
              <div className="ok-row" style={{ marginBottom: 24, alignItems: 'center' }}>
                <div className="ok-md-6 ok-xsd-12">
                  {!loading && (
                    <p style={{ margin: 0 }}>
                      Showing <strong>{sorted.length}</strong> product{sorted.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="ok-md-6 ok-xsd-12" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {/* Stock filter */}
                  <select
                    className="orderby"
                    value={filterStock}
                    onChange={e => setFilterStock(e.target.value as 'all' | 'instock')}
                    style={{ minWidth: 140 }}
                  >
                    <option value="all">All products</option>
                    <option value="instock">In stock only</option>
                  </select>

                  {/* Sort */}
                  <select
                    className="orderby"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    style={{ minWidth: 160 }}
                  >
                    <option value="default">Default sorting</option>
                    <option value="name">Sort by name</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                  </select>
                </div>
              </div>

              {/* States */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <p>Loading products...</p>
                </div>
              )}

              {error && (
                <div className="dima-alert dima-alert-info" style={{ padding: '20px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4 }}>
                  <i className="fa fa-warning" style={{ marginRight: 8 }} />
                  <strong>Could not load products</strong>
                  <p style={{ margin: '8px 0 0', fontFamily: 'monospace', fontSize: 13 }}>{error}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#666' }}>
                    Make sure the backend is running on <code>http://localhost:3000</code> and check the browser console.
                  </p>
                </div>
              )}

              {/* Product grid */}
              {!loading && !error && (
                <>
                  {sorted.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <p>No products found.</p>
                    </div>
                  ) : (
                    <ul className="rows ok-row products-grids" id="rows">
                      {sorted.map(product => (
                        <ShopProductCard key={product.ID} product={product} />
                      ))}
                    </ul>
                  )}
                </>
              )}

            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
