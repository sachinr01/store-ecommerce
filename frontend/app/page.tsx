import type { Metadata } from 'next';
import './home.css';
import Header from './components/Header';
import Slider from './components/Slider';
import NewlyLaunched, { BestSellers } from './components/NewArrivals';
import VideoBanner from './components/SalesEvent';
import CuratedGifting from './components/PopularProducts';
import GiftingWorld from './components/GiftingWorld';
import LatestPosts from './components/LatestPosts';
import Footer from './components/Footer';
import { BLOG_HOME_LIMIT } from './blog/utils/config';
import { getLatestBlogs } from './blog/utils/getBlogs';

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL  ?? 'http://localhost:3001';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'NESTCASE';

export const metadata: Metadata = {
  title: `${SITE_NAME} | Hoodies, Mugs, Decals & More`,
  description:
    'Shop our full collection of custom hoodies, tumblers, mugs, decals, koozies and more. Free shipping on orders above $99. Spring Summer 2026 now live.',
  keywords: [
    'hoodies', 'custom mugs', 'tumblers', 'decals', 'koozies',
    'online store', 'custom gifts', 'spring summer 2026',
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE_NAME} | Hoodies, Mugs, Decals & More`,
    description:
      'Shop custom hoodies, tumblers, mugs, decals and more. Free shipping on orders above $99.',
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/store/images/og-home.jpg`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Shop Now`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Hoodies, Mugs, Decals & More`,
    description:
      'Shop custom hoodies, tumblers, mugs, decals and more. Free shipping on orders above $99.',
    images: [`${SITE_URL}/images/logo/Nestcase_Logo.png`],
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      url: SITE_URL,
      name: SITE_NAME,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/shop?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      url: SITE_URL,
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo/Nestcase_Logo.png`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      ],
    },
  ],
};

export default async function Home() {
  const latestPosts = await getLatestBlogs(BLOG_HOME_LIMIT);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="ann-bar">
        FREE SHIPPING ON ORDERS ABOVE $99 &nbsp;|&nbsp; ✦ SPRING SUMMER 2026: NOW LIVE ✦
      </div>
      <Header />
      <Slider />
      <CuratedGifting />
      <NewlyLaunched />
      <VideoBanner />
      <GiftingWorld />
      <BestSellers />
      <LatestPosts posts={latestPosts} />
      <Footer />
    </>
  );
}
