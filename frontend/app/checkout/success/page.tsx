'use client';

import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function OrderSuccessPage() {
  return (
    <>
      <Header />
      <div className="dima-main">
        <section className="title_container start-style">
          <div className="page-section-content">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">Order Placed</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">Order Confirmation</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
              <h3 className="undertitle" style={{ marginBottom: 12 }}>Thank you for your order!</h3>
              <p style={{ color: '#666', marginBottom: 30 }}>
                Your order has been received and is being processed. You will receive a confirmation email shortly.
              </p>
              <Link href="/shop" className="button fill uppercase">Continue Shopping</Link>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
