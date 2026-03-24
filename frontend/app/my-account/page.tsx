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
  const [reg, setReg]     = useState({ username: '', email: '', password: '' });
  const [loginErr, setLoginErr]   = useState('');
  const [regErr, setRegErr]       = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading]     = useState(false);
  const [regSuccess, setRegSuccess]     = useState('');

  const setL = (k: keyof typeof login) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setLogin(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } as typeof login));

  const setR = (k: keyof typeof reg) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setReg(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!login.username || !login.password) { setLoginErr('Please enter username and password.'); return; }
    setLoginErr(''); setLoginLoading(true);
    try {
      const res = await authLogin(login.username, login.password);
      if (res.success && res.data) {
        setUser(res.data);
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
    if (!reg.username || !reg.email || !reg.password) { setRegErr('All fields are required.'); return; }
    if (!/\S+@\S+\.\S+/.test(reg.email)) { setRegErr('Enter a valid email address.'); return; }
    setRegErr(''); setRegLoading(true);
    try {
      const res = await authRegister(reg.username, reg.email, reg.password);
      if (res.success) {
        setReg({ username: '', email: '', password: '' });
        // Session is already set by the backend — fetch the user from /auth/me
        const me = await fetch('/store/api/auth/me', { credentials: 'include' }).then(r => r.json());
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

  return (
    <>
      <Header />
      <div className="dima-main">

        {/* Breadcrumb */}
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
                /* ── Logged in ── */
                <div className="box order-products" style={{ maxWidth: 480 }}>
                  {/* Avatar + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: "#8fb8a8", display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0,
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                        stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="box-titel" style={{ margin: 0 }}>Welcome, {user.displayName}</h4>
                      <span style={{ fontSize: 12, color: "#888", textTransform: "capitalize" }}>{user.role}</span>
                    </div>
                  </div>
                  <div className="field">
                    <p><strong>Username:</strong> {user.username}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>User Type:</strong> {user.role}</p>
                  </div>
                  <div className="field last">
                    <Link href="/shop" className="button small fill uppercase" style={{ marginRight: 12 }}>
                      Continue Shopping
                    </Link>
                    <button className="button small stroke uppercase" onClick={logout}>
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Guest ── */
                <>
                  <div className="ok-row">

                    {/* Login */}
                    <div className="ok-md-6 ok-xsd-12">
                      <div className="box order-products">
                        <h4 className="box-titel">Login</h4>
                        <form className="form-small form" onSubmit={handleLogin} noValidate>
                          <div className="field">
                            <label className="required">Username or Email</label>
                            <input type="text" placeholder="Username or email"
                              value={login.username} onChange={setL('username')} />
                          </div>
                          <div className="field">
                            <label className="required">Password</label>
                            <input type="password" placeholder="Password"
                              value={login.password} onChange={setL('password')} />
                          </div>
                          {loginErr && <p style={errStyle}>{loginErr}</p>}
                          <div className="field last">
                            <button type="submit" className="button small fill uppercase" disabled={loginLoading}>
                              {loginLoading ? 'Logging in...' : 'LOGIN'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* Register */}
                    <div className="ok-md-6 ok-xsd-12">
                      <div className="box order-products">
                        <h4 className="box-titel">Register</h4>
                        <form className="form-small form" onSubmit={handleRegister} noValidate>
                          <div className="field">
                            <label className="required">Username</label>
                            <input type="text" placeholder="Username"
                              value={reg.username} onChange={setR('username')} />
                          </div>
                          <div className="field">
                            <label className="required">Email</label>
                            <input type="email" placeholder="Email"
                              value={reg.email} onChange={setR('email')} />
                          </div>
                          <div className="field">
                            <label className="required">Password</label>
                            <input type="password" placeholder="Password"
                              value={reg.password} onChange={setR('password')} />
                          </div>
                          {regErr     && <p style={errStyle}>{regErr}</p>}
                          {regSuccess && <p style={{ color: '#2bbfaa', fontSize: 13, marginBottom: 8 }}>{regSuccess}</p>}
                          <div className="field last">
                            <button type="submit" className="button small fill uppercase" disabled={regLoading}>
                              {regLoading ? 'Registering...' : 'REGISTER'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>

                  </div>
                </>
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
