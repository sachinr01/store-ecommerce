export default function TrustBar() {
  const features = [
    {
      icon: "fa-refresh",
      title: "Easy returns",
      desc: "Eligible returns within 7 days.",
    },
    {
      icon: "fa-truck",
      title: "Pan India Shipping",
      desc: "Safe & reliable delivery across India.",
    },
    {
      icon: "fa-clock-o",
      title: "Free shipping",
      desc: "Free shipping across India on prepaid orders.",
    },
    {
      icon: "fa-certificate",
      title: "Secure Payments",
      desc: "Trusted & secure checkout",
    },
  ];

  return (
    <div className="tb-wrap">
      <div className="tb-tagline">
        <h6>Trend-Driven Design. Quality-First Craftsmanship.</h6>
      </div>
      <div className="tb-grid">
        {features.map((f, i) => (
          <div key={i} className="tb-item">
            <div className="tb-icon">
              <i className={`fa ${f.icon}`} aria-hidden="true" />
            </div>
            <div className="tb-text">
              <h4>{f.title}</h4>
              <h6>{f.desc}</h6>
            </div>
          </div>
        ))}
      </div>
      <div className="tb-stripe-bar" />
    </div>
  );
}
