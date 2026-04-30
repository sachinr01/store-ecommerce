import Link from 'next/link';
import Header from './components/Header';
import Footer from './components/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <div className="nf-page">
        <style>{`
          .nf-page {
            min-height: 60vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px 24px;
            background: #faf7f3;
          }
          .nf-inner {
            text-align: center;
            max-width: 520px;
            width: 100%;
          }
          .nf-code {
            font-size: 120px;
            font-weight: 800;
            line-height: 1;
            color: #ece7dc;
            letter-spacing: -4px;
            margin: 0 0 8px;
            font-family: 'Lato', Helvetica, Arial, sans-serif;
          }
          .nf-title {
            font-size: 26px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 12px;
            letter-spacing: 0.01em;
          }
          .nf-desc {
            font-size: 15px;
            color: #6b6460;
            line-height: 1.7;
            margin: 0 0 32px;
          }
          .nf-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .nf-btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 48px;
            padding: 0 28px;
            background: #2bbfaa;
            color: #fff;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-decoration: none;
            border: none;
            cursor: pointer;
            transition: background 0.2s;
          }
          .nf-btn-primary:hover { background: #22a896; }
          .nf-btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 48px;
            padding: 0 28px;
            background: transparent;
            color: #1a1a1a;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-decoration: none;
            border: 1px solid #d4cfc8;
            transition: border-color 0.2s, color 0.2s;
          }
          .nf-btn-secondary:hover { border-color: #1a1a1a; }
          .nf-divider {
            width: 48px;
            height: 3px;
            background: #2bbfaa;
            margin: 0 auto 28px;
          }
          @media (max-width: 480px) {
            .nf-code { font-size: 88px; }
            .nf-title { font-size: 22px; }
            .nf-actions { flex-direction: column; align-items: center; }
            .nf-btn-primary, .nf-btn-secondary { width: 100%; max-width: 280px; }
          }
        `}</style>
        <div className="nf-inner">
          <p className="nf-code">404</p>
          <div className="nf-divider" />
          <h1 className="nf-title">Page Not Found</h1>
          <p className="nf-desc">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.<br />
            Let&apos;s get you back on track.
          </p>
          <div className="nf-actions">
            <Link href="/" className="nf-btn-primary">Go to Home</Link>
            <Link href="/shop" className="nf-btn-secondary">Browse Shop</Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
