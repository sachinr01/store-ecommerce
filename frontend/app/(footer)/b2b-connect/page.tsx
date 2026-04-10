import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const dynamic = 'force-dynamic';

export default function B2BConnectPage() {
  return (
    <>
      <style>{`
        .static-page { background: #f7f5f2; min-height: 70vh; }
        .static-body {
          max-width: 820px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }
        .static-title { margin: 0 0 6px; font-size: 28px; font-weight: 700; color: #1a1a1a; }
        .static-date { font-size: 12px; color: #999; margin-bottom: 18px; }
        .static-breadcrumb { font-size: 12px; color: #888; margin-bottom: 16px; display: flex; gap: 6px; align-items: center; }
        .static-breadcrumb a { color: #888; text-decoration: none; }
        .static-breadcrumb a:hover { color: #222; }
        .static-summary {
          background: #fff;
          border: 1px solid #ece7df;
          padding: 16px 18px;
          border-radius: 6px;
          margin: 16px 0 28px;
          font-size: 14px;
          color: #555;
          line-height: 1.7;
        }
        .static-content p { font-size: 14px; line-height: 1.9; color: #444; margin: 0 0 16px; }
        .static-content h2,
        .static-content h3,
        .static-content h4 {
          color: #1a1a1a;
          margin: 18px 0 10px;
          line-height: 1.4;
        }
        .static-content h2 { font-size: 18px; }
        .static-content h3 { font-size: 16px; }
        .static-content ul { padding-left: 18px; margin: 0 0 16px; color: #444; }
        .static-content li { margin-bottom: 8px; font-size: 14px; line-height: 1.7; }
        .static-back {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #1a1a1a;
          text-decoration: none;
          border-bottom: 1.5px solid #1a1a1a;
          padding-bottom: 2px;
          margin-top: 16px;
        }
        .b2b-section {
          background: #fff;
          border: 1px solid #ece7df;
          border-radius: 6px;
          padding: 18px 20px;
          margin: 0 0 18px;
        }
        .b2b-grid {
          display: grid;
          gap: 12px;
        }
        .b2b-track {
          border: 1px solid #f0e9df;
          border-radius: 4px;
          padding: 14px 16px;
          background: #fcfbf8;
        }
        .b2b-track h4 {
          margin: 0 0 6px;
          font-size: 14px;
        }
        .b2b-track p {
          margin: 0;
          font-size: 13px;
          color: #555;
          line-height: 1.7;
        }
        .b2b-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }
        .b2b-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 20px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          text-decoration: none;
        }
        .b2b-btn.primary { background: #1a1a1a; color: #fff; }
        .b2b-btn.secondary { background: #fff; color: #1a1a1a; border: 1px solid #d8d1c8; }

        @media (max-width: 640px) {
          .static-body { padding: 18px 16px 48px; }
          .static-title { font-size: 24px; }
        }
      `}</style>

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
