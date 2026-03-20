"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function RefundPolicyPage() {
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
              Refund Policy
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
              <h2 className="uppercase">Refund Policy</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Refunds are processed after successful return approval, cancellation confirmation, or failure to deliver due to valid operational issues.
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
                      Refund Policy
                    </h3>
                    <p style={{ marginBottom: "22px" }}>
                      Once your return is approved, we process your refund promptly. Please review the refund scenarios, timeline, and important notes below.
                    </p>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Refund Scenarios</h5>
                      <ul className="list-style check">
                        <li>
                          Refunds may be issued for canceled orders, approved returns, undeliverable shipments, or verified payment duplications.
                        </li>
                        <li>
                          If a product is damaged, defective, or materially different from the listing, refund eligibility will depend on inspection and approval.
                        </li>
                        <li>
                          Shipping charges may or may not be refunded depending on the nature of the issue and order status.
                        </li>
                        <li>
                          Refunds for defective items are issued in full, including original shipping costs.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Refund Timeline</h5>
                      <ul className="list-style check">
                        <li>
                          Once approved, refunds are generally initiated within 3-5 business days.
                        </li>
                        <li>
                          Credit card, debit card, net banking, wallet, and UPI refunds may reflect based on banking partner timelines (5-10 business days).
                        </li>
                        <li>
                          COD refunds may require bank account details and may take additional processing time (7-15 business days).
                        </li>
                        <li>
                          Refunds during weekends or holidays may be processed on the next business day.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Payment Method Refunds</h5>
                      <ul className="list-style check">
                        <li>
                          Credit/Debit Card: Refund reflects in 5-10 business days depending on your bank.
                        </li>
                        <li>
                          Net Banking: Refund typically reflects within 5-7 business days.
                        </li>
                        <li>
                          Digital Wallets (PayPal, Google Pay, etc.): Refund reflects within 3-5 business days.
                        </li>
                        <li>
                          UPI: Refund reflects within 5-7 business days.
                        </li>
                        <li>
                          Bank Transfer: Refund reflects within 7-10 business days.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Important Notes</h5>
                      <ul className="list-style check">
                        <li>
                          Refund processing speed may vary due to banks, payment partners, holidays, or verification delays.
                        </li>
                        <li>
                          If you do not receive the refund within the expected period, please contact support with your order details and we will investigate.
                        </li>
                        <li>
                          Refunds will usually be made to the original payment method unless otherwise communicated by our team.
                        </li>
                        <li>
                          In rare cases where refund cannot be issued to the original method, we will offer an alternative refund method.
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
                        Refund Status
                      </h5>
                      <p style={{ marginBottom: "0" }}>
                        You can track your refund status through your account dashboard or by contacting support@okabstore.com.
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
