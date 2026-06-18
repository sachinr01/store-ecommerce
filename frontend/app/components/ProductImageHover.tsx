'use client';

import { useState, useEffect } from 'react';

interface ProductImageHoverProps {
  featuredSrc: string;
  gallerySrc: string | null;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  fallback: string;
  cardHovered?: boolean;
}

export default function ProductImageHover({
  featuredSrc,
  gallerySrc,
  alt,
  className,
  loading = 'lazy',
  fallback,
  cardHovered = false,
}: ProductImageHoverProps) {
  const [imgHovered, setImgHovered] = useState(false);
  const [galleryFailed, setGalleryFailed] = useState(false);

  const hasGallery = !!gallerySrc && gallerySrc !== featuredSrc && !galleryFailed;

  // Reset gallery failure state when gallerySrc changes
  useEffect(() => {
    setGalleryFailed(false);
  }, [gallerySrc]);

  const onFeaturedErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).src = fallback;
  };

  const onGalleryErr = () => {
    setGalleryFailed(true);
  };

  const hovered = imgHovered || cardHovered;
  const showGallery = hovered;

  return (
    <div
      className="csp-img-hover-wrap"
      onMouseEnter={() => setImgHovered(true)}
      onMouseLeave={() => setImgHovered(false)}
      style={{ position: 'relative', display: 'block', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* featured image — always underneath */}
      <img
        src={featuredSrc}
        alt={alt}
        className={className}
        loading={loading}
        onError={onFeaturedErr}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* gallery image — fades in on hover (desktop) or auto-cycles (mobile) */}
      {hasGallery && (
        <img
          src={gallerySrc!}
          alt={alt}
          className={className}
          loading="lazy"
          onError={onGalleryErr}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: showGallery ? 1 : 0,
            transition: 'opacity 0.35s ease',
            transform: 'none',
          }}
        />
      )}
    </div>
  );
}
