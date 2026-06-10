'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import Link from 'next/link';
import type { Blog } from '../blog/types';
import { BLOG_HOME_LIMIT } from '../blog/utils/config';
import { getBlogDetailHref } from '../blog/utils/links';

export default function LatestPosts({ posts }: { posts: Blog[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ pointerX: 0, scrollLeft: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 42 });
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
    const maxScroll = track.scrollWidth - track.clientWidth;
    const rawWidth = track.scrollWidth > 0
      ? (track.clientWidth / track.scrollWidth) * 100
      : 42;
    const width = maxScroll > 0 ? Math.max(24, Math.min(42, rawWidth)) : 42;
    const left = maxScroll > 0
      ? (track.scrollLeft / maxScroll) * (100 - width)
      : 0;

    setActiveSlide(closestIndex);
    setScrollbar({ left, width });
  }, []);

  const goToPrevious = useCallback(() => {
    slideTo((activeSlide - 1 + visiblePosts.length) % visiblePosts.length);
  }, [activeSlide, slideTo, visiblePosts.length]);

  const goToNext = useCallback(() => {
    slideTo((activeSlide + 1) % visiblePosts.length);
  }, [activeSlide, slideTo, visiblePosts.length]);

  const scrollToScrollbarPosition = useCallback((clientX: number) => {
    const track = trackRef.current;
    const bar = scrollbarRef.current;
    if (!track || !bar) return track?.scrollLeft ?? 0;

    const rect = bar.getBoundingClientRect();
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (maxScroll <= 0) return track.scrollLeft;

    const dragWidth = rect.width * (scrollbar.width / 100);
    const availableWidth = Math.max(1, rect.width - dragWidth);
    const targetLeft = Math.min(
      availableWidth,
      Math.max(0, clientX - rect.left - dragWidth / 2)
    );

    const nextScrollLeft = (targetLeft / availableWidth) * maxScroll;
    track.scrollLeft = nextScrollLeft;
    return nextScrollLeft;
  }, [scrollbar.width]);

  const startScrollbarDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;

    setIsDraggingScrollbar(true);
    event.preventDefault();
    const nextScrollLeft = scrollToScrollbarPosition(event.clientX);
    dragStartRef.current = {
      pointerX: event.clientX,
      scrollLeft: nextScrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [scrollToScrollbarPosition]);

  const moveScrollbarDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const bar = scrollbarRef.current;
    if (!isDraggingScrollbar || !track || !bar) return;
    event.preventDefault();

    const rect = bar.getBoundingClientRect();
    const maxScroll = track.scrollWidth - track.clientWidth;
    const dragWidth = rect.width * (scrollbar.width / 100);
    const availableWidth = Math.max(1, rect.width - dragWidth);
    const deltaX = event.clientX - dragStartRef.current.pointerX;
    const scrollDelta = (deltaX / availableWidth) * maxScroll;

    track.scrollLeft = dragStartRef.current.scrollLeft + scrollDelta;
  }, [isDraggingScrollbar, scrollbar.width]);

  const stopScrollbarDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    setIsDraggingScrollbar(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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
              <h3 className="blog-section-title">From The Nestcase Blogs</h3>
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
              className={`blog-grid blog-carousel-track${isDraggingScrollbar ? ' dragging' : ''}`}
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
          {hasCarousel ? (
            <div
              ref={scrollbarRef}
              className={`swiper-scrollbar swiper-scrollbar-horizontal blog-carousel-scrollbar${isDraggingScrollbar ? ' dragging' : ''}`}
              role="scrollbar"
              aria-label="Blog carousel scrollbar"
              aria-controls="home-blog-carousel"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, visiblePosts.length - 1)}
              aria-valuenow={activeSlide}
              tabIndex={0}
              onPointerDown={startScrollbarDrag}
              onPointerMove={moveScrollbarDrag}
              onPointerUp={stopScrollbarDrag}
              onPointerCancel={stopScrollbarDrag}
            >
              <span
                className="swiper-scrollbar-drag"
                style={{
                  width: `${scrollbar.width}%`,
                  left: `${scrollbar.left}%`,
                }}
              />
            </div>
          ) : null}
        </div>
      </section>
  );
}
