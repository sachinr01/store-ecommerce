'use strict';

const axios = require('axios');

let _tokenCache = null; // { token, expiresAt }

/**
 * Fetch (and cache) the Shiprocket bearer token.
 * @param {boolean} forceRefresh - bypass cache and re-authenticate
 * @param {boolean} _isRetry     - internal flag, do not pass from callers
 * @returns {Promise<string>} bearer token
 */
async function getShiprocketToken(forceRefresh = false, _isRetry = false) {
  if (!forceRefresh && _tokenCache && _tokenCache.expiresAt > Date.now()) {
    return _tokenCache.token;
  }

  const email = process.env.SHIPROCKET_EMAIL || '';
  const password = process.env.SHIPROCKET_PASSWORD || '';
  if (!email || !password) {
    throw new Error('SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not set in .env');
  }

  try {
    const res = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      { email, password },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
    );
    const token = res.data?.data?.token || res.data?.token;
    if (!token) throw new Error('Shiprocket login returned no token');

    // Shiprocket tokens last 10 hours — cache for 9 to leave headroom.
    _tokenCache = { token, expiresAt: Date.now() + 9 * 60 * 60 * 1000 };
    return token;
  } catch (err) {
    _tokenCache = null; // never cache a bad/partial result

    // One automatic retry for transient network/5xx hiccups — NOT for 403s,
    // since retrying a rate-limit/auth-block immediately just makes it worse.
    const status = err.response?.status;
    const isRetryable = !status || status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    if (!_isRetry && isRetryable) {
      console.warn(`[shiprocketAuth] login attempt failed (${err.message}) — retrying once`);
      await new Promise((r) => setTimeout(r, 800));
      return getShiprocketToken(true, true);
    }
    throw err;
  }
}

/** Drop the cached token — call this if a downstream request 401/403s
 *  unexpectedly with a token that should still be valid (rare: revoked
 *  session, password changed, etc). Next getShiprocketToken() call will
 *  re-authenticate. */
function invalidateShiprocketToken() {
  _tokenCache = null;
}

module.exports = { getShiprocketToken, invalidateShiprocketToken };