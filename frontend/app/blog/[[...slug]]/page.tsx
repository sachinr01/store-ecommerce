import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BlogListView from '../components/BlogListView';
import BlogDetailView from '../components/BlogDetailView';
import { getBlogBySlug } from '../utils/getBlogBySlug';
import { BLOG_FEATURED_LIMIT } from '../utils/config';
import { getBlogDetailHref } from '../utils/links';
import { getBlogCategories, getBlogs, getLatestBlogs, mergeUniqueBlogs, getBlogsByCategory } from '../utils/getBlogs';
import { staticBlogs, getStaticBlogBySlug } from '../../blog/staticblog';
import type { BlogSidebarFeaturedItem, BlogBreadcrumbItem } from '../types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolved = await params;
  const segments = (resolved?.slug ?? []).map((s) => decodeURIComponent(s)).filter(Boolean);
  if (segments.length === 0) return {};

  const slug = segments[0].toLowerCase();
  const blogResult = await getBlogBySlug(slug);
  const blog = blogResult.blog ?? getStaticBlogBySlug(slug);
  if (!blog) return {};

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
    alternates: { canonical: `/blog/${blog.slug}` },
  };
}

export default async function BlogRoutePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolved = await params;
  const segments = (resolved?.slug ?? []).map((s) => decodeURIComponent(s)).filter(Boolean);

  // ── Blog listing page: /blog ──────────────────────────────────────────────
  if (segments.length === 0) {
    const [apiBlogs, latestFromApi, categories] = await Promise.all([
      getBlogs(),
      getLatestBlogs(BLOG_FEATURED_LIMIT),
      getBlogCategories(),
    ]);

    const mergedBlogs = mergeUniqueBlogs(apiBlogs, staticBlogs);
    const latestPosts = mergeUniqueBlogs(latestFromApi, staticBlogs).slice(0, BLOG_FEATURED_LIMIT);
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
          posts={mergedBlogs}
          emptyMessage="No blogs available right now."
          featuredTitle="Latest Posts"
          featuredItems={featuredItems}
          categories={categories}
        />
        <Footer />
      </>
    );
  }

  // ── Blog detail page: /blog/[slug] ────────────────────────────────────────
  const slug = segments[0].toLowerCase();
  const [blogResult, latestFromApi, categories] = await Promise.all([
    getBlogBySlug(slug),
    getLatestBlogs(BLOG_FEATURED_LIMIT),
    getBlogCategories(),
  ]);

  // Check if slug matches a category first
  const matchedCategory = categories.find(
    (cat) => (cat.category_slug || '').toLowerCase() === slug || cat.category_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug
  );

  if (matchedCategory) {
    const [categoryBlogs] = await Promise.all([getBlogsByCategory(slug)]);
    const latestPosts = mergeUniqueBlogs(latestFromApi, staticBlogs).slice(0, BLOG_FEATURED_LIMIT);
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
          title={matchedCategory.category_name}
          subtitle={`Posts in ${matchedCategory.category_name}.`}
          posts={categoryBlogs}
          emptyMessage={`No posts found in ${matchedCategory.category_name}.`}
          featuredTitle="Latest Posts"
          featuredItems={featuredItems}
          activeCategorySlug={slug}
          showBreadcrumb
          breadcrumbs={[{ href: '/', label: 'Home' }, { href: '/blog', label: 'Blog' }, { label: matchedCategory.category_name }]}
          categories={categories}
          storageKeyPrefix={`blog-cat-${slug}`}
        />
        <Footer />
      </>
    );
  }

  const blog = blogResult.blog ?? getStaticBlogBySlug(slug);
  if (!blog) notFound();

  const latestPosts = mergeUniqueBlogs(latestFromApi, staticBlogs).slice(0, BLOG_FEATURED_LIMIT);

  const categoryName = blog.primary_category_name || null;
  const categoryCrumb = categoryName
    ? { label: categoryName }
    : undefined;

  return (
    <>
      <Header />
      <BlogDetailView
        blog={blog}
        latestPosts={latestPosts}
        backHref="/blog"
        backLabel="Back to Blogs"
        categoryCrumb={categoryCrumb}
        categories={categories}
      />
      <Footer />
    </>
  );
}
