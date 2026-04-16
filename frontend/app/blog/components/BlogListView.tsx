// app/app/blog/components/BlogListView.tsx
// FULL FILE — replace entirely

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import BlogSidebar from './BlogSidebar';
import BlogPostCard from './BlogPostCard';
import type { Blog, BlogBreadcrumbItem, BlogCategory, BlogSidebarFeaturedItem } from '../types';
import { BLOG_LIST_INITIAL_COUNT, BLOG_LIST_LOAD_MORE_COUNT } from '../utils/config';
import { getBlogDetailHref } from '../utils/links';

const parseBlogArray = (payload: unknown): Blog[] => {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as { success?: unknown }).success &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: Blog[] }).data;
  }
  return [];
};

export default function BlogListView({
  pageClassName,
  title,
  subtitle,
  posts,
  emptyMessage,
  featuredItems,
  featuredTitle = 'Latest Posts',
  activeCategorySlug,
  showBreadcrumb = false,
  breadcrumbs = [],
  storageKeyPrefix = 'blog',
  loading = false,
  categories,
  loadMoreEndpoint,
}: {
  pageClassName: string;
  title: string;
  subtitle: string;
  posts: Blog[];
  emptyMessage: string;
  featuredItems: BlogSidebarFeaturedItem[];
  featuredTitle?: string;
  activeCategorySlug?: string;
  showBreadcrumb?: boolean;
  breadcrumbs?: BlogBreadcrumbItem[];
  storageKeyPrefix?: string;
  loading?: boolean;
  categories?: BlogCategory[];
  loadMoreEndpoint?: string;
}) {
  const storageKey = `${storageKeyPrefix}VisibleCount`;
  const scrollKey = `${storageKeyPrefix}ScrollY`;

  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = Number(sessionStorage.getItem(storageKey));
      if (!Number.isNaN(saved) && saved > 0) return saved;
    }
    return BLOG_LIST_INITIAL_COUNT;
  });
  const [visiblePosts, setVisiblePosts] = useState<Blog[]>(posts);
  const [hasMore, setHasMore] = useState<boolean>(() => (loadMoreEndpoint ? posts.length > 0 : posts.length > visibleCount));
  const [loadingMore, setLoadingMore] = useState(false);
  // Fix: surface load-more errors to the user instead of silently swallowing them
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    setVisiblePosts(posts);
    setHasMore(loadMoreEndpoint ? posts.length > 0 : posts.length > BLOG_LIST_INITIAL_COUNT);
  }, [posts, loadMoreEndpoint]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (typeof window !== 'undefined') {
      const saved = Number(sessionStorage.getItem(scrollKey));
      if (!Number.isNaN(saved) && saved > 0) {
        requestAnimationFrame(() => window.scrollTo(0, saved));
      }
      sessionStorage.removeItem(scrollKey);
    }
    hasRestoredRef.current = true;
  }, [scrollKey, visibleCount]);

  const displayedPosts = useMemo(() => visiblePosts.slice(0, visibleCount), [visiblePosts, visibleCount]);
  const canLoadMore = !loadingMore && hasMore && (loadMoreEndpoint ? visiblePosts.length > 0 : visibleCount < visiblePosts.length);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadMoreError(null);

    const nextCount = visibleCount + BLOG_LIST_LOAD_MORE_COUNT;

    if (loadMoreEndpoint) {
      setLoadingMore(true);
      try {
        const separator = loadMoreEndpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${loadMoreEndpoint}${separator}limit=${nextCount}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`Failed to load more posts (${res.status})`);
        }

        const nextPosts = parseBlogArray(await res.json());
        const nextVisibleCount = Math.min(nextCount, nextPosts.length);

        setVisiblePosts(nextPosts);
        setVisibleCount(nextVisibleCount);
        setHasMore(nextPosts.length >= nextCount);

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, String(nextVisibleCount));
        }
      } catch (err) {
        // Surface the error instead of silently dropping it
        setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more posts. Please try again.');
      } finally {
        setLoadingMore(false);
      }
      return;
    }

    setVisibleCount((count) => {
      const next = Math.min(count + BLOG_LIST_LOAD_MORE_COUNT, visiblePosts.length);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, String(next));
      }
      setHasMore(next < visiblePosts.length);
      return next;
    });
  };

  const handleCardClick = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, String(visibleCount));
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    }
  };

  return (
    <div className={`dima-main ${pageClassName}`}>
      <div className="blog-list-hero">
        {showBreadcrumb && breadcrumbs.length > 0 && (
          <nav className="blog-list-breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`}>
                {item.href ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span style={{ color: '#555' }}>{item.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <span>{' > '}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="blog-list-title">{title}</h1>
        <p className="blog-list-subtitle">{subtitle}</p>
      </div>

      <div className="blog-list-layout">
        <div>
          {!loading && visiblePosts.length === 0 ? (
            <div className="blog-empty">{emptyMessage}</div>
          ) : (
            <>
              <div className="blog-grid">
                {displayedPosts.map((post) => (
                  <BlogPostCard
                    key={post.slug}
                    post={post}
                    href={getBlogDetailHref(post)}
                    onClick={handleCardClick}
                  />
                ))}
              </div>

              {/* Load-more error message */}
              {loadMoreError && (
                <p className="load-more-error">{loadMoreError}</p>
              )}

              {canLoadMore && (
                <div className="load-more-wrap">
                  <button className="load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <BlogSidebar
          variant="widget"
          featuredTitle={featuredTitle}
          activeCategorySlug={activeCategorySlug}
          featuredItems={featuredItems}
          categories={categories ?? []}
        />
      </div>

      <style>{` 
        .${pageClassName} { background: #f7f5f2; min-height: 80vh; }
        .blog-list-hero {
          max-width: 1160px;
          margin: 0 auto;
          padding: 40px 24px 10px;
        }
        .blog-list-breadcrumb {
          font-size: 12px;
          color: #aaa;
          margin-bottom: 10px;
        }
        .blog-list-breadcrumb a { color: #aaa; text-decoration: none; }
        .blog-list-breadcrumb a:hover { color: #1a1a1a; }
        .blog-list-title {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 6px;
          letter-spacing: -0.4px;
          color: #1a1a1a;
        }
        .blog-list-subtitle {
          font-size: 13px;
          color: #8c857d;
          margin: 0 0 22px;
        }
        .blog-list-layout {
          max-width: 1160px;
          margin: 0 auto;
          padding: 0 24px 72px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 32px;
          align-items: start;
        }
        .blog-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }
        .blog-empty {
          padding: 20px 0 24px;
          color: #777;
          font-size: 14px;
        }
        .load-more-wrap {
          display: flex;
          justify-content: center;
          margin-top: 28px;
        }
        .load-more-btn {
          background: #1a1a1a;
          color: #fff;
          border: none;
          padding: 10px 18px;
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
        }
        .load-more-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .load-more-error {
          text-align: center;
          margin-top: 16px;
          font-size: 13px;
          color: #c0392b;
        }
        @media (max-width: 1100px) {
          .blog-list-layout { grid-template-columns: minmax(0, 1fr) 280px; }
          .blog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .blog-list-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .blog-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
