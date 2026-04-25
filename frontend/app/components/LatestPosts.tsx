'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Blog } from '../blog/types';
import { BLOG_HOME_LIMIT } from '../blog/utils/config';
import { getBlogDetailHref } from '../blog/utils/links';
import "./LatestPosts.css";

export default function LatestPosts({ posts }: { posts: Blog[] }) {
  const visiblePosts = posts.slice(0, BLOG_HOME_LIMIT);

  if (visiblePosts.length === 0) return null;

  return (
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
                  {post.image ? (
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      unoptimized
                      sizes="(max-width: 560px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : null}
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
  );
}
