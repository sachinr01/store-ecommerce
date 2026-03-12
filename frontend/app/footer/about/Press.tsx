"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const pressReleases = [
  {
    title: "India Circus Launches New Sustainable Home Collection",
    date: "March 2026",
    source: "Lifestyle Weekly",
    excerpt:
      "India Circus unveiled a new eco-conscious range of home décor and dining products inspired by Indian biodiversity and craftsmanship.",
  },
  {
    title: "Okab Store Hits New Milestone in Customer Satisfaction",
    date: "February 2026",
    source: "Retail Insights",
    excerpt:
      "With improved delivery timelines and a modernized shopping experience, Okab reported record customer satisfaction scores this quarter.",
  },
  {
    title: "Collaborative Art-Inspired Product Line Announced",
    date: "January 2026",
    source: "Design Chronicle",
    excerpt:
      "The brand announced a limited-edition collaboration featuring artist-led motifs across mugs, cushions, and statement décor accessories.",
  },
];

const mediaContacts = [
  {
    name: "Corporate Communications",
    email: "press@okabstore.com",
    phone: "+213 2020 555013",
  },
  {
    name: "Partnerships & Collaborations",
    email: "media@okabstore.com",
    phone: "+213 7700 900106",
  },
];

export default function PressPage() {
  return (
    <>
      <Header />

      <div className="dima-main">
        {/* Hero */}
        <section
          style={{
            position: "relative",
            width: "100%",
            height: "300px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="store/images/slides/shop-2.jpg"
            alt="Press Banner"
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
              background: "rgba(24, 23, 20, 0.60)",
            }}
          />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
            <h2
              className="uppercase undertitle"
              style={{
                color: "#fff",
                letterSpacing: "3px",
                marginBottom: "12px",
              }}
            >
              Press
            </h2>
            <div className="topaz-line">
              <i className="di-separator"></i>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container text-center">
              <h3 className="uppercase">Media & Newsroom</h3>
              <p>
                Welcome to our press room. Here you can find company announcements,
                media resources, official updates, and contact details for
                journalists and editorial teams.
              </p>
            </div>
          </div>
        </section>

        {/* Press releases + media contacts */}
        <section className="section section-colored" style={{ background: "#faf9f5" }}>
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {/* Left: Releases */}
                <div className="ok-md-8 ok-xsd-12">
                  <h4 className="uppercase">Latest Press Releases</h4>
                  <div className="clear"></div>

                  {pressReleases.map((item) => (
                    <article
                      key={item.title}
                      style={{
                        background: "#fff",
                        border: "1px solid #e9e9e9",
                        padding: "24px",
                        marginBottom: "20px",
                      }}
                    >
                      <h5 style={{ marginBottom: "8px" }}>{item.title}</h5>
                      <p style={{ marginBottom: "10px", color: "#888", fontSize: "13px" }}>
                        {item.date} • {item.source}
                      </p>
                      <p style={{ marginBottom: "0" }}>{item.excerpt}</p>
                    </article>
                  ))}
                </div>

                {/* Right: Contact */}
                <div className="ok-md-4 ok-xsd-12">
                  <h4 className="uppercase">Media Contacts</h4>
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e9e9e9",
                      padding: "24px",
                    }}
                  >
                    <p style={{ marginBottom: "16px" }}>
                      For press inquiries, interviews, partnership announcements,
                      and brand-related media requests:
                    </p>

                    {mediaContacts.map((contact) => (
                      <div key={contact.email} style={{ marginBottom: "16px" }}>
                        <h6 style={{ marginBottom: "6px" }}>{contact.name}</h6>
                        <p style={{ margin: 0 }}>
                          <strong>Email:</strong> {contact.email}
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Phone:</strong> {contact.phone}
                        </p>
                      </div>
                    ))}

                    <a
                      href="mailto:press@okabstore.com"
                      className="button fill"
                      style={{ marginTop: "8px", display: "inline-block" }}
                    >
                      Contact Press Team
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
