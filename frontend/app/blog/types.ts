export type Blog = {
  slug: string;
  image: string | null;
  date: string;
  title: string;
  summary: string;
  content: string;
  categories?: BlogCategory[];
  author_id?: number | null;
  author_name?: string | null;
  primary_category_id?: number | null;
  primary_category_name?: string | null;
  // SEO fields — dynamically stored in tbl_postmeta by admin
  seo_meta_title?: string | null;
  seo_meta_description?: string | null;
  seo_canonical_tag?: string | null;
  seo_meta_index?: string | null; // 'yes' | 'no'  (default: 'yes')
};

export type BlogCard = Pick<Blog, 'slug' | 'image' | 'date' | 'title' | 'summary'>;

export type BlogCategory = {
  category_id: number;
  category_name: string;
  category_slug: string;
  post_count?: number;
  is_primary_category?: boolean;
};

export type BlogSidebarFeaturedItem = {
  href: string;
  title: string;
  meta?: string;
};

export type BlogBreadcrumbItem = {
  href?: string;
  label: string;
};