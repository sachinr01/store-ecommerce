import type { Blog } from '../types';
import { BLOG_API_BASE_URL } from './apiBase';
import { BLOG_REVALIDATE_SECONDS } from './config';

export type BlogBySlugResult = {
  blog?: Blog;
  error?: 'api' | 'not-found';
};

export const getBlogBySlug = async (slug: string): Promise<BlogBySlugResult> => {
  try {
    const res = await fetch(`${BLOG_API_BASE_URL}/blogs/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
    });

    if (res.status === 404) return { error: 'not-found' };
    if (!res.ok) return { error: 'api' };

    const data = await res.json();
    if (data?.success && data.data) return { blog: data.data as Blog };
    return { error: 'api' };
  } catch {
    return { error: 'api' };
  }
};

