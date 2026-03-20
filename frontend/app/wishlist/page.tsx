'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useWishlist } from '../lib/wishlistContext';
import { useCart } from '../lib/cartContext';
import { getProductById } from '../lib/api';
import type { ProductDetail } from '../lib/api';

const PLACEHOLDER = '/store/images/dummy.png';

export default function WishlistPage() {
  const { items, removeItem } = useWishlist();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Record<number, ProductDetail>>({});
  const [loading, setLoading] = useState(true);
  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // Fetch full product data for each wishlist item
  useEffect(() => {
    if (items.length === 0) { setLoading(false); return; }
    const missing = items.filter(i => !products[i.id]).map(i => i.id);
    if (missing.length === 0) { setLoading(false); return; }
    setLoading(true);
    Promise.all(missing.map(id => getProductById(id).then(p => ({ id, p })).catch(() => null)))
      .then(results => {
        const map: Record<number, ProductDetail> = { ...products };
        results.forEach(r => { if (r) map[r.id] = r.p; });
        setProducts(map);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const getPrice = (p: ProductDetail) => {
    const simple = p.price ? Number(p.price) : null;
    const min    = Number(p.price_min ?? 0);
    return simple ?? min;
  };

  const getStock = (p: ProductDetail) =>
    p.stock_status === 'instock' || p.variations.some(v => v.stock_status === 'instock');

  return (
    <>
      <Header />
      <div className="dima-main">

        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">Wishlist</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/store" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">Wishlist</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container mini-sidebar">
              <div className="dima-container float-start">

                {items.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 16, marginBottom: 20 }}>Your wishlist is empty.</p>
                    <Link href="/store/shop" className="button fill uppercase">Go to Shop</Link>
                  </div>
                ) : loading ? (
                  <p style={{ padding: '40px 0', textAlign: 'center' }}>Loading...</p>
                ) : (
                  <div className="dima-data-table-wrap cart-table">
                    <table>
                      <thead>
                        <tr>
                          <th className="uppercase">Product</th>
                          <th className="uppercase">Unit Price</th>
                          <th className="uppercase">Stock Status</th>
                          <th className="uppercase"></th>
                          <th className="uppercase"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => {
                          const p = products[item.id];
                          const price   = p ? getPrice(p) : item.price;
                          const inStock = p ? getStock(p) : item.inStock;
                          const title   = p ? p.title : item.title;
                          return (
                            <tr key={item.id}>
                              <td className="product-name">
                                <div className="product-thumbnail">
                                   <Link href={`/product/${toSlug(title)}-${item.id}`}>
                                     <img width={65} height={70} src={item.image || PLACEHOLDER}
                                       className="attachment-shop_thumbnail" alt={title} />
                                   </Link>
                                 </div>
                                 <div className="cart-item-details">
                                   <h6><Link href={`/product/${toSlug(title)}-${item.id}`}>{title}</Link></h6>
                                 </div>
                              </td>
                              <td>${Number(price).toFixed(2)}</td>
                              <td>
                                <span style={{ color: inStock ? '#2bbfaa' : '#c62828' }}>
                                  {inStock ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </td>
                              <td>
                                <a href="#" className="button mini fill uppercase"
                                  onClick={e => {
                                    e.preventDefault();
                                    addItem({ id: item.id, title, price: Number(price), image: item.image, quantity: 1 });
                                  }}
                                  style={{ whiteSpace: 'nowrap' }}>
                                  ADD TO CART
                                </a>
                              </td>
                              <td className="product-remove">
                                <h6>
                                  <a href="#" onClick={e => { e.preventDefault(); removeItem(item.id); }}>
                                    <i className="di-close"></i>
                                  </a>
                                </h6>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="double-clear" />
                <h4>Share On</h4>
                <div className="clear" />
                <div className="social-media social-medium">
                  <ul className="inline clearfix">
                    <li><a href="#"><i className="fa fa-facebook"></i></a></li>
                    <li><a href="#"><i className="fa fa-twitter"></i></a></li>
                    <li><a href="#"><i className="fa fa-google-plus"></i></a></li>
                  </ul>
                </div>

              </div>
            </div>
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}
