// ============================================================
// B2B Connect Page
// Route: /b2b-connect
//
// This is a server component (async) that renders the full
// B2B landing page. It:
//   1. Fetches top-level product categories from the API
//   2. Renders a product category grid with images
//   3. Shows the key business benefits of partnering
//   4. Displays a contact/enquiry form for B2B leads
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import Slider from "../components/Slider";
import Footer from "../components/Footer";
import { getProductCategories, type ProductCategory } from "../lib/api";
import EnquiryForm from "../components/EnquiryForm";

// -----------------------------------------------------------
// Environment variables
// NEXT_PUBLIC_SITE_NAME — display name of the site (e.g. "nestcase")
// NEXT_PUBLIC_SITE_URL  — base URL used for canonical/OG tags
// -----------------------------------------------------------
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "nestcase";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

// -----------------------------------------------------------
// Page-level SEO metadata (Next.js Metadata API)
// Sets the <title>, <meta description>, canonical URL,
// Open Graph (Facebook/LinkedIn previews), and Twitter card.
// -----------------------------------------------------------
export const metadata: Metadata = {
  title: `B2B Connect`,
  description:
    "Premium drinkware, glassware and lifestyle essentials for hospitality, gifting, retail and modern spaces.",
  alternates: { canonical: `${SITE_URL}/b2b-connect` },
  openGraph: {
    title: `B2B Connect | ${SITE_NAME}`,
    description:
      "Premium drinkware, glassware and lifestyle essentials for hospitality, gifting, retail and modern spaces.",
    url: `${SITE_URL}/b2b-connect`,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/og-home.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — B2B Connect`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `B2B Connect | ${SITE_NAME}`,
    description:
      "Premium drinkware, glassware and lifestyle essentials for hospitality, gifting, retail and modern spaces.",
    images: [`${SITE_URL}/images/og-home.png`],
  },
};

// -----------------------------------------------------------
// COLLECTION_IMAGE_MAP
//
// Maps a keyword (substring of a category slug) to a local
// image path under /public/images/collection/.
//
// How it works:
//   - Each entry is a [keyword, imagePath] tuple.
//   - getCollectionImage() scans this list top-to-bottom and
//     returns the image for the first keyword that appears
//     inside the category slug.
//   - Order matters — more specific keywords should come first
//     (e.g. "glassware" before "drinkware").
// -----------------------------------------------------------
const COLLECTION_IMAGE_MAP: [string, string][] = [
  ["glassware",  "/images/collection/Drinkware-Whiskey-Glasses.png"],
  ["drinkware",  "/images/collection/Drinkware-Tumblers.png"],
  ["tumbler",    "/images/collection/Drinkware-Tumblers.png"],
  ["kitchen",    "/images/collection/Container-Contaner.png"],
  ["organiser",  "/images/collection/Container-Contaner.png"],
  ["jar",        "/images/collection/Container-Contaner.png"],
  ["bowl",       "/images/collection/Dinner-Set-Bowls.png"],
  ["platter",    "/images/collection/Dinner-Set-Platter.png"],
  ["cup",        "/images/collection/Drinkware-Cups-&-Mugs.png"],
  ["mug",        "/images/collection/Drinkware-Insulated-Mugs.png"],
  ["dinner",     "/images/collection/Dinner-Sets-Dinner-Set.png"],
];

// Fallback image used when no keyword matches the category slug
const DEFAULT_COLLECTION_IMAGE = "/images/dummy.jpg";

/**
 * getCollectionImage
 *
 * Returns the display image for a product category card.
 *
 * @param slug - The category slug (e.g. "premium-glassware")
 * @returns A local image path string
 *
 * Example:
 *   getCollectionImage("premium-glassware") → "/images/collection/Drinkware-Whiskey-Glasses.png"
 *   getCollectionImage("unknown-category")  → "/images/dummy.jpg"
 */
function getCollectionImage(slug: string): string {
  const match = COLLECTION_IMAGE_MAP.find(([key]) => slug.includes(key));
  return match ? match[1] : DEFAULT_COLLECTION_IMAGE;
}

// -----------------------------------------------------------
// benefits
//
// Static list of selling points shown in the "Why Partner
// With Us?" section. Each item renders as a card with:
//   - title    — bold heading
//   - copy     — short description
//   - iconClass — Font Awesome icon class (fa-*)
//
// To add a new benefit, just push a new object to this array.
// -----------------------------------------------------------
const benefits = [
  {
    title: "Premium Quality",
    copy: "Finest materials and craftsmanship for lasting impressions.",
    iconClass: "fa-certificate",
  },
  {
    title: "Bulk Order Support",
    copy: "Flexible solutions for businesses of all sizes.",
    iconClass: "fa-cubes",
  },
  {
    title: "Custom Branding",
    copy: "Personalized options to reflect your brand identity.",
    iconClass: "fa-tag",
  },
  {
    title: "Reliable Delivery",
    copy: "Timely and secure delivery, every time.",
    iconClass: "fa-truck",
  },
];

// -----------------------------------------------------------
// B2BConnectPage (default export)
//
// Async server component — Next.js runs this on the server at
// request time, so it can fetch data directly without useEffect.
//
// Data flow:
//   1. Call getProductCategories() to get all categories from API.
//   2. Filter to top-level only (parent_id is null/0).
//   3. If the API call fails, categories stays [] and the grid
//      is simply not rendered (graceful degradation).
// -----------------------------------------------------------
export default async function B2BConnectPage() {
  // Start with an empty array; populated if the API call succeeds
  let categories: ProductCategory[] = [];

  try {
    const all = await getProductCategories();
    // Keep only root-level categories (no parent)
    categories = all.filter((c) => !c.parent_id || c.parent_id === 0);
  } catch {
    // API failure is non-fatal — the section simply won't render
  }

  return (
    <>
      {/* Site-wide navigation header */}
      <Header />

      <main className="b2b-page">

        {/* Hero banner / image slider at the top of the page */}
        <Slider />

        {/* -------------------------------------------------------
            Product Categories Section
            Displays a grid of clickable category cards.
            Each card links to /shop/<category-slug>.
            The grid is hidden if no categories were returned.
        ------------------------------------------------------- */}
        <section className="b2b-section b2b-categories" aria-labelledby="b2b-categories-title">
          <div className="b2b-section-heading">
            <h2 id="b2b-categories-title">Our Product Categories</h2>
          </div>

          {/* Only render the grid when we have at least one category */}
          {categories.length > 0 && (
            <div className="b2b-category-grid">
              {categories.map((category) => (
                // Each card is a Next.js <Link> so it uses client-side navigation
                <Link
                  className="b2b-category-card"
                  href={`/shop/${category.category_slug}`}
                  key={category.category_id}
                >
                  {/* Category thumbnail — image resolved from slug via getCollectionImage */}
                  <span className="b2b-category-image">
                    <img
                      src={getCollectionImage(category.category_slug)}
                      alt={category.category_name}
                    />
                  </span>

                  {/* Category label + arrow icon */}
                  <span className="b2b-category-name">
                    {category.category_name}
                    <i className="fa fa-arrow-right" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------
            Quote Band
            A decorative full-width strip with a brand tagline.
            The two <span> elements act as decorative divider lines.
        ------------------------------------------------------- */}
        <section className="b2b-quote-band" aria-label="Brand statement">
          <span />
          <p>Thoughtfully crafted products for spaces people remember.</p>
          <span />
        </section>

        {/* -------------------------------------------------------
            Benefits Section
            Iterates over the `benefits` array above and renders
            each item as an <article> card with an icon, heading,
            and short description.
        ------------------------------------------------------- */}
        <section className="b2b-section b2b-benefits" aria-labelledby="b2b-benefits-title">
          <div className="b2b-section-heading">
            <h2 id="b2b-benefits-title">Why Partner With Us?</h2>
          </div>
          <div className="b2b-benefit-grid">
            {benefits.map((benefit) => (
              <article className="b2b-benefit" key={benefit.title}>
                {/* Font Awesome icon — aria-hidden keeps it decorative */}
                <div className="b2b-benefit-icon">
                  <i className={`fa ${benefit.iconClass}`} aria-hidden="true" />
                </div>
                <h4>{benefit.title}</h4>
                <p>{benefit.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------
            Contact / Enquiry Section
            Contains a headline, a short intro, and the shared
            <EnquiryForm> component configured for B2B leads.

            Props passed to EnquiryForm:
              type="b2b"               — tells the form which API
                                         endpoint / email template to use
              buttonLabel="Request Callback" — customises submit button text
        ------------------------------------------------------- */}
        <section className="b2b-contact" id="b2b-contact" aria-labelledby="b2b-contact-title">
          {/* Decorative leaf graphic (aria-hidden = purely visual) */}
          <div className="b2b-leaf" aria-hidden="true" />

          <div className="b2b-contact-copy">
            <h2 id="b2b-contact-title">Let&apos;s Work Together</h2>
            <p>
              Share your business requirements and our team will get in touch
              with you.
            </p>
          </div>

          {/* Reusable enquiry form — handles validation & API submission */}
          <EnquiryForm type="b2b" buttonLabel="Request Callback" />
        </section>

      </main>

      {/* Site-wide footer */}
      <Footer />
    </>
  );
}
