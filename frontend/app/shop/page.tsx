import type { Metadata } from 'next';
import ShopClient from './ShopClient';
import { getProducts, type Product } from '../lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'e-commerce';

// Fetch once, reuse for both metadata and page render
async function fetchProducts(): Promise<Product[]> {
  try {
    return await getProducts();
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const products = await fetchProducts();

  const count = products.length;
  const inStock = products.filter(p => p.stock_status === 'instock').length;

  // Derive unique category keywords from product titles
  const knownCategories = ['Hoodies', 'Koozies', 'Bottles', 'Tumblers', 'Decals', 'Mugs'];
  const presentCategories = knownCategories.filter(cat =>
    products.some(p => p.title.toLowerCase().includes(cat.toLowerCase()))
  );
  const categoryList = presentCategories.length > 0 ? presentCategories : knownCategories;

  // Price range
  const prices = products
    .map(p => Number(p.price_min ?? 0))
    .filter(n => n > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const priceRange = minPrice && maxPrice
    ? ` Prices from $${minPrice.toFixed(0)} to $${maxPrice.toFixed(0)}.`
    : '';

  const title = count > 0
    ? `Shop All ${count} Products | ${SITE_NAME}`
    : `Shop | ${SITE_NAME}`;

  const description = count > 0
    ? `Browse ${count} coastal-inspired products${inStock < count ? ` (${inStock} in stock)` : ''} — ${categoryList.slice(0, 4).join(', ')} and more.${priceRange}`
    : `Browse our full collection of coastal-inspired gear — ${categoryList.join(', ')} and more.`;

  const keywords = [
    'coastal gear',
    'beach apparel',
    'shop',
    ...categoryList.map(c => c.toLowerCase()),
    ...(minPrice ? [`gifts under $${Math.ceil(minPrice / 10) * 10 + 10}`] : []),
  ];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `${SITE_URL}/shop`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/shop`,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ShopPage() {
  const products = await fetchProducts();

  const count = products.length;
  const inStock = products.filter(p => p.stock_status === 'instock').length;

  const heading = count > 0 ? `Our Collection (${count})` : 'Our Collection';
  const subheading = count > 0
    ? `${inStock} item${inStock !== 1 ? 's' : ''} in stock · Coastal-inspired gear for every adventure`
    : 'Coastal-inspired gear for every adventure';

  // Build JSON-LD server-side so it's in the initial HTML for crawlers
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
        ],
      },
      ...(products.length > 0
        ? [{
            '@type': 'ItemList',
            name: 'Our Collection',
            numberOfItems: products.length,
            itemListElement: products.slice(0, 20).map((p, i) => {
              const slugBase = (p.slug || p.title)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
              return {
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}/product/${slugBase}-${p.ID}`,
                name: p.title,
              };
            }),
          }]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShopClient heading={heading} subheading={subheading} />
    </>
  );
}
