'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { getProfileAddresses, updateProfileAddress, type ProfileAddressForm } from '../../../lib/api';
import { useAuth } from '../../../lib/authContext';

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belgium', 'Bolivia', 'Brazil', 'Bulgaria',
  'Cambodia', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Denmark', 'Ecuador', 'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany',
  'Ghana', 'Greece', 'Guatemala', 'Honduras', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
  'Latvia', 'Lebanon', 'Libya', 'Lithuania', 'Luxembourg', 'Malaysia', 'Mexico', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Panama', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore',
  'Slovakia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Thailand', 'Tunisia', 'Turkey', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Venezuela', 'Vietnam', 'Yemen', 'Zimbabwe',
];

const EMPTY_FORM: ProfileAddressForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
};

export default function EditAddressTypePage() {
  const params = useParams<{ type: string }>();
  const router = useRouter();
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const type = params?.type === 'billing' || params?.type === 'shipping' ? params.type : '';
  const isBilling = type === 'billing';

  const [form, setForm] = useState<ProfileAddressForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [loadingForm, setLoadingForm] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!type) {
      router.replace('/my-account/edit-address');
    }
  }, [router, type]);

  useEffect(() => {
    if (!isLoggedIn || !user || !type) {
      setLoadingForm(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoadingForm(true);
      setPageError('');

      try {
        const addresses = await getProfileAddresses();
        if (!active) return;
        setForm(addresses[type]);
      } catch {
        if (!active) return;
        setPageError('Unable to load your saved address right now.');
      } finally {
        if (!active) return;
        setLoadingForm(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isLoggedIn, type, user]);

  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';
  const title = useMemo(() => isBilling ? 'Edit Billing Address' : 'Edit Shipping Address', [isBilling]);
  const description = useMemo(
    () => isBilling
      ? 'Update the billing address details used for future checkout.'
      : 'Update the shipping address details used for future checkout.',
    [isBilling]
  );

  const setField = (key: keyof ProfileAddressForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((current) => ({ ...current, [key]: value }));
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!type) return;

    setSaving(true);
    setPageError('');
    setPageSuccess('');

    try {
      const result = await updateProfileAddress(type, form);
      if (!result.success) {
        setErrors(result.errors || {});
        setPageError(result.message || 'Could not save address.');
        return;
      }

      setErrors({});
      setPageSuccess(result.message || 'Address updated successfully.');
      if (result.data) {
        setForm(result.data[type]);
      }
    } catch {
      setPageError('Could not save address.');
    } finally {
      setSaving(false);
    }
  };

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
          margin-bottom: 28px;
        }

        .account-address-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          color: #14544f;
          text-decoration: none;
          font-size: 14px;
        }

        .account-address-copy {
          margin: 0;
          color: #33465c;
          font-size: 18px;
          line-height: 1.75;
          max-width: 760px;
        }

        .account-address-title {
          margin: 0 0 12px;
          color: #0c0c0c;
          font-size: 31px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .account-address-form {
          border: 1px solid #ece8df;
          padding: 24px;
        }

        .account-address-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .account-address-field {
          margin-bottom: 16px;
        }

        .account-address-field label {
          display: block;
          margin-bottom: 8px;
          color: #202020;
          font-size: 14px;
          font-weight: 600;
        }

        .account-address-field input,
        .account-address-field select {
          width: 100%;
          min-height: 44px;
          border: 1px solid #d8d2c8;
          padding: 10px 12px;
          font-size: 14px;
          color: #111;
          background: #fff;
        }

        .account-address-field-error {
          display: block;
          margin-top: 6px;
          color: #c62828;
          font-size: 12px;
        }

        .account-address-message {
          margin: 0 0 20px;
          padding: 14px 16px;
          border: 1px solid #ece8df;
          background: #fff;
          color: #5f6977;
          font-size: 14px;
          line-height: 1.6;
        }

        .account-address-message.error {
          color: #c62828;
        }

        .account-address-message.success {
          color: #166534;
        }

        .account-address-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .account-address-cancel {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 18px;
          border: 1px solid #d8d2c8;
          color: #111;
          text-decoration: none;
        }

        @media (max-width: 991px) {
          .account-address-layout {
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
          .account-address-main,
          .account-address-form {
            padding: 18px;
          }

          .account-address-title {
            font-size: 24px;
          }

          .account-address-copy {
            font-size: 15px;
          }

          .account-address-row,
          .account-address-actions {
            grid-template-columns: 1fr;
            display: grid;
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
                    Please log in to edit your saved addresses.
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
                        <Link href="/my-account/edit-address" className="account-address-back">
                          <span>{'<-'}</span>
                          <span>Back to addresses</span>
                        </Link>
                        <h1 className="account-address-title">{title}</h1>
                        <p className="account-address-copy">{description}</p>
                      </div>

                      {pageError && <p className="account-address-message error">{pageError}</p>}
                      {pageSuccess && <p className="account-address-message success">{pageSuccess}</p>}
                      {loadingForm ? (
                        <p className="account-address-message">Loading saved address...</p>
                      ) : (
                        <form className="account-address-form" onSubmit={handleSubmit} noValidate>
                          <div className="account-address-field">
                            <label htmlFor="country">Country</label>
                            <select id="country" value={form.country} onChange={setField('country')}>
                              <option value="">Select country</option>
                              {COUNTRIES.map((country) => (
                                <option key={country} value={country}>{country}</option>
                              ))}
                            </select>
                            {errors.country && <span className="account-address-field-error">{errors.country}</span>}
                          </div>

                          <div className="account-address-row">
                            <div className="account-address-field">
                              <label htmlFor="firstName">First Name</label>
                              <input id="firstName" type="text" value={form.firstName} onChange={setField('firstName')} />
                              {errors.firstName && <span className="account-address-field-error">{errors.firstName}</span>}
                            </div>
                            <div className="account-address-field">
                              <label htmlFor="lastName">Last Name</label>
                              <input id="lastName" type="text" value={form.lastName} onChange={setField('lastName')} />
                              {errors.lastName && <span className="account-address-field-error">{errors.lastName}</span>}
                            </div>
                          </div>

                          <div className="account-address-field">
                            <label htmlFor="company">Company Name (optional)</label>
                            <input id="company" type="text" value={form.company} onChange={setField('company')} />
                          </div>

                          <div className="account-address-field">
                            <label htmlFor="address1">Address</label>
                            <input id="address1" type="text" value={form.address1} onChange={setField('address1')} />
                            {errors.address1 && <span className="account-address-field-error">{errors.address1}</span>}
                          </div>

                          <div className="account-address-field">
                            <label htmlFor="address2">Apartment, suite, unit etc. (optional)</label>
                            <input id="address2" type="text" value={form.address2} onChange={setField('address2')} />
                          </div>

                          <div className="account-address-field">
                            <label htmlFor="city">Town / City</label>
                            <input id="city" type="text" value={form.city} onChange={setField('city')} />
                            {errors.city && <span className="account-address-field-error">{errors.city}</span>}
                          </div>

                          <div className="account-address-row">
                            <div className="account-address-field">
                              <label htmlFor="state">State / County</label>
                              <input id="state" type="text" value={form.state} onChange={setField('state')} />
                              {errors.state && <span className="account-address-field-error">{errors.state}</span>}
                            </div>
                            <div className="account-address-field">
                              <label htmlFor="postcode">Postcode / Zip</label>
                              <input id="postcode" type="text" value={form.postcode} onChange={setField('postcode')} />
                              {errors.postcode && <span className="account-address-field-error">{errors.postcode}</span>}
                            </div>
                          </div>

                          <div className="account-address-actions">
                            <button type="submit" className="button fill uppercase" disabled={saving}>
                              {saving ? 'Saving...' : `Save ${isBilling ? 'Billing' : 'Shipping'} Address`}
                            </button>
                            <Link href="/my-account/edit-address" className="account-address-cancel">
                              Cancel
                            </Link>
                          </div>
                        </form>
                      )}
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
