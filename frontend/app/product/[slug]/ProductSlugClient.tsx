'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ProductDetailsClient } from '../../product-details/page';

function ProductBySlug() {
  const params = useParams();
  const slug = String(params?.slug ?? '');
  return <ProductDetailsClient productSlug={slug} />;
}

export default function ProductSlugPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 80, textAlign: 'center', fontFamily: 'sans-serif', color: '#888' }}>
        Loading...
      </div>
    }>
      <ProductBySlug />
    </Suspense>
  );
}
