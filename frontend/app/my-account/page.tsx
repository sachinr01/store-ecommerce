'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authLogin, authRegister } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useAuth } from '../lib/authContext';
import { useWishlist } from '../lib/wishlistContext';

export default function MyAccountPage() {
  const { user, isLoggedIn, isLoading, setUser, logout } = useAuth();
  const { refresh, count } = useCart();
  const { items: wishlistItems } = useWishlist();

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

  const quickLinks = [
    {
      title: 'Wishlist',
      value: `${wishlistItems.length}`,
      note: 'Saved items',
      href: '/wishlist',
    },
    {
      title: 'My Cart',
      value: `${count}`,
      note: 'Items in cart',
      href: '/cart',
    },
    {
      title: 'Orders',
      value: 'View',
      note: 'Order details',
      href: '/orders',
    },
  ];

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
        .account-shell,
        .account-card,
        .account-quick-card {
          background: #fff;
          border: 1px solid #ece8df;
        }

        .account-auth-card {
          padding: 26px 24px;
        }

        .account-shell {
          padding: 28px;
        }

        .account-hero {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          margin-bottom: 28px;
        }

        .account-avatar {
          width: 74px;
          height: 74px;
          border-radius: 50%;
          background: #8fb8a8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .account-title {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
          color: #1a1a1a;
          font-weight: 700;
        }

        .account-subtitle {
          margin: 6px 0 0;
          color: #747474;
          font-size: 14px;
        }

        .account-role {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 14px;
          border-radius: 999px;
          background: #f3efe7;
          color: #444;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .account-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 28px;
          align-items: start;
        }

        .account-stack {
          display: grid;
          gap: 22px;
        }

        .account-card {
          padding: 22px;
        }

        .account-card-title {
          margin: 0 0 18px;
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .account-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .account-info-item {
          padding: 16px;
          border: 1px solid #f0ece4;
          background: #fcfbf8;
        }

        .account-info-label {
          display: block;
          margin-bottom: 6px;
          color: #767676;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .account-info-value {
          color: #1f1f1f;
          font-size: 16px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .account-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .account-quick-grid {
          display: grid;
          gap: 16px;
        }

        .account-quick-card {
          padding: 20px;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .account-quick-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
        }

        .account-quick-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
        }

        .account-quick-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #1b1b1b;
        }

        .account-quick-value {
          color: #12bfb2;
          font-size: 26px;
          font-weight: 800;
          line-height: 1;
        }

        .account-quick-note {
          margin: 0 0 18px;
          color: #6f6f6f;
          font-size: 14px;
          line-height: 1.5;
        }

        .account-empty-note {
          margin: 0;
          color: #777;
          font-size: 14px;
          line-height: 1.6;
        }

        @media (max-width: 991px) {
          .account-grid,
          .account-auth-grid {
            grid-template-columns: 1fr;
          }

          .account-hero {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .account-role {
            grid-column: 1 / -1;
            justify-self: start;
          }
        }

        @media (max-width: 767px) {
          .account-page {
            padding-bottom: 32px;
          }

          .account-shell,
          .account-auth-card,
          .account-card,
          .account-quick-card {
            padding: 18px;
          }

          .account-title {
            font-size: 24px;
          }

          .account-info-grid {
            grid-template-columns: 1fr;
          }

          .account-actions .button {
            width: 100%;
            text-align: center;
          }
        }

        @media (max-width: 520px) {
          .account-hero {
            grid-template-columns: 1fr;
          }

          .account-avatar {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>

      <Header />
      <div className="dima-main account-page">
        <section className="title_container start-style">
          <div className="page-section-content overflow-hidden">
            <div className="container page-section">
              <h2 className="uppercase undertitle text-start">MY ACCOUNT</h2>
              <div className="dima-breadcrumbs breadcrumbs-end text-end">
                <span><Link href="/" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">My Account</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
                <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : isLoggedIn && user ? (
                <div className="account-shell">
                  <div className="account-hero">
                    <div className="account-avatar">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h3 className="account-title">Welcome, {user.displayName}</h3>
                      <p className="account-subtitle">Manage your profile, saved products, cart, and order details from one place.</p>
                    </div>

                    <div className="account-role">{user.role}</div>
                  </div>

                  <div className="account-grid">
                    <div className="account-stack">
                      <div className="account-card">
                        <h4 className="account-card-title">Account Details</h4>
                        <div className="account-info-grid">
                          <div className="account-info-item">
                            <span className="account-info-label">Username</span>
                            <span className="account-info-value">{user.username}</span>
                          </div>
                          <div className="account-info-item">
                            <span className="account-info-label">Email</span>
                            <span className="account-info-value">{user.email}</span>
                          </div>
                          <div className="account-info-item">
                            <span className="account-info-label">Display Name</span>
                            <span className="account-info-value">{user.displayName}</span>
                          </div>
                          <div className="account-info-item">
                            <span className="account-info-label">Role</span>
                            <span className="account-info-value" style={{ textTransform: 'capitalize' }}>{user.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="account-card">
                        <h4 className="account-card-title">Quick Actions</h4>
                        <div className="account-actions">
                          <Link href="/shop" className="button fill uppercase">Continue Shopping</Link>
                          <button className="button stroke uppercase" onClick={logout}>Logout</button>
                        </div>
                      </div>
                    </div>

                    <div className="account-quick-grid">
                      {quickLinks.map((item) => (
                        <div key={item.title} className="account-quick-card">
                          <div className="account-quick-top">
                            <h4 className="account-quick-title">{item.title}</h4>
                            <span className="account-quick-value">{item.value}</span>
                          </div>
                          <p className="account-quick-note">{item.note}</p>
                          <Link href={item.href} className="button fill uppercase" style={{ display: 'block', textAlign: 'center' }}>
                            {item.title === 'Orders' ? 'Order Details' : `Open ${item.title}`}
                          </Link>
                        </div>
                      ))}

                      <div className="account-quick-card">
                        <div className="account-quick-top">
                          <h4 className="account-quick-title">Need Something Fast?</h4>
                        </div>
                        <p className="account-empty-note">
                          Use the quick links on the right to jump straight into your wishlist, cart, or past orders without hunting through the menu.
                        </p>
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
