'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { getProfileAddresses, type ProfileAddressForm } from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import './edit-address.css';

type AddressBlock = {
  name: string;
  company: string;
  lines: string[];
};

function formatAddressBlock(address: ProfileAddressForm): AddressBlock | null {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ').trim();
  const location = [address.city, address.state, address.postcode].filter(Boolean).join(', ').trim();
  const lines = [address.address1, address.address2, location].filter(Boolean);

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
      <Header />
      <div className="dima-main account-address-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
              <p className="account-address-loading">Loading...</p>
              ) : !isLoggedIn || !user ? (
                <div className="account-address-login-box">
                  <p className="account-address-login-text">Please log in to view your addresses.</p>
                  <div className="account-address-login-action">
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

                      <section className="account-address-card">
                        <h3 className="account-address-title">Address</h3>
                        <Link href="/my-account/edit-address/billing" className="account-address-edit-link">
                          <span className="account-address-edit-icon">{'->'}</span>
                          <span>Edit address</span>
                        </Link>

                        {billingAddress ? (
                          <div className="account-address-lines">
                            {billingLines.map((line) => <p key={line}>{line}</p>)}
                          </div>
                        ) : (
                          <p className="account-address-empty">
                            You have not set up a billing address yet.
                          </p>
                        )}
                      </section>

                      
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
