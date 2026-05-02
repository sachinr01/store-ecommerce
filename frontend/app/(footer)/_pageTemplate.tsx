import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PdfDownloadButton from './PdfDownloadButton';
import { getLatestBlogs } from '../blog/utils/getBlogs';
import { getBlogDetailHref } from '../blog/utils/links';
import './footepages.css';

type StaticPage = {
  slug: string;
  title: string;
  content: string;
  summary: string;
  date: string;
  // Page image — from tbl_media where media_type='blog_image' AND parent_id=page.ID
  image?: string | null;
  // SEO fields — dynamically stored in tbl_postmeta by admin
  seo_meta_title?:       string | null;
  seo_meta_description?: string | null;
  seo_canonical_tag?:    string | null;
  seo_meta_index?:       string | null; // 'yes' | 'no'  (default: 'yes')
};

type PageResult = { page?: StaticPage; error?: 'api' | 'not-found' };
type PageListItem = { slug: string; title: string; date: string };

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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
    return { error: 'not-found' };
  } catch {
    return { error: 'api' };
  }
};

// Lightweight fetch used only by generateMetadata in [slug]/page.tsx
export const fetchPageForMeta = async (slug: string): Promise<StaticPage | null> => {
  const result = await fetchPage(slug);
  return result.page ?? null;
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
  const [result, pageList, latestBlogs] = await Promise.all([
    fetchPage(slug),
    fetchPageList(),
    getLatestBlogs(5),
  ]);

  if (result.error === 'api') {
    return (
      <>
        <Header />
        <div className="dima-main static-error-wrap">
          <h2>We&apos;re having trouble loading this page.</h2>
          <p>
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
              <span className="static-breadcrumb-current">{page?.title || 'Page'}</span>
            </nav>

            <h1 className="static-title">{page?.title || 'Page'}</h1>


            {/* Page image — uploaded via admin Page Image section, stored in tbl_media */}
            {page?.image && (
              <div className="static-page-image">
                <Image
                  src={page.image}
                  alt={page.title || 'Page image'}
                  width={860}
                  height={450}
                  priority
                />
              </div>
            )}

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
            {/* Latest Posts — dynamic from blog API */}
            <div className="sidebar-box">
              <h4 className="sidebar-title">Latest Posts</h4>
              <ul className="featured-list">
                {latestBlogs.length > 0 ? (
                  latestBlogs.map((blog) => (
                    <li key={blog.slug} className="featured-item">
                      <Link
                        href={getBlogDetailHref(blog, '/blog')}
                        className="featured-title"
                      >
                        {blog.title}
                      </Link>
                      {blog.date && (
                        <span className="featured-meta">
                          {new Date(blog.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="featured-empty">No posts yet.</li>
                )}
              </ul>
            </div>

            {/* Quick Links — other static pages */}
            <div className="sidebar-box">
              <h4 className="sidebar-title">Quick Links</h4>
              <ul className="featured-list">
                {featuredPages.length > 0 ? (
                  featuredPages.map((p) => (
                    <li key={p.slug} className="featured-item">
                      <Link href={`/${p.slug}`} className="featured-title">{p.title}</Link>
                    </li>
                  ))
                ) : (
                  <li className="featured-empty">No links yet.</li>
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
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
