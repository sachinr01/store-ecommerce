import 'server-only';

const rawBlogApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!rawBlogApiUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL must be set in production for blog content.');
}

const baseUrl = rawBlogApiUrl || 'http://127.0.0.1:3000';

export const BLOG_API_BASE_URL = `${baseUrl.replace(/\/+$/, '').replace(/\/store\/api$/, '')}/store/api`;

