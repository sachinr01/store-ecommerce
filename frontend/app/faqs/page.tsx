// ============================================================
// FAQs Page
// Route: /faqs
//
// A fully static server component that renders a grouped
// accordion-style FAQ list. No data fetching — all content
// is defined inline in the `faqGroups` array below.
//
// Page structure:
//   1. Hero    — page title and subtitle
//   2. FAQ list — grouped <details>/<summary> accordions
//   3. CTA band — "Still have a question?" with an email link
// ============================================================

import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

// -----------------------------------------------------------
// Environment variables
// NEXT_PUBLIC_SITE_NAME — display name of the site (e.g. "nestcase")
// NEXT_PUBLIC_SITE_URL  — base URL used for canonical/OG meta tags
// -----------------------------------------------------------
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "nestcase";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

// -----------------------------------------------------------
// Page-level SEO metadata (Next.js Metadata API)
// Sets <title>, <meta description>, canonical URL,
// Open Graph (Facebook/LinkedIn previews), and Twitter card.
// -----------------------------------------------------------
export const metadata: Metadata = {
  title: `Frequently Asked Questions (FAQs)`,
  description:
    "Find answers to the most common questions about orders, shipping, returns, and more.",
  alternates: { canonical: `${SITE_URL}/faqs` },
  openGraph: {
    title: `Frequently Asked Questions (FAQs) | ${SITE_NAME}`,
    description:
      "Find answers to the most common questions about orders, shipping, returns, and more.",
    url: `${SITE_URL}/faqs`,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/og-home.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — FAQs`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Frequently Asked Questions (FAQs) | ${SITE_NAME}`,
    description:
      "Find answers to the most common questions about orders, shipping, returns, and more.",
    images: [`${SITE_URL}/images/og-home.png`],
  },
};

// -----------------------------------------------------------
// faqGroups
//
// All FAQ content lives here — no CMS or API needed.
// Structure:
//   title — group heading (e.g. "Orders & Shipping")
//   items — array of { question, answer } pairs
//
// Each group renders as a labelled section.
// Each item renders as a native <details>/<summary> accordion
// (browser-native, no JS required to open/close).
//
// To add a new FAQ:
//   - Find the matching group and push to its `items` array, OR
//   - Add a brand new group object at the end of this array.
// -----------------------------------------------------------
const faqGroups = [
  {
    title: "Orders & Shipping",
    items: [
      {
        question: "How long does delivery take?",
        answer:
          "Orders are usually delivered within 2–7 business days depending on your location.",
      },
      {
        question: "Do you offer free shipping?",
        answer:
          "Yes, we currently offer free shipping across India on prepaid orders.",
      },
      {
        question: "How can I track my order?",
        answer:
          "Once your order is shipped, tracking details will be shared via email or SMS.",
      },
    ],
  },
  {
    title: "Returns & Refunds",
    items: [
      {
        question: "What if I receive a damaged product?",
        answer:
          "Please contact us within 24 hours of delivery with product and packaging images for assistance.",
      },
      {
        question: "Do you offer returns?",
        answer:
          "Yes, eligible returns can be initiated within 7 days of delivery.",
      },
      {
        question: "How long do refunds take?",
        answer:
          "Eligible refunds are usually processed within 5–7 business days after approval.",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept UPI, credit cards, debit cards, net banking, and selected wallets.",
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        question: "Are your products dishwasher safe?",
        answer:
          "Product care instructions may vary by item. Please refer to the product description for details.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        question: "How can I contact nestcase?",
        answer:
          "You can reach us at: support@nestcase.in",
      },
      {
        question: "Still have a question?",
        answer:
          "We're here to help. Reach out to us at: support@nestcase.in",
      },
    ],
  },
];

// -----------------------------------------------------------
// FAQsPage (default export)
//
// Static server component — renders entirely on the server.
// No client-side state or interactivity needed; the accordion
// behaviour comes from native HTML <details>/<summary> elements.
// -----------------------------------------------------------
export default function FAQsPage() {
  return (
    <div className="faqs-shell">

      {/* Site-wide navigation header */}
      <Header />

      <main className="faqs-main">

        {/* -------------------------------------------------------
            Hero Section
            Displays the page title, a decorative rule, and a
            short subtitle describing what the FAQ covers.
            aria-labelledby links the <section> to the <h2> for
            screen readers.
        ------------------------------------------------------- */}
        <section className="faqs-hero" aria-labelledby="faqs-title">
          <h2 id="faqs-title">Frequently Asked Questions</h2>
          {/* Decorative horizontal rule below the title */}
          <span className="faqs-title-rule" aria-hidden="true" />
          <p>
            Find answers to the most common questions about
            <br />
            orders, shipping, returns, and more.
          </p>
        </section>

        {/* -------------------------------------------------------
            FAQ Content Area
            Wraps the grouped accordion list. The outer div
            "faqs-content-wrap" controls max-width and padding.
        ------------------------------------------------------- */}
        <div className="faqs-content-wrap">
          <section className="faqs-list" aria-label="Frequently asked questions">

            {/* Iterate over each FAQ group (e.g. "Orders & Shipping") */}
            {faqGroups.map((group) => (
              <div className="faqs-group" key={group.title}>

                {/* Group heading */}
                <h3>{group.title}</h3>
                {/* Decorative divider below the group heading */}
                <div className="faqs-group-rule" />

                <div className="faqs-items">
                  {/* Each FAQ item uses native <details>/<summary> for
                      accordion behaviour — no JavaScript required.
                      Clicking the <summary> toggles open/closed. */}
                  {group.items.map((item) => (
                    <details className="faqs-item" key={item.question}>
                      <summary>
                        {/* Question mark icon — decorative, hidden from screen readers */}
                        <span className="faqs-question-icon">
                          <i className="fa fa-question" aria-hidden="true" />
                        </span>
                        {/* The visible question text */}
                        <span className="faqs-question">{item.question}</span>
                        {/* Chevron icon that indicates expand/collapse state via CSS */}
                        <i className="fa fa-chevron-down faqs-chevron" aria-hidden="true" />
                      </summary>
                      {/* Answer shown when the <details> element is open */}
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>

              </div>
            ))}

          </section>
        </div>
      </main>

      {/* -------------------------------------------------------
          CTA Band — "Still have a question?"
          Rendered outside <main> so it spans full width as a
          standalone band above the footer.
          Contains a mailto link that opens the user's email client.
      ------------------------------------------------------- */}
      <section className="faqs-cta" aria-label="Shop now">
        <h2>Still have a question?</h2>
        <p>We're here to help. Reach out to us at support@nestcase.in</p>
        {/* mailto: link — opens the default email client */}
        <a href="mailto:support@nestcase.in" className="faqs-cta-btn">Email Now</a>
      </section>

      {/* Site-wide footer */}
      <Footer />

    </div>
  );
}
