"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const supportChannels = [
  {
    title: "Order Support",
    icon: "fa-shopping-bag",
    description:
      "Need help with order status, delivery timelines, cancellations, or returns? Our order specialists are here to assist you quickly.",
    email: "orders@okabstore.com",
    phone: "+213 2020 555013",
    hours: "Mon - Sat: 9:00 AM - 8:00 PM",
  },
  {
    title: "Product Assistance",
    icon: "fa-cube",
    description:
      "Get product recommendations, material details, care instructions, and sizing/dimension guidance before you place an order.",
    email: "products@okabstore.com",
    phone: "+213 7700 900106",
    hours: "Mon - Sat: 10:00 AM - 7:30 PM",
  },
  {
    title: "Payments & Refunds",
    icon: "fa-credit-card",
    description:
      "Facing payment issues or waiting for a refund update? We can help verify transactions and share refund progress.",
    email: "payments@okabstore.com",
    phone: "+213 6600 123456",
    hours: "Mon - Fri: 9:30 AM - 6:30 PM",
  },
];

const faqItems = [
  {
    q: "How can I track my order?",
    a: "You can visit the Track Order page from the footer and enter your order ID with email/phone to view real-time status updates.",
  },
  {
    q: "What is the typical delivery time?",
    a: "Most orders are delivered within 3-7 business days depending on your city, product availability, and courier serviceability.",
  },
  {
    q: "How do I request a return?",
    a: "Return requests can be initiated from your account orders section or by contacting support within the eligible return window.",
  },
  {
    q: "When will I receive my refund?",
    a: "After quality check and return approval, refunds are usually processed within 5-10 business days to the original payment mode.",
  },
];

export default function CustomerSupportPage() {
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
            src="/store/images/slides/shop-1.jpg"
            alt="Customer Support Banner"
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
              Customer Support
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
              <h2 className="uppercase">How Can We Help You?</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                We are committed to providing a smooth shopping experience.
                <br />
                Reach us through the right support channel for faster assistance.
              </p>
            </div>
          </div>
        </section>

        {/* Support Channels */}
        <section
          className="section section-colored"
          style={{ background: "#faf9f5" }}
        >
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {supportChannels.map((channel) => (
                  <div key={channel.title} className="ok-md-4 ok-xsd-12">
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #ececec",
                        padding: "24px",
                        marginBottom: "24px",
                        height: "100%",
                      }}
                    >
                      <h4 className="uppercase" style={{ marginBottom: "12px" }}>
                        <i
                          className={`fa ${channel.icon} theme-color`}
                          style={{ marginRight: "8px" }}
                        ></i>
                        {channel.title}
                      </h4>

                      <p style={{ marginBottom: "14px" }}>{channel.description}</p>
                      <p style={{ marginBottom: "8px" }}>
                        <strong>Email:</strong> {channel.email}
                      </p>
                      <p style={{ marginBottom: "8px" }}>
                        <strong>Phone:</strong> {channel.phone}
                      </p>
                      <p style={{ marginBottom: "0" }}>
                        <strong>Hours:</strong> {channel.hours}
                      </p>

                      <a
                        href={`mailto:${channel.email}`}
                        className="button stroke uppercase"
                        style={{ marginTop: "14px", display: "inline-block" }}
                      >
                        Contact
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Help Request Form + FAQ */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {/* Form */}
                <div className="ok-md-6 ok-xsd-12">
                  <h3 className="uppercase">Raise a Support Request</h3>
                  <div className="clear"></div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "22px",
                    }}
                  >
                    <div style={{ marginBottom: "12px" }}>
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
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "6px" }}>
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #ddd",
                          background: "#fff",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "6px" }}>
                        Order ID (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. OKB123456"
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #ddd",
                          background: "#fff",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", marginBottom: "6px" }}>
                        Support Topic
                      </label>
                      <select
                        defaultValue=""
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #ddd",
                          background: "#fff",
                        }}
                      >
                        <option value="" disabled>
                          Select a topic
                        </option>
                        <option value="order">Order Issue</option>
                        <option value="product">Product Query</option>
                        <option value="payment">Payment / Refund</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "6px" }}>
                        Message
                      </label>
                      <textarea
                        placeholder="Describe your issue..."
                        rows={5}
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "1px solid #ddd",
                          background: "#fff",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <button className="button fill uppercase">
                      Submit Request
                    </button>
                  </div>
                </div>

                {/* FAQ */}
                <div className="ok-md-6 ok-xsd-12">
                  <h3 className="uppercase">Frequently Asked Questions</h3>
                  <div className="clear"></div>

                  {faqItems.map((faq) => (
                    <div
                      key={faq.q}
                      style={{
                        background: "#fff",
                        border: "1px solid #ececec",
                        padding: "18px 20px",
                        marginBottom: "12px",
                      }}
                    >
                      <h5 style={{ marginBottom: "8px" }}>{faq.q}</h5>
                      <p style={{ marginBottom: "0" }}>{faq.a}</p>
                    </div>
                  ))}

                  <div
                    style={{
                      background: "#f7fffd",
                      border: "1px solid rgba(0,191,165,0.25)",
                      padding: "20px",
                      marginTop: "14px",
                    }}
                  >
                    <h5 className="uppercase" style={{ marginBottom: "8px" }}>
                      Priority Support
                    </h5>
                    <p style={{ marginBottom: "10px" }}>
                      For urgent order concerns, call us directly and select the
                      “Priority” option.
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Hotline:</strong> +213 2020 555013
                    </p>
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
