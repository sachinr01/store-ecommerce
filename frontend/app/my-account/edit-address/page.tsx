'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { getProfileAddresses, type ProfileAddressForm } from '../../lib/api';
import { useAuth } from '../../lib/authContext';

type AddressBlock = {
  name: string;
  company: string;
  lines: string[];
};

function formatAddressBlock(address: ProfileAddressForm): AddressBlock | null {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ').trim();
  const location = [address.city, address.state, address.postcode].filter(Boolean).join(', ').trim();
  const lines = [address.address1, address.address2, location, address.country].filter(Boolean);

  if (!name && lines.length === 0) {
    return null;
  }

  return {
    name,
    company: address.company,
    lines,
  };
}

export default function EditAddressPage() {
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [billingAddress, setBillingAddress] = useState<AddressBlock | null>(null);
  const [shippingAddress, setShippingAddress] = useState<AddressBlock | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      return;
    }

    let active = true;
    const loadAddresses = async () => {
      setLoadingAddress(true);
      setAddressError('');

      try {
        const profileAddresses = await getProfileAddresses();
        if (!active) return;

        setBillingAddress(formatAddressBlock(profileAddresses.billing));
        setShippingAddress(formatAddressBlock(profileAddresses.shipping));
      } catch {
        if (!active) return;
        setAddressError('No saved address details were found yet. Add your billing and shipping information here to use it later during checkout.');
      } finally {
        if (!active) return;
        setLoadingAddress(false);
      }
    };

    void loadAddresses();

    return () => {
      active = false;
    };
  }, [isLoggedIn, user]);

  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';

  const billingLines = useMemo(() => billingAddress?.lines ?? [], [billingAddress]);
  const shippingLines = useMemo(() => shippingAddress?.lines ?? [], [shippingAddress]);

  return (
    <>
      <style>{`
        .account-address-page {
          padding-bottom: 48px;
        }

        .account-address-shell {
          overflow: hidden;
          background: #fff;
        }

        .account-address-layout {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          align-items: start;
        }

        .account-address-sidebar {
          min-height: 100%;
          padding: 60px 42px 48px;
          background: #fff;
        }

        .account-address-sidebar-inner {
          position: sticky;
          top: 104px;
        }

        .account-address-avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .account-address-hello {
          margin: 28px 0 10px;
          color: #000;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .account-address-handle {
          margin: 0;
          color: #42556d;
          font-size: 18px;
          line-height: 1.5;
        }

        .account-address-nav {
          display: grid;
          gap: 8px;
          margin-top: 66px;
        }

        .account-address-link,
        .account-address-button {
          display: block;
          padding: 2px 0;
          border: 0;
          background: transparent;
          color: #121212;
          text-decoration: none;
          text-align: left;
          font-size: 17px;
          line-height: 1.45;
          cursor: pointer;
        }

        .account-address-link:hover,
        .account-address-button:hover,
        .account-address-link.active {
          color: #111;
        }

        .account-address-main {
          min-width: 0;
          padding: 44px 56px 48px 36px;
          background: #fff;
        }

        .account-address-top {
          margin-bottom: 42px;
        }

        .account-address-copy {
          margin: 0;
          color: #33465c;
          font-size: 18px;
          line-height: 1.75;
          max-width: 760px;
        }

        .account-address-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 72px;
          align-items: start;
        }

        .account-address-card {
          min-width: 0;
        }

        .account-address-title {
          margin: 0 0 10px;
          color: #0c0c0c;
          font-size: 31px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .account-address-edit-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
          color: #111;
          text-decoration: none;
          font-size: 16px;
          line-height: 1.5;
        }

        .account-address-edit-link:hover {
          color: #14544f;
        }

        .account-address-edit-icon {
          font-size: 14px;
          line-height: 1;
        }

        .account-address-lines {
          color: #4a5a70;
          font-size: 17px;
          line-height: 1.8;
        }

        .account-address-lines p {
          margin: 0;
        }

        .account-address-empty {
          color: #717171;
          font-size: 16px;
          line-height: 1.8;
        }

        .account-address-message {
          margin: 0 0 22px;
          padding: 14px 16px;
          border: 1px solid #ece8df;
          background: #fff;
          color: #5f6977;
          font-size: 14px;
          line-height: 1.6;
        }

        @media (max-width: 991px) {
          .account-address-layout,
          .account-address-grid {
            grid-template-columns: 1fr;
          }

          .account-address-sidebar {
            padding-bottom: 28px;
          }

          .account-address-sidebar-inner {
            position: static;
          }

        }

        @media (max-width: 767px) {
          .account-address-sidebar,
          .account-address-main {
            padding: 18px;
          }

          .account-address-title {
            font-size: 24px;
          }

          .account-address-copy,
          .account-address-lines {
            font-size: 15px;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main account-address-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : !isLoggedIn || !user ? (
                <div style={{ background: '#fff', border: '1px solid #ece8df', padding: 24 }}>
                  <p style={{ margin: 0, color: '#555', fontSize: 15, lineHeight: 1.7 }}>
                    Please log in to view your addresses.
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <Link href="/my-account" className="button fill uppercase">Go To My Account</Link>
                  </div>
                </div>
              ) : (
                <div className="account-address-shell">
                  <div className="account-address-layout">
                    <aside className="account-address-sidebar">
                      <div className="account-address-sidebar-inner">
                        <div className="account-address-avatar" aria-hidden="true">
                          <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h3 className="account-address-hello">Hello</h3>
                        <p className="account-address-handle">{accountHandle}</p>

                        <nav className="account-address-nav" aria-label="Account navigation">
                          <Link href="/my-account" className="account-address-link">Dashboard</Link>
                          <Link href="/my-account/edit-account" className="account-address-link">Edit Profile</Link>
                          <Link href="/my-account/edit-address" className="account-address-link active">My Addresses</Link>
                          <Link href="/orders" className="account-address-link">My Orders</Link>
                          <Link href="/my-account/order-tracking" className="account-address-link">Order Tracking</Link>
                          <Link href="/wishlist" className="account-address-link">Wishlist</Link>
                          <button className="account-address-button" onClick={logout}>Logout</button>
                        </nav>
                      </div>
                    </aside>

                    <div className="account-address-main">
                      <div className="account-address-top">
                        <p className="account-address-copy">
                          The following addresses will be used on the checkout page by default.
                        </p>
                      </div>

                      {addressError && <p className="account-address-message">{addressError}</p>}
                      {loadingAddress && <p className="account-address-message">Loading your latest saved checkout addresses...</p>}

                      <div className="account-address-grid">
                        <section className="account-address-card">
                          <h3 className="account-address-title">Billing Address</h3>
                          <Link href="/my-account/edit-address/billing" className="account-address-edit-link">
                            <span className="account-address-edit-icon">{'->'}</span>
                            <span>Edit Billing address</span>
                          </Link>

                          {billingAddress ? (
                            <div className="account-address-lines">
                              {billingAddress.name && <p>{billingAddress.name}</p>}
                              {billingAddress.company && <p>{billingAddress.company}</p>}
                              {billingLines.map((line) => <p key={line}>{line}</p>)}
                            </div>
                          ) : (
                            <p className="account-address-empty">
                              You have not set up a billing address yet.
                            </p>
                          )}
                        </section>

                        <section className="account-address-card">
                          <h3 className="account-address-title">Shipping Address</h3>
                          <Link href="/my-account/edit-address/shipping" className="account-address-edit-link">
                            <span className="account-address-edit-icon">{'->'}</span>
                            <span>Edit Shipping address</span>
                          </Link>

                          {shippingAddress ? (
                            <div className="account-address-lines">
                              {shippingAddress.name && <p>{shippingAddress.name}</p>}
                              {shippingAddress.company && <p>{shippingAddress.company}</p>}
                              {shippingLines.map((line) => <p key={line}>{line}</p>)}
                            </div>
                          ) : (
                            <p className="account-address-empty">
                              You have not set up a shipping address yet.
                            </p>
                          )}
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
