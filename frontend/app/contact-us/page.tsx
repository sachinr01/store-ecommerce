import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";
import EnquiryForm from "../components/EnquiryForm";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "nestcase";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  title: `Contact Us`,
  description:
    "Contact nestcase for product queries, order support, business enquiries, bulk orders, gifting and collaborations.",
  alternates: { canonical: `${SITE_URL}/contact-us` },
};

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
    href: "https://wa.me/919011038200",
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
    value: "Monday - Saturday\n10:00 AM - 7:00 PM",
    iconClass: "fa-clock-o",
  },
  {
    label: "Business & B2B Enquiries",
    value: "For bulk orders, gifting, hospitality partnerships, or collaborations: business@nestcase.in",
    href: "mailto:business@nestcase.in",
    iconClass: "fa-clock-o",
  },
];

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
  // {
  //   label: "WhatsApp",
  //   href: "https://wa.me/919011038200",
  //   handle: "+91 90110 38200",
  //   iconClass: "fa-whatsapp",
  // },
];

function ContactIcon({ iconClass }: { iconClass: string }) {
  return (
    <span className="contact-icon">
      <i className={`fa ${iconClass}`} aria-hidden="true" />
    </span>
  );
}

export default function ContactUsPage() {
  return (
    <div className="contact-page">
      <Header />
      <main className="contact-main">
        <section className="contact-hero" aria-labelledby="contact-title">
          <h2 id="contact-title">Contact Us</h2>
          <span aria-hidden="true" />
          <p>
            We&apos;d love to hear from you.
            <br />
            For product queries, order support, or business enquiries - our team is here to help.
          </p>
        </section>

        <section className="contact-layout" aria-label="Contact details and enquiry form">
          <div className="contact-info">
            <h3>Customer Support</h3>
            <div className="contact-rule" />
            <div className="contact-stack">
              {supportItems.map((item) => (
                <div className="contact-row" key={item.label}>
                  <ContactIcon iconClass={item.iconClass} />
                  <div>
                    <strong className="contact-item-label">{item.label}</strong>
                    {"href" in item && item.href ? (
                      <p><a href={item.href}>{item.value}</a></p>
                    ) : (
                      <p>{item.value.split("\n").map((line, i) => (
                        <span key={i}>{line}{i < item.value.split("\n").length - 1 && <br />}</span>
                      ))}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Socials */}
              <div className="contact-row">
                <ContactIcon iconClass="fa-share-alt" />
                <div>
                  <strong className="contact-item-label">Socials</strong>
                  <div>
                  <ul className="contact-socials-list">
                    {socialLinks.map((s) => (
                      <li key={s.label}>
                        <a href={s.href} target="_blank" rel="noopener noreferrer" className="contact-social-link">
                          {/* <i className={`fa ${s.iconClass}`} aria-hidden="true" /> */}
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

      <Footer />
    </div>
  );
}
