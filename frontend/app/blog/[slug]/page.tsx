import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

type Blog = {
  slug: string;
  image: string;
  date: string;
  title: string;
  summary: string;
  content: string;
};

export const dynamic = 'force-dynamic';

const BASE_URL =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3001';

type BlogResult = { blog?: Blog; error?: 'api' | 'not-found' };

const fetchBlog = async (slug: string): Promise<BlogResult> => {
  try {
    const res = await fetch(`${BASE_URL}/store/api/blogs/slug/${slug}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { error: 'not-found' };
    if (!res.ok) return { error: 'api' };
    const data = await res.json();
    if (data?.success && data.data) return { blog: data.data };
    return { error: 'api' };
  } catch {
    return { error: 'api' };
  }
};

const fetchBlogList = async (): Promise<Blog[]> => {
  try {
    const res = await fetch(`${BASE_URL}/store/api/blogs?limit=6`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.success && Array.isArray(data.data)) return data.data;
    return [];
  } catch {
    return [];
  }
};

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = decodeURIComponent((resolved?.slug || '').toString()).toLowerCase();
  const [blogResult, list] = await Promise.all([
    fetchBlog(slug),
    fetchBlogList(),
  ]);

  if (blogResult.error === 'api') {
    return (
      <>
        <Header />
        <div className="dima-main" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 10 }}>We&apos;re having trouble loading this blog.</h2>
          <p style={{ color: '#666', marginBottom: 22 }}>
            Please try again in a few minutes.
          </p>
          <Link href="/" className="button fill uppercase">Back to Home</Link>
        </div>
        <Footer />
      </>
    );
  }

  if (blogResult.error === 'not-found' || !blogResult.blog) {
    notFound();
  }

  const blog = blogResult.blog;

  const htmlContent = blog.content || '';

  const related = (list && list.length ? list : [])
    .filter((b) => b.slug !== blog.slug)
    .slice(0, 3);

  const categories = [
    { name: 'General', count: list.length || 1 },
    { name: 'Updates', count: Math.max(1, Math.ceil((list.length || 1) / 2)) },
    { name: 'Stories', count: Math.max(1, Math.floor((list.length || 1) / 2)) },
  ];

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
        }
        .blog-breadcrumb a { color: #aaa; text-decoration: none; }
        .blog-breadcrumb a:hover { color: #1a1a1a; }
        .blog-breadcrumb span { color: #ccc; }

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

        .blog-sidebar {
          display: flex;
          flex-direction: column;
          gap: 22px;
          position: static;
          align-self: start;
        }
        .sidebar-box {
          border: 1px solid #ece7df;
          border-radius: 4px;
          background: #fff;
          padding: 16px 18px;
        }
        .sidebar-title {
          margin: 0 0 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #1a1a1a;
        }
        .sidebar-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .sidebar-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #555;
          border-bottom: 1px solid #f1ece4;
          padding-bottom: 8px;
        }
        .sidebar-item:last-child { border-bottom: none; padding-bottom: 0; }
        .sidebar-item span:last-child { color: #999; }
        .featured-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .featured-item {
          padding: 12px 0;
          border-bottom: 1px solid #f1ece4;
        }
        .featured-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .featured-title {
          text-decoration: none;
          color: #3f3a33;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          line-height: 1.5;
          display: block;
        }
        .featured-title:hover { color: #e4572e; }
        .featured-meta {
          display: block;
          font-size: 11px;
          color: #9a948c;
          margin-top: 4px;
        }
        .featured-meta span { color: #c0b9b1; margin: 0 4px; }

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
          .blog-sidebar { position: static; }
        }
      `}</style>

      <Header />
      <div className="dima-main blog-detail-page">
        <div className="blog-detail-body">
          <div>
            <nav className="blog-breadcrumb">
              <Link href="/">Home</Link>
              <span>{'>'}</span>
              <Link href="/#blog">Blog</Link>
              <span>{'>'}</span>
              <span style={{ color: '#555' }}>{blog.title}</span>
            </nav>

            <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>{blog.title}</h1>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 18 }}>{blog.date}</div>

            {blog.summary && blog.summary.trim() && (
              <div className="blog-summary-box">{blog.summary}</div>
            )}

            <div className="blog-content" dangerouslySetInnerHTML={{ __html: htmlContent }} />

            <Link href="/blog" className="blog-back-btn">Back to Blogs</Link>
          </div>

          <aside className="blog-sidebar">
            <div className="sidebar-box">
              <h4 className="sidebar-title">Categories</h4>
              <ul className="sidebar-list">
                {categories.map((cat) => (
                  <li key={cat.name} className="sidebar-item">
                    <span>{cat.name}</span>
                    <span>{String(cat.count).padStart(2, '0')}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sidebar-box">
              <h4 className="sidebar-title">Featured Blogs</h4>
              <ul className="featured-list">
                {related.length > 0 ? (
                  related.map((r) => (
                    <li key={r.slug} className="featured-item">
                      <Link href={`/blog/${r.slug}`} className="featured-title">{r.title}</Link>
                      <span className="featured-meta">
                        By Admin <span>/</span> {r.date}
                      </span>
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: 13, color: '#777' }}>No related blogs yet.</li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
