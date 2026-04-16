import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BlogCategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const resolved = await params;
  const postSlug = decodeURIComponent((resolved?.postSlug || '').toString()).toLowerCase();
  redirect(`/blog/${postSlug}`);
}
