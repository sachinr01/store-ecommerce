// ============================================================
// About Us Page
// Route: /about-us
//
// A purely static server component — no data fetching needed.
// It renders five content sections:
//   1. Banner       — full-width hero image
//   2. USPs         — three key selling points in a card grid
//   3. How We Design — split layout with copy + product image
//   4. Why The Name  — brand story explaining "nestcase"
//   5. Our Promise   — closing brand statement
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
  title: `About Us`,
  description:
    "Discover the design philosophy behind nestcase and the details that shape everyday living.",
  alternates: { canonical: `${SITE_URL}/about-us` },
  openGraph: {
    title: `About Us | ${SITE_NAME}`,
    description:
      "Discover the design philosophy behind nestcase and the details that shape everyday living.",
    url: `${SITE_URL}/about-us`,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/og-home.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — About Us`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `About Us | ${SITE_NAME}`,
    description:
      "Discover the design philosophy behind nestcase and the details that shape everyday living.",
    images: [`${SITE_URL}/images/og-home.png`],
  },
};

// -----------------------------------------------------------
// uspItems
//
// Static data for the "OUR USPs" section.
// Each object renders as a card with an icon, heading, and body.
//
// Fields:
//   title — card heading
//   body  — short description paragraph
//   icon  — Font Awesome icon class (without the "fa " prefix)
//
// To add a new USP, push a new object to this array.
// The grid layout will adapt automatically via CSS.
// -----------------------------------------------------------
const uspItems = [
  {
    title: "Thoughtfully Designed",
    body:
      "Timeless aesthetics with a focus on functionality, comfort, and products that fit seamlessly into modern homes.",
    icon: "fa-pencil",
  },
  {
    title: "Quality You Can Trust",
    body:
      "Made with carefully chosen materials and crafted to last. Our products are durable, safe, and made for daily use.",
    icon: "fa-shield",
  },
  {
    title: "Everyday Made Better",
    body:
      "Microwave-safe, dishwasher-safe, and easy to maintain - designed to bring simplicity and ease to your everyday.",
    icon: "fa-home",
  },
];

// -----------------------------------------------------------
// SectionLabel (internal helper component)
//
// Renders a small labelled tag above section headings, e.g.:
//   ── OUR USPs ──────────────────
//
// Props:
//   children — the label text (string)
//
// The decorative line (<span aria-hidden>) is purely visual
// and hidden from screen readers.
// -----------------------------------------------------------
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="aboutus-label-wrap">
      {/* Pill-style label text */}
      <span className="aboutus-label">{children}</span>
      {/* Decorative horizontal rule — hidden from assistive tech */}
      <span className="aboutus-label-line" aria-hidden="true" />
    </div>
  );
}

// -----------------------------------------------------------
// AboutUsPage (default export)
//
// Static server component — renders on the server with no
// client-side JS required. No props or params needed.
// -----------------------------------------------------------
export default function AboutUsPage() {
  return (
    <div className="aboutus-page">

      {/* Site-wide navigation header */}
      <Header />

      <main className="aboutus-main">

        {/* -------------------------------------------------------
            1. Banner Section
            Full-width hero image at the top of the page.
            No overlay text — purely visual introduction.
        ------------------------------------------------------- */}
        <section className="aboutus-banner">
          <img
            src="/images/about/about-banner.webp"
            alt="About nestcase"
            className="aboutus-banner-img"
          />
        </section>

        {/* -------------------------------------------------------
            2. USPs Section ("OUR USPs")
            Iterates over `uspItems` and renders each as an
            <article> card with a Font Awesome icon, heading,
            and short description paragraph.
        ------------------------------------------------------- */}
        <section className="aboutus-usps">
          <div className="aboutus-shell">
            <div className="aboutus-usps-heading">
              <SectionLabel>OUR USPs</SectionLabel>
            </div>

            <div className="aboutus-usps-grid">
              {uspItems.map((item) => (
                <article className="aboutus-usp-card" key={item.title}>
                  {/* Icon — aria-hidden because it's decorative */}
                  <div className="aboutus-usp-icon">
                    <i className={`fa ${item.icon}`} aria-hidden="true" />
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------
            3. How We Design Section
            Split layout:
              Left  — copy block explaining the design process
              Right — product lifestyle image (ceramic bowl/plates)

            CSS class "aboutus-split" handles the two-column layout.
            "aboutus-split-spacious" adds extra vertical spacing.
        ------------------------------------------------------- */}
        <section className="aboutus-process">
          <div className="aboutus-shell aboutus-split aboutus-split-spacious">

            {/* Text copy column */}
            <div className="aboutus-copy">
              <SectionLabel>HOW WE DESIGN</SectionLabel>
              <h2 className="aboutus-section-title">
                Intentional from
                <br />
                the very beginning.
              </h2>
              <p>
                Every product starts with a simple question - would we
                genuinely love using this ourselves every day?
              </p>
              <p>
                From shapes and proportions to textures and finishes, we refine
                every detail to strike the right balance between beauty and
                practicality.
              </p>
            </div>

            {/* Image column */}
            <div className="aboutus-art aboutus-art-bowl">
              <img
                src="/images/about/about-cn.webp"
                alt="Minimal ceramic bowl and plates"
              />
            </div>

          </div>
        </section>

        {/* -------------------------------------------------------
            4. Why The Name Section
            Explains the meaning behind the brand name "nestcase".
            Layout:
              Left  — two-column text grid (name breakdown + combined meaning)
              Right — lifestyle image (vase and bowl on books)
        ------------------------------------------------------- */}
        <section className="aboutus-name">
          <div className="aboutus-shell aboutus-name-grid">

            <div className="aboutus-name-content">
              <div className="aboutus-name-head">
                <SectionLabel>WHY THE NAME</SectionLabel>
                <h2 className="aboutus-section-title aboutus-name-title">
                  Why &quot;nestcase&quot;?
                </h2>
              </div>

              {/* Two-column copy layout inside the name section */}
              <div className="aboutus-name-columns">

                {/* Left column — individual word meanings */}
                <div className="aboutus-name-copy">
                  <p>
                    &quot;Nest&quot; represents warmth, comfort, belonging, and
                    the feeling of home.
                  </p>
                  <p>
                    &quot;Case&quot; represents the everyday essentials we keep
                    close to our lives - the objects that quietly become part
                    of our routines and moments.
                  </p>
                </div>

                {/* Right column — combined meaning + brand tagline */}
                <div className="aboutus-name-center">
                  <p>
                    Together, nestcase reflects thoughtfully designed products
                    created to naturally belong in modern homes.
                  </p>
                  {/* Emphasis text — styled distinctly via CSS */}
                  <p className="aboutus-name-emphasis">
                    Not loud. Not excessive.
                    <br />
                    Just intentional design for everyday living.
                  </p>
                </div>

              </div>
            </div>

            {/* Lifestyle image column */}
            <div className="aboutus-art aboutus-art-vase">
              <img
                src="/images/about/about-ls.webp"
                alt="Ceramic vase and bowl on stacked books"
              />
            </div>

          </div>
        </section>

        {/* -------------------------------------------------------
            5. Our Promise Section
            Closing brand statement — centred layout with a
            headline, supporting copy, and a brand design motto.

            "aboutus-promise-tag" is the all-caps design motto
            rendered at the very bottom of this section.
        ------------------------------------------------------- */}
        <section className="aboutus-promise">
          <div className="aboutus-shell aboutus-promise-inner">
            <SectionLabel>OUR PROMISE</SectionLabel>
            <h2 className="aboutus-promise-title">
              We do not just design products.
              <br />
              We design experiences for everyday living.
            </h2>
            <p className="aboutus-promise-copy">
              We are still growing, still learning, and still designing
              products we truly love.
            </p>
            {/* Brand motto — displayed in uppercase tracked lettering */}
            <p className="aboutus-promise-tag">DESIGNED FOR MODERN LIVING.</p>
          </div>
        </section>

      </main>

      {/* Site-wide footer */}
      <Footer />

    </div>
  );
}
