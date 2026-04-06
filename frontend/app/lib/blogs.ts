export type Blog = {
  slug: string;
  image: string;
  date: string;
  title: string;
  summary: string;
  content: string;
};

// Live data comes from /store/api/blogs. This is a safe empty fallback.
export const blogs: Blog[] = [];

export function getBlogBySlug(slug: string): Blog | undefined {
  const normalized = (slug || '').toString().trim().toLowerCase();
  const cleaned = normalized.split('/').filter(Boolean).pop() ?? '';
  return blogs.find((b) => b.slug.toLowerCase() === cleaned);
}
