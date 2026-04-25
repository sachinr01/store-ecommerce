import "./TrustBar.css";

export default function TrustBar() {
  const features = [
    {
      icon: (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      ),
      title: 'Easy returns',
      desc: 'Return within 15 days of order delivery.',
      link: { label: 'See T&Cs', href: 'terms-conditions' },
    },
    {
      icon: (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
      title: 'We ship worldwide',
      desc: 'Fast and reliable international delivery.',
      link: null,
    },
    {
      icon: (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      ),
      title: 'Free shipping',
      desc: 'Free shipping on orders above ₹1,000.',
      link: null,
    },
    {
      icon: (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
          <line x1="6" y1="15" x2="10" y2="15"/>
        </svg>
      ),
      title: 'Cash on delivery',
      desc: 'COD available.',
      link: null,
    },
  ];

  return (
    <>
      <div className="tb-wrap">
        <div className="tb-tagline">
          <span className="tb-heart">♥</span> Ours is a culture where madness and data co-exist. <span className="tb-heart">♥</span>
        </div>
        <div className="tb-grid">
          {features.map((f, i) => (
            <div key={i} className="tb-item">
              <div className="tb-icon">{f.icon}</div>
              <div className="tb-text">
                <h4>{f.title}</h4>
                <p>
                  {f.desc}
                  {f.link && <> <a href={f.link.href}>{f.link.label}</a></>}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="tb-stripe-bar" />
      </div>
    </>
  );
}
