"use client";

import { useState, useEffect } from "react";
import "./Slider.css";

export default function Slider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    { image: "/store/images/ecommerce/HEROSECTION_FINAL.png" },
    { image: "/store/images/ecommerce/HEROSECTION_FINAL.png" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="slider-root">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`slider-slide ${index === currentSlide ? "active" : "inactive"}`}
        >
          <img
            src={slide.image}
            alt="Banner"
            className="slider-bg-img"
          />
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
            onClick={() =>
              setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)
            }
            aria-label="Previous slide"
            className="slider-arrow prev"
          >
            &#8249;
          </button>
          <button
            onClick={() =>
              setCurrentSlide((p) => (p + 1) % slides.length)
            }
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