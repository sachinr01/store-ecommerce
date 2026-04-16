'use client';

import Image from 'next/image';

export default function BlogHeroImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      unoptimized
      sizes="(max-width: 990px) 100vw, 760px"
      onError={(event) => {
        const target = event.currentTarget;
        if (target.dataset.fallbackApplied === '1') return;
        target.dataset.fallbackApplied = '1';
        target.src = '/store/images/dummy.jpg';
      }}
    />
  );
}
