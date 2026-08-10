"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBanners, type Banner } from "../lib/api";

const FALLBACK_SRC = "/images/Fallback_Image/Full_Banner.webp";
const FALLBACK_HREF = "/";

export default function VideoBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    getBanners("nestcase")
      .then((data) => { if (data.length) setBanners(data); })
      .catch(() => {});
  }, []);

  // Show all nestcase banners stacked, or fallback
  if (!banners.length) {
    return (
      <section className="video-banner">
        <Link href={FALLBACK_HREF} aria-label="Shop now" style={{ display: "block", cursor: "pointer" }}>
          <img src={FALLBACK_SRC} alt="Banner" className="video-banner-bg" />
        </Link>
      </section>
    );
  }

  return (
    <>
      {banners.map((b) => (
        <section key={b.id} className="video-banner">
          <Link href={b.link_url || FALLBACK_HREF} aria-label={b.title || "Shop now"} style={{ display: "block", cursor: "pointer" }}>
            <img src={b.image_url} alt={b.title || "Banner"} className="video-banner-bg" />
          </Link>
        </section>
      ))}
    </>
  );
}
