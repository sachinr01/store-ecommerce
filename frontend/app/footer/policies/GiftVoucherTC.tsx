"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function GiftVoucherTCPage() {
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
              Gift Voucher T&C
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
              <h2 className="uppercase">Gift Voucher Terms & Conditions</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Gift vouchers are issued for promotional, gifting, or goodwill purposes and are governed by the conditions below.
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
                      Gift Voucher Terms & Conditions
                    </h3>
                    <p style={{ marginBottom: "22px" }}>
                      Please review the terms and conditions for gift voucher usage before redeeming or purchasing vouchers.
                    </p>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Usage Rules</h5>
                      <ul className="list-style check">
                        <li>
                          Gift vouchers may be redeemed only within their validity period and on eligible products or categories.
                        </li>
                        <li>
                          They may be single-use unless otherwise specified.
                        </li>
                        <li>
                          Gift vouchers may not be combined with certain promotions, discounts, or other voucher codes.
                        </li>
                        <li>
                          Voucher code must be entered at checkout to claim the value.
                        </li>
                        <li>
                          One voucher per transaction unless explicitly stated otherwise.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Limitations</h5>
                      <ul className="list-style check">
                        <li>
                          Gift vouchers are non-refundable, non-transferable for cash, and cannot be exchanged for money.
                        </li>
                        <li>
                          Lost, expired, or misused vouchers may not be reissued.
                        </li>
                        <li>
                          The platform reserves the right to void vouchers in cases of fraud, abuse, or technical misuse.
                        </li>
                        <li>
                          Vouchers cannot be used in conjunction with employee discounts or wholesale pricing.
                        </li>
                        <li>
                          Partial redemption may leave remaining balance that expires on the voucher's expiry date.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Balance & Expiry</h5>
                      <ul className="list-style check">
                        <li>
                          Any unused balance after redemption may expire if not otherwise stated.
                        </li>
                        <li>
                          Voucher expiration dates are final unless a specific campaign exception is communicated.
                        </li>
                        <li>
                          Customers are encouraged to review voucher terms before placing an order.
                        </li>
                        <li>
                          Remaining balance notifications will be provided at the time of redemption.
                        </li>
                        <li>
                          Once a voucher expires, the balance cannot be recovered or reactivated.
                        </li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <h5 style={{ marginBottom: "10px" }}>Redemption Process</h5>
                      <ul className="list-style check">
                        <li>
                          Enter the unique voucher code at the checkout stage before confirming payment.
                        </li>
                        <li>
                          The voucher value will be deducted from your total order amount.
                        </li>
                        <li>
                          If the order amount exceeds the voucher value, you must pay the remaining balance.
                        </li>
                        <li>
                          If the voucher value exceeds the order amount, the remaining balance cannot be used for future purchases unless stated.
                        </li>
                        <li>
                          Redemption is immediate upon checkout confirmation.
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
                        Questions or Issues?
                      </h5>
                      <p style={{ marginBottom: "0" }}>
                        If you have questions about gift vouchers or need assistance, contact our support team at support@okabstore.com or call +213 2020 555013.
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
