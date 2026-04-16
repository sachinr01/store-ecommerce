'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keeps error observable in logs without exposing internals to users.
    console.error('Global app error:', error);
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
          maxWidth: 520,
          background: '#fff',
          border: '1px solid #e6dfd6',
          borderRadius: 6,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 24, color: '#1a1a1a' }}>
          Something went wrong
        </h2>
        <p style={{ margin: '0 0 20px', color: '#6f6760', lineHeight: 1.6 }}>
          We could not load this page right now. Please try again.
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
            href="/"
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
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
