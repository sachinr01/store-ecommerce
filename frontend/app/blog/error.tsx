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
    <div className="blog-error-shell">
      <div className="blog-error-card">
        <h2 className="blog-error-title">
          Unable to load blog content
        </h2>
        <p className="blog-error-text">
          Please retry, or return to the blog list.
        </p>
        <div className="blog-error-actions">
          <button
            onClick={reset}
            className="blog-error-btn"
          >
            Try again
          </button>
          <Link
            href="/blog"
            className="blog-error-link"
          >
            Back to blog
          </Link>
        </div>
      </div>
    </div>
  );
}
