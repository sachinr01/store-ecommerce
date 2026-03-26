export default function LatestPosts() {
  const posts = [
    {
      image: 'https://nestasia.in/cdn/shop/articles/467.png?v=1773144465&width=600',
      date: 'March 01, 2026',
      title: 'How To Prepare Your Home For A Stress-Free Summer',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/Blog_Banners_500_x_500_px_25_3efe0bf0-7b98-4208-b254-71edeca8e867.png?v=1773035780&width=600',
      date: 'March 05, 2026',
      title: 'Summertime Pre-Summer Home Refresh Checklist',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/What_s_your_dinner_hosting_score_4067574c-e3c7-4403-9b51-69a6e8ffea50.png?v=1772716953&width=600',
      date: 'March 12, 2026',
      title: 'What Your Dining Table Decor Says About Your Entertaining Style',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/WhatsApp_Image_2026-02-27_at_20.47.07_e9e9cc65-0179-456c-8f31-1b0e48afc7f5.jpg?v=1772716483&width=600',
      date: 'March 16, 2026',
      title: "Unique Holi Gifts That They'll Treasure Forever",
    },
  ];

  return (
    <section className="home-section-gray">
      <h2 className="section-title">From The Blog</h2>
      <div className="blog-grid">
        {posts.map((post, i) => (
          <div key={i} className="blog-card">
            <img src={post.image} alt={post.title} />
            <div className="blog-card-body">
              <span className="blog-card-date">{post.date}</span>
              <h4 className="blog-card-title">{post.title}</h4>
              <a href="#" className="blog-card-link">Read More</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
