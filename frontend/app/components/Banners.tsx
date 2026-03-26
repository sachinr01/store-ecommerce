export default function TrendingCategories() {
  const categories = [
    { label: 'Cups & Mugs', image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg' },
    { label: 'Home Decor',  image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller01-10.03.2026.jpg' },
    { label: 'Dining',      image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg' },
    { label: 'Kitchen',     image: 'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg' },
  ];

  return (
    <section className="home-section">
      <h2 className="section-title">Trending Categories</h2>
      <div className="cat-grid">
        {categories.map((c) => (
          <div key={c.label} className="cat-card">
            <img src={c.image} alt={c.label} />
            <h3>{c.label}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
