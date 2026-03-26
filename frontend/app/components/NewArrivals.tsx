import Link from 'next/link';

interface ProductItem { image: string; name: string; price: string; }

function ProductGrid({ title, products }: { title: string; products: ProductItem[] }) {
  return (
    <div className="product-section">
      <h2 className="section-title">{title}</h2>
      <div className="product-grid">
        {products.map((p, i) => (
          <div key={i} className="product-card">
            <div className="product-card-img-wrap">
              <img src={p.image} alt={p.name} />
            </div>
            <p>{p.name}</p>
            <strong>{p.price}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewlyLaunched() {
  const newlyLaunched: ProductItem[] = [
    { image: 'https://kixa-life.com/cdn/shop/files/tumbler25pink.jpg?v=1772957723&width=600',          name: '20oz Skinny Tumbler – Pink',       price: '$34.99' },
    { image: 'https://kixa-life.com/cdn/shop/files/tumbler25skyblue.jpg?v=1772957736&width=600',       name: '20oz Skinny Tumbler – Sky Blue',   price: '$34.99' },
    { image: 'https://kixa-life.com/cdn/shop/files/tumbler_25_candy_crush.jpg?v=1772957945&width=600', name: '20oz Skinny Tumbler – Candy Crush', price: '$34.99' },
    { image: 'https://kixa-life.com/cdn/shop/files/tumbler25pink-blue.jpg?v=1772957729&width=600',     name: '20oz Skinny Tumbler – Pink Blue',   price: '$34.99' },
  ];

  const bestSellers: ProductItem[] = [
    { image: 'https://kixa-life.com/cdn/shop/files/black-zaya.jpg?v=1772952422&width=600',   name: '26oz Flex Bottle – Black',  price: '$44.99' },
    { image: 'https://kixa-life.com/cdn/shop/files/tumbler25pink.jpg?v=1772957723&width=600', name: '20oz Skinny Tumbler – Pink', price: '$34.99' },
    { image: 'https://kixa-life.com/cdn/shop/files/bunny.jpg?v=1772987314&width=600',         name: 'Coffee Mug – Bunny',         price: '$12.00' },
    { image: 'https://kixa-life.com/cdn/shop/files/candycrush-1.jpg?v=1771863755&width=600',  name: 'Decal – Candy Crush',        price: '$6.00'  },
  ];

  return (
    <section className="home-section-alt">
      <ProductGrid title="Newly Launched" products={newlyLaunched} />
      <ProductGrid title="Best Sellers"   products={bestSellers} />
      <div className="view-all-wrap">
        <Link href="/shop" className="view-all-btn">View All Products</Link>
      </div>
    </section>
  );
}
