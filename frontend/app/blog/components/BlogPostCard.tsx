'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { BlogCard } from '../types';

export type BlogPostCardData = BlogCard;

export default function BlogPostCard({
  post,
  href,
  onClick,
}: {
  post: BlogPostCardData;
  href: string;
  onClick?: () => void;
  }) {
  return (
    <Link href={href} className="blog-post-card" onClick={onClick}>
      <div className="blog-post-card__image-wrap">
        {post.image ? (
          <Image
            className="blog-post-card__image"
            src={post.image}
            alt={post.title}
            fill
            unoptimized
            sizes="(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        ) : null}
      </div>
      <div className="blog-post-card__body">
        <span className="blog-post-card__date">{post.date}</span>
        <h3 className="blog-post-card__title">{post.title}</h3>
        <p className="blog-post-card__summary">{post.summary}</p>
      </div>
    </Link>
  );
}
