// ============================================================
// Contact Us Page
// Route: /contact-us
//
// Static server component that renders the full contact page.
// Page structure:
//   1. Hero          — page title and intro copy
//   2. Contact layout — two-column section:
//        Left  — support info cards (email, WhatsApp, address, hours, B2B)
//                + social media links
//        Right — EnquiryForm for direct message submission
// ============================================================

import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";
import EnquiryForm from "../components/EnquiryForm";

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
  title: `Contact Us`,
  description:
    "Contact nestcase for product queries, order support, business enquiries, bulk orders, gifting and collaborations.",
  alternates: { canonical: `${SITE_URL}/contact-us` },
  openGraph: {
    title: `Contact Us | ${SITE_NAME}`,
    description:
      "Contact nestcase for product queries, order support, business enquiries, bulk orders, gifting and collaborations.",
    url: `${SITE_URL}/contact-us`,
    siteName: SITE_NAME,
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/og-home.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Contact Us`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Contact Us | ${SITE_NAME}`,
    description:
      "Contact nestcase for product queries, order support, business enquiries, bulk orders, gifting and collaborations.",
    images: [`${SITE_URL}/images/og-home.png`],
  },
};

// -----------------------------------------------------------
// supportItems
//
// Static list of customer support contact details shown in
// the left column of the contact layout.
//
// Fields:
//   label     — display label (e.g. "Email", "WhatsApp")
//   value     — text shown to the user; supports \n for line breaks
//   href      — (optional) makes the value a clickable link
//               e.g. "mailto:..." or "https://wa.me/..."
//   iconClass — Font Awesome icon class (without the "fa " prefix)
//
// To add a new contact channel, push a new object to this array.
// If it shouldn't be a link, just omit the `href` field.
// -----------------------------------------------------------
const supportItems = [
  {
    label: "Email",
    value: "support@nestcase.in",
    href: "mailto:support@nestcase.in",
    iconClass: "fa-envelope",
  },
  {
    label: "WhatsApp",
    value: "+91 90110 38200",
    href: "https://wa.me/919011038200",  // wa.me format: country code + number, no spaces
    iconClass: "fa-whatsapp",
  },
  {
    label: "Address",
    value: `nestcase.in Pune, 
            Maharashtra India`,
    iconClass: "fa-map-marker",
  },
  {
    label: "Business Hours",
    value: "Monday - Saturday\n10:00 AM - 7:00 PM",  // \n renders as <br> in JSX below
    iconClass: "fa-clock-o",
  },
  {
    label: "Business & B2B Enquiries",
    value: "For bulk orders, gifting, hospitality partnerships, or collaborations: business@nestcase.in",
    href: "mailto:business@nestcase.in",
    iconClass: "fa-clock-o",
  },
];

// -----------------------------------------------------------
// socialLinks
//
// Static list of social media profiles shown below the
// support items. Each renders as a linked row with label
// and handle text.
//
// Fields:
//   label     — platform name (e.g. "Instagram")
//   href      — full URL to the profile
//   handle    — display handle shown next to the label
//   iconClass — Font Awesome icon class (currently commented
//               out in the JSX but kept here for easy re-enable)
//
// Note: WhatsApp is commented out below — uncomment if needed.
// -----------------------------------------------------------
const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/nestcase.in/",
    handle: "@nestcase.in",
    iconClass: "fa-instagram",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/nestcase",
    handle: "nestcase",
    iconClass: "fa-linkedin",
  },
  {
    label: "Pinterest",
    href: "https://in.pinterest.com/nestcaseofficial/",
    handle: "@nestcaseofficial",
    iconClass: "fa-pinterest",
  },
  // Uncomment below to add WhatsApp as a social link:
  // {
  //   label: "WhatsApp",
  //   href: "https://wa.me/919011038200",
  //   handle: "+91 90110 38200",
  //   iconClass: "fa-whatsapp",
  // },
];

// -----------------------------------------------------------
// ContactIcon (internal helper component)
//
// Renders a Font Awesome icon inside a styled wrapper span.
// Used to prefix each support item and social link row.
//
// Props:
//   iconClass — e.g. "fa-envelope" (combined with "fa" base class)
//
// aria-hidden="true" keeps the icon decorative for screen readers.
// -----------------------------------------------------------
function ContactIcon({ iconClass }: { iconClass: string }) {
  return (
    <span className="contact-icon">
      <i className={`fa ${iconClass}`} aria-hidden="true" />
    </span>
  );
}

// -----------------------------------------------------------
// ContactUsPage (default export)
//
// Static server component — no data fetching needed.
// All content comes from the arrays defined above.
// -----------------------------------------------------------
export default function ContactUsPage() {
  return (
    <div className="contact-page">

      {/* Site-wide navigation header */}
      <Header />

      <main className="contact-main">

        {/* -------------------------------------------------------
            Hero Section
            Page title + short intro copy.
            The <span aria-hidden> is a decorative divider line.
        ------------------------------------------------------- */}
        <section className="contact-hero" aria-labelledby="contact-title">
          <h2 id="contact-title">Contact Us</h2>
          {/* Decorative rule below the heading */}
          <span aria-hidden="true" />
          <p>
            We&apos;d love to hear from you.
            <br />
            For product queries, order support, or business enquiries - our team is here to help.
          </p>
        </section>

        {/* -------------------------------------------------------
            Contact Layout — two-column section
            Left  : "contact-info" — support details + socials
            Right : "contact-form-section" — enquiry form
        ------------------------------------------------------- */}
        <section className="contact-layout" aria-label="Contact details and enquiry form">

          {/* --- Left Column: Support Info --- */}
          <div className="contact-info">
            <h3>Customer Support</h3>
            <div className="contact-rule" />

            <div className="contact-stack">
              {/* Render each support item (email, WhatsApp, address, etc.) */}
              {supportItems.map((item) => (
                <div className="contact-row" key={item.label}>
                  {/* Icon prefix */}
                  <ContactIcon iconClass={item.iconClass} />
                  <div>
                    <strong className="contact-item-label">{item.label}</strong>

                    {/* If href exists, render value as a clickable link.
                        Otherwise, split on \n to support multi-line values
                        (e.g. business hours) using <br> elements. */}
                    {"href" in item && item.href ? (
                      <p><a href={item.href}>{item.value}</a></p>
                    ) : (
                      <p>{item.value.split("\n").map((line, i) => (
                        <span key={i}>
                          {line}
                          {/* Add <br> between lines, but not after the last one */}
                          {i < item.value.split("\n").length - 1 && <br />}
                        </span>
                      ))}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* --- Socials Row ---
                  Rendered separately from supportItems because it has
                  a nested list rather than a simple value/link. */}
              <div className="contact-row">
                <ContactIcon iconClass="fa-share-alt" />
                <div>
                  <strong className="contact-item-label">Socials</strong>
                  <div>
                    <ul className="contact-socials-list">
                      {socialLinks.map((s) => (
                        <li key={s.label}>
                          {/* Opens in a new tab; rel="noopener noreferrer" prevents
                              the new tab from accessing window.opener (security best practice) */}
                          <a
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contact-social-link"
                          >
                            {/* Icon is commented out — uncomment to show platform icons:
                                <i className={`fa ${s.iconClass}`} aria-hidden="true" /> */}
                            <span>{s.label}</span>
                            <span className="contact-social-handle">{s.handle}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* --- Right Column: Enquiry Form ---
              Uses the shared <EnquiryForm> component.
              Props:
                type="contact-us"       — determines API endpoint / email template
                buttonLabel="Send Message" — customises the submit button text
              Response time note is shown above the form as plain copy. */}
          <section className="contact-form-section" aria-labelledby="connect-title">
            <h3 id="connect-title">Let&apos;s Connect</h3>
            <div className="contact-rule" />
            <p>
              Have a question or requirement?<br />
              Fill out the form below and our team will get in touch with you.<br />
              Response Time: We usually respond within 24-48 business hours.
            </p>
            <EnquiryForm type="contact-us" buttonLabel="Send Message" />
          </section>

        </section>
      </main>

      {/* Site-wide footer */}
      <Footer />

    </div>
  );
}
