import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PdfDownloadButton from './PdfDownloadButton';
import './footepages.css';

type StaticPage = {
  slug: string;
  title: string;
  content: string;
  summary: string;
  date: string;
};

type PageResult = { page?: StaticPage; error?: 'api' | 'not-found' };
type PageListItem = { slug: string; title: string; date: string };
type SidebarCategory = { label: string; count: string };

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const STATIC_CATEGORIES: SidebarCategory[] = [
  { label: 'General', count: '08' },
  { label: 'Updates', count: '04' },
  { label: 'Stories', count: '06' },
  { label: 'Guides', count: '03' },
];

const BASE_URL =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3001';

const toTime = (value: string) => {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : 0;
};

const isDownloadablePolicyPage = (page: StaticPage | undefined, slug: string) => {
  const haystack = normalizeText(`${page?.slug || ''} ${page?.title || ''} ${slug}`);
  return (
    haystack.includes('privacy policy') ||
    haystack.includes('shipping policy') ||
    haystack.includes('refund') ||
    haystack.includes('return') ||
    (haystack.includes('terms') && haystack.includes('conditions'))
  );
};

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
    const res = await fetch(`${BASE_URL}/store/api/pages?limit=10`, {
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

export async function renderStaticPage(slug: string) {
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
  const featuredPages = pageList
    .filter((p) => p.slug && p.slug !== slug)
    .sort((a, b) => {
      const aTime = toTime(a.date);
      const bTime = toTime(b.date);
      return bTime - aTime;
    })
    .slice(0, 4);
  const showContactInfo = (page?.title || '').toLowerCase().includes('contact');
  const showDownload = page ? isDownloadablePolicyPage(page, slug) : false;

  return (
    <>
      <Header />
      <div className="dima-main static-page">
        <div className="static-body">
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

            {showDownload && (
              <div className="static-actions">
                <PdfDownloadButton page={page} />
              </div>
            )}
          </div>

          <aside className="static-sidebar">
            <div className="sidebar-box">
              <h4 className="sidebar-title">Featured Posts</h4>
              <ul className="featured-list">
                {featuredPages.length > 0 ? (
                  featuredPages.map((p) => (
                    <li key={p.slug} className="featured-item">
                      <Link href={`/${p.slug}`} className="featured-title">{p.title}</Link>
                      <span className="featured-meta">
                        By Admin <span>/</span> {p.date || '-'}
                      </span>
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: 13, color: '#777' }}>No featured posts yet.</li>
                )}
              </ul>
            </div>

            {showContactInfo && (
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
              <h4 className="sidebar-title">Categories</h4>
              <ul className="sidebar-list">
                {STATIC_CATEGORIES.map((category) => (
                  <li key={category.label} className="sidebar-item">
                    <span>{category.label}</span>
                    <span>{category.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
