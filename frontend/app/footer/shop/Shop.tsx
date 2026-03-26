'use client';

import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function ShopPage() {
  return (
    <>
      <Header />
      <main className="dima-main">
        <section style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="container">
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>SHOP</h1>
            <p style={{ color: '#666' }}>Shop page content coming soon...</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
