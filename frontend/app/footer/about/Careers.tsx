"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const openings = [
  {
    title: "E-commerce Operations Executive",
    type: "Full Time",
    location: "London / Hybrid",
    experience: "2-4 Years",
    summary:
      "Manage daily storefront operations, order flow coordination, catalog updates, and customer experience improvements across the e-commerce platform.",
    responsibilities: [
      "Monitor product listings, stock visibility, and order status updates.",
      "Coordinate with logistics and customer support teams.",
      "Track marketplace and website operational performance.",
      "Improve order processing efficiency and customer satisfaction.",
    ],
  },
  {
    title: "UI / UX Designer",
    type: "Full Time",
    location: "Manchester / Remote",
    experience: "3-5 Years",
    summary:
      "Design intuitive shopping experiences, campaign landing pages, and responsive user journeys that improve conversion and engagement.",
    responsibilities: [
      "Create user-friendly interfaces for web and mobile shopping flows.",
      "Build design systems and reusable e-commerce components.",
      "Collaborate with developers on implementation quality.",
      "Support product discovery, checkout, and post-purchase journeys.",
    ],
  },
  {
    title: "Customer Support Specialist",
    type: "Full Time",
    location: "Birmingham / On-site",
    experience: "1-3 Years",
    summary:
      "Deliver high-quality customer assistance for orders, returns, product questions, and delivery issues while maintaining a premium support experience.",
    responsibilities: [
      "Handle customer queries through email and phone support.",
      "Resolve delivery, return, and refund concerns quickly.",
      "Coordinate with warehouse and payments teams.",
      "Maintain clear issue tracking and follow-up communication.",
    ],
  },
];

const benefits = [
  "Competitive salary and performance-based growth",
  "Flexible work model for eligible roles",
  "Learning support and skill development programs",
  "Friendly, collaborative, and design-driven culture",
  "Employee discounts on selected product collections",
  "Career progression opportunities across teams",
];

export default function CareersPage() {
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
            alt="Careers Banner"
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
              Careers
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
              <h2 className="uppercase">Build Your Career With Us</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Join our growing e-commerce team and help shape modern shopping
                experiences across design, operations, customer support, and
                digital commerce.
                <br />
                We are looking for people who care about quality, creativity,
                and customer-first execution.
              </p>
            </div>
          </div>
        </section>

        {/* Open roles + why join */}
        <section
          className="section section-colored"
          style={{ background: "#faf9f5" }}
        >
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {/* Open positions */}
                <div className="ok-md-8 ok-xsd-12">
                  <h4 className="uppercase">Current Openings</h4>
                  <div className="clear"></div>

                  {openings.map((job) => (
                    <article
                      key={job.title}
                      style={{
                        background: "#fff",
                        border: "1px solid #ececec",
                        padding: "24px",
                        marginBottom: "22px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                          marginBottom: "10px",
                        }}
                      >
                        <h5 style={{ marginBottom: 0 }}>{job.title}</h5>
                        <span
                          style={{
                            background: "rgba(0, 191, 165, 0.1)",
                            color: "#00bfa5",
                            padding: "6px 10px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {job.type}
                        </span>
                      </div>

                      <p
                        style={{
                          marginBottom: "12px",
                          color: "#777",
                          fontSize: "13px",
                        }}
                      >
                        {job.location} • {job.experience}
                      </p>

                      <p style={{ marginBottom: "14px" }}>{job.summary}</p>

                      <ul className="list-style check">
                        {job.responsibilities.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>

                      <div style={{ marginTop: "16px" }}>
                        <a href="mailto:careers@okabstore.com" className="button fill uppercase">
                          Apply Now
                        </a>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Sidebar */}
                <div className="ok-md-4 ok-xsd-12">
                  <h4 className="uppercase">Why Join OKAB</h4>
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "24px",
                      marginBottom: "20px",
                    }}
                  >
                    <p style={{ marginBottom: "14px" }}>
                      We combine retail, design, and digital innovation to build
                      a better commerce experience for customers and teams.
                    </p>
                    <ul className="list-style check">
                      {benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "24px",
                    }}
                  >
                    <h5 className="uppercase" style={{ marginBottom: "10px" }}>
                      HR Contact
                    </h5>
                    <p style={{ marginBottom: "6px" }}>
                      <strong>Email:</strong> careers@okabstore.com
                    </p>
                    <p style={{ marginBottom: "6px" }}>
                      <strong>Phone:</strong> +213 2020 555013
                    </p>
                    <p style={{ marginBottom: "0" }}>
                      <strong>Hours:</strong> Mon - Fri: 9:30 AM - 6:30 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Application form */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase text-center">Send Your Application</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ececec",
                  padding: "26px",
                  marginTop: "20px",
                }}
              >
                <div className="ok-row">
                  <div className="ok-md-6 ok-xsd-12">
                    <label style={{ display: "block", marginBottom: "6px" }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        marginBottom: "14px",
                      }}
                    />
                  </div>

                  <div className="ok-md-6 ok-xsd-12">
                    <label style={{ display: "block", marginBottom: "6px" }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        marginBottom: "14px",
                      }}
                    />
                  </div>

                  <div className="ok-md-6 ok-xsd-12">
                    <label style={{ display: "block", marginBottom: "6px" }}>
                      Role Interested In
                    </label>
                    <select
                      defaultValue=""
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        marginBottom: "14px",
                      }}
                    >
                      <option value="" disabled>
                        Select a role
                      </option>
                      {openings.map((job) => (
                        <option key={job.title} value={job.title}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ok-md-6 ok-xsd-12">
                    <label style={{ display: "block", marginBottom: "6px" }}>
                      Experience
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 3 Years"
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        marginBottom: "14px",
                      }}
                    />
                  </div>

                  <div className="ok-md-12 ok-xsd-12">
                    <label style={{ display: "block", marginBottom: "6px" }}>
                      Cover Note
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Tell us about your background and why you want to join..."
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                        resize: "vertical",
                        marginBottom: "16px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="button fill uppercase">Submit Application</button>
                  <a
                    href="mailto:careers@okabstore.com"
                    className="button stroke uppercase"
                  >
                    Email Resume
                  </a>
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
