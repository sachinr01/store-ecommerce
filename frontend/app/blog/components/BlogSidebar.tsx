'use client';

import Link from 'next/link';
import { slugify } from '../utils/slugify';
import type { BlogCategory, BlogSidebarFeaturedItem } from '../types';

type Variant = 'widget' | 'sidebar-box';

const cn = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

export default function BlogSidebar({
  featuredTitle,
  featuredItems,
  activeCategorySlug,
  variant = 'widget',
  categories,
}: {
  featuredTitle: string;
  featuredItems: BlogSidebarFeaturedItem[];
  activeCategorySlug?: string;
  variant?: Variant;
  categories: BlogCategory[];
}) {
  const wrapClass = variant === 'sidebar-box' ? 'sidebarBox' : 'widget';
  const titleClass = variant === 'sidebar-box' ? 'sidebarTitle' : 'widgetTitle';
  const contentClass = variant === 'sidebar-box' ? undefined : 'widgetContent';
  const featuredListClass = variant === 'sidebar-box'
    ? 'featuredList'
    : cn('withBorder', 'featuredPosts');
  const categoryListClass = variant === 'sidebar-box'
    ? 'sidebarList'
    : cn('withBorder', 'categoriesPosts');
  const visibleCategories = categories.filter((cat) => Number(cat.post_count) > 0);

  return (
    <aside className="sidebar">
      <div className={wrapClass}>
        <h5 className={titleClass}>{featuredTitle}</h5>
        <div className={contentClass}>
          <ul className={featuredListClass}>
            {featuredItems.length > 0 ? (
              featuredItems.map((item) => (
                <li
                  key={item.href}
                  className={variant === 'sidebar-box' ? 'featuredItem' : undefined}
                >
                  <Link
                    href={item.href}
                    className={variant === 'sidebar-box' ? 'featuredTitle' : undefined}
                  >
                    {variant === 'sidebar-box' ? item.title : <h6>{item.title}</h6>}
                  </Link>
                  {item.meta ? (
                    variant === 'sidebar-box' ? (
                      <span className="featuredMeta">{item.meta}</span>
                    ) : (
                      <span>{item.meta}</span>
                    )
                  ) : null}
                </li>
              ))
            ) : (
              <li className={variant === 'sidebar-box' ? 'sidebarEmpty sidebarEmpty--box' : 'sidebarEmpty'}>
                No featured posts yet.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className={wrapClass}>
        <h5 className={titleClass}>Categories</h5>
        <div className={contentClass}>
          {visibleCategories.length > 0 ? (
            <ul className={categoryListClass}>
              {visibleCategories.map((cat) => {
                const resolvedCategorySlug = cat.category_slug || slugify(cat.category_name);
                const isActive = activeCategorySlug
                  ? slugify(resolvedCategorySlug) === slugify(activeCategorySlug)
                  : false;
                const linkClass = variant === 'sidebar-box'
                  ? cn('sidebarItem', isActive && 'activeCat')
                  : isActive
                    ? 'activeCat'
                    : undefined;

                return (
                  <li key={cat.category_id}>
                    <Link href={`/blog/${resolvedCategorySlug}`} className={linkClass}>
                      <span className="catName">{cat.category_name}</span>
                      <span className="catCount">{String(cat.post_count).padStart(2, '0')}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={variant === 'sidebar-box' ? 'catLoading catLoading--box' : 'catLoading'}>
              No categories found.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
