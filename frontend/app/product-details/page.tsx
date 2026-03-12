'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './product-details.css';

export default function ProductDetailsPage() {
  const [selectedColor, setSelectedColor] = useState('Blue');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [mainImage, setMainImage] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isZooming, setIsZooming] = useState(false);

  // Initialize header scripts
  useEffect(() => {
    // Ensure jQuery and scripts are loaded
    const initializeHeader = () => {
      if (typeof window !== 'undefined' && (window as any).jQuery) {
        // Scripts are already loaded from layout
        console.log('Header scripts initialized');
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeHeader, 100);
    return () => clearTimeout(timer);
  }, []);

  // Product data
  const product = {
    name: 'HOODIES',
    priceRange: { min: 49.00, max: 57.00 },
    sku: 'OC-HOODIE-001',
    shortDescription: 'Whether you\'re the Captain, Crew, Ocean Dweller, or avid Beach Bum, these performance hoodies will provide outstanding style comfort and important Sun Protection while enjoying your favorite activities in and around our Oceans. Display your passion for the Sea proudly with Ocean Cowboy Branded Apparel!!!',
    
    images: [
      'https://www.oceancowboy.com/wp-content/uploads/2023/03/Main-5.jpg',
      'https://www.oceancowboy.com/wp-content/uploads/2023/03/Front-5.jpg',
      'https://www.oceancowboy.com/wp-content/uploads/2023/03/Back-5.jpg',
      'https://www.oceancowboy.com/wp-content/uploads/2023/11/4-lifestyle-3-1.jpg',
    ],

    colors: [
      { name: 'Blue', hex: '#5dade2', available: true, image: 'https://www.oceancowboy.com/wp-content/uploads/2020/09/Hoodies-Blue-Front.jpg' },
      { name: 'White', hex: '#ffffff', available: true, image: 'https://www.oceancowboy.com/wp-content/uploads/2020/09/Hoodies-White-Front.jpg' },
      { name: 'Blue Ocean Camo', hex: '#4a90a4', available: true, image: 'https://www.oceancowboy.com/wp-content/uploads/2020/09/Hoodies-Camo-Front.jpg' },
      { name: 'Navy', hex: '#34495e', available: true, image: 'https://www.oceancowboy.com/wp-content/uploads/2020/09/Hoodies-Navy-Front.jpg' },
      { name: 'White Ocean Camo', hex: '#ecf0f1', available: true, image: 'https://www.oceancowboy.com/wp-content/uploads/2020/09/Hoodies-White-Camo-Front.jpg' },
    ],

    sizes: [
      { name: 'S', available: true, price: 49.00 },
      { name: 'M', available: true, price: 49.00 },
      { name: 'L', available: true, price: 51.00 },
      { name: 'XL', available: true, price: 53.00 },
      { name: '2XL', available: true, price: 55.00 },
      { name: '3XL', available: true, price: 57.00 },
    ],

    features: [
      'Smooth Close Knit, Anti-Snag Material',
      'Made in America',
      'UPF 40+ Sun Protection',
      'Cool Dry Material',
      'Full Custom Dye Sublimation Print',
      'Sizes S-2XL',
      'Crew Neck',
    ],

    specifications: {
      'Material': '100% Performance Polyester',
      'Weight': '8.5 oz',
      'Care': 'Machine wash cold, tumble dry low',
      'Origin': 'Made in USA',
      'UV Protection': 'UPF 40+',
      'Fit': 'Regular fit',
    },

    reviews: [
      {
        id: 1,
        author: 'John D.',
        rating: 5,
        date: '2026-02-15',
        verified: true,
        comment: 'Great quality hoodie! The sun protection is excellent and it\'s very comfortable.',
      },
      {
        id: 2,
        author: 'Sarah M.',
        rating: 4,
        date: '2026-02-10',
        verified: true,
        comment: 'Love the design and fit. Runs slightly large but overall very happy with the purchase.',
      },
    ],
  };

  const getCurrentPrice = () => {
    if (selectedSize) {
      const sizeData = product.sizes.find(s => s.name === selectedSize);
      return sizeData?.price || product.priceRange.min;
    }
    return null;
  };

  const isAddToCartEnabled = selectedColor && selectedSize;

  const handleAddToCart = () => {
    if (isAddToCartEnabled) {
      alert(`Added ${quantity} x ${product.name} (${selectedColor}, ${selectedSize}) to cart!`);
    }
  };

  const handleColorChange = (colorName: string) => {
    setSelectedColor(colorName);
    const colorData = product.colors.find(c => c.name === colorName);
    if (colorData?.image) {
      setMainImage(0);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    setIsZooming(false);
  };

  return (
    <>
      <Header />
      <div className="dima-main">
        {/* Breadcrumb */}
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">{product.name}</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span>
                  <Link href="/" className="trail-begin">Home</Link>
                </span>
                <span className="sep">\</span>
                <span>
                  <Link href="#">Shop</Link>
                </span>
                <span className="sep">\</span>
                <span className="trail-end">{product.name}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Product Details */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {/* Left Column - Images */}
                <div className="ok-md-5 ok-xsd-12">
                  <div className="product-images-wrapper">
                    {/* Thumbnail Images - Vertical on Left */}
                    <div className="product-gallery-container">
                      <div className="product-thumbnails-vertical">
                        {product.images.map((img, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setMainImage(idx)}
                            className={mainImage === idx ? 'active' : ''}
                          >
                            <img 
                              src={img} 
                              alt={`View ${idx + 1}`}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Main Image */}
                      <div 
                        className="product-main-image"
                        onMouseMove={handleMouseMove}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <img 
                          src={product.images[mainImage]} 
                          alt={product.name}
                        />
                        
                        {/* Zoomed Image Overlay */}
                        {isZooming && (
                          <div 
                            className="zoom-overlay"
                            style={{
                              backgroundImage: `url(${product.images[mainImage]})`,
                              backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                            }}
                          />
                        )}
                        
                        {/* Zoom Icon */}
                        <div className="zoom-icon">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            width="18"
                            height="18"
                          >
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Product Info */}
                <div className="ok-md-7 ok-xsd-12">
                  <div className="product-summary">
                    {/* Brand Logo - Top Right */}
                    {/* <div className="brand-logo-container">
                      <img 
                        src="/images/okab_ecommerce_logo.png" 
                        alt="Ocean Cowboy" 
                        className="brand-logo"
                      />
                    </div> */}

                    {/* Product Title */}
                    <h1 className="product-title">{product.name}</h1>

                    {/* Short Description */}
                    <div className="product-description">
                      <p>
                        {showFullDescription 
                          ? product.shortDescription 
                          : product.shortDescription.substring(0, 200) + '...'}
                      </p>
                      <a 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowFullDescription(!showFullDescription);
                        }}
                        className="read-more-link"
                      >
                        {showFullDescription ? 'READ LESS' : 'READ MORE'}
                      </a>
                    </div>

                    {/* Color Selection */}
                    <div className="product-option">
                      <label className="option-label">Color</label>
                      <div className="color-swatches">
                        {product.colors.map((color) => (
                          <button
                            key={color.name}
                            onClick={() => color.available && handleColorChange(color.name)}
                            disabled={!color.available}
                            title={color.name}
                            className={`color-swatch ${selectedColor === color.name ? 'active' : ''} ${!color.available ? 'disabled' : ''} ${color.hex === '#ffffff' || color.hex === '#ecf0f1' ? 'white-border' : ''}`}
                            style={{ backgroundColor: color.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Size Selection */}
                    <div className="product-option">
                      <div className="option-header">
                        <label className="option-label">Size</label>
                        {selectedSize && (
                          <a 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedSize('');
                            }}
                            className="clear-link"
                          >
                            Clear
                          </a>
                        )}
                      </div>
                      <div className="size-buttons">
                        {product.sizes.map((size) => (
                          <button
                            key={size.name}
                            onClick={() => size.available && setSelectedSize(size.name)}
                            disabled={!size.available}
                            className={`size-button ${selectedSize === size.name ? 'active' : ''} ${!size.available ? 'disabled' : ''}`}
                          >
                            {size.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="product-price">
                      {getCurrentPrice() ? (
                        <span>${getCurrentPrice()?.toFixed(2)}</span>
                      ) : (
                        <>
                          <span>${product.priceRange.min.toFixed(2)}</span>
                          <span className="price-separator">–</span>
                          <span>${product.priceRange.max.toFixed(2)}</span>
                        </>
                      )}
                    </div>

                    {/* Notify Me Button (if out of stock) */}
                    {selectedColor && selectedSize && (
                      <div className="notify-section">
                        <button className="notify-button">
                          NOTIFY ME
                        </button>
                      </div>
                    )}

                    {/* Quantity & Add to Cart */}
                    <div className="cart-section">
                      <div className="quantity-wrapper">
                        <label className="quantity-label">Quantity</label>
                        <div className="quantity-selector">
                          <button 
                            className="qty-btn"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="qty-input"
                          />
                          <button 
                            className="qty-btn"
                            onClick={() => setQuantity(quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleAddToCart}
                        disabled={!isAddToCartEnabled}
                        className="add-to-cart-button"
                      >
                        ADD TO CART
                      </button>
                    </div>

                    {/* Product Meta */}
                    <div className="product-meta">
                      <div className="meta-item">
                        <strong>SKU:</strong> <span>{product.sku}</span>
                      </div>
                      <div className="meta-item">
                        <strong>Category:</strong> <a href="#">Hoodies</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Tabs */}
              <div className="double-clear"></div>
              <div className="product-tabs">
                {/* Tab Headers */}
                <nav role="navigation" className="filters-box filters">
                  <ul>
                    <li>
                      <a 
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActiveTab('description'); }}
                        className={activeTab === 'description' ? 'show-all' : ''}
                      >
                        Description
                      </a>
                    </li>
                    <li>
                      <a 
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActiveTab('specifications'); }}
                        className={activeTab === 'specifications' ? 'show-all' : ''}
                      >
                        Specifications
                      </a>
                    </li>
                    <li>
                      <a 
                        href="#"
                        onClick={(e) => { e.preventDefault(); setActiveTab('reviews'); }}
                        className={activeTab === 'reviews' ? 'show-all' : ''}
                      >
                        Reviews ({product.reviews.length})
                      </a>
                    </li>
                  </ul>
                </nav>

                {/* Tab Content */}
                <div className="tab-content box dima-box">
                  {activeTab === 'description' && (
                    <div>
                      <h3 className="undertitle">Product Description</h3>
                      <div className="clear-section"></div>
                      <p className="app">
                        {product.shortDescription}
                      </p>
                      <div className="clear-section"></div>
                      <h4>Key Features:</h4>
                      <ul className="with-border">
                        {product.features.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'specifications' && (
                    <div>
                      <h3 className="undertitle">Product Specifications</h3>
                      <div className="clear-section"></div>
                      <table className="order-products-table">
                        <tbody>
                          {Object.entries(product.specifications).map(([key, value]) => (
                            <tr key={key}>
                              <td className="product-name">
                                <strong>{key}</strong>
                              </td>
                              <td className="product-total">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === 'reviews' && (
                    <div>
                      <h3 className="undertitle">Customer Reviews</h3>
                      <div className="clear-section"></div>
                      {product.reviews.map((review) => (
                        <div key={review.id} className="review-box">
                          <div className="review-header">
                            <div>
                              <span className="review-author">{review.author}</span>
                              {review.verified && (
                                <span className="verified-badge">
                                  <i className="fa fa-check-circle"></i> Verified Purchase
                                </span>
                              )}
                            </div>
                            <span className="review-date">{review.date}</span>
                          </div>
                          <div className="review-rating rating">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star}></span>
                            ))}
                          </div>
                          <p className="review-comment">{review.comment}</p>
                        </div>
                      ))}
                      <div className="clear-section"></div>
                      <a data-animated-link="fadeOut" href="#" className="button fill uppercase">
                        <i className="fa fa-pencil"></i> Write a Review
                      </a>
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
