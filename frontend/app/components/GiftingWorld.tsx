"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBanners, type Banner } from "../lib/api";

const FALLBACK_PANELS = [
  { image_url: "/images/Fallback_Image/Gifting_Banner.webp", title: "...", link_url: "/" },
  { image_url: "/images/Fallback_Image/Gifting_Banner.webp", title: "...",  link_url: "/" },
];

export default function GiftingWorld() {
  const [panels, setPanels] = useState<{ image_url: string; title: string | null; link_url: string | null }[]>(FALLBACK_PANELS);

  useEffect(() => {
    getBanners("gifting")
      .then((data) => { if (data.length) setPanels(data); })
      .catch(() => {});
  }, []);

  return (
    <section className="gw-section">
      <h3 className="gw-title">Gifting</h3>
      <div className="gw-grid">
        {panels.map((p, i) => (
          <Link key={i} href={p.link_url || "/b2b-connect"} className="gw-panel">
            <img src={p.image_url} alt={p.title || "Gifting"} loading="lazy" />
            <div className="gw-panel-label">
              <span className="gw-panel-link">{p.title}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
