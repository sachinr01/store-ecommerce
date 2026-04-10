'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authLogin, authRegister } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useAuth } from '../lib/authContext';

export default function MyAccountPage() {
  const { user, isLoggedIn, isLoading, setUser, logout } = useAuth();
  const { refresh } = useCart();

  const [login, setLogin] = useState({ username: '', password: '', remember: false });
  const [reg, setReg] = useState({ username: '', email: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [regErr, setRegErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');

  const setL = (k: keyof typeof login) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setLogin((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } as typeof login));

  const setR = (k: keyof typeof reg) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setReg((f) => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!login.username || !login.password) {
      setLoginErr('Please enter username and password.');
      return;
    }

    setLoginErr('');
    setLoginLoading(true);

    try {
      const res = await authLogin(login.username, login.password);
      if (res.success && res.data) {
        const me = await fetch('/store/api/auth/me', { credentials: 'include' }).then((r) => r.json());
        if (me.success && me.data?.isLoggedIn && me.data.user) {
          setUser(me.data.user);
        } else {
          setUser(res.data);
        }
        await refresh();
      } else {
        setLoginErr(res.message || 'Login failed.');
      }
    } catch {
      setLoginErr('Could not connect to server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reg.username || !reg.email || !reg.password) {
      setRegErr('All fields are required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(reg.email)) {
      setRegErr('Enter a valid email address.');
      return;
    }

    setRegErr('');
    setRegLoading(true);

    try {
      const res = await authRegister(reg.username, reg.email, reg.password);
      if (res.success) {
        setReg({ username: '', email: '', password: '' });
        const me = await fetch('/store/api/auth/me', { credentials: 'include' }).then((r) => r.json());
        if (me.success && me.data?.isLoggedIn && me.data.user) {
          setUser(me.data.user);
          await refresh();
        } else {
          setRegSuccess('Account created! You can now log in.');
        }
      } else {
        setRegErr(res.message || 'Registration failed.');
      }
    } catch {
      setRegErr('Could not connect to server.');
    } finally {
      setRegLoading(false);
    }
  };

  const accountName = user?.displayName || user?.username || 'Guest';
  const accountHandle = user?.username ? `@${user.username}` : user?.email || '@account';

  return (
    <>
      <style>{`
        .account-page {
          padding-bottom: 48px;
        }

        .account-auth-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
        }

        .account-auth-card,
        .account-shell {
          background: #fff;
        }

        .account-auth-card {
          border: 1px solid #ece8df;
          padding: 26px 24px;
        }

        .account-shell {
          overflow: hidden;
        }

        .account-layout {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          align-items: start;
          min-height: 560px;
        }

        .account-sidebar {
          min-height: 100%;
          padding: 60px 42px 48px;
          background: #fff;
        }

        .account-sidebar-inner {
          position: sticky;
          top: 104px;
        }

        .account-avatar {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .account-hello {
          margin: 28px 0 10px;
          color: #000;
          font-size: 27px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .account-handle {
          margin: 0;
          color: #42556d;
          font-size: 18px;
          line-height: 1.5;
        }

        .account-nav {
          display: grid;
          gap: 8px;
          margin-top: 66px;
        }

        .account-nav-link,
        .account-nav-button {
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

        .account-nav-link:hover,
        .account-nav-button:hover {
          color: #14544f;
        }

        .account-main {
          min-width: 0;
          padding: 54px 56px 48px 36px;
          background: #fff;
        }

        .account-top {
          display: block;
        }

        .account-copy {
          max-width: 940px;
        }

        .account-greeting {
          margin: 0 0 18px;
          color: #1f3550;
          font-size: 18px;
          line-height: 1.6;
        }

        .account-inline-action {
          border: 0;
          padding: 0;
          background: transparent;
          color: #111;
          font: inherit;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .account-description {
          margin: 0;
          color: #111;
          font-size: 19px;
          line-height: 1.75;
          max-width: 960px;
        }

        @media (max-width: 991px) {
          .account-layout,
          .account-auth-grid {
            grid-template-columns: 1fr;
          }

          .account-sidebar-inner {
            position: static;
          }

          .account-main {
            padding-left: 42px;
          }
        }

        @media (max-width: 767px) {
          .account-sidebar,
          .account-main,
          .account-auth-card {
            padding: 18px;
          }

          .account-description {
            font-size: 16px;
            line-height: 1.7;
          }

        }
      `}</style>

      <Header />
      <div className="dima-main account-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : isLoggedIn && user ? (
                <div className="account-shell">
                  <div className="account-layout">
                    <aside className="account-sidebar">
                      <div className="account-sidebar-inner">
                        <div className="account-avatar" aria-hidden="true">
                          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h3 className="account-hello">Hello</h3>
                        <p className="account-handle">{accountHandle}</p>

                        <nav className="account-nav" aria-label="Account navigation">
                          <Link href="/my-account" className="account-nav-link">Dashboard</Link>
                          <Link href="/my-account/edit-account" className="account-nav-link">Edit Profile</Link>
                          <Link href="/my-account/edit-address" className="account-nav-link">My Addresses</Link>
                          <Link href="/orders" className="account-nav-link">My Orders</Link>
                          <Link href="/wishlist" className="account-nav-link">Wishlist</Link>
                          <button className="account-nav-button" onClick={logout}>Logout</button>
                        </nav>
                      </div>
                    </aside>

                    <div className="account-main">
                      <div className="account-top">
                        <div className="account-copy">
                          <p className="account-greeting">
                            Hello {accountName} (not {accountName}? <button className="account-inline-action" onClick={logout}>Log out</button>)
                          </p>
                          <p className="account-description">
                            From your account dashboard you can view your recent orders, manage your shipping and billing addresses,
                            and edit your password and account details.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="account-auth-grid">
                  <div className="account-auth-card">
                    <h4 className="box-titel">Login</h4>
                    <form className="form-small form" onSubmit={handleLogin} noValidate>
                      <div className="field">
                        <label className="required">Username or Email</label>
                        <input type="text" placeholder="Username or email" value={login.username} onChange={setL('username')} />
                      </div>
                      <div className="field">
                        <label className="required">Password</label>
                        <input type="password" placeholder="Password" value={login.password} onChange={setL('password')} />
                      </div>
                      {loginErr && <p style={errStyle}>{loginErr}</p>}
                      <div className="field last">
                        <button type="submit" className="button small fill uppercase" disabled={loginLoading}>
                          {loginLoading ? 'Logging in...' : 'Login'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="account-auth-card">
                    <h4 className="box-titel">Register</h4>
                    <form className="form-small form" onSubmit={handleRegister} noValidate>
                      <div className="field">
                        <label className="required">Username</label>
                        <input type="text" placeholder="Username" value={reg.username} onChange={setR('username')} />
                      </div>
                      <div className="field">
                        <label className="required">Email</label>
                        <input type="email" placeholder="Email" value={reg.email} onChange={setR('email')} />
                      </div>
                      <div className="field">
                        <label className="required">Password</label>
                        <input type="password" placeholder="Password" value={reg.password} onChange={setR('password')} />
                      </div>
                      {regErr && <p style={errStyle}>{regErr}</p>}
                      {regSuccess && <p style={{ color: '#2bbfaa', fontSize: 13, marginBottom: 8 }}>{regSuccess}</p>}
                      <div className="field last">
                        <button type="submit" className="button small fill uppercase" disabled={regLoading}>
                          {regLoading ? 'Registering...' : 'Register'}
                        </button>
                      </div>
                    </form>
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

const errStyle: React.CSSProperties = { color: '#c62828', fontSize: 13, marginBottom: 8 };
