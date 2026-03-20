"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const recentOrders = [
  {
    orderId: "OKB-10256",
    date: "08 Mar 2026",
    status: "In Transit",
    eta: "12 Mar 2026",
  },
  {
    orderId: "OKB-10231",
    date: "04 Mar 2026",
    status: "Delivered",
    eta: "Delivered on 07 Mar 2026",
  },
  {
    orderId: "OKB-10188",
    date: "26 Feb 2026",
    status: "Processing",
    eta: "Expected Dispatch: 10 Mar 2026",
  },
];

export default function TrackOrderPage() {
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
            alt="Track Order Banner"
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
              Track Order
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
              <h2 className="uppercase">Order Status Lookup</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Enter your order details below to check the latest shipment and
                delivery updates.
                <br />
                You can track by order ID and the email used during checkout.
              </p>
            </div>
          </div>
        </section>

        {/* Form + Help */}
        <section className="section section-colored" style={{ background: "#faf9f5" }}>
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {/* Left: Lookup form */}
                <div className="ok-md-8 ok-xsd-12">
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "26px",
                    }}
                  >
                    <h4 className="uppercase" style={{ marginBottom: "16px" }}>
                      Track Your Shipment
                    </h4>

                    <div className="ok-row">
                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>
                          Order ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. OKB-10256"
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            marginBottom: "14px",
                            padding: "12px",
                            border: "1px solid #ddd",
                            background: "#fff",
                          }}
                        />
                      </div>

                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            marginBottom: "14px",
                            padding: "12px",
                            border: "1px solid #ddd",
                            background: "#fff",
                          }}
                        />
                      </div>

                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>
                          Phone (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="+213..."
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            marginBottom: "14px",
                            padding: "12px",
                            border: "1px solid #ddd",
                            background: "#fff",
                          }}
                        />
                      </div>

                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>
                          Delivery Postcode
                        </label>
                        <input
                          type="text"
                          placeholder="Postcode"
                          style={{
                            width: "100%",
                            marginTop: "8px",
                            marginBottom: "14px",
                            padding: "12px",
                            border: "1px solid #ddd",
                            background: "#fff",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: "6px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button className="button fill uppercase">Track Now</button>
                      <button className="button stroke uppercase">Reset</button>
                    </div>
                  </div>
                </div>

                {/* Right: Support info */}
                <div className="ok-md-4 ok-xsd-12">
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #ececec",
                      padding: "26px",
                    }}
                  >
                    <h4 className="uppercase" style={{ marginBottom: "14px" }}>
                      Need Help?
                    </h4>
                    <p style={{ marginBottom: "10px" }}>
                      If your order is delayed or you cannot find tracking details,
                      our support team can help.
                    </p>
                    <p style={{ marginBottom: "6px" }}>
                      <i className="fa fa-phone theme-color"></i> +213 2020 555013
                    </p>
                    <p style={{ marginBottom: "6px" }}>
                      <i className="fa fa-envelope theme-color"></i>{" "}
                      support@okabstore.com
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      <i className="fa fa-clock-o theme-color"></i> Mon - Sat:
                      10:00 AM - 8:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Orders */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase text-center">Recent Order Updates</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>

              <div className="ok-row">
                {recentOrders.map((order) => (
                  <div key={order.orderId} className="ok-md-4 ok-xsd-12">
                    <div
                      style={{
                        border: "1px solid #ececec",
                        background: "#fff",
                        padding: "22px",
                        marginBottom: "20px",
                      }}
                    >
                      <h5 style={{ marginBottom: "8px" }}>{order.orderId}</h5>
                      <p style={{ marginBottom: "6px" }}>
                        <strong>Order Date:</strong> {order.date}
                      </p>
                      <p style={{ marginBottom: "6px" }}>
                        <strong>Status:</strong>{" "}
                        <span className="theme-color">{order.status}</span>
                      </p>
                      <p style={{ marginBottom: 0 }}>
                        <strong>Update:</strong> {order.eta}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
