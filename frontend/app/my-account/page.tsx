'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authLogin, authRegister } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useAuth } from '../lib/authContext';
import './my-account.css';

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
  const [showRegister, setShowRegister] = useState(false);

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
      <Header />
      <div className="dima-main account-page">
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              {isLoading ? (
              <p style={{ padding: '24px 0', color: '#888', fontSize: 14 }}>Loading...</p>
              ) : isLoggedIn && user ? (                <div className="account-shell">
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
                  {!showRegister ? (
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
                      {loginErr && <p className="account-err">{loginErr}</p>}
                      <div className="field last">
                        <button type="submit" className="button small fill uppercase" disabled={loginLoading}>
                          {loginLoading ? 'Logging in...' : 'Login'}
                        </button>
                      </div>
                    </form>
                    <p style={{ marginTop: '14px', fontSize: '13px', color: '#555' }}>
                      Don&apos;t have an account?{' '}
                      <button onClick={() => setShowRegister(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                        Create New Account
                      </button>
                    </p>
                  </div>
                  ) : (
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
                      {regErr && <p className="account-err">{regErr}</p>}
                      {regSuccess && <p className="account-success">{regSuccess}</p>}
                      <div className="field last">
                        <button type="submit" className="button small fill uppercase" disabled={regLoading}>
                          {regLoading ? 'Registering...' : 'Register'}
                        </button>
                      </div>
                    </form>
                    <p style={{ marginTop: '14px', fontSize: '13px', color: '#555' }}>
                      Already have an account?{' '}
                      <button onClick={() => setShowRegister(false)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                        Back to Login
                      </button>
                    </p>
                  </div>
                  )}
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

