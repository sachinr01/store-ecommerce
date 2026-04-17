'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { updateProfile } from '../../lib/api';
import { useAuth } from '../../lib/authContext';

export default function EditAccountPage() {
  const { user, isLoggedIn, isLoading, setUser, logout } = useAuth();

  const initialFields = useMemo(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    displayName: user?.displayName || user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }), [user]);

  const [form, setForm] = useState(initialFields);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialFields);
  }, [initialFields]);

  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';

  const setField = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    if (!form.displayName.trim()) {
      setError('Display name is required.');
      setSuccess('');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(form.email)) {
      setError('Enter a valid email address.');
      setSuccess('');
      return;
    }

    const wantsPasswordChange = !!(form.currentPassword || form.newPassword || form.confirmPassword);
    if (wantsPasswordChange) {
      if (!form.currentPassword) {
        setError('Current password is required to change your password.');
        setSuccess('');
        return;
      }
      if (!form.newPassword) {
        setError('Enter a new password.');
        setSuccess('');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError('New password and confirmation do not match.');
        setSuccess('');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const result = await updateProfile({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        firstName: form.firstName,
        lastName: form.lastName,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      });

      if (!result.success) {
        setError(result.message || 'Could not save profile.');
        return;
      }

      if (result.data) {
        setUser(result.data);
      }

      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      setSuccess('Profile updated successfully.');
    } catch {
      setError('Could not connect to server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        .account-edit-page {
          padding-bottom: 48px;
        }

        .account-edit-shell {
          overflow: hidden;
          background: #fff;
        }

        .account-edit-layout {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          align-items: start;
        }

        .account-edit-sidebar {
          min-height: 100%;
          padding: 60px 42px 48px;
          background: #fff;
        }

        .account-edit-sidebar-inner {
          position: sticky;
          top: 104px;
        }

        .account-edit-avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .account-edit-hello {
          margin: 28px 0 10px;
          color: #000;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .account-edit-handle {
          margin: 0;
          color: #42556d;
          font-size: 18px;
          line-height: 1.5;
        }

        .account-edit-nav {
          display: grid;
          gap: 8px;
          margin-top: 66px;
        }

        .account-edit-link,
        .account-edit-button {
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

        .account-edit-link:hover,
        .account-edit-button:hover,
        .account-edit-link.active {
          color: #111;
        }

        .account-edit-main {
          min-width: 0;
          padding: 44px 56px 48px 36px;
          background: #fff;
        }

        .account-edit-top {
          margin-bottom: 14px;
        }

        .account-edit-form {
          max-width: 100%;
        }

        .account-edit-field {
          margin-bottom: 16px;
        }

        .account-edit-label {
          display: block;
          margin-bottom: 12px;
          color: #050505;
          font-size: 17px;
          line-height: 1.4;
          font-weight: 400;
        }

        .account-edit-label.required::after {
          content: ' *';
        }

        .account-edit-input {
          width: 100%;
          min-height: 62px;
          padding: 16px 22px;
          border: 1px solid #ddd8cf;
          background: #fff;
          color: #465468;
          font-size: 15px;
          outline: none;
        }

        .account-edit-input:focus {
          border-color: #14544f;
          box-shadow: 0 0 0 3px rgba(20, 84, 79, 0.08);
        }

        .account-edit-note {
          margin: 10px 0 8px;
          color: #6b6b6b;
          font-size: 15px;
          line-height: 1.8;
          font-style: italic;
        }

        .account-edit-subheading {
          margin: 28px 0 14px;
          color: #111;
          font-size: 19px;
          line-height: 1.4;
          font-weight: 700;
        }

        .account-edit-message {
          margin: 0 0 18px;
          padding: 14px 16px;
          border: 1px solid transparent;
          font-size: 14px;
          line-height: 1.6;
        }

        .account-edit-message.error {
          color: #9b1c1c;
          border-color: #efcaca;
          background: #fff5f5;
        }

        .account-edit-message.success {
          color: #14532d;
          border-color: #c9e7d2;
          background: #f3fbf6;
        }

        .account-edit-actions {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }

        .account-edit-save {
          min-width: 236px;
          min-height: 56px;
          border: 0;
          background: #162335;
          color: #fff;
          font-size: 14px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .account-edit-save:disabled {
          opacity: 0.7;
          cursor: progress;
        }

        @media (max-width: 991px) {
          .account-edit-layout {
            grid-template-columns: 1fr;
          }

          .account-edit-sidebar {
            padding-bottom: 28px;
          }

          .account-edit-sidebar-inner {
            position: static;
          }

        }

        @media (max-width: 767px) {
          .account-edit-sidebar,
          .account-edit-main {
            padding: 18px;
          }

          .account-edit-save {
            width: 100%;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main account-edit-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : !isLoggedIn || !user ? (
                <div style={{ background: '#fff', border: '1px solid #ece8df', padding: 24 }}>
                  <p style={{ margin: 0, color: '#555', fontSize: 15, lineHeight: 1.7 }}>
                    Please log in to edit your account details.
                  </p>
                  <div style={{ marginTop: 16 }}>
                    <Link href="/my-account" className="button fill uppercase">Go To My Account</Link>
                  </div>
                </div>
              ) : (
                <div className="account-edit-shell">
                  <div className="account-edit-layout">
                    <aside className="account-edit-sidebar">
                      <div className="account-edit-sidebar-inner">
                        <div className="account-edit-avatar" aria-hidden="true">
                          <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h3 className="account-edit-hello">Hello</h3>
                        <p className="account-edit-handle">{accountHandle}</p>

                        <nav className="account-edit-nav" aria-label="Account navigation">
                          <Link href="/my-account" className="account-edit-link">Dashboard</Link>
                          <Link href="/my-account/edit-account" className="account-edit-link active">Edit Profile</Link>
                          <Link href="/my-account/edit-address" className="account-edit-link">My Addresses</Link>
                          <Link href="/orders" className="account-edit-link">My Orders</Link>
                          <Link href="/wishlist" className="account-edit-link">Wishlist</Link>
                          <button className="account-edit-button" onClick={logout}>Logout</button>
                        </nav>
                      </div>
                    </aside>

                    <div className="account-edit-main">
                      <div className="account-edit-top" />

                      {error && <p className="account-edit-message error">{error}</p>}
                      {success && <p className="account-edit-message success">{success}</p>}

                      <form className="account-edit-form" onSubmit={handleSubmit} noValidate>
                        <div className="account-edit-field">
                          <label className="account-edit-label">First name</label>
                          <input className="account-edit-input" type="text" value={form.firstName} onChange={setField('firstName')} />
                        </div>

                        <div className="account-edit-field">
                          <label className="account-edit-label">Last name</label>
                          <input className="account-edit-input" type="text" value={form.lastName} onChange={setField('lastName')} />
                        </div>

                        <div className="account-edit-field">
                          <label className="account-edit-label required">Display name</label>
                          <input className="account-edit-input" type="text" value={form.displayName} onChange={setField('displayName')} />
                          <p className="account-edit-note">
                            This will be how your name will be displayed in the account section and in reviews.
                          </p>
                        </div>

                        <div className="account-edit-field">
                          <label className="account-edit-label required">Email address</label>
                          <input className="account-edit-input" type="email" value={form.email} onChange={setField('email')} />
                        </div>

                        <h4 className="account-edit-subheading">Password change</h4>

                        <div className="account-edit-field">
                          <label className="account-edit-label">Current password (leave blank to leave unchanged)</label>
                          <input className="account-edit-input" type="password" value={form.currentPassword} onChange={setField('currentPassword')} />
                        </div>

                        <div className="account-edit-field">
                          <label className="account-edit-label">New password (leave blank to leave unchanged)</label>
                          <input className="account-edit-input" type="password" value={form.newPassword} onChange={setField('newPassword')} />
                        </div>

                        <div className="account-edit-field">
                          <label className="account-edit-label">Confirm new password</label>
                          <input className="account-edit-input" type="password" value={form.confirmPassword} onChange={setField('confirmPassword')} />
                        </div>

                        <div className="account-edit-actions">
                          <button type="submit" className="account-edit-save" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
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
