const crypto = require('crypto');

const COOKIE_NAME = process.env.GUEST_COOKIE_NAME || 'guest_id';
const TTL_DAYS = Number.parseInt(process.env.GUEST_COOKIE_TTL_DAYS || '30', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_SAMESITE = NODE_ENV === 'production' ? 'none' : 'lax';
const SAME_SITE = String(process.env.SESSION_SAMESITE || DEFAULT_SAMESITE).toLowerCase();
const SECURE = process.env.SESSION_SECURE === 'true'
  || (NODE_ENV === 'production' && SAME_SITE === 'none');
const COOKIE_PATH = process.env.SESSION_COOKIE_PATH || '/';
const HTTP_ONLY = true;

const isSameSiteValue = (value) => ['lax', 'strict', 'none'].includes(value);

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function buildCookie(name, value, opts) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
  if (opts.expires) parts.push(`Expires=${new Date(opts.expires).toUTCString()}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite && isSameSiteValue(opts.sameSite)) {
    const formatted = opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1);
    parts.push(`SameSite=${formatted}`);
  }
  return parts.join('; ');
}

function setCookie(res, cookieName, cookieValue, opts) {
  const cookieStr = buildCookie(cookieName, cookieValue, opts);
  const prev = res.getHeader('Set-Cookie');
  const next = [];
  if (Array.isArray(prev)) {
    prev.forEach(item => {
      if (!String(item).startsWith(`${cookieName}=`)) next.push(item);
    });
  } else if (prev && !String(prev).startsWith(`${cookieName}=`)) {
    next.push(prev);
  }
  next.push(cookieStr);
  res.setHeader('Set-Cookie', next);
}

function newGuestId() {
  return crypto.randomBytes(16).toString('hex');
}

function guestCookieMiddleware() {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie || '');
    let guestId = cookies[COOKIE_NAME];

    if (!guestId) {
      guestId = newGuestId();
    }

    req.guestId = guestId;

    const ttlMs = Math.max(TTL_DAYS, 1) * 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;

    setCookie(res, COOKIE_NAME, guestId, {
      maxAge: ttlMs,
      expires: expiresAt,
      httpOnly: HTTP_ONLY,
      secure: SECURE,
      sameSite: SAME_SITE,
      path: COOKIE_PATH,
    });

    next();
  };
}

module.exports = { guestCookieMiddleware, COOKIE_NAME };
