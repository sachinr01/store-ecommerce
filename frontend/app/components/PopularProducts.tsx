export default function CuratedGifting() {
  return (
    <section style={{ padding: '56px 0', background: '#fff' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 45px' }}>
        <h2 className="section-title">Collection</h2>
        <div className="gifting-collage">
          <div className="gift-panel gift-panel-tall"
            style={{ backgroundImage: "url('/store/images/category_images/CC_TUMBLERS.png')" }} />
          <div className="gift-panel"
            style={{ backgroundImage: "url('/store/images/category_images/CC_GLASSWARE.png')" }} />
          <div className="gift-panel"
            style={{ backgroundImage: "url('/store/images/category_images/CC_KITCHEN_ORGANISERS.png')" }} />
        </div>
      </div>
    </section>
  );
}

export function PopularCategories() {
  const popularCategories = [
    'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller01-10.03.2026.jpg',
    'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg',
    'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg',
    'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg',
  ];

  return (
    <section className="home-section" style={{ paddingTop: 0 }}>
      <h2 className="section-title">Popular Categories</h2>
      <div className="pop-cat-grid">
        {popularCategories.map((src, i) => (
          <div key={i} className="pop-cat-item">
            <img src={src} alt={`Category ${i + 1}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
