"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getBanners, type Banner } from "../lib/api";

const FALLBACK: Banner[] = [
  { id: 0, title: null, type: "banner", image_url: "/images/ecommerce/Hero_Image.webp", link_url: "/shop", sort_order: 0 },
];

export default function Slider() {
  const [slides, setSlides] = useState<Banner[]>(FALLBACK);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    getBanners("banner")
      .then((data) => { if (data.length) setSlides(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="slider-root">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`slider-slide ${index === currentSlide ? "active" : "inactive"}`}
        >
          <Link href={slide.link_url || "/shop"} aria-label={slide.title || "Shop now"}>
            <img
              src={slide.image_url}
              alt={slide.title || "Banner"}
              className="slider-bg-img"
              style={{ cursor: "pointer" }}
            />
          </Link>
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <div className="slider-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`slider-dot ${i === currentSlide ? "active" : ""}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
            className="slider-arrow prev"
          >
            &#8249;
          </button>
          <button
            onClick={() => setCurrentSlide((p) => (p + 1) % slides.length)}
            aria-label="Next slide"
            className="slider-arrow next"
          >
            &#8250;
          </button>
        </>
      )}
    </div>
  );
}
