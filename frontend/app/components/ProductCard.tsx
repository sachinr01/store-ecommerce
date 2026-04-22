"use client";

import { useState } from "react";
import Link from "next/link";

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
      onMouseLeave={() => {
        setHovered(false);
        setHoveredIcon(null);
      }}
    >
      {/* ── Product Image + Hover Overlay ── */}
      <div className="product-img">
        <div
          className="fix-chrome"
          style={{ position: "relative", overflow: "hidden", display: "block" }}
        >
          {/* Main product image */}
          <figure style={{ margin: 0, display: "block", lineHeight: 0 }}>
            <img
              src={image}
              alt={name}
              style={{
                width: "100%",
                display: "block",
                transition: "transform 0.4s ease",
                transform: hovered ? "scale(1.04)" : "scale(1)",
              }}
            />
          </figure>

          {/* ── Teal overlay ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: hovered
                ? "rgba(0, 191, 165, 0.72)"
                : "rgba(0, 191, 165, 0)",
              transition: "background 0.32s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            {/* ── White border frame (topaz-hover effect) ── */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                right: "10px",
                bottom: "10px",
                border: "1px solid rgba(255,255,255,0.7)",
                opacity: hovered ? 1 : 0,
                transition: "opacity 0.35s ease",
                pointerEvents: "none",
                zIndex: 11,
              }}
            />

            {/* ── 2 × 2 icon grid ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 50px",
                gridTemplateRows: "50px 50px",
                gap: "20px",
                opacity: hovered ? 1 : 0,
                transform: hovered ? "translateY(0)" : "translateY(12px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
                zIndex: 20,
              }}
            >
              {iconActions.map((action, i) => (
                <a
                  key={i}
                  href={action.href}
                  title={action.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "50px",
                    height: "50px",
                    border: "1px solid #ffffff",
                    color: hoveredIcon === i ? "#00bfa5" : "#ffffff",
                    background: hoveredIcon === i ? "#ffffff" : "transparent",
                    fontSize: "18px",
                    textDecoration: "none",
                    transition: "background 0.2s ease, color 0.2s ease",
                    cursor: "pointer",
                  }}
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
          {onSale && (
            <span className="onsale">
              <span>SALE</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Product Info ── */}
      <div className="product-content">
        <Link href="/shop-product-detail-right-sidebar.html">
          <h5 className="product-name">{name}</h5>
        </Link>

        {/* Star rating */}
        <div className="rating">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span className="star"></span>
        </div>
      </div>

      {/* ── Price ── */}
      <span className="price text-center">
        {oldPrice && (
          <del>
            <span className="amount">${oldPrice.toFixed(2)}</span>
          </del>
        )}
        <ins>
          <span className="amount">${price.toFixed(2)}</span>
        </ins>
      </span>
    </li>
  );
}
