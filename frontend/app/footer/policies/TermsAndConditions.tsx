"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function TermsAndConditionsPage() {
  const sections = [
    {
      heading: "Website Use",
      points: [
        "You agree to use the website only for lawful purposes and in a way that does not infringe the rights of others.",
        "Any misuse of the website, including attempts to disrupt, hack, scrape, or manipulate content or pricing, is strictly prohibited.",
        "We reserve the right to update, suspend, or discontinue any part of the website without prior notice.",
      ],
    },
    {
      heading: "Product Information",
      points: [
        "We make every effort to display products, pricing, and descriptions accurately, but occasional errors may occur.",
        "Colors, textures, and dimensions may appear slightly different depending on screen settings or handcrafted product variations.",
        "We reserve the right to correct any errors, update product details, and cancel orders affected by pricing or listing issues.",
      ],
    },
    {
      heading: "Orders & Liability",
      points: [
        "Placing an order does not guarantee acceptance; orders may be canceled if inventory, payment, or verification issues arise.",
        "We are not liable for indirect or consequential damages arising from website use, delayed deliveries, or third-party service interruptions.",
        "Continued use of the website after updates to these terms constitutes acceptance of the revised terms.",
      ],
    },
  ];

  return (
    <>
      <Header />

      <div className="dima-main">
        {/* Hero */}
        <section
          style={{
            position: "relative",
            width: "100%",
            height: "320px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/store/images/slides/shop-2.jpg"
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(30, 28, 24, 0.62)",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              padding: "0 20px",
            }}
          >
            <h2
              style={{
                color: "#fff",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "4px",
                margin: "0 0 16px 0",
              }}
            >
              Terms & Conditions
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: "60px",
                  height: "1px",
                  background: "#00cfc1",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#00cfc1",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: "60px",
                  height: "1px",
                  background: "#00cfc1",
                }}
              />
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container text-center">
              <h2 className="uppercase">Terms & Conditions of Use</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                By accessing and using this website, you agree to follow the
                terms outlined below. These terms govern your use of the site,
                products, and services offered through our store.
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section
          className="section section-colored"
          style={{ background: "#faf9f5" }}
        >
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ececec",
                  padding: "26px",
                }}
              >
                {sections.map((section) => (
                  <div key={section.heading} style={{ marginBottom: "24px" }}>
                    <h5 style={{ marginBottom: "10px" }}>{section.heading}</h5>
                    <ul className="list-style check">
                      {section.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Contact support */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container text-center">
              <h2 className="uppercase">Questions About These Terms?</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                If you have any questions about our terms and conditions, please
                contact our support team.
              </p>

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="mailto:support@okabstore.com"
                  className="button fill uppercase"
                >
                  Email Support
                </a>
                <a
                  href="/footer/about?tab=customer-support"
                  className="button stroke uppercase"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
