// app/app/blog/utils/getBlogs.ts
// FULL FILE — replace entirely

import { BLOG_API_BASE_URL } from './apiBase';
import { BLOG_REVALIDATE_SECONDS } from './config';
import type { Blog, BlogCategory } from '../types';
import { slugify } from './slugify';

const parseDataArray = <T,>(payload: unknown): T[] => {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as { success?: unknown }).success &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

export const mergeUniqueBlogs = (primary: Blog[], fallback: Blog[]) => {
  const combined = [...primary, ...fallback];
  return combined.filter((item, index, arr) => (
    arr.findIndex((blog) => blog.slug === item.slug) === index
  ));
};

export const getBlogs = async (): Promise<Blog[]> => {
  try {
    const res = await fetch(`${BLOG_API_BASE_URL}/blogs`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return parseDataArray<Blog>(await res.json());
  } catch {
    return [];
  }
};

export const getLatestBlogs = async (limit = 6): Promise<Blog[]> => {
  try {
    const res = await fetch(`${BLOG_API_BASE_URL}/blogs?limit=${limit}`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return parseDataArray<Blog>(await res.json());
  } catch {
    return [];
  }
};

export const getBlogsByCategory = async (categorySlug: string): Promise<Blog[]> => {
  try {
    const normalized = slugify(categorySlug);
    const res = await fetch(
      `${BLOG_API_BASE_URL}/blogs?category=${encodeURIComponent(normalized)}`,
      { next: { revalidate: BLOG_REVALIDATE_SECONDS } },
    );
    if (!res.ok) return [];
    return parseDataArray<Blog>(await res.json());
  } catch {
    return [];
  }
};

export const getBlogCategories = async (): Promise<BlogCategory[]> => {
  try {
    const res = await fetch(`${BLOG_API_BASE_URL}/blog-categories`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    return parseDataArray<BlogCategory>(await res.json());
  } catch {
    return [];
  }
};

/**
 * Resolves the primary category for a blog post.
 *
 * Resolution order (all O(1) — no extra API calls):
 *   1. blog.primary_category_slug  matched against the categories list
 *   2. blog.categories[is_primary] matched against the categories list
 *   3. blog.categories[0]          matched against the categories list
 *   4. Return blog.categories[0] as-is (already embedded in the post)
 *
 * The previous N+1 fallback (fetching all categories' posts to find which one
 * contains this post) has been removed. That information is now stored directly
 * on the post via is_primary_category in the DB (set by blog_schema_migration.js).
 */
export const getPrimaryCategoryForBlog = async (
  blog: Blog,
  categories: BlogCategory[],
): Promise<BlogCategory | null> => {
  // 1. Explicit primary_category_slug on the post
  const explicitSlug = slugify(blog.primary_category_slug || '');
  if (explicitSlug) {
    const matched = categories.find((category) => (
      slugify(category.category_slug || category.category_name) === explicitSlug
    ));
    if (matched) return matched;
  }

  // 2 & 3. Use embedded categories array (no extra fetch needed)
  const embeddedCategory =
    blog.categories?.find((category) => category.is_primary_category) ??
    blog.categories?.[0] ??
    null;

  if (embeddedCategory) {
    // Try to match against the canonical categories list for a full record
    const matched = categories.find((category) => (
      slugify(category.category_slug || category.category_name) ===
      slugify(embeddedCategory.category_slug || embeddedCategory.category_name)
    ));
    if (matched) return matched;
    // Return the embedded category directly (has enough info for breadcrumb/byline)
    return embeddedCategory;
  }

  return null;
};