import Link from 'next/link';

export default function TrendingCategories() {
  const categories = [
    { label: 'Cups & Mugs', image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg', href: '/collection/cups-and-mugs' },
    { label: 'Home Decor',  image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller01-10.03.2026.jpg', href: '/collection/home-decor' },
    { label: 'Dining',      image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg', href: '/collection/dining' },
    { label: 'Kitchen',     image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg', href: '/collection/kitchen' },
  ];

  return (
    <section className="home-section">
      <h2 className="section-title">Trending Categories</h2>
      <div className="cat-grid">
        {categories.map((c) => (
          <Link key={c.label} href={c.href} className="cat-card">
            <img src={c.image} alt={c.label} />
            <p className="cat-label">{c.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
