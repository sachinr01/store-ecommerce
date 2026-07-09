'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AccountSidebar from '../components/AccountSidebar';
import { authSendOtp, authVerifyOtp, authForgotPassword, type AuthUser } from '../lib/api';
import { useCart } from '../lib/cartContext';
import { useAuth } from '../lib/authContext';

export default function MyAccountPage() {
  const { user, isLoggedIn, isLoading, setUser, logout } = useAuth();
  const { refresh } = useCart();

  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear timer on unmount
  useEffect(() => () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); }, []);

  const startResendTimer = () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setOtpResendTimer(60);
    resendTimerRef.current = setInterval(() => {
      setOtpResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current!);
          resendTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };



  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');



  const syncLoggedInUser = useCallback(async (fallbackUser: AuthUser) => {
    try {
      const me = await fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json());
      if (me.success && me.data?.isLoggedIn && me.data.user) {
        setUser(me.data.user);
      } else {
        setUser(fallbackUser);
      }
      await refresh();
    } catch {
      setUser(fallbackUser);
      await refresh();
    }
  }, [refresh, setUser]);

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setLoginErr('Please enter a valid mobile number.');
      return;
    }

    setLoginErr('');
    setLoginLoading(true);

    try {
      const res = await authSendOtp(mobile);
      if (res.success) {
        setOtpSent(true);
        startResendTimer();
      } else {
        setLoginErr(res.message || 'Failed to send OTP.');
      }
    } catch {
      setLoginErr('Could not connect to server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mobile || !otp || otp.length < 4) {
      setLoginErr('Please enter a valid OTP.');
      return;
    }

    setLoginErr('');
    setLoginLoading(true);

    try {
      const res = await authVerifyOtp(mobile, otp);
      if (res.success && res.data) {
        await syncLoggedInUser(res.data.user);
      } else {
        setLoginErr(res.message || 'OTP verification failed.');
      }
    } catch {
      setLoginErr('Could not connect to server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;

    setLoginErr('');
    setLoginLoading(true);

    try {
      const res = await authSendOtp(mobile);
      if (res.success) {
        startResendTimer();
      } else {
        setLoginErr(res.message || 'Failed to resend OTP.');
      }
    } catch {
      setLoginErr('Could not connect to server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMobile(e.target.value);
    if (otpSent) {
      setOtpSent(false);
      setOtp('');
    }
  };



  const openForgotModal = () => {
    setForgotIdentifier(mobile.trim());
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotIdentifier('');
    setForgotLoading(false);
    setForgotError('');
    setForgotSuccess('');
  };

  const handleForgotPassword = async () => {
    const value = forgotIdentifier.trim();
    if (!value || value.length < 10) {
      setForgotError('Please enter a valid mobile number.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');
    try {
      const res = await authForgotPassword(value);
      if (res.success) {
        setForgotSuccess(res.message || 'A password reset link has been sent.');
        setForgotIdentifier('');
      } else {
        setForgotError(res.message || 'Unable to process your request.');
      }
    } catch {
      setForgotError('Could not connect to the server.');
    } finally {
      setForgotLoading(false);
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
                <div className="account-loading">Loading...</div>
              ) : isLoggedIn && user ? (
                <div className="account-shell">
                  <div className="account-layout">
                    <AccountSidebar accountHandle={accountHandle} activeLink="dashboard" onLogout={logout} />

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
                    {!otpSent ? (
                      <form className="form-small form" onSubmit={handleSendOtp} noValidate>
                        <div className="field">
                          <label className="required">Mobile Number</label>
                          <input 
                            type="tel" 
                            placeholder="Enter mobile number" 
                            value={mobile} 
                            onChange={handleMobileChange}
                            maxLength={10}
                          />
                        </div>
                        {loginErr && <p className="account-err">{loginErr}</p>}
                        <div className="field last">
                          <button type="submit" className="btn-view-product btn-view-product--inline" disabled={loginLoading}>
                            {loginLoading ? 'Sending OTP...' : 'Send OTP'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form className="form-small form" onSubmit={handleVerifyOtp} noValidate>
                        <div className="field">
                          <label>Mobile No.</label>
                          <div className="otp-mobile-row">
                            <span className="otp-mobile-number">{mobile}</span>
                            <button
                              type="button"
                              className="otp-change-link"
                              onClick={() => {
                                if (resendTimerRef.current) clearInterval(resendTimerRef.current);
                                resendTimerRef.current = null;
                                setOtpSent(false);
                                setOtp('');
                                setOtpResendTimer(0);
                                setLoginErr('');
                              }}
                            >
                              Change
                            </button>
                          </div>
                        </div>
                        <div className="field">
                          <label className="required">Enter OTP</label>
                          <input
                            type="text"
                            placeholder="Enter OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            autoFocus
                          />
                        </div>
                        {loginErr && <p className="account-err">{loginErr}</p>}
                        <div className="field last otp-action-row">
                          <button type="submit" className="btn-view-product btn-view-product--inline" disabled={loginLoading}>
                            {loginLoading ? 'Verifying...' : 'VERIFY OTP'}
                          </button>
                          {otpResendTimer > 0 ? (
                            <span className="otp-resend-timer">Resend in {otpResendTimer}s</span>
                          ) : (
                            <button
                              type="button"
                              className="otp-resend-btn"
                              onClick={handleResendOtp}
                              disabled={loginLoading}
                            >
                              Resend OTP
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {showForgotModal && (
        <div className="register-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForgotModal(); }}>
          <div className="register-modal">
            <button type="button" className="register-modal-close" onClick={closeForgotModal} aria-label="Close">&#x2715;</button>
            <p className="register-modal-title">Forgot Password?</p>
            <p className="register-modal-sub">Enter your mobile number and we&apos;ll send a secure reset link to your registered number.</p>
            <div className="register-modal-field">
              <label className="register-modal-label">Mobile Number <span>*</span></label>
              <input
                className="register-modal-input"
                type="tel"
                placeholder="mobile number"
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                autoComplete="tel"
                maxLength={10}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleForgotPassword(); }}
              />
            </div>
            {forgotError && <p className="register-modal-err">{forgotError}</p>}
            {forgotSuccess && <p className="register-modal-success">{forgotSuccess}</p>}
            <button
              type="button"
              className="btn-view-product checkout-recovery-submit"
              onClick={() => void handleForgotPassword()}
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="reset-password-foot">
              <button type="button" className="reset-password-foot-link" onClick={closeForgotModal}>
                Back to login
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
