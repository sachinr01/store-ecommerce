'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { authLogin, authRegister, type AuthUser } from '../lib/api';

export default function MyAccountPage() {
  const [login, setLogin] = useState({ username: '', password: '', remember: false });
  const [reg, setReg]     = useState({ username: '', email: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [regErr, setRegErr]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [regLoading, setRegLoading]     = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<AuthUser | null>(null);
  const [regSuccess, setRegSuccess]     = useState('');

  const setL = (k: keyof typeof login) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setLogin(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } as typeof login));

  const setR = (k: keyof typeof reg) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setReg(f => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.username || !login.password) { setLoginErr('Please enter username and password.'); return; }
    setLoginErr(''); setLoginLoading(true);
    try {
      const res = await authLogin(login.username, login.password);
      if (res.success && res.data) {
        setLoggedInUser(res.data);
      } else {
        setLoginErr(res.message || 'Login failed.');
      }
    } catch {
      setLoginErr('Could not connect to server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reg.username || !reg.email || !reg.password) { setRegErr('All fields are required.'); return; }
    if (!/\S+@\S+\.\S+/.test(reg.email)) { setRegErr('Enter a valid email address.'); return; }
    setRegErr(''); setRegLoading(true);
    try {
      const res = await authRegister(reg.username, reg.email, reg.password);
      if (res.success) {
        setRegSuccess('Account created! You can now log in.');
        setReg({ username: '', email: '', password: '' });
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
                <span><Link href="/store" className="trail-begin">Home</Link></span>
                <span className="sep">\</span>
                <span className="trail-end">My Account</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">

              {loggedInUser ? (
                /* ── Logged in state ── */
                <div className="box order-products" style={{ maxWidth: 480 }}>
                  <h4 className="box-titel">Welcome, {loggedInUser.displayName}</h4>
                  <div className="field">
                    <p><strong>Username:</strong> {loggedInUser.username}</p>
                    <p><strong>Email:</strong> {loggedInUser.email}</p>
                  </div>
                  <div className="field last">
                    <Link href="/store/shop" className="button small fill uppercase" style={{ marginRight: 12 }}>
                      Continue Shopping
                    </Link>
                    <button className="button small stroke uppercase"
                      onClick={() => setLoggedInUser(null)}>
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4>Billing Details</h4>
                  <div className="clear" />
                  <div className="ok-row">

                    {/* ── Login ── */}
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
                            <a href="#" className="lost-pass" style={{ marginLeft: 14, fontSize: 13 }}>Lost Password?</a>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
                              <input className="checkbox" type="checkbox"
                                checked={login.remember} onChange={setL('remember')} />
                              Remember me
                            </label>
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* ── Register ── */}
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
