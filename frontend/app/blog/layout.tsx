// app/app/blog/layout.tsx
// FULL FILE — replace entirely

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './blog.css';

export const metadata: Metadata = {
  // metadataBase is required so that relative canonical/og:url values resolve correctly.
  // Set NEXT_PUBLIC_SITE_URL in your environment (e.g. https://yourstore.com).
  // Falls back to localhost for local development.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'),

  title: 'Blog – Home Decor & Lifestyle',
  description:
    'Explore home decor tips, interior styling inspiration, and the latest updates from our team.',
  keywords: [
    'home decor blog',
    'interior design tips',
    'lifestyle blog',
    'home styling inspiration',
  ],
  robots: {
    index: true,
    follow: true,
  },
  // Canonical is now an absolute path — resolves correctly with metadataBase above.
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog – Home Decor & Lifestyle',
    description: 'Explore home decor tips, interior styling inspiration, and the latest updates from our team.',
    url: '/blog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog – Home Decor & Lifestyle',
    description: 'Tips, inspiration, and stories from our team.',
  },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
