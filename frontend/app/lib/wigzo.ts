'use client';

/**
 * Wigzo (Engage360) client-side event helper.
 *
 * Wraps the global `wigzo(...)` function injected by the mapper script in
 * app/layout.tsx. All event names / field names below are copied verbatim
 * from "Engage360 — Custom Event Integration" PDF — do not rename fields,
 * Wigzo's message templates resolve them by exact key
 * (e.g. %event:addtocart:{{title}}%).
 *
 * Every call is a no-op (not an error) if the mapper script hasn't loaded
 * yet or we're rendering on the server, so it's always safe to call these
 * from any client component without guarding.
 */

declare global {
  interface Window {
    wigzo?: (...args: unknown[]) => void;
  }
}

function callWigzo(...args: unknown[]) {
  if (typeof window === 'undefined') return; // SSR — no-op
  if (typeof window.wigzo !== 'function') return; // mapper script not loaded yet — no-op
  try {
    window.wigzo(...args);
  } catch {
    // Never let a Wigzo failure break the page.
  }
}

// ── 1. Identify ──────────────────────────────────────────────────────────────
// Trigger point per PDF: Login Page & Checkout Page
export function wigzoIdentify(params: { email?: string; phone?: string; fullName?: string }) {
  callWigzo('identify', {
    email: params.email || '',
    phone: params.phone || '',
    fullName: params.fullName || '',
  });
}

// ── 2. Product View ──────────────────────────────────────────────────────────
// Trigger point per PDF: Product Page
export function wigzoProductView(params: {
  canonicalURL: string;
  firstname?: string;
  productUrl: string;
  title: string;
  price: string | number;
  previousPrice?: string | number;
  description?: string;
  image: string;
  productId: string | number;
  category?: string;
  tags?: string;
  author?: string;
  language?: string;
}) {
  callWigzo('track', 'productview', {
    canonicalURL: params.canonicalURL,
    firstname: params.firstname || '',
    productUrl: params.productUrl,
    title: params.title,
    price: String(params.price ?? ''),
    previousPrice: String(params.previousPrice ?? ''),
    description: params.description || '',
    image: params.image,
    productId: String(params.productId),
    category: params.category || '',
    tags: params.tags || '',
    author: params.author || '',
    language: params.language || 'en',
  });
}

// ── 3. Category View ─────────────────────────────────────────────────────────
// Trigger point per PDF: Category Page
export function wigzoCategoryView(params: {
  canonicalURL: string;
  categoryUrl: string;
  image?: string;
  title: string;
}) {
  callWigzo('track', 'categoryview', {
    canonicalURL: params.canonicalURL,
    categoryUrl: params.categoryUrl,
    image: params.image || '',
    title: params.title,
  });
}

// ── 4. Add To Cart ───────────────────────────────────────────────────────────
// Trigger point per PDF: on click of the Add to Cart button
export function wigzoAddToCart(params: {
  canonicalURL: string;
  productUrl: string;
  title: string;
  firstname?: string;
  price: string | number;
  previousPrice?: string | number;
  description?: string;
  image: string;
  productId: string | number;
  category?: string;
  tags?: string;
  author?: string;
  language?: string;
}) {
  callWigzo('track', 'addtocart', {
    canonicalURL: params.canonicalURL,
    productUrl: params.productUrl,
    title: params.title,
    firstname: params.firstname || '',
    price: String(params.price ?? ''),
    previousPrice: String(params.previousPrice ?? ''),
    description: params.description || '',
    image: params.image,
    productId: String(params.productId),
    category: params.category || '',
    tags: params.tags || '',
    author: params.author || '',
    language: params.language || 'en',
  });
}

// ── 5. Checkout Started ──────────────────────────────────────────────────────
// Trigger point per PDF: Checkout Page
export function wigzoCheckoutStarted(params: {
  firstname?: string;
  currency?: string;
  image?: string;
  totalDiscounts?: string | number;
  totalLineItemsPrice?: string | number;
  totalPrice?: string | number;
  totalTax?: string | number;
  abandonedCheckoutUrl?: string;
  checkoutId?: string | number;
  productId?: string | number;
  quantity?: number | null;
  sku?: string | null;
  taxable?: boolean;
  title?: string;
  variantId?: string | number;
  variantTitle?: string;
  variantPrice?: string | number;
  vendor?: string;
  compareAtPrice?: string | number;
  price?: string | number;
}) {
  const now = new Date().toISOString();
  callWigzo('track', 'checkoutstarted', {
    completed_at: now,
    closed_at: now,
    referring_site: typeof document !== 'undefined' ? document.referrer || '' : '',
    firstname: params.firstname || '',
    currency: params.currency || 'INR',
    image: params.image || '',
    source_identifier: '',
    total_discounts: String(params.totalDiscounts ?? ''),
    total_line_items_price: String(params.totalLineItemsPrice ?? ''),
    total_price: String(params.totalPrice ?? ''),
    total_tax: String(params.totalTax ?? ''),
    abandoned_checkout_url: params.abandonedCheckoutUrl || '',
    checkout_id: params.checkoutId ?? '',
    applied_discounts_json: null,
    key: '',
    gift_card: '',
    product_id: params.productId ?? '',
    quantity: params.quantity ?? null,
    sku: params.sku ?? null,
    taxable: params.taxable ?? true,
    title: params.title || '',
    variant_id: params.variantId ?? '',
    variant_title: params.variantTitle || '',
    variant_price: String(params.variantPrice ?? ''),
    vendor: params.vendor || '',
    compare_at_price: String(params.compareAtPrice ?? ''),
    price: String(params.price ?? ''),
  });
}

// ── 7. Buy (optional) ────────────────────────────────────────────────────────
// Trigger point per PDF: Thank You Page (fires alongside the `order` event,
// which this storefront sends server-side — see api/orderController.js).
export function wigzoBuy(productIds: Array<string | number>) {
  callWigzo('track', 'buy', productIds.map(String));
}