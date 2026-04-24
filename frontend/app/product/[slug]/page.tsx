import { Metadata } from 'next';
import { Suspense } from 'react';
import ProductSlugClient from './ProductSlugClient';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/store/api';

async function fetchProductMeta(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/products/slug/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductMeta(slug);
  if (!product) return {};

  const metaTitle       = product.seo_meta_title       || product.title             || '';
  const metaDescription = product.seo_meta_description || product.short_description || '';
  const canonicalUrl    = product.seo_canonical_tag     || `/store/shop/product/${slug}`;
  const shouldIndex     = (product.seo_meta_index || 'yes').toLowerCase() !== 'no';
  const ogImage         = product.thumbnail_url || null;

  return {
    title: { absolute: metaTitle },
    description: metaDescription,
    robots: {
      index:  shouldIndex,
      follow: shouldIndex,
    },
    openGraph: {
      title:       metaTitle,
      description: metaDescription,
      url:         canonicalUrl,
      type:        'website',
      ...(ogImage ? { images: [{ url: ogImage, alt: product.title }] } : {}),
    },
    alternates: { canonical: canonicalUrl },
  };
}

export default function ProductSlugPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 80, textAlign: 'center', fontFamily: 'sans-serif', color: '#888' }}>
        Loading...
      </div>
    }>
      <ProductSlugClient />
    </Suspense>
  );
}
