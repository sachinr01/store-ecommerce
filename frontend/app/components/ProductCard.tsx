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
}

const iconActions = [
  { icon: "fa-search", title: "View Product", href: "#" },
  { icon: "fa-shopping-cart", title: "Add to Cart", href: "#" },
  { icon: "fa-heart", title: "Wishlist", href: "#" },
  { icon: "fa-share-alt", title: "Share", href: "#" },
];

export default function ProductCard({
  name,
  price,
  oldPrice,
  image,
  onSale,
  delay,
  category,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState<number | null>(null);

  return (
    <li
      className={`dima-product ok-md-3 ok-xsd-12 ok-sd-6 ${category || ""}`}
      data-animate="fadeIn"
      data-delay={delay || 0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHoveredIcon(null); }}
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

          {/* ── Teal overlay ── */}
          <div className={`pc-overlay${hovered ? " hovered" : ""}`}>
            <div className={`pc-border-frame${hovered ? " hovered" : ""}`} />
            <div className={`pc-icon-grid${hovered ? " hovered" : ""}`}>
              {iconActions.map((action, i) => (
                <a
                  key={i}
                  href={action.href}
                  title={action.title}
                  className={`pc-icon-btn${hoveredIcon === i ? " hovered" : ""}`}
                  onMouseEnter={() => setHoveredIcon(i)}
                  onMouseLeave={() => setHoveredIcon(null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className={`fa ${action.icon}`} />
                </a>
              ))}
            </div>
          </div>

          {/* ── SALE badge ── */}
          {onSale && <span className="onsale"><span>SALE</span></span>}
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
