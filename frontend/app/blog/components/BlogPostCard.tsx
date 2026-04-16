'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './BlogPostCard.module.css';
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
    <Link href={href} className={styles.card} onClick={onClick}>
      <div className={styles.imageWrap}>
        <Image
          className={styles.image}
          src={post.image}
          alt={post.title}
          fill
          unoptimized
          sizes="(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 33vw"
          onError={(event) => {
            const target = event.currentTarget;
            if (target.dataset.fallbackApplied === '1') return;
            target.dataset.fallbackApplied = '1';
            target.src = '/store/images/dummy.jpg';
          }}
        />
      </div>
      <div className={styles.body}>
        <span className={styles.date}>{post.date}</span>
        <h3 className={styles.title}>{post.title}</h3>
        <p className={styles.summary}>{post.summary}</p>
      </div>
    </Link>
  );
}
