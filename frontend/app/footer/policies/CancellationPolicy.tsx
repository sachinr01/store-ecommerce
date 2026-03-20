"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function CancellationPolicyPage() {
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
              Cancellation Policy
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
              <h2 className="uppercase">Cancellation Policy</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Orders may be canceled before dispatch, subject to order status, product category, and operational constraints.
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
                      Cancellation Policy
                    </h3>
                    <p style={{ marginBottom: "22px" }}>
                      We understand that plans can change. This policy explains how and when you can cancel your order.
                    </p>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Customer-Initiated Cancellations</h5>
                      <ul className="list-style check">
                        <li>
                          You may request order cancellation before the item is packed or shipped.
                        </li>
                        <li>
                          Some made-to-order, limited-edition, or promotional items may not be eligible for cancellation after confirmation.
                        </li>
                        <li>
                          If cancellation is approved, the refund process will begin as per the refund policy.
                        </li>
                        <li>
                          Cancellation requests should be submitted within 2 hours of order placement for best results.
                        </li>
                        <li>
                          Contact our support team immediately if you wish to cancel your order.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Seller / Platform Cancellations</h5>
                      <ul className="list-style check">
                        <li>
                          We may cancel orders due to stock unavailability, payment verification issues, pricing discrepancies, or operational limitations.
                        </li>
                        <li>
                          In such cases, customers will be notified immediately via email or SMS.
                        </li>
                        <li>
                          Eligible refunds will be processed according to our refund policy.
                        </li>
                        <li>
                          Repeated suspicious ordering behavior may lead to cancellation or account review.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>After Dispatch</h5>
                      <ul className="list-style check">
                        <li>
                          Once an order has been dispatched, it may no longer be eligible for direct cancellation.
                        </li>
                        <li>
                          In such cases, customers may need to follow the return process after delivery, where applicable.
                        </li>
                        <li>
                          Cancellation eligibility depends on shipment stage, courier processing, and item category.
                        </li>
                        <li>
                          If the order is in transit, you may request a return upon delivery if the item meets return eligibility criteria.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Cancellation Charges</h5>
                      <ul className="list-style check">
                        <li>
                          No charges are applied if the order is canceled before it is packed or dispatched.
                        </li>
                        <li>
                          If cancellation is requested after partial processing, handling charges may apply depending on the circumstances.
                        </li>
                        <li>
                          Cancellations initiated by us due to system errors will result in a full refund with no deductions.
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
                        Quick Cancellation
                      </h5>
                      <p style={{ marginBottom: "0" }}>
                        To cancel your order quickly, contact our support team immediately at support@okabstore.com or call +213 2020 555013. Provide your order ID and reason for cancellation.
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
