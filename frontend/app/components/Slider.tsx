"use client";

import { useState, useEffect } from "react";
import "./Slider.css";

export default function Slider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image: "https://icmedianew.gumlet.io/pub/media/home_banner/main_slider/Summer-Specials-02.03.2026.webp",
      topLabel: "BEST DEAL",
      highlight: "UNDER $40",
      description: "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean\nsollicitudin, lorem quis bibendum auctor..",
    },
    {
      image: "https://icmedianew.gumlet.io/pub/media/home_banner/main_slider/NGCPR-Banner-02.01.2026.webp",
      topLabel: "THE SALES EVENT",
      midLabel: "UP TO",
      highlight: "70% OFF",
      description: "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean\nsollicitudin, lorem quis bibendum auctor..",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="slider-root">
      {/* ─── Slides ─── */}
      {slides.map((slide, index) => (
        <div key={index} className={`slider-slide ${index === currentSlide ? "active" : "inactive"}`}>
          <img src={slide.image} alt={slide.topLabel} className="slider-bg-img" />
          <div className="slider-overlay">
            <div className="slider-content-box" />
          </div>
        </div>
      ))}

      {/* ─── Navigation dots ─── */}
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

      {/* ─── Prev arrow ─── */}
      <button
        onClick={() => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)}
        aria-label="Previous slide"
        className="slider-arrow prev"
      >
        &#8249;
      </button>

      {/* ─── Next arrow ─── */}
      <button
        onClick={() => setCurrentSlide((p) => (p + 1) % slides.length)}
        aria-label="Next slide"
        className="slider-arrow next"
      >
        &#8250;
      </button>
    </div>
  );
}
