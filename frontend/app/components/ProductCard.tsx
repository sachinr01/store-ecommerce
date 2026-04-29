"use client";

import { useState } from "react";
import Link from "next/link";
import "./ProductCard.css";

interface ProductCardProps {
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  onSale?: boolean;
  delay?: number;
  category?: string;
  stockStatus?: string | null;
}




export default function ProductCard({
  name,
  price,
  oldPrice,
  image,
  onSale,
  delay,
  category,
  stockStatus,
}: ProductCardProps) {
  const isOutOfStock = stockStatus != null && stockStatus !== 'instock' && stockStatus !== 'onbackorder';
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className={`dima-product ok-md-3 ok-xsd-12 ok-sd-6 ${category || ""}`}
      data-animate="fadeIn"
      data-delay={delay || 0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Product Image + Hover Overlay ── */}
      <div className="product-img">
        <div className="fix-chrome pc-img-wrap">
          <figure className="pc-figure">
            <img
              src={image}
              alt={name}
              className={hovered ? "hovered" : "idle"}
            />
          </figure>

          {/* ── View Product overlay ── */}
          <div className={`pc-overlay${hovered ? " hovered" : ""}`}>
            <div className={`pc-border-frame${hovered ? " hovered" : ""}`} />
            <div className={`pc-icon-grid${hovered ? " hovered" : ""}`}>
              <a href="#" className="btn-view-product" style={{ gridColumn: 'span 2' }}>View Product</a>
            </div>
          </div>

          {/* ── SALE badge ── */}
          {onSale && <span className="onsale"><span>SALE</span></span>}
          {/* ── OUT OF STOCK badge ── */}
          {isOutOfStock && <span className="pc-oos-badge">Sold Out</span>}
        </div>
      </div>

      {/* ── Product Info ── */}
      <div className="product-content">
        <Link href="/shop-product-detail-right-sidebar.html">
          <h5 className="product-name">{name}</h5>
        </Link>
        <div className="rating">
          <span></span><span></span><span></span><span></span>
          <span className="star"></span>
        </div>
      </div>

      {/* ── Price ── */}
      <span className="price text-center">
        {oldPrice && (
          <del><span className="amount">${oldPrice.toFixed(2)}</span></del>
        )}
        <ins><span className="amount">${price.toFixed(2)}</span></ins>
      </span>
    </li>
  );
}
