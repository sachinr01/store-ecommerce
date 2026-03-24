"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { useAuth } from "@/app/lib/authContext";

interface Order {
  order_id: number;
  order_status: string;
  order_date: string;
  total: string;
  items: string;
}

const STATUS_LABEL: Record<string, string> = {
  "wc-pending":    "Pending",
  "wc-processing": "Processing",
  "wc-on-hold":    "On Hold",
  "wc-completed":  "Completed",
  "wc-cancelled":  "Cancelled",
  "wc-refunded":   "Refunded",
  "wc-failed":     "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  "wc-completed":  "#2bbfaa",
  "wc-processing": "#f0a500",
  "wc-cancelled":  "#c62828",
  "wc-refunded":   "#888",
  "wc-failed":     "#c62828",
  "wc-pending":    "#888",
  "wc-on-hold":    "#f0a500",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TrackOrderPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    setOrdersLoading(true);
    fetch("/store/api/orders/my", { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        if (json.success) setOrders(json.data || []);
        else setOrdersError(json.message || "Failed to load orders.");
      })
      .catch(() => setOrdersError("Could not connect to server."))
      .finally(() => setOrdersLoading(false));
  }, [isLoggedIn]);

  return (
    <>
      <Header />
      <div className="dima-main">

        {/* Hero */}
        <section style={{ position: "relative", width: "100%", height: "320px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/store/images/slides/shop-1.jpg" alt="Track Order Banner"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(30,28,24,0.62)" }} />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 20px" }}>
            <h2 style={{ color: "#fff", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "4px", margin: "0 0 16px 0" }}>
              Track Order
            </h2>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <span style={{ display: "block", width: "60px", height: "1px", background: "#00cfc1" }} />
              <span style={{ display: "block", width: "8px", height: "8px", borderRadius: "50%", background: "#00cfc1" }} />
              <span style={{ display: "block", width: "60px", height: "1px", background: "#00cfc1" }} />
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container text-center">
              <h2 className="uppercase">Order Status Lookup</h2>
              <div className="topaz-line"><i className="di-separator"></i></div>
              <p>
                Enter your order details below to check the latest shipment and delivery updates.<br />
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
                <div className="ok-md-8 ok-xsd-12">
                  <div style={{ background: "#fff", border: "1px solid #ececec", padding: "26px" }}>
                    <h4 className="uppercase" style={{ marginBottom: "16px" }}>Track Your Shipment</h4>
                    <div className="ok-row">
                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>Order ID</label>
                        <input type="text" placeholder="e.g. OKB-10256"
                          style={{ width: "100%", marginTop: "8px", marginBottom: "14px", padding: "12px", border: "1px solid #ddd", background: "#fff" }} />
                      </div>
                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>Email Address</label>
                        <input type="email" placeholder="you@example.com"
                          style={{ width: "100%", marginTop: "8px", marginBottom: "14px", padding: "12px", border: "1px solid #ddd", background: "#fff" }} />
                      </div>
                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>Phone (Optional)</label>
                        <input type="text" placeholder="+213..."
                          style={{ width: "100%", marginTop: "8px", marginBottom: "14px", padding: "12px", border: "1px solid #ddd", background: "#fff" }} />
                      </div>
                      <div className="ok-md-6 ok-xsd-12">
                        <label className="uppercase" style={{ fontWeight: 700 }}>Delivery Postcode</label>
                        <input type="text" placeholder="Postcode"
                          style={{ width: "100%", marginTop: "8px", marginBottom: "14px", padding: "12px", border: "1px solid #ddd", background: "#fff" }} />
                      </div>
                    </div>
                    <div style={{ marginTop: "6px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button className="button fill uppercase">Track Now</button>
                      <button className="button stroke uppercase">Reset</button>
                    </div>
                  </div>
                </div>

                <div className="ok-md-4 ok-xsd-12">
                  <div style={{ background: "#fff", border: "1px solid #ececec", padding: "26px" }}>
                    <h4 className="uppercase" style={{ marginBottom: "14px" }}>Need Help?</h4>
                    <p style={{ marginBottom: "10px" }}>If your order is delayed or you cannot find tracking details, our support team can help.</p>
                    <p style={{ marginBottom: "6px" }}><i className="fa fa-phone theme-color" /> +213 2020 555013</p>
                    <p style={{ marginBottom: "6px" }}><i className="fa fa-envelope theme-color" /> support@okabstore.com</p>
                    <p style={{ marginBottom: 0 }}><i className="fa fa-clock-o theme-color" /> Mon - Sat: 10:00 AM - 8:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Order History */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase text-center">My Orders</h2>
              <div className="topaz-line"><i className="di-separator"></i></div>

              {isLoading ? (
                <p style={{ textAlign: "center", color: "#888", padding: "24px 0" }}>Loading...</p>
              ) : !isLoggedIn ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ marginBottom: 16, color: "#555" }}>Please log in to view your order history.</p>
                  <Link href="/my-account" className="button fill uppercase">Login / Register</Link>
                </div>
              ) : ordersLoading ? (
                <p style={{ textAlign: "center", color: "#888", padding: "24px 0" }}>Loading orders...</p>
              ) : ordersError ? (
                <p style={{ textAlign: "center", color: "#c62828", padding: "24px 0" }}>{ordersError}</p>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ color: "#888", marginBottom: 16 }}>You have no orders yet.</p>
                  <Link href="/shop" className="button fill uppercase">Start Shopping</Link>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
                      <th style={thStyle}>Order</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.order_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={tdStyle}>#{order.order_id}</td>
                        <td style={tdStyle}>{formatDate(order.order_date)}</td>
                        <td style={tdStyle}>
                          <span style={{ color: STATUS_COLOR[order.order_status] || "#555", fontWeight: 600 }}>
                            {STATUS_LABEL[order.order_status] || order.order_status}
                          </span>
                        </td>
                        <td style={tdStyle}>{order.total ? `$${parseFloat(order.total).toFixed(2)}` : "—"}</td>
                        <td style={{ ...tdStyle, color: "#555" }}>{order.items || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#1a1a1a",
};
const tdStyle: React.CSSProperties = { padding: "12px 12px", verticalAlign: "middle" };
