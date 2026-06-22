import type { Metadata } from 'next';
import CategoryClient from './CategoryClient';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      absolute: 'nestcase | Premium Drinkware, Glassware & Kitchenware',
    },
    description:
      'Shop premium drinkware, glassware, cups & mugs, bowls & platters, dinner sets, and kitchen organisers for modern homes.',
  };
}

export default function CategoryPage() {
  return <CategoryClient />;
}
