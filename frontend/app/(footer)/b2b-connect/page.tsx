import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import '../footepages.css';

export const dynamic = 'force-dynamic';

export default function B2BConnectPage() {
  return (
    <>
      <Header />
      <div className="dima-main static-page">
        <div className="static-body">
          <div>
            <nav className="static-breadcrumb">
              <Link href="/">Home</Link>
              <span>{'>'}</span>
              <span style={{ color: '#555' }}>B2B Connect</span>
            </nav>

            <h1 className="static-title">B2B Connect</h1>

            <Link href="/" className="static-back">Back to Home</Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
