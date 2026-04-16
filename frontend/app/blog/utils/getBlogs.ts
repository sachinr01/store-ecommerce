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
      cache: 'no-store',
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
      cache: 'no-store',
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
      { cache: 'no-store' },
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
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return parseDataArray<BlogCategory>(await res.json());
  } catch {
    return [];
  }
};