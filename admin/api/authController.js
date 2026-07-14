const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const https = require('https');
const db = require('../config/db');
const { mergeGuestCart } = require('./cartController');
const { sendEmail } = require('./mailer');

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID;
const requireGoogleClientId = () => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google client ID is not configured.');
  }
  return GOOGLE_CLIENT_ID;
};
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const RESET_TOKEN_HASH_META = 'password_reset_token_hash';
const RESET_TOKEN_EXPIRES_META = 'password_reset_token_expires';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

const roleSlugFromType = (type) => {
  if (type === 1) return 'admin';
  if (type === 2) return 'agents';
  if (type === 3) return 'customers';
  if (type === 4) return 'guests';
  return 'guest';
};

const toSlug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const md5 = (val) => crypto.createHash('md5').update(val).digest('hex');

const md5Buffer = (val) => crypto.createHash('md5').update(val).digest();
const sha256 = (val) => crypto.createHash('sha256').update(val).digest('hex');

const isHex32 = (val) => /^[a-f0-9]{32}$/i.test(val || '');

// Stricter email validation used in register() and updateProfile().
// Rejects obvious garbage that /\S+@\S+\.\S+/ passes (e.g. 'a@b.c',
// leading/trailing spaces, missing TLD, multiple consecutive dots).
// local part : 1–64 chars, no whitespace or bare @
// domain     : labels of alphanumeric/hyphen chars separated by dots
// TLD        : 2–24 letters only
const VALID_EMAIL_RE = /^[^\s@]{1,64}@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;

function encode64(input, count) {
  let output = '';
  let i = 0;
  while (i < count) {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  }
  return output;
}

function phpassHash(password, setting) {
  if (!setting || setting.length < 12) return null;
  const id = setting.slice(0, 3);
  if (id !== '$P$' && id !== '$H$') return null;

  const countLog2 = ITOA64.indexOf(setting[3]);
  if (countLog2 < 7 || countLog2 > 30) return null;
  const count = 1 << countLog2;
  const salt = setting.slice(4, 12);

  let hash = md5Buffer(`${salt}${password}`);
  for (let i = 0; i < count; i += 1) {
    hash = md5Buffer(Buffer.concat([hash, Buffer.from(password)]));
  }

  return setting.slice(0, 12) + encode64(hash, 16);
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return { ok: false, needsRehash: false };
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    const ok = await bcrypt.compare(password, storedHash);
    return { ok, needsRehash: ok && bcrypt.getRounds(storedHash) < 12 };
  }
  if (storedHash.startsWith('$P$') || storedHash.startsWith('$H$')) {
    const check = phpassHash(password, storedHash);
    // timingSafeEqual prevents timing attacks that enumerate the hash byte-by-byte.
    // phpassHash always produces a fixed-length string matching storedHash length.
    const ok = check.length === storedHash.length &&
      crypto.timingSafeEqual(Buffer.from(check), Buffer.from(storedHash));
    return { ok, needsRehash: ok };
  }
  if (isHex32(storedHash)) {
    // Legacy MD5 path — WordPress accounts migrated before bcrypt was adopted.
    // timingSafeEqual prevents timing attacks; md5() always returns 32 hex chars
    // matching storedHash length, so buffers are always the same length.
    const computed = md5(password);
    const ok = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
    return { ok, needsRehash: ok };
  }
  // Legacy plaintext fallback — absolute last resort for very old accounts.
  // Pad both sides to 256 bytes so length itself does not leak whether the
  // password matched (prevents timing oracle on password length).
  const a = Buffer.alloc(256, 0);
  const b = Buffer.alloc(256, 0);
  Buffer.from(storedHash).copy(a);
  Buffer.from(password).copy(b);
  const ok = crypto.timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
}

function setSessionUser(req, user) {
  const slug = user.user_type_slug || roleSlugFromType(user.user_type);
  req.sessionData.user = {
    id: user.ID,
    userType: user.user_type,
    userTypeSlug: slug,
    email: user.user_email,
    name: user.display_name,
    username: user.user_login,
  };
  req.sessionData.isLoggedIn = true;
  req.touchSession();
}

async function setUserMetaEntries(userId, entries) {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && entry.metaKey)
    .map((entry) => ({
      metaKey: String(entry.metaKey),
      metaValue: String(entry.metaValue ?? ''),
    }));

  if (!normalizedEntries.length) {
    return;
  }

  const conn = await db.getConnection();
  const lockKey = `usermeta:${userId}`;

  try {
    const [[lockRow]] = await conn.query('SELECT GET_LOCK(?, 5) AS got_lock', [lockKey]);
    if (!lockRow || Number(lockRow.got_lock) !== 1) {
      throw new Error('Could not acquire user meta lock.');
    }

    await conn.beginTransaction();
    const metaKeys = [...new Set(normalizedEntries.map((entry) => entry.metaKey))];
    await conn.query(
      'DELETE FROM tbl_usermeta WHERE user_id = ? AND meta_key IN (?)',
      [userId, metaKeys]
    );
    const rows = normalizedEntries.map((entry) => [userId, entry.metaKey, entry.metaValue]);
    await conn.query(
      'INSERT INTO tbl_usermeta (user_id, meta_key, meta_value) VALUES ?',
      [rows]
    );
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    throw err;
  } finally {
    try {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockKey]);
    } catch {}
    conn.release();
  }
}

async function setUserMeta(userId, metaKey, metaValue) {
  await setUserMetaEntries(userId, [{ metaKey, metaValue }]);
}

async function deleteUserMeta(userId, metaKey) {
  await db.query('DELETE FROM tbl_usermeta WHERE user_id = ? AND meta_key = ?', [userId, metaKey]);
}

function validateBcryptPasswordLength(password) {
  const bytes = Buffer.byteLength(String(password ?? ''), 'utf8');
  if (bytes > MAX_BCRYPT_PASSWORD_BYTES) {
    return 'Password is too long - please shorten it.';
  }
  return null;
}

async function clearPasswordResetToken(userId) {
  await deleteUserMeta(userId, RESET_TOKEN_HASH_META);
  await deleteUserMeta(userId, RESET_TOKEN_EXPIRES_META);
}

async function clearPasswordResetTokenInConn(conn, userId) {
  await conn.query(
    'DELETE FROM tbl_usermeta WHERE user_id = ? AND meta_key IN (?)',
    [userId, [RESET_TOKEN_HASH_META, RESET_TOKEN_EXPIRES_META]]
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFrontendBaseUrl() {
  const rawBase = (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3001'
  ).replace(/\/+$/, '');

  try {
    const url = new URL(rawBase);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    if (process.env.NODE_ENV === 'production' && isLocalhost) {
      throw new Error(
        `Invalid FRONTEND_URL/NEXT_PUBLIC_SITE_URL for production: ${rawBase}. Set it to your public domain.`,
      );
    }

    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '';
    }
    if (!isLocalhost && url.port === '3001') {
      url.port = '';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Unable to determine a production frontend URL from FRONTEND_URL/NEXT_PUBLIC_SITE_URL: ${rawBase}`,
      );
    }
    return rawBase;
  }
}

function getResetCheckoutBaseUrl() {
  const rawResetUrl = (process.env.RESET_URL || '').replace(/\/+$/, '');

  if (rawResetUrl) {
    let url;
    try {
      url = new URL(rawResetUrl);
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Invalid RESET_URL for production: ${rawResetUrl}. Set it to your public checkout URL, for example https://gaffis.org/checkout.`,
        );
      }
      return rawResetUrl;
    }

    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (process.env.NODE_ENV === 'production') {
      if (isLocalhost) {
        throw new Error(
          `Invalid RESET_URL for production: ${rawResetUrl}. Set it to your public checkout URL, for example https://gaffis.org/checkout.`,
        );
      }
      if (url.pathname === '/' || url.pathname === '') {
        throw new Error(
          `RESET_URL must point to the checkout page in production. Example: https://gaffis.org/checkout.`,
        );
      }
    }

    return url.toString().replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'RESET_URL is not configured. Set RESET_URL to your public checkout URL, for example https://gaffis.org/checkout.',
    );
  }

  return `${getFrontendBaseUrl()}/checkout`;
}

// sendBrevoEmail is now provided by ./mailer (SMTP-based)
const sendBrevoEmail = sendEmail;


async function findUserByIdentifier(identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;

  const [[user]] = await db.query(
    `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_type,
            ut.user_type_slug
     FROM tbl_users u
     LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
     WHERE u.user_login = ? OR LOWER(u.user_email) = LOWER(?)
     LIMIT 1`,
    [value, value],
  );

  return user || null;
}

async function getAuthUserById(userId) {
  const [[user]] = await db.query(
    `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_type,
            ut.user_type_slug
     FROM tbl_users u
     LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
     WHERE u.ID = ?
     LIMIT 1`,
    [userId]
  );
  return user || null;
}

async function findGoogleAccount(googleSub, googleEmail) {
  const [[subMatch]] = await db.query(
    `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_type,
            ut.user_type_slug
     FROM tbl_usermeta um
     INNER JOIN tbl_users u ON u.ID = um.user_id
     LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
     WHERE um.meta_key = 'google_sub'
       AND um.meta_value = ?
     LIMIT 1`,
    [googleSub]
  );
  if (subMatch) {
    return { user: subMatch, matchedBy: 'sub' };
  }

  const [[emailMatch]] = await db.query(
    `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_type,
            ut.user_type_slug
     FROM tbl_users u
     LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
     WHERE u.user_email = ?
     LIMIT 1`,
    [googleEmail]
  );

  if (emailMatch) {
    return { user: emailMatch, matchedBy: 'email' };
  }

  return { user: null, matchedBy: 'new' };
}

async function verifyGoogleCredential(credential) {
  if (!credential) {
    throw new Error('Missing Google credential.');
  }

  const clientId = requireGoogleClientId();
  const res = await fetch(`${GOOGLE_TOKENINFO_URL}${encodeURIComponent(credential)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Google token verification failed.');
  }

  const payload = await res.json();
  if (String(payload.aud || '') !== clientId) {
    throw new Error('Google account does not match this app.');
  }

  const issuer = String(payload.iss || '');
  if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
    throw new Error('Google token issuer is invalid.');
  }

  if (!payload.sub || !payload.email) {
    throw new Error('Google account data is incomplete.');
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email),
    emailVerified: String(payload.email_verified ?? '').toLowerCase() === 'true',
    name: String(payload.name || payload.email),
    givenName: String(payload.given_name || ''),
    familyName: String(payload.family_name || ''),
    picture: String(payload.picture || ''),
    hd: String(payload.hd || ''),
  };
}

// POST /api/auth/register
const register = async (req, res) => {
  const { email, password } = req.body;
  // Accept legacy username field but it is no longer required from the frontend.
  let username = req.body.username;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }
  if (!VALID_EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  // Auto-generate a unique username from the email local-part if not supplied.
  if (!username || !String(username).trim()) {
    const base = toSlug(String(email).trim().split('@')[0]) || 'user';
    username = base;
    const [[taken]] = await db.query('SELECT ID FROM tbl_users WHERE user_login = ? LIMIT 1', [username]);
    if (taken) {
      username = `${base}_${Date.now()}`;
    }
  }

  try {
    // ── Check 1: does this email already exist? ──────────────────────────────
    // We look up by email first so we can detect the guest-upgrade path.
    const [[existingByEmail]] = await db.query(
      'SELECT ID, user_type, user_pass FROM tbl_users WHERE user_email = ? LIMIT 1',
      [email]
    );

    const isGuestRow = existingByEmail && existingByEmail.user_type === 4 && !existingByEmail.user_pass;

    if (existingByEmail && !isGuestRow) {
      // A real registered account already owns this email → block.
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // ── Check 2: is the chosen username already taken by ANY other user? ─────
    // This must always run — including the guest-upgrade path — because the
    // guest row's user_login is their email, not the username they're choosing now.
    // Without this check, a guest upgrade could silently overwrite another user's
    // user_login, violating the UNIQUE KEY constraint (or causing a DB error).
    const [[existingByUsername]] = await db.query(
      'SELECT ID FROM tbl_users WHERE user_login = ? AND (? IS NULL OR ID != ?) LIMIT 1',
      [username, existingByEmail ? existingByEmail.ID : null, existingByEmail ? existingByEmail.ID : null]
    );

    if (existingByUsername) {
      return res.status(409).json({ success: false, message: 'That username is already taken. Please choose another.' });
    }

    const existing = existingByEmail; // alias for upgrade path below

    const passwordLengthError = validateBcryptPasswordLength(password);
    if (passwordLengthError) {
      return res.status(400).json({ success: false, message: passwordLengthError });
    }

    const hashed = await bcrypt.hash(password, 12);
    const nicename = toSlug(username);

    let newUserId;

    if (isGuestRow) {
      // ── Guest upgrade path ─────────────────────────────────────────────────
      // The guest placed orders before registering. Promote their existing row
      // to a full customer account so all past orders remain linked to this ID.
      await db.query(
        `UPDATE tbl_users
         SET user_type      = 3,
             user_login     = ?,
             user_pass      = ?,
             user_nicename  = ?,
             display_name   = ?,
             user_registered = NOW()
         WHERE ID = ?`,
        [username, hashed, nicename, username, existing.ID]
      );
      newUserId = existing.ID;
    } else {
      // ── Normal registration path ────────────────────────────────────────────
      const [result] = await db.query(
        `INSERT INTO tbl_users
         (user_type, user_login, user_email, user_pass, user_nicename, display_name, user_registered)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [3, username, email, hashed, nicename, username]
      );
      newUserId = result.insertId;
    }

    const oldSessionId = req.sessionId;
    const guestCookieId = req.guestId || null;
    await req.rotateSession();

    await mergeGuestCart(newUserId, oldSessionId, guestCookieId);

    setSessionUser(req, {
      ID: newUserId,
      user_type: 3,
      user_type_slug: 'customers',
      user_email: email,
      display_name: username,
      user_login: username,
    });

    res.json({
      success: true,
      message: 'Account created successfully.',
      data: { userId: newUserId },
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const [[user]] = await db.query(
      `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_pass, u.user_type,
              ut.user_type_slug
       FROM tbl_users u
       LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
       WHERE u.user_login = ? OR u.user_email = ?
       LIMIT 1`,
      [username, username]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Guest rows (user_type=4, user_pass='') cannot log in directly.
    // Direct them to register instead — their order history will be preserved.
    if (user.user_type === 4 && !user.user_pass) {
      return res.status(401).json({
        success: false,
        message: 'No account found with these credentials. Please register to access your order history.',
      });
    }

    const { ok, needsRehash } = await verifyPassword(password, user.user_pass);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (needsRehash) {
      const newHash = await bcrypt.hash(password, 12);
      await db.query('UPDATE tbl_users SET user_pass = ? WHERE ID = ?', [newHash, user.ID]);
    }

    const oldSessionId = req.sessionId;
    const guestCookieId = req.guestId || null;
    await req.rotateSession();

    await mergeGuestCart(user.ID, oldSessionId, guestCookieId);
    setSessionUser(req, user);

    // Prefer the account-level `phone` meta key — confirmed against production
    // data to be the one populated for real logged-in users. `billing_phone`
    // is only ever set via checkout/guest-merge flows and is empty for most
    // accounts, so it's kept only as a fallback, not the primary source.
    const [phoneRows] = await db.query(
      `SELECT meta_key, meta_value FROM tbl_usermeta WHERE user_id = ? AND meta_key IN ('phone','billing_phone')`,
      [user.ID],
    );
    const phoneMetaMap = Object.fromEntries(phoneRows.map(r => [r.meta_key, r.meta_value]));
    const resolvedPhone = phoneMetaMap['phone'] || phoneMetaMap['billing_phone'] || '';

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.ID,
          username: user.user_login,
          email: user.user_email,
          displayName: user.display_name,
          phone: resolvedPhone,
          role: user.user_type_slug || roleSlugFromType(user.user_type),
          userType: user.user_type,
        }
      }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/google
const googleLogin = async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ success: false, message: 'Google credential is required.' });
  }

  try {
    const googleUser = await verifyGoogleCredential(credential);
    const { user: matchedUser, matchedBy } = await findGoogleAccount(googleUser.sub, googleUser.email);

    let user = matchedUser;
    let userId = matchedUser ? matchedUser.ID : null;

    if (!userId) {
      const nicenameBase = googleUser.givenName || googleUser.name || googleUser.email.split('@')[0];
      const nicename = toSlug(nicenameBase) || toSlug(googleUser.email) || `google-${googleUser.sub.slice(0, 12)}`;
      const displayName = googleUser.name || googleUser.email;
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

      // If a guest row exists for this email, upgrade it instead of inserting a duplicate.
      // This preserves all past guest orders (same user_id on tbl_orders).
      const [[existingGuest]] = await db.query(
        `SELECT ID FROM tbl_users WHERE user_email = ? AND user_type = 4 LIMIT 1`,
        [googleUser.email]
      );

      if (existingGuest) {
        await db.query(
          `UPDATE tbl_users
           SET user_type = 3, user_login = ?, user_pass = ?, user_nicename = ?,
               display_name = ?, user_registered = NOW()
           WHERE ID = ?`,
          [googleUser.email, randomPassword, nicename, displayName, existingGuest.ID]
        );
        userId = existingGuest.ID;
      } else {
        const [result] = await db.query(
          `INSERT INTO tbl_users
           (user_type, user_login, user_pass, user_nicename, user_email, user_url, user_registered, user_activation_key, user_status, display_name)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), '', 0, ?)`,
          [3, googleUser.email, randomPassword, nicename, googleUser.email, googleUser.picture || '', displayName]
        );
        userId = result.insertId;
      }

      user = await getAuthUserById(userId);
    } else {
      if (matchedBy === 'sub' && user.user_email !== googleUser.email) {
        await db.query('UPDATE tbl_users SET user_email = ? WHERE ID = ?', [googleUser.email, userId]);
        user.user_email = googleUser.email;
      }

      if (!user.display_name || !String(user.display_name).trim()) {
        const displayName = googleUser.name || googleUser.email;
        await db.query('UPDATE tbl_users SET display_name = ? WHERE ID = ?', [displayName, userId]);
        user.display_name = displayName;
      }
    }

    if (!user) {
      user = await getAuthUserById(userId);
    }

    if (!user) {
      throw new Error('Google account could not be loaded.');
    }

    await setUserMetaEntries(userId, [
      { metaKey: 'auth_provider', metaValue: 'google' },
      { metaKey: 'google_sub', metaValue: googleUser.sub },
      { metaKey: 'google_email', metaValue: googleUser.email },
      { metaKey: 'google_name', metaValue: googleUser.name },
      { metaKey: 'google_picture', metaValue: googleUser.picture },
      ...(googleUser.givenName ? [{ metaKey: 'first_name', metaValue: googleUser.givenName }] : []),
      ...(googleUser.familyName ? [{ metaKey: 'last_name', metaValue: googleUser.familyName }] : []),
      ...(googleUser.hd ? [{ metaKey: 'google_hd', metaValue: googleUser.hd }] : []),
    ]);

    const oldSessionId = req.sessionId;
    const guestCookieId = req.guestId || null;
    await req.rotateSession();

    await mergeGuestCart(userId, oldSessionId, guestCookieId);
    setSessionUser(req, user);

    return res.json({
      success: true,
      message: 'Google login successful.',
      data: {
        user: {
          id: user.ID,
          username: user.user_login,
          email: googleUser.email,
          displayName: user.display_name || googleUser.name,
          firstName: googleUser.givenName,
          lastName: googleUser.familyName,
          role: user.user_type_slug || roleSlugFromType(user.user_type),
          userType: user.user_type,
        },
      },
    });
  } catch (err) {
    console.error('googleLogin error:', err);
    return res.status(401).json({
      success: false,
      message: err instanceof Error ? err.message : 'Google sign-in failed.',
    });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await req.destroySession();
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  const user = req.sessionData && req.sessionData.user;
  if (!user) {
    return res.json({
      success: true,
      data: { isLoggedIn: false, role: 'guest', sessionId: req.sessionId }
    });
  }

  // Fetch first_name, last_name, and phone from tbl_usermeta.
  // Prefer 'phone' over 'billing_phone' — confirmed against production data
  // that real account phone numbers live under 'phone', while 'billing_phone'
  // is set only via checkout/guest-merge flows and is empty for most users.
  const [metaRows] = await db.query(
    `SELECT meta_key, meta_value FROM tbl_usermeta WHERE user_id = ? AND meta_key IN ('first_name','last_name','phone','billing_phone')`,
    [user.id]
  );
  const meta = {};
  metaRows.forEach(r => { meta[r.meta_key] = r.meta_value; });

  res.json({
    success: true,
    data: {
      isLoggedIn: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.name,
        firstName: meta['first_name'] || '',
        lastName: meta['last_name'] || '',
        phone: meta['phone'] || meta['billing_phone'] || '',
        role: user.userTypeSlug,
        userType: user.userType,
      }
    }
  });
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  const sessionUser = req.sessionData && req.sessionData.user;
  if (!sessionUser) {
    return res.status(401).json({ success: false, message: 'Not logged in.' });
  }

  const { displayName, email, firstName, lastName, currentPassword, newPassword } = req.body;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ success: false, message: 'Display name is required.' });
  }
  if (!email || !VALID_EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'A valid email is required.' });
  }

  try {
    const [[user]] = await db.query(
      'SELECT ID, user_pass, user_email FROM tbl_users WHERE ID = ? LIMIT 1',
      [sessionUser.id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Check email uniqueness if changed
    if (email.trim().toLowerCase() !== user.user_email.toLowerCase()) {
      const [[taken]] = await db.query(
        'SELECT ID FROM tbl_users WHERE user_email = ? AND ID != ? LIMIT 1',
        [email.trim(), user.ID]
      );
      if (taken) return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    // Password reset
    let newHash = null;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
      }
      const { ok } = await verifyPassword(currentPassword, user.user_pass);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
      const passwordLengthError = validateBcryptPasswordLength(newPassword);
      if (passwordLengthError) {
        return res.status(400).json({ success: false, message: passwordLengthError });
      }
      newHash = await bcrypt.hash(newPassword, 12);
    }

    const updates = [
      'display_name = ?',
      'user_email = ?',
    ];
    const values = [displayName.trim(), email.trim()];

    if (newHash) {
      updates.push('user_pass = ?');
      values.push(newHash);
    }

    values.push(user.ID);
    await db.query(`UPDATE tbl_users SET ${updates.join(', ')} WHERE ID = ?`, values);

    // Save first/last name to tbl_usermeta
    if (firstName !== undefined || lastName !== undefined) {
      const upsertMeta = async (key, value) => {
        await db.query(
          `INSERT INTO tbl_usermeta (user_id, meta_key, meta_value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
          [user.ID, key, String(value ?? '')]
        );
      };
      if (firstName !== undefined) await upsertMeta('first_name', firstName.trim());
      if (lastName  !== undefined) await upsertMeta('last_name',  lastName.trim());
    }

    // Update session
    req.sessionData.user.name  = displayName.trim();
    req.sessionData.user.email = email.trim();
    req.touchSession();

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        id: user.ID,
        username: sessionUser.username,
        email: email.trim(),
        displayName: displayName.trim(),
        role: sessionUser.userTypeSlug,
        userType: sessionUser.userType,
      },
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/forgot-password
const requestPasswordReset = async (req, res) => {
  const identifier = String((req.body && req.body.identifier) || '').trim();
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Username or email is required.' });
  }

  try {
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Guest rows (user_type=4) have no password — direct to register instead.
    if (user.user_type === 4) {
      return res.status(400).json({ success: false, message: 'No account exists for this email. Please register to create an account and view your order history.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = String(Date.now() + RESET_TOKEN_TTL_MS);

    await setUserMetaEntries(user.ID, [
      { metaKey: RESET_TOKEN_HASH_META, metaValue: tokenHash },
      { metaKey: RESET_TOKEN_EXPIRES_META, metaValue: expiresAt },
    ]);

    let resetBaseUrl;
    try {
      resetBaseUrl = getResetCheckoutBaseUrl();
    } catch (urlErr) {
      console.error('requestPasswordReset frontend URL error:', urlErr);
      return res.status(500).json({
        success: false,
        message: 'Password reset is not configured correctly. Set RESET_URL to your public checkout URL.',
      });
    }
    const resetUrl = `${resetBaseUrl}?login=1&reset=${encodeURIComponent(rawToken)}`;
    const displayName = user.display_name || user.user_login || 'there';
    const emailHtml = `
      <div style="margin:0; padding:0; background:#f5efe8;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5efe8; padding:32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eadfce;">
                <tr>
                  <td style="background:#22311d; color:#ffffff; padding:24px 28px; font-family: Arial, sans-serif; font-size:22px; font-weight:700; letter-spacing:1px;">
                    NESTCASE
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px; font-family: Arial, sans-serif; color:#1b1b1b;">
                    <h2 style="margin:0 0 12px; font-size:24px; color:#22311d;">Reset your password</h2>
                    <p style="margin:0 0 14px; color:#343434; font-size:15px; line-height:1.7;">Hi ${escapeHtml(displayName)},</p>
                    <p style="margin:0 0 18px; color:#343434; font-size:15px; line-height:1.7;">
                      We received a request to reset your password. Click the button below to open the password reset page and choose a new password.
                      This link will expire in 1 hour.
                    </p>
                    <p style="margin:0 0 24px;">
                      <a href="${resetUrl}" style="display:inline-block; background:#22311d; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:8px; font-size:14px; font-weight:700; letter-spacing:0.04em;">
                        Reset password
                      </a>
                    </p>
                    <p style="margin:0; color:#6f6459; font-size:13px; line-height:1.7;">
                      If you did not request this reset, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const sent = await sendBrevoEmail({
      toEmail: user.user_email,
      toName: displayName,
      subject: 'Reset your Nestcase password',
      html: emailHtml,
    });

    if (!sent) {
      await clearPasswordResetToken(user.ID);
      return res.status(500).json({
        success: false,
        message: 'Unable to send the reset email right now. Please try again later.',
      });
    }

    return res.json({
      success: true,
      message: 'A password reset link has been sent to the registered email address.',
    });
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const token = String((req.body && req.body.token) || '').trim();
  const password = String((req.body && req.body.password) || '');
  const confirmPassword = String((req.body && req.body.confirmPassword) || '');

  if (!token || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token, password and confirm password are required.',
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  try {
    const tokenHash = sha256(token);
    const [[record]] = await db.query(
      `SELECT u.ID, u.display_name, u.user_email,
              hash_meta.meta_value AS token_hash,
              expires_meta.meta_value AS token_expires
       FROM tbl_users u
       INNER JOIN tbl_usermeta hash_meta
         ON hash_meta.user_id = u.ID AND hash_meta.meta_key = ?
       INNER JOIN tbl_usermeta expires_meta
         ON expires_meta.user_id = u.ID AND expires_meta.meta_key = ?
       WHERE hash_meta.meta_value = ?
       LIMIT 1`,
      [RESET_TOKEN_HASH_META, RESET_TOKEN_EXPIRES_META, tokenHash],
    );

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired.',
      });
    }

    const expiresAt = Number(record.token_expires || 0);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await clearPasswordResetToken(record.ID);
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired.',
      });
    }

    const passwordLengthError = validateBcryptPasswordLength(password);
    if (passwordLengthError) {
      return res.status(400).json({ success: false, message: passwordLengthError });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE tbl_users SET user_pass = ?, user_type = CASE WHEN user_type = 4 THEN 3 ELSE user_type END WHERE ID = ?', [hashedPassword, record.ID]);
      await clearPasswordResetTokenInConn(conn, record.ID);
      await conn.commit();
    } catch (txErr) {
      try {
        await conn.rollback();
      } catch {}
      throw txErr;
    } finally {
      conn.release();
    }

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── MSG91 OTP ─────────────────────────────────────────────────────────
const axios = require('axios');

const MSG91_BASE_URL = 'https://control.msg91.com/api/v5';

function getMsg91AuthKey() {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key) throw new Error('MSG91_AUTH_KEY is not configured.');
  return key;
}

function getMsg91TemplateId() {
  const id = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!id) throw new Error('MSG91_OTP_TEMPLATE_ID is not configured.');
  return id;
}

// Normalise a 10-digit Indian mobile number to MSG91's expected format (91XXXXXXXXXX, no '+')
function toMsg91India(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return null;
}

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  const raw = String((req.body && req.body.phone) || '').trim();
  const to = toMsg91India(raw);

  if (!to) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
  }

  try {
    const { data } = await axios.request({
      method: 'POST',
      url: `${MSG91_BASE_URL}/otp`,
      params: {
        template_id: getMsg91TemplateId(),
        mobile: to,
        authkey: getMsg91AuthKey(),
      },
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    if (data && data.type !== 'success') {
      console.error('sendOtp MSG91 error:', data);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    }

    return res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    console.error('sendOtp error:', err?.response?.data || err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  const raw = String((req.body && req.body.phone) || '').trim();
  const code = String((req.body && req.body.otp) || '').trim();
  const to = toMsg91India(raw);

  if (!to) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
  }
  if (!code || code.length < 4) {
    return res.status(400).json({ success: false, message: 'Please enter a valid OTP.' });
  }

  try {
    const { data: check } = await axios.request({
      method: 'GET',
      url: `${MSG91_BASE_URL}/otp/verify`,
      params: { otp: code, mobile: to },
      headers: { authkey: getMsg91AuthKey() },
    });

    if (!check || check.type !== 'success') {
      return res.status(401).json({ success: false, message: 'Incorrect or expired OTP. Please try again.' });
    }

    // Find user by phone (meta key 'phone' or 'billing_phone')
    const digits = raw.replace(/\D/g, '').slice(-10); // last 10 digits
    const [metaRows] = await db.query(
      `SELECT user_id FROM tbl_usermeta
       WHERE meta_key IN ('phone', 'billing_phone')
         AND REPLACE(meta_value, ' ', '') LIKE ?
       LIMIT 1`,
      [`%${digits}`]
    );

    let user = null;

    if (metaRows.length > 0) {
      const [[found]] = await db.query(
        `SELECT u.ID, u.user_login, u.user_email, u.display_name, u.user_type,
                ut.user_type_slug
         FROM tbl_users u
         LEFT JOIN tbl_user_types ut ON ut.user_type_id = u.user_type
         WHERE u.ID = ? LIMIT 1`,
        [metaRows[0].user_id]
      );
      user = found || null;
    }

    if (!user) {
      // Auto-create a customer account for this phone number
      const username = `user_${digits}`;
      const displayName = `User ${digits.slice(-4)}`;
      const [result] = await db.query(
        `INSERT INTO tbl_users
         (user_type, user_login, user_email, user_pass, user_nicename, display_name, user_registered)
         VALUES (3, ?, '', '', ?, ?, NOW())`,
        [username, username, displayName]
      );
      const newUserId = result.insertId;

      // Store phone in usermeta
      await db.query(
        `INSERT INTO tbl_usermeta (user_id, meta_key, meta_value) VALUES (?, 'phone', ?)
         ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
        [newUserId, raw]
      );

      user = {
        ID: newUserId,
        user_login: username,
        user_email: '',
        display_name: displayName,
        user_type: 3,
        user_type_slug: 'customers',
      };
    }

    const oldSessionId = req.sessionId;
    const guestCookieId = req.guestId || null;
    await req.rotateSession();
    await mergeGuestCart(user.ID, oldSessionId, guestCookieId);
    setSessionUser(req, user);

    return res.json({
      success: true,
      message: 'OTP verified. Login successful.',
      data: {
        user: {
          id: user.ID,
          username: user.user_login,
          email: user.user_email,
          displayName: user.display_name,
          phone: raw,
          role: user.user_type_slug || roleSlugFromType(user.user_type),
          userType: user.user_type,
        },
      },
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ success: false, message: 'OTP verification failed. Please try again.' });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  logout,
  me,
  updateProfile,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
};