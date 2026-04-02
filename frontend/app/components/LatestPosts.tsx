export default function LatestPosts() {
  const posts = [
    {
      image: 'https://nestasia.in/cdn/shop/articles/467.png?v=1773144465&width=600',
      date: 'March 01, 2026',
      title: 'How To Prepare Your Home For A Stress-Free Summer',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/Blog_Banners_500_x_500_px_25_c53d2c3d-1367-46fc-a922-ae67ccc299c5.png?v=1774874256&width=780',
      date: 'March 05, 2026',
      title: 'Summertime Pre-Summer Home Refresh Checklist',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/What_s_your_dinner_hosting_score_f9aac14d-58ea-4a8c-a08f-215822835ad3.png?v=1774874314&width=780',
      date: 'March 12, 2026',
      title: 'What Your Dining Table Decor Says About Your Entertaining Style',
    },
    {
      image: 'https://nestasia.in/cdn/shop/articles/WhatsApp_Image_2026-02-27_at_20.47.07_7b452509-c434-4d10-ad9c-ebb3b212868a.jpg?v=1774871271&width=780',
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
