'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Blog } from '../blog/types';
import { BLOG_HOME_LIMIT } from '../blog/utils/config';
import { getBlogDetailHref } from '../blog/utils/links';

export default function LatestPosts({ posts }: { posts: Blog[] }) {
  const visiblePosts = posts.slice(0, BLOG_HOME_LIMIT);

  if (visiblePosts.length === 0) return null;

  return (
    <>
      <style>{` 
        .blog-section {
          padding: 56px 0 64px;
          background: #f7f5f2;
        }
        .blog-section-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .blog-section-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .blog-section-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #aaa;
          margin-bottom: 10px;
        }
        .blog-section-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .blog-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .blog-card {
          background: #fff;
          border: 1px solid #ece7df;
          border-radius: 3px;
          overflow: hidden;
          text-decoration: none;
          display: block;
          transition: box-shadow 0.22s ease, transform 0.22s ease;
        }
        .blog-card:hover {
          box-shadow: 0 8px 28px rgba(0,0,0,0.09);
          transform: translateY(-3px);
        }
        .blog-card-img-wrap {
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          background: #f0ebe3;
          position: relative;
        }
        .blog-card-img-wrap img {
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .blog-card:hover .blog-card-img-wrap img {
          transform: scale(1.04);
        }
        .blog-card-body {
          padding: 18px 20px 22px;
        }
        .blog-card-date {
          display: block;
          font-size: 11px;
          color: #aaa;
          margin-bottom: 8px;
          letter-spacing: 0.3px;
        }
        .blog-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.45;
          margin: 0 0 14px;
        }
        .blog-card-summary {
          font-size: 12px;
          color: #888;
          line-height: 1.6;
          margin: 0 0 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .blog-card-link {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #1a1a1a;
          text-decoration: none;
          border-bottom: 1.5px solid #1a1a1a;
          padding-bottom: 1px;
          transition: opacity 0.2s;
        }
        .blog-card:hover .blog-card-link { opacity: 0.6; }
        @media (max-width: 1024px) {
          .blog-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .blog-grid { grid-template-columns: 1fr; gap: 16px; }
          .blog-section { padding: 40px 0 48px; }
          .blog-section-title { font-size: 22px; }
        }
      `}</style>

      <section className="blog-section" id="blog">
        <div className="blog-section-inner">
          <div className="blog-section-header">
            <span className="blog-section-label">Latest Posts</span>
            <h2 className="blog-section-title">From The Blog</h2>
          </div>
          <div className="blog-grid">
            {visiblePosts.map((post) => (
              <Link key={post.slug} href={getBlogDetailHref(post)} className="blog-card">
                <div className="blog-card-img-wrap">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    unoptimized
                    sizes="(max-width: 560px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (target.dataset.fallbackApplied === '1') return;
                      target.dataset.fallbackApplied = '1';
                      target.src = '/store/images/dummy.jpg';
                    }}
                  />
                </div>
                <div className="blog-card-body">
                  <span className="blog-card-date">{post.date}</span>
                  <h4 className="blog-card-title">{post.title}</h4>
                  <p className="blog-card-summary">{post.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
