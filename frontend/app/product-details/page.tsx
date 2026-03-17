'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getProductById, type ProductDetail } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useWishlist } from '../lib/wishlistContext';
import './product-details.css';

const PLACEHOLDER = '/store/images/dummy.png';

function ProductDetails() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [product, setProduct]   = useState<ProductDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize]   = useState('');
  const [quantity, setQuantity]           = useState(1);
  const [activeTab, setActiveTab]         = useState('description');
  const [mainImage, setMainImage]         = useState(0);
  const [showFullDesc, setShowFullDesc]   = useState(false);
  const [zoomPos, setZoomPos]             = useState({ x: 0, y: 0 });
  const [isZooming, setIsZooming]         = useState(false);

  useEffect(() => {
    if (!id) { setError('No product ID provided.'); setLoading(false); return; }
    getProductById(id)
      .then(data => { setProduct(data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <>
      <Header />
      <div className="dima-main" style={{ textAlign: 'center', padding: '80px 0' }}>
        <p>Loading product...</p>
      </div>
      <Footer />
    </>
  );

  if (error || !product) return (
    <>
      <Header />
      <div className="dima-main" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <p style={{ color: '#c00' }}>{error || 'Product not found.'}</p>
        <Link href="/shop">← Back to Shop</Link>
      </div>
      <Footer />
    </>
  );

  // Derive price from selected variation — match on whichever attributes are selected
  const selectedVariation = product.variations.find(v => {
    const colorMatch = !selectedColor || (v.color ?? '').toLowerCase() === selectedColor.toLowerCase();
    const sizeMatch  = !selectedSize  || (v.size  ?? '').toLowerCase() === selectedSize.toLowerCase();
    return colorMatch && sizeMatch;
  });

  // If only one attribute type exists, a partial selection is enough
  const hasColors = product.variations.some(v => v.color);
  const hasSizes  = product.variations.some(v => v.size);

  const bestMatch = selectedVariation
    ?? (!hasSizes  && selectedColor ? product.variations.find(v => (v.color ?? '').toLowerCase() === selectedColor.toLowerCase()) : undefined)
    ?? (!hasColors && selectedSize  ? product.variations.find(v => (v.size  ?? '').toLowerCase() === selectedSize.toLowerCase())  : undefined);

  const currentPrice     = bestMatch ? Number(bestMatch.price || bestMatch.regular_price || 0) || null : null;
  const currentSalePrice = bestMatch?.sale_price && bestMatch.sale_price !== '' ? Number(bestMatch.sale_price) : null;

  const priceMin = Number(product.price_min ?? 0);
  const priceMax = Number(product.price_max ?? 0);

  // Simple product (no variations) — price lives on the parent
  const simplePrice     = !product.variations.length && product.price && product.price !== ''
    ? Number(product.price) : null;
  const simpleSalePrice = !product.variations.length && product.sale_price && product.sale_price !== ''
    ? Number(product.sale_price) : null;

  const displayPrice     = currentPrice ?? simplePrice ?? priceMin;
  const displaySalePrice = currentSalePrice ?? simpleSalePrice ?? null;

  const { addItem } = useCart();
  const { addItem: addToWishlist, hasItem: inWishlist } = useWishlist();
  const isAddToCartEnabled = !product.variations.length || (selectedColor || !hasColors) && (selectedSize || !hasSizes);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    });
  };

  const shortDesc = product.short_description?.replace(/<[^>]+>/g, '') || '';
  const fullDesc  = product.description?.replace(/<[^>]+>/g, '')       || '';

  return (
    <>
      <Header />
      <div className="dima-main">
        {/* Breadcrumb */}
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">{product.title}</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span><Link href="/shop">Shop</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">{product.title}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">

                {/* Left — Images */}
                <div className="ok-md-5 ok-xsd-12">
                  <div className="product-images-wrapper">
                    <div className="product-gallery-container">
                      {/* Thumbnails — just show the same placeholder for now */}
                      <div className="product-thumbnails-vertical">
                        {[0].map(idx => (
                          <div key={idx} onClick={() => setMainImage(idx)} className={mainImage === idx ? 'active' : ''}>
                            <img src={PLACEHOLDER} alt={product.title} />
                          </div>
                        ))}
                      </div>

                      {/* Main image with zoom */}
                      <div
                        className="product-main-image"
                        onMouseMove={handleMouseMove}
                        onMouseEnter={() => setIsZooming(true)}
                        onMouseLeave={() => setIsZooming(false)}
                      >
                        <img src={PLACEHOLDER} alt={product.title} />
                        {isZooming && (
                          <div
                            className="zoom-overlay"
                            style={{
                              backgroundImage: `url(${PLACEHOLDER})`,
                              backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                            }}
                          />
                        )}
                        <div className="zoom-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            width="18" height="18">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right — Info */}
                <div className="ok-md-7 ok-xsd-12">
                  <div className="product-summary">
                    <h1 className="product-title">{product.title}</h1>

                    {shortDesc && (
                      <div className="product-description">
                        <p>{showFullDesc ? shortDesc : shortDesc.substring(0, 200) + (shortDesc.length > 200 ? '...' : '')}</p>
                        {shortDesc.length > 200 && (
                          <a href="#" onClick={e => { e.preventDefault(); setShowFullDesc(!showFullDesc); }} className="read-more-link">
                            {showFullDesc ? 'READ LESS' : 'READ MORE'}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Colors */}
                    {product.attributes.colors.length > 0 && (
                      <div className="product-option">
                        <label className="option-label">Color{selectedColor && `: ${selectedColor}`}</label>
                        <div className="color-swatches">
                          {product.attributes.colors.map(c => (
                            <button
                              key={c.attr_id}
                              title={c.attr_name}
                              onClick={() => setSelectedColor(selectedColor === c.attr_slug ? '' : c.attr_slug)}
                              className={`color-swatch ${selectedColor === c.attr_slug ? 'active' : ''} ${!c.in_stock ? 'disabled' : ''}`}
                              style={{ backgroundColor: c.attr_slug }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sizes */}
                    {product.attributes.sizes.length > 0 && (
                      <div className="product-option">
                        <div className="option-header">
                          <label className="option-label">Size</label>
                          {selectedSize && (
                            <a href="#" onClick={e => { e.preventDefault(); setSelectedSize(''); }} className="clear-link">Clear</a>
                          )}
                        </div>
                        <div className="size-buttons">
                          {product.attributes.sizes.map(s => (
                            <button
                              key={s.attr_id}
                              onClick={() => setSelectedSize(selectedSize === s.attr_slug ? '' : s.attr_slug)}
                              disabled={!s.in_stock}
                              className={`size-button ${selectedSize === s.attr_slug ? 'active' : ''} ${!s.in_stock ? 'disabled' : ''}`}
                            >
                              {s.attr_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Price */}
                    <div className="product-price">
                      {displaySalePrice ? (
                        <>
                          <del style={{ opacity: 0.5, marginRight: 8 }}>${Number(displayPrice).toFixed(2)}</del>
                          <span style={{ color: '#e53935' }}>${displaySalePrice.toFixed(2)}</span>
                        </>
                      ) : displayPrice ? (
                        <span>${Number(displayPrice).toFixed(2)}</span>
                      ) : priceMax > priceMin ? (
                        <>
                          <span>${priceMin.toFixed(2)}</span>
                          <span className="price-separator">–</span>
                          <span>${priceMax.toFixed(2)}</span>
                        </>
                      ) : (
                        <span>${priceMin.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Quantity + Add to Cart */}
                    <div className="cart-section">
                      <div className="quantity-wrapper">
                        <label className="quantity-label">Quantity</label>
                        <div className="quantity-selector">
                          <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                          <input
                            type="number" value={quantity} className="qty-input"
                            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <button className="qty-btn" onClick={() => setQuantity(quantity + 1)}>+</button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!isAddToCartEnabled) return;
                          addItem({
                            id: product.ID,
                            variationId: bestMatch?.ID,
                            title: product.title,
                            price: displaySalePrice ?? displayPrice,
                            color: selectedColor || undefined,
                            size: selectedSize || undefined,
                            quantity,
                            image: '/images/dummy.png',
                          });
                          alert(`Added ${quantity} × ${product.title} to cart`);
                        }}
                        disabled={!isAddToCartEnabled}
                        className="add-to-cart-button"
                      >
                        ADD TO CART
                      </button>
                      <button
                        onClick={() => addToWishlist({
                          id: product.ID,
                          title: product.title,
                          price: Number(displaySalePrice ?? displayPrice) || 0,
                          image: PLACEHOLDER,
                          inStock: bestMatch?.stock_status === 'instock' || product.stock_status === 'instock',
                        })}
                        className="add-to-cart-button"
                        style={{ marginLeft: 8, background: inWishlist(product.ID) ? '#e53935' : '#757575' }}
                        title={inWishlist(product.ID) ? 'In Wishlist' : 'Add to Wishlist'}
                      >
                        <i className={`fa fa-heart${inWishlist(product.ID) ? '' : '-o'}`} />
                        {' '}{inWishlist(product.ID) ? 'WISHLISTED' : 'WISHLIST'}
                      </button>
                    </div>

                    {/* Meta */}
                    <div className="product-meta">
                      {(bestMatch?.sku || product.sku) && (
                        <div className="meta-item">
                          <strong>SKU:</strong> <span>{bestMatch?.sku || product.sku}</span>
                        </div>
                      )}
                      {selectedColor && selectedSize && bestMatch && (
                        <div className="meta-item" style={{ marginTop: 8 }}>
                          <strong>Stock:</strong>{' '}
                          <span style={{ color: bestMatch.stock_status === 'instock' ? '#2e7d32' : '#c62828' }}>
                            {bestMatch.stock_status === 'instock' ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      )}
                      {selectedColor && selectedSize && bestMatch && (
                        <div className="meta-item" style={{ marginTop: 8 }}>
                          <strong>Variation:</strong>{' '}
                          <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}>
                            #{bestMatch.ID}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="double-clear"></div>
              <div className="product-tabs">
                <nav role="navigation" className="filters-box filters">
                  <ul>
                    {['description', 'reviews'].map(tab => (
                      <li key={tab}>
                        <a href="#" onClick={e => { e.preventDefault(); setActiveTab(tab); }}
                          className={activeTab === tab ? 'show-all' : ''}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="tab-content box dima-box">
                  {activeTab === 'description' && (
                    <div>
                      <h3 className="undertitle">Product Description</h3>
                      <div className="clear-section"></div>
                      <p className="app">{fullDesc || shortDesc || 'No description available.'}</p>
                    </div>
                  )}
                  {activeTab === 'reviews' && (
                    <div>
                      <h3 className="undertitle">Customer Reviews</h3>
                      <div className="clear-section"></div>
                      <p>No reviews yet.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}

export default function ProductDetailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}>Loading...</div>}>
      <ProductDetails />
    </Suspense>
  );
}
