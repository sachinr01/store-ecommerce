import type { Blog } from '../types';

export const getBlogDetailHref = (
  blog: Pick<Blog, 'slug'>,
  fallbackPrefix = '/blog'
): string => {
  const normalizedFallback = fallbackPrefix.replace(/\/+$/, '');
  return `${normalizedFallback}/${blog.slug}`;
};
