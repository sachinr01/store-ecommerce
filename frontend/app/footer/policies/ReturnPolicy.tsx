"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function ReturnPolicyPage() {
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
              Return Policy
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
              <h2 className="uppercase">Return Policy</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Our goal is to ensure you are satisfied with your purchase. If you receive a damaged, defective, or incorrect product, eligible returns may be requested within the specified policy window.
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
              <div className="ok-row">
                <div className="ok-md-12 ok-xsd-12">
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "26px",
                    }}
                  >
                    <h3 className="uppercase" style={{ marginBottom: "10px" }}>
                      Return Policy
                    </h3>
                    <p style={{ marginBottom: "22px" }}>
                      We understand that sometimes products may not meet your expectations. This policy outlines the conditions and process for returning items to us.
                    </p>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Eligibility</h5>
                      <ul className="list-style check">
                        <li>
                          Return requests must typically be initiated within the eligible return period mentioned on the product or order details page.
                        </li>
                        <li>
                          Products must be unused, in original packaging, and accompanied by tags, invoices, and all included accessories wherever applicable.
                        </li>
                        <li>
                          Certain categories such as personalized, hygiene-sensitive, or clearance items may be non-returnable unless defective.
                        </li>
                        <li>
                          Items must not show signs of wear, damage from mishandling, or alterations beyond normal inspection.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Return Process</h5>
                      <ul className="list-style check">
                        <li>
                          Submit a return request through your account or contact customer support with your order ID and issue details.
                        </li>
                        <li>
                          Our team may request product images or additional information to verify damage, defects, or incorrect shipment.
                        </li>
                        <li>
                          Approved returns may be scheduled for pickup or require self-shipping based on serviceability and item category.
                        </li>
                        <li>
                          Please ensure items are securely packed to prevent damage during transit.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Inspection & Approval</h5>
                      <ul className="list-style check">
                        <li>
                          Returned products are subject to quality inspection upon receipt.
                        </li>
                        <li>
                          If the returned product does not meet eligibility conditions, the return may be rejected and the item may be sent back at the customer's expense.
                        </li>
                        <li>
                          Once approved, the refund or replacement process will be initiated according to the applicable policy.
                        </li>
                        <li>
                          Return approval typically takes 5-7 business days from receipt.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Return Timeline</h5>
                      <ul className="list-style check">
                        <li>
                          Standard return window: 14-30 days from delivery date (varies by product category).
                        </li>
                        <li>
                          Defective or damaged items: Return may be accepted beyond the standard window upon inspection.
                        </li>
                        <li>
                          Sale or clearance items: May have restricted or no return eligibility.
                        </li>
                      </ul>
                    </div>

                    <div
                      style={{
                        background: "#f7fffd",
                        border: "1px solid rgba(0,191,165,0.25)",
                        padding: "20px",
                      }}
                    >
                      <h5 className="uppercase" style={{ marginBottom: "8px" }}>
                        Need Help?
                      </h5>
                      <p style={{ marginBottom: "0" }}>
                        If you have questions about returning an item, contact our support team at support@okabstore.com or call +213 2020 555013.
                      </p>
                    </div>
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
