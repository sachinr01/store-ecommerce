"use client";

import { useState, useEffect } from "react";

export default function Slider() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image:
        "https://icmedianew.gumlet.io/pub/media/home_banner/main_slider/Summer-Specials-02.03.2026.webp",
      topLabel: "BEST DEAL",
      highlight: "UNDER $40",
      description:
        "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean\nsollicitudin, lorem quis bibendum auctor..",
    },
    {
      image:
        "https://icmedianew.gumlet.io/pub/media/home_banner/main_slider/NGCPR-Banner-02.01.2026.webp",
      topLabel: "THE SALES EVENT",
      midLabel: "UP TO",
      highlight: "70% OFF",
      description:
        "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean\nsollicitudin, lorem quis bibendum auctor..",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div
      className="slider-root"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: "520px",
        overflow: "hidden",
        backgroundColor: "#111",
      }}
    >
      {/* ─── Slides ─── */}
      {slides.map((slide, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: index === currentSlide ? 1 : 0,
            transition: "opacity 1s ease",
            pointerEvents: index === currentSlide ? "auto" : "none",
          }}
        >
          {/* Background image */}
          <img
            src={slide.image}
            alt={slide.topLabel}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />

          {/* ── Full-slide flexbox overlay — always perfectly centered ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              padding: "20px",
            }}
          >
            {/* Content box */}
            <div
              style={{
                textAlign: "center",
                width: "100%",
                maxWidth: "580px",
              }}
            >

            </div>
          </div>
        </div>
      ))}

      {/* ─── Navigation dots ─── */}
      <div
        style={{
          position: "absolute",
          bottom: "26px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          zIndex: 20,
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              height: "4px",
              width: i === currentSlide ? "48px" : "22px",
              background:
                i === currentSlide ? "#00cfc1" : "rgba(255,255,255,0.45)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              borderRadius: "2px",
              transition: "all 0.35s ease",
            }}
          />
        ))}
      </div>

      {/* ─── Prev arrow ─── */}
      <button
        onClick={() =>
          setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)
        }
        aria-label="Previous slide"
        style={{
          position: "absolute",
          left: "14px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 20,
          background: "rgba(0,0,0,0.28)",
          border: "none",
          color: "#fff",
          width: "42px",
          height: "42px",
          fontSize: "1.8rem",
          lineHeight: "42px",
          textAlign: "center",
          cursor: "pointer",
          borderRadius: "2px",
          padding: 0,
          transition: "background 0.3s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0,0,0,0.6)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0,0,0,0.28)")
        }
      >
        &#8249;
      </button>

      {/* ─── Next arrow ─── */}
      <button
        onClick={() => setCurrentSlide((p) => (p + 1) % slides.length)}
        aria-label="Next slide"
        style={{
          position: "absolute",
          right: "14px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 20,
          background: "rgba(0,0,0,0.28)",
          border: "none",
          color: "#fff",
          width: "42px",
          height: "42px",
          fontSize: "1.8rem",
          lineHeight: "42px",
          textAlign: "center",
          cursor: "pointer",
          borderRadius: "2px",
          padding: 0,
          transition: "background 0.3s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0,0,0,0.6)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "rgba(0,0,0,0.28)")
        }
      >
        &#8250;
      </button>
    </div>
  );
}
