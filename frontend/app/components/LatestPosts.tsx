'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Blog } from '../blog/types';
import { BLOG_HOME_LIMIT } from '../blog/utils/config';
import { getBlogDetailHref } from '../blog/utils/links';

export default function LatestPosts({ posts }: { posts: Blog[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const visiblePosts = posts.slice(0, BLOG_HOME_LIMIT);
  const hasCarousel = visiblePosts.length > 1;

  const slideTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;

    const slides = Array.from(track.children) as HTMLElement[];
    const target = slides[index];
    if (!target) return;

    track.scrollTo({
      left: target.offsetLeft - track.offsetLeft,
      behavior: 'smooth',
    });
  }, []);

  const updateActiveSlide = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const slides = Array.from(track.children) as HTMLElement[];
    if (slides.length === 0) return;
    const closestIndex = slides.reduce((closest, slide, index) => {
      const currentDistance = Math.abs(slide.offsetLeft - track.scrollLeft);
      const closestDistance = Math.abs(slides[closest].offsetLeft - track.scrollLeft);
      return currentDistance < closestDistance ? index : closest;
    }, 0);

    setActiveSlide(closestIndex);
  }, []);

  const goToPrevious = useCallback(() => {
    if (activeSlide > 0) slideTo(activeSlide - 1);
  }, [activeSlide, slideTo]);

  const goToNext = useCallback(() => {
    if (activeSlide < visiblePosts.length - 1) slideTo(activeSlide + 1);
  }, [activeSlide, slideTo, visiblePosts.length]);

  const handleTrackScroll = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updateActiveSlide();
    });
  }, [updateActiveSlide]);

  useEffect(() => {
    updateActiveSlide();
    window.addEventListener('resize', updateActiveSlide);
    return () => {
      window.removeEventListener('resize', updateActiveSlide);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateActiveSlide, visiblePosts.length]);

  if (visiblePosts.length === 0) return null;

  return (
    <section className="blog-section" id="blog">
        <div className="blog-section-inner">
          <div className="blog-section-top">
            <div className="blog-section-header">
              <span className="blog-section-label">Blogs</span>
              <h3 className="blog-section-title">From The nestcase Blogs</h3>
            </div>
          </div>
          <div className="blog-carousel-shell">
            {hasCarousel ? (
              <div className="blog-carousel-controls" aria-label="Blog carousel controls">
                  <button
                    type="button"
                    className="blog-carousel-arrow na-scroll-btn blog-carousel-arrow-prev"
                    onClick={goToPrevious}
                    aria-label="Previous blog post"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="blog-carousel-arrow na-scroll-btn blog-carousel-arrow-next"
                    onClick={goToNext}
                    aria-label="Next blog post"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ) : null}
            <div
              ref={trackRef}
              id="home-blog-carousel"
              className="blog-grid blog-carousel-track"
              onScroll={handleTrackScroll}
            >
              {visiblePosts.map((post) => (
                <Link key={post.slug} href={getBlogDetailHref(post)} className="blog-card">
                  <div className="blog-card-img-wrap">
                    {post.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image}
                        alt={post.title}
                        className="blog-card-img"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="blog-card-body">
                    <span className="blog-card-date">{post.date}</span>
                    <h4 className="blog-card-title">{post.title}</h4>
                    <p className="blog-card-summary">{post.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
  );
}
