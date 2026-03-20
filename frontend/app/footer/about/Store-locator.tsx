"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const stores = [
  {
    city: "London",
    address: "Bluett Avenue, Seaview, Isle of Wight PO34, UK",
    phone: "+213 2020 555013",
    email: "london@okabstore.com",
    hours: "Mon - Sat: 10:00 AM - 8:00 PM",
  },
  {
    city: "Manchester",
    address: "21 Market Street, Manchester M1 1AB, UK",
    phone: "+213 7700 900106",
    email: "manchester@okabstore.com",
    hours: "Mon - Sat: 10:00 AM - 8:30 PM",
  },
  {
    city: "Birmingham",
    address: "8 New Street, Birmingham B2 4QA, UK",
    phone: "+213 6600 123456",
    email: "birmingham@okabstore.com",
    hours: "Mon - Sun: 11:00 AM - 7:00 PM",
  },
  {
    city: "Leeds",
    address: "44 Briggate, Leeds LS1 6HD, UK",
    phone: "+213 5500 654321",
    email: "leeds@okabstore.com",
    hours: "Mon - Sat: 10:30 AM - 8:00 PM",
  },
];

export default function StoreLocatorPage() {
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
            alt="Store Locator Banner"
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
              Store Locator
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

        {/* Intro + Filters */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="text-center">
                <h2 className="uppercase">Find a Store Near You</h2>
                <div className="topaz-line">
                  <i className="di-separator"></i>
                </div>
                <p>
                  Locate your nearest OKAB store for in-store shopping, order
                  pickup, and product assistance.
                  <br />
                  Select a city and check opening hours before your visit.
                </p>
              </div>

              <div className="clear-section"></div>

              <div className="ok-row">
                <div className="ok-md-4 ok-xsd-12">
                  <label className="uppercase" style={{ fontWeight: 700 }}>
                    Select City
                  </label>
                  <select
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      padding: "12px",
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a city
                    </option>
                    {stores.map((store) => (
                      <option key={store.city} value={store.city}>
                        {store.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ok-md-4 ok-xsd-12">
                  <label className="uppercase" style={{ fontWeight: 700 }}>
                    Distance
                  </label>
                  <select
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      padding: "12px",
                      border: "1px solid #ddd",
                      background: "#fff",
                    }}
                    defaultValue="10"
                  >
                    <option value="5">Within 5 km</option>
                    <option value="10">Within 10 km</option>
                    <option value="25">Within 25 km</option>
                    <option value="50">Within 50 km</option>
                  </select>
                </div>

                <div className="ok-md-4 ok-xsd-12">
                  <label className="uppercase" style={{ fontWeight: 700 }}>
                    Search
                  </label>
                  <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                    <input
                      type="text"
                      placeholder="Area / Postcode"
                      style={{
                        flex: 1,
                        padding: "12px",
                        border: "1px solid #ddd",
                        background: "#fff",
                      }}
                    />
                    <button className="button fill uppercase">Find</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store Cards */}
        <section className="section section-colored" style={{ background: "#faf9f5" }}>
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <div className="ok-row">
                {stores.map((store) => (
                  <div key={store.city} className="ok-md-6 ok-xsd-12">
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #ececec",
                        padding: "24px",
                        marginBottom: "24px",
                      }}
                    >
                      <h4 className="uppercase" style={{ marginBottom: "10px" }}>
                        {store.city}
                      </h4>
                      <p style={{ marginBottom: "8px" }}>
                        <i className="fa fa-map-marker theme-color"></i>{" "}
                        {store.address}
                      </p>
                      <p style={{ marginBottom: "8px" }}>
                        <i className="fa fa-phone theme-color"></i> {store.phone}
                      </p>
                      <p style={{ marginBottom: "8px" }}>
                        <i className="fa fa-envelope theme-color"></i> {store.email}
                      </p>
                      <p style={{ marginBottom: "16px" }}>
                        <i className="fa fa-clock-o theme-color"></i> {store.hours}
                      </p>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <a href="#" className="button stroke uppercase">
                          Get Directions
                        </a>
                        <a href="#" className="button fill uppercase">
                          Call Store
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Static Map Placeholder */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase text-center">Map View</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "360px",
                  background:
                    "linear-gradient(135deg, rgba(0,191,165,0.15), rgba(0,0,0,0.06))",
                  border: "1px solid #e5e5e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: "20px",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "#555" }}>
                  Interactive map can be integrated here.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
