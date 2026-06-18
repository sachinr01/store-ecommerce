import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTruckFast,
  faTag,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface Feature {
  icon: IconDefinition;
  title: string;
  desc: string;
}

export default function TrustBar() {
  const features: Feature[] = [
    {
      icon: faBoxOpen,
      title: "Easy Returns",
      desc: "Eligible returns within 7 days.",
    },
    {
      icon: faTruckFast,
      title: "Pan India Shipping",
      desc: "Safe & reliable delivery across India.",
    },
    {
      icon: faTag,
      title: "Free Shipping",
      desc: "Free shipping across India on prepaid orders.",
    },
    {
      icon: faShieldHalved,
      title: "Secure Payments",
      desc: "Trusted & secure checkout.",
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
            <div className="tb-icon-circle">
              <FontAwesomeIcon icon={f.icon} className="tb-icon-svg" />
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
