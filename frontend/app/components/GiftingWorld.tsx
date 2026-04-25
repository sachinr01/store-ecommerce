import Link from 'next/link';
import "./GiftingWorld.css";

const panels = [
  {
    image: '/store/images/CORPORATE_GIFTING.jpg',
    label: 'CORPORATE GIFTING',
    href: '/#',
  },
  {
    image: '/store/images/E-CARDS.jpg',
    label: 'SHOP E-CARDS',
    href: '/#',
  },
];

export default function GiftingWorld() {
  return (
    <section className="gw-section">
        <h2 className="gw-title">GIFTING</h2>
        <div className="gw-grid">
          {panels.map((p, i) => (
            <Link key={i} href={p.href} className="gw-panel">
              <img src={p.image} alt={p.label} loading="lazy" />
              <div className="gw-panel-label">
                <span className="gw-panel-link">{p.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
  );
}
