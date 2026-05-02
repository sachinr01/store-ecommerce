import Link from 'next/link';
import BlogSidebar from './BlogSidebar';
import BlogHeroImage from './BlogHeroImage';
import type { Blog, BlogBreadcrumbItem, BlogCategory } from '../types';
import { getBlogDetailHref } from '../utils/links';

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12 8H5v9.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V10ZM20 8V6.5a.5.5 0 0 0-.5-.5H18v1a1 1 0 1 1-2 0V6H9v1a1 1 0 1 1-2 0V6H4.5a.5.5 0 0 0-.5.5V8h16Z" fill="currentColor"/>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12.2a4.6 4.6 0 1 0-4.6-4.6 4.61 4.61 0 0 0 4.6 4.6Zm0 2c-4.2 0-8 2.2-8 5.2V21h16v-1.6c0-3-3.8-5.2-8-5.2Z" fill="currentColor"/>
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4.5 5A2.5 2.5 0 0 0 2 7.5v9A2.5 2.5 0 0 0 4.5 19h15a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 19.5 7H11L9.5 5.5A2.5 2.5 0 0 0 7.8 5H4.5Zm0 2H7.8c.18 0 .35.07.48.2L10 8.9A2 2 0 0 0 11.4 9H19.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-9A.5.5 0 0 1 4.5 7Z" fill="currentColor"/>
  </svg>
);

function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<(script|style|iframe|frame|frameset|object|embed|applet|form|base|meta|link|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|frame|object|embed|applet|form|base|meta|link|input|button)[^>]*\/?>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/(href|src|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*')/gi, (match) =>
      /javascript:|data:/i.test(match) ? '' : match
    )
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
}

export default function BlogDetailView({
  blog,
  latestPosts,
  categoryCrumb,
  activeCategorySlug,
  categories,
}: {
  blog: Blog;
  latestPosts: Blog[];
  categoryCrumb?: BlogBreadcrumbItem;
  activeCategorySlug?: string;
  categories?: BlogCategory[];
}) {
  const htmlContent = sanitizeHtml(blog.content || '');
  const normalizeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const primaryCategory = blog.categories?.find((category) => category.is_primary_category) || blog.categories?.[0];
  const postedCategoryName =
    blog.primary_category_name || primaryCategory?.category_name || null;
  const postedCategorySlug =
    primaryCategory?.category_slug ||
    categories?.find((category) => {
      const candidateName = postedCategoryName || '';
      return (
        category.category_name.toLowerCase() === candidateName.toLowerCase() ||
        normalizeSlug(category.category_slug) === normalizeSlug(candidateName)
      );
    })?.category_slug ||
    null;

  return (
    <div className="dima-main blog-detail-page">
      <div className="blog-detail-body">
        <div className="blog-detail-main">
          <nav className="blog-breadcrumb">
            <Link href="/">Home</Link>
            <span>{'>'}</span>
            <Link href="/blog">Blog</Link>
            {categoryCrumb?.href ? (
              <>
                <span>{'>'}</span>
                <Link href={categoryCrumb.href}>{categoryCrumb.label}</Link>
              </>
            ) : null}
            <span>{'>'}</span>
            <span className="blog-breadcrumb-current">{blog.title}</span>
          </nav>

          <h1 className="blog-detail-title">{blog.title}</h1>
          <div className="blog-byline">
            <span className="blog-byline-item">
              <span className="blog-byline-icon"><CalendarIcon /></span>
              <span>{blog.date}</span>
            </span>
            <span className="blog-byline-divider" />
            <span className="blog-byline-item">
              <span className="blog-byline-icon"><UserIcon /></span>
              <span>
                Posted by <strong>{blog.author_name || 'Admin'}</strong>
              </span>
            </span>
            {postedCategoryName ? (
              <>
                <span className="blog-byline-divider" />
                <span className="blog-byline-item">
                  <span className="blog-byline-icon"><FolderIcon /></span>
                  <span>
                    Posted in{' '}
                    {postedCategorySlug ? (
                      <Link href={`/blog/${postedCategorySlug}`}>
                        <strong>{postedCategoryName}</strong>
                      </Link>
                    ) : (
                      <strong>{postedCategoryName}</strong>
                    )}
                  </span>
                </span>
              </>
            ) : null}
          </div>

          {blog.image ? (
            <div className="blog-hero-image">
              <BlogHeroImage src={blog.image} alt={blog.title} />
            </div>
          ) : null}

          <div className="blog-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>

        <BlogSidebar
          variant="widget"
          featuredTitle="Latest Posts"
          activeCategorySlug={activeCategorySlug}
          categories={categories ?? []}
          featuredItems={latestPosts.map((post) => ({
            href: getBlogDetailHref(post),
            title: post.title,
            meta: `Posted by ${post.author_name || 'Admin'} / ${post.date}`,
          }))}
        />
      </div>
    </div>
  );
}
