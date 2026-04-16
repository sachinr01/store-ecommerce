export type Blog = {
  slug: string;
  image: string;
  date: string;
  title: string;
  summary: string;
  content: string;
  categories?: BlogCategory[];
  author_id?: number | null;
  author_name?: string | null;
  primary_category_id?: number | null;
  primary_category_name?: string | null;
  primary_category_slug?: string | null;
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
