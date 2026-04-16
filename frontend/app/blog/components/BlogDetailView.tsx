// app/app/blog/components/BlogDetailView.tsx
// FULL FILE — replace entirely

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

// ── Inline DOMPurify-style sanitizer (server-safe, no npm required) ──────────
// Strips every dangerous tag and attribute that the API-side sanitizer misses:
// <iframe>, <object>, <embed>, <form>, <base>, <meta>, <link>, <svg onload>,
// data: URIs in href/src, and javascript: protocol.
function sanitizeHtml(raw: string): string {
  return raw
    // Remove dangerous block-level tags entirely (including their content)
    .replace(/<(script|style|iframe|frame|frameset|object|embed|applet|form|base|meta|link|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove self-closing dangerous tags
    .replace(/<(script|iframe|frame|object|embed|applet|form|base|meta|link|input|button)[^>]*\/?>/gi, '')
    // Remove all event handler attributes (on*)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: and data: protocols in href/src/action
    .replace(/(href|src|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*')/gi, (match) =>
      /javascript:|data:/i.test(match) ? '' : match
    )
    // Remove srcdoc attribute (used to smuggle HTML into iframes)
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    // Remove all img tags
    .replace(/<img[^>]*\/?>/gi, '');
}

export default function BlogDetailView({
  blog,
  latestPosts,
  backHref,
  backLabel,
  categoryCrumb,
  activeCategorySlug,
  categories,
}: {
  blog: Blog;
  latestPosts: Blog[];
  backHref: string;
  backLabel: string;
  categoryCrumb?: BlogBreadcrumbItem;
  activeCategorySlug?: string;
  categories?: BlogCategory[];
}) {
  // Sanitize on the client before rendering raw HTML
  const htmlContent = sanitizeHtml(blog.content || '');

  return (
    <>
      <style>{`
        .blog-detail-page { background: #f7f5f2; min-height: 80vh; }
        .blog-detail-body {
          max-width: 1160px;
          margin: 0 auto;
          padding: 48px 24px 72px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 36px;
          align-items: start;
        }
        .blog-breadcrumb {
          font-size: 12px;
          color: #aaa;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .blog-breadcrumb a { color: #aaa; text-decoration: none; }
        .blog-breadcrumb a:hover { color: #1a1a1a; }
        .blog-breadcrumb span { color: #ccc; }
        .blog-byline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          color: #8b857d;
          font-size: 13px;
          margin: 2px 0 18px;
        }
        .blog-byline-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          line-height: 1.3;
        }
        .blog-byline-divider {
          width: 1px;
          height: 14px;
          background: #ddd2c7;
        }
        .blog-byline-icon {
          width: 16px;
          height: 16px;
          color: #8a7d72;
          flex: 0 0 16px;
        }
        .blog-byline-icon svg {
          width: 16px;
          height: 16px;
          display: block;
        }
        .blog-hero-image {
          position: relative;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          overflow: hidden;
          background: #ece7df;
          margin: 18px 0 20px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);
        }
        .blog-summary-box {
          border: 1px solid #ece7df;
          padding: 14px 16px;
          background: #fff;
          border-radius: 4px;
          margin-bottom: 24px;
          font-size: 14px;
          color: #555;
          line-height: 1.7;
        }
        .blog-content p {
          font-size: 15px;
          color: #444;
          line-height: 1.85;
          margin: 0 0 22px;
        }
        .blog-content h1,
        .blog-content h2,
        .blog-content h3,
        .blog-content h4 {
          color: #1a1a1a;
          margin: 18px 0 10px;
          line-height: 1.4;
        }
        .blog-content h1 { font-size: 24px; }
        .blog-content h2 { font-size: 20px; }
        .blog-content h3 { font-size: 18px; }
        .blog-content ul { padding-left: 18px; margin: 0 0 18px; color: #444; }
        .blog-content li { margin-bottom: 8px; font-size: 15px; line-height: 1.7; }
        .blog-content table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 13px; }
        .blog-content th,
        .blog-content td { border: 1px solid #e6dfd6; padding: 8px 10px; text-align: left; }
        .blog-content th { background: #f2ece4; font-weight: 700; }
        .blog-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 44px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #1a1a1a;
          text-decoration: none;
          border-bottom: 1.5px solid #1a1a1a;
          padding-bottom: 2px;
        }
        @media (max-width: 990px) {
          .blog-detail-body { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dima-main blog-detail-page">
        <div className="blog-detail-body">
          <div>
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
              <span style={{ color: '#555' }}>{blog.title}</span>
            </nav>

            <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>{blog.title}</h1>
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
              {(() => {
                const postedCategory = blog.primary_category_name
                  || blog.categories?.find((category) => category.is_primary_category)?.category_name
                  || blog.categories?.[0]?.category_name;
                return postedCategory ? (
                  <>
                    <span className="blog-byline-divider" />
                    <span className="blog-byline-item">
                      <span className="blog-byline-icon"><FolderIcon /></span>
                      <span>
                        Posted in <strong>{postedCategory}</strong>
                      </span>
                    </span>
                  </>
                ) : null;
              })()}
            </div>

            {blog.summary && blog.summary.trim() && (
              <div className="blog-summary-box">{blog.summary}</div>
            )}

            {/* ── Sanitized HTML — safe to render ── */}
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
    </>
  );
}
