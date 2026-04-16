'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Blog route error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
        background: '#f7f5f2',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          border: '1px solid #e6dfd6',
          borderRadius: 6,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: '#1a1a1a' }}>
          Unable to load blog content
        </h2>
        <p style={{ margin: '0 0 20px', color: '#6f6760', lineHeight: 1.6 }}>
          Please retry, or return to the blog list.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              border: 'none',
              background: '#1a1a1a',
              color: '#fff',
              padding: '10px 16px',
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/blog"
            style={{
              border: '1px solid #d7cfc4',
              color: '#3f3a33',
              padding: '9px 15px',
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Back to blog
          </Link>
        </div>
      </div>
    </div>
  );
}
