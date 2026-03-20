"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function PrivacyPolicy() {
  const sections = [
    {
      heading: "Information We Collect",
      points: [
        "We may collect your name, email address, phone number, shipping address, billing address, and order details when you place an order or contact us.",
        "We may also collect browsing behavior, device information, and cookies to improve website performance and customer experience.",
        "Payment information is processed securely through trusted payment gateways and is not stored in unsecured areas of the website.",
      ],
    },
    {
      heading: "How We Use Your Information",
      points: [
        "To process orders, confirm payments, arrange shipments, and provide delivery updates.",
        "To respond to customer support requests and improve service quality.",
        "To personalize shopping experiences, recommend relevant products, and improve site usability.",
      ],
    },
    {
      heading: "Data Protection",
      points: [
        "We use appropriate technical and organizational measures to protect your data from unauthorized access, misuse, or disclosure.",
        "Access to personal information is limited to authorized team members and service providers who require it for business operations.",
        "We retain data only as long as necessary for legal, operational, and customer service purposes.",
      ],
    },
  ];

  return (
    <>
      <Header />
      <div className="dima-main">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase">Privacy Policy</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                We value your trust and are committed to protecting your personal
                information while you browse, shop, and interact with our
                e-commerce platform.
              </p>

              <div className="clear-section"></div>

              {sections.map((section) => (
                <div key={section.heading} style={{ marginBottom: "24px" }}>
                  <h4 className="uppercase">{section.heading}</h4>
                  <ul className="list-style check">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
