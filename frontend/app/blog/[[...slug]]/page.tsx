// app/app/blog/[[...slug]]/page.tsx
// FULL FILE — replace entirely

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BlogListView from '../components/BlogListView';
import BlogDetailView from '../components/BlogDetailView';
import { slugify } from '../utils/slugify';
import { getBlogBySlug } from '../utils/getBlogBySlug';
import { BLOG_FEATURED_LIMIT, BLOG_LIST_INITIAL_COUNT } from '../utils/config';
import { getBlogDetailHref } from '../utils/links';
import {
  getBlogCategories,
  getBlogsByCategory,
  getLatestBlogs,
  getPrimaryCategoryForBlog,
} from '../utils/getBlogs';
import type { BlogBreadcrumbItem, BlogSidebarFeaturedItem } from '../types';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toTitleCase = (value: string) => value
  .replace(/-/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeSlugSegments = (segments?: string[]) => (Array.isArray(segments) ? segments : [])
  .map((segment) => decodeURIComponent((segment || '').toString()))
  .filter(Boolean);

// ── Per-page metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolved = await params;
  const segments = normalizeSlugSegments(resolved?.slug);

  // Index page — use the static layout metadata
  if (segments.length === 0) {
    return {};
  }

  // Single segment — could be a category or a post
  if (segments.length === 1) {
    const slug = slugify(segments[0]);

    // Try as a blog post first
    const { blog } = await getBlogBySlug(slug);
    if (blog) {
      return {
        title: `${blog.title} | Blog`,
        description: blog.summary || `Read "${blog.title}" on our blog.`,
        openGraph: {
          title: blog.title,
          description: blog.summary || '',
          url: `/blog/${blog.slug}`,
          type: 'article',
          ...(blog.image ? { images: [{ url: blog.image, alt: blog.title }] } : {}),
        },
        twitter: {
          card: 'summary_large_image',
          title: blog.title,
          description: blog.summary || '',
          ...(blog.image ? { images: [blog.image] } : {}),
        },
        alternates: { canonical: `/blog/${blog.slug}` },
      };
    }

    // Try as a category
    const categories = await getBlogCategories();
    const matchedCategory = categories.find(
      (cat) => slugify(cat.category_slug || cat.category_name) === slug,
    );
    if (matchedCategory) {
      return {
        title: `${matchedCategory.category_name} | Blog`,
        description: `Browse all posts in ${matchedCategory.category_name}.`,
        alternates: { canonical: `/blog/${slug}` },
      };
    }

    return {};
  }

  // Two-segment URL — last segment is the post slug
  if (segments.length >= 2) {
    const postSlug = slugify(segments[segments.length - 1]);
    const { blog } = await getBlogBySlug(postSlug);
    if (blog) {
      return {
        title: `${blog.title} | Blog`,
        description: blog.summary || `Read "${blog.title}" on our blog.`,
        openGraph: {
          title: blog.title,
          description: blog.summary || '',
          url: `/blog/${blog.slug}`,
          type: 'article',
          ...(blog.image ? { images: [{ url: blog.image, alt: blog.title }] } : {}),
        },
        twitter: {
          card: 'summary_large_image',
          title: blog.title,
          description: blog.summary || '',
          ...(blog.image ? { images: [blog.image] } : {}),
        },
        alternates: { canonical: `/blog/${blog.slug}` },
      };
    }
  }

  return {};
}

// ── Page renders ──────────────────────────────────────────────────────────────

async function renderIndex() {
  const [blogs, latestFromApi, categories] = await Promise.all([
    getLatestBlogs(BLOG_LIST_INITIAL_COUNT),
    getLatestBlogs(BLOG_FEATURED_LIMIT),
    getBlogCategories(),
  ]);

  const latestPosts = latestFromApi.slice(0, BLOG_FEATURED_LIMIT);
  const featuredItems: BlogSidebarFeaturedItem[] = latestPosts.map((post) => ({
    href: getBlogDetailHref(post),
    title: post.title,
    meta: `Posted by ${post.author_name || 'Admin'} / ${post.date}`,
  }));

  return (
    <>
      <Header />
      <BlogListView
        pageClassName="blog-list-page"
        title="From The Blog"
        subtitle="Latest updates, stories, and inspirations."
        posts={blogs}
        emptyMessage="No blogs available right now."
        featuredTitle="Latest Posts"
        featuredItems={featuredItems}
        categories={categories}
        loadMoreEndpoint="/store/api/blogs"
      />
      <Footer />
    </>
  );
}

async function renderCategory(slug: string) {
  const [categories, latestFromApi, categoryBlogs] = await Promise.all([
    getBlogCategories(),
    getLatestBlogs(BLOG_FEATURED_LIMIT),
    getBlogsByCategory(slug),
  ]);

  const matchedCategory = categories.find(
    (cat) => slugify(cat.category_slug || cat.category_name) === slug,
  );
  if (!matchedCategory) return null;

  const latestPosts = latestFromApi.slice(0, BLOG_FEATURED_LIMIT);
  const featuredItems: BlogSidebarFeaturedItem[] = latestPosts.map((post) => ({
    href: getBlogDetailHref(post),
    title: post.title,
    meta: `Posted by ${post.author_name || 'Admin'} / ${post.date}`,
  }));

  const categoryDisplayName = matchedCategory.category_name;
  const breadcrumbs: BlogBreadcrumbItem[] = [
    { href: '/', label: 'Home' },
    { href: '/blog', label: 'Blog' },
    { label: categoryDisplayName },
  ];

  return (
    <>
      <Header />
      <BlogListView
        pageClassName="blog-list-page"
        title={categoryDisplayName}
        subtitle={`Posts in ${categoryDisplayName}.`}
        posts={categoryBlogs}
        emptyMessage={`No posts found in ${categoryDisplayName}.`}
        featuredTitle="Latest Posts"
        featuredItems={featuredItems}
        activeCategorySlug={slug}
        showBreadcrumb
        breadcrumbs={breadcrumbs}
        categories={categories}
        storageKeyPrefix={`blog-cat-${slug}`}
      />
      <Footer />
    </>
  );
}

async function renderDetail(slug: string) {
  const [blogResult, latestFromApi, categories] = await Promise.all([
    getBlogBySlug(slug),
    getLatestBlogs(BLOG_FEATURED_LIMIT),
    getBlogCategories(),
  ]);

  const blog = blogResult.blog;
  if (!blog) return null;

  const primaryCategory = await getPrimaryCategoryForBlog(blog, categories);
  const activeCategorySlug = slugify(
    primaryCategory?.category_slug || primaryCategory?.category_name || blog.primary_category_slug || '',
  );
  const categoryName =
    primaryCategory?.category_name ||
    blog.primary_category_name ||
    (activeCategorySlug ? toTitleCase(activeCategorySlug) : '');
  const categoryCrumb = activeCategorySlug && categoryName
    ? { href: `/blog/${activeCategorySlug}`, label: categoryName }
    : undefined;

  return (
    <>
      <Header />
      <BlogDetailView
        blog={blog}
        latestPosts={latestFromApi.slice(0, BLOG_FEATURED_LIMIT)}
        backHref="/blog"
        backLabel="Back to Blogs"
        categoryCrumb={categoryCrumb}
        activeCategorySlug={activeCategorySlug || undefined}
        categories={categories}
      />
      <Footer />
    </>
  );
}

// ── Route entry point ─────────────────────────────────────────────────────────

export default async function BlogRoutePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolved = await params;
  const segments = normalizeSlugSegments(resolved?.slug);

  if (segments.length === 0) {
    return renderIndex();
  }

  if (segments.length === 1) {
    const slug = slugify(segments[0]);
    const category = await renderCategory(slug);
    if (category) return category;

    const detail = await renderDetail(slug);
    if (detail) return detail;

    notFound();
  }

  if (segments.length >= 2) {
    const postSlug = slugify(segments[segments.length - 1]);
    const detail = await renderDetail(postSlug);
    if (detail) return detail;
    notFound();
  }

  notFound();
}
