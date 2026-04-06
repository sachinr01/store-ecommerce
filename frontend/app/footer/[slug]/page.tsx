import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

type StaticPage = {
  slug: string;
  title: string;
  content: string;
  summary: string;
  date: string;
};

export const dynamic = 'force-dynamic';

const BASE_URL =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3001';

type PageResult = { page?: StaticPage; error?: 'api' | 'not-found' };
type PageListItem = { slug: string; title: string; date: string };

const fetchPage = async (slug: string): Promise<PageResult> => {
  try {
    const res = await fetch(`${BASE_URL}/store/api/pages/slug/${slug}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { error: 'not-found' };
    if (!res.ok) return { error: 'api' };
    const data = await res.json();
    if (data?.success && data.data) return { page: data.data };
    return { error: 'api' };
  } catch {
    return { error: 'api' };
  }
};

const fetchPageList = async (): Promise<PageListItem[]> => {
  try {
    const res = await fetch(`${BASE_URL}/store/api/pages?limit=6`, {
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

export default async function FooterSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = (resolved?.slug || '').toString().trim().toLowerCase();
  const [result, pageList] = await Promise.all([
    fetchPage(slug),
    fetchPageList(),
  ]);

  if (result.error === 'api') {
    return (
      <>
        <Header />
        <div className="dima-main" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 10 }}>We&apos;re having trouble loading this page.</h2>
          <p style={{ color: '#666', marginBottom: 22 }}>
            Please try again in a few minutes.
          </p>
          <Link href="/" className="button fill uppercase">Back to Home</Link>
        </div>
        <Footer />
      </>
    );
  }

  if (result.error === 'not-found' || !result.page) {
    notFound();
  }

  const page = result.page;
  const html = page?.content || '';
  const showSidebar = slug === 'about-us' || slug === 'contact-us';

  return (
    <>
      <style>{`
        .static-page { background: #f7f5f2; min-height: 70vh; }
        .static-body {
          max-width: 1160px;
          margin: 0 auto;
          padding: 40px 24px 72px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 36px;
        }
        .static-body.no-sidebar {
          max-width: 820px;
          grid-template-columns: 1fr;
          padding: 24px 20px 64px;
        }
        .static-body.no-sidebar .static-sidebar {
          display: none;
        }
        .static-title { margin: 0 0 6px; font-size: 28px; font-weight: 700; color: #1a1a1a; }
        .static-date { font-size: 12px; color: #999; margin-bottom: 18px; }
        .static-breadcrumb { font-size: 12px; color: #888; margin-bottom: 16px; display: flex; gap: 6px; align-items: center; }
        .static-breadcrumb a { color: #888; text-decoration: none; }
        .static-breadcrumb a:hover { color: #222; }
        .static-summary { background: #fff; border: 1px solid #ece7df; padding: 16px 18px; border-radius: 6px; margin: 16px 0 28px; font-size: 14px; color: #555; line-height: 1.7; }
        .static-content p { font-size: 14px; line-height: 1.9; color: #444; margin: 0 0 16px; }
        .static-content h1,
        .static-content h2,
        .static-content h3,
        .static-content h4 {
          color: #1a1a1a;
          margin: 18px 0 10px;
          line-height: 1.4;
        }
        .static-content h1 { font-size: 22px; }
        .static-content h2 { font-size: 18px; }
        .static-content h3 { font-size: 16px; }
        .static-content ul { padding-left: 18px; margin: 0 0 16px; color: #444; }
        .static-content li { margin-bottom: 8px; font-size: 14px; line-height: 1.7; }
        .static-content table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 13px; }
        .static-content th,
        .static-content td { border: 1px solid #e6dfd6; padding: 8px 10px; text-align: left; }
        .static-content th { background: #f2ece4; font-weight: 700; }
        .static-back { display: inline-flex; gap: 8px; align-items: center; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #1a1a1a; text-decoration: none; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 2px; margin-top: 16px; }

        .static-sidebar {
          display: flex;
          flex-direction: column;
          gap: 22px;
          position: sticky;
          top: 100px;
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
        .featured-list { list-style: none; margin: 0; padding: 0; }
        .featured-item { padding: 12px 0; border-bottom: 1px solid #f1ece4; }
        .featured-item:last-child { border-bottom: none; padding-bottom: 0; }
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
        .contact-info-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
          font-size: 13px;
          color: #555;
        }
        .contact-info-list li {
          display: grid;
          gap: 4px;
          border-bottom: 1px solid #f1ece4;
          padding-bottom: 10px;
        }
        .contact-info-list li:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .contact-info-list strong {
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #777;
        }

        @media (max-width: 990px) {
          .static-body { grid-template-columns: 1fr; }
          .static-sidebar { position: static; }
        }
        @media (max-width: 640px) {
          .static-body { padding: 18px 16px 48px; }
          .static-title { font-size: 24px; }
        }
      `}</style>

      <Header />
      <div className="dima-main static-page">
        <div className={`static-body ${showSidebar ? '' : 'no-sidebar'}`}>
          <div>
            <nav className="static-breadcrumb">
              <Link href="/">Home</Link>
              <span>{'>'}</span>
              <span style={{ color: '#555' }}>{page?.title || 'Page'}</span>
            </nav>

            <h1 className="static-title">{page?.title || 'Page'}</h1>
            {page?.date && <div className="static-date">{page.date}</div>}

            {page?.summary && (
              <div className="static-summary">{page.summary}</div>
            )}

            <div className="static-content" dangerouslySetInnerHTML={{ __html: html }} />

            <Link href="/" className="static-back">Back to Home</Link>
          </div>

            <aside className="static-sidebar">
              <div className="sidebar-box">
                <h4 className="sidebar-title">Categories</h4>
                <ul className="sidebar-list">
                  <li className="sidebar-item"><span>General</span><span>08</span></li>
                  <li className="sidebar-item"><span>Updates</span><span>04</span></li>
                  <li className="sidebar-item"><span>Stories</span><span>06</span></li>
                  <li className="sidebar-item"><span>Guides</span><span>03</span></li>
                </ul>
              </div>

              {slug === 'contact-us' && (
                <div className="sidebar-box">
                  <h4 className="sidebar-title">Contact Info</h4>
                  <ul className="contact-info-list">
                    <li>
                      <strong>Location</strong>
                      <span>India</span>
                    </li>
                    <li>
                      <strong>Phone</strong>
                      <span>+91 9876543210</span>
                      <span>+91 1234567890</span>
                    </li>
                    <li>
                      <strong>Email</strong>
                      <span>admin@coffr.com</span>
                      <span>owner@coffer.com</span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="sidebar-box">
                <h4 className="sidebar-title">Featured Posts</h4>
              <ul className="featured-list">
                {pageList.length > 0 ? (
                  (slug === 'contact-us' || slug === 'about-us'
                    ? pageList.filter((p) =>
                        p.slug && p.slug !== slug && (p.slug === 'about-us' || p.slug === 'contact-us')
                      )
                    : pageList.filter((p) => p.slug && p.slug !== slug)
                  )
                    .sort((a, b) => {
                      if (slug === 'contact-us') {
                        if (a.slug === 'about-us') return -1;
                        if (b.slug === 'about-us') return 1;
                      }
                      if (slug === 'about-us') {
                        if (a.slug === 'contact-us') return -1;
                        if (b.slug === 'contact-us') return 1;
                      }
                      return 0;
                    })
                    .slice(0, 4)
                    .map((p) => (
                    <li key={p.slug} className="featured-item">
                      <Link href={`/footer/${p.slug}`} className="featured-title">{p.title}</Link>
                      <span className="featured-meta">
                        By Admin <span>/</span> {p.date || '—'}
                      </span>
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: 13, color: '#777' }}>No featured posts yet.</li>
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
