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
                  <span className="blog-breadcrumb-current">{item.label}</span>
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
    </div>
  );
}
