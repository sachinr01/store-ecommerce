const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { mergeGuestCart } = require('./cartController');

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

const isHex32 = (val) => /^[a-f0-9]{32}$/i.test(val || '');

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
    const ok = check === storedHash;
    return { ok, needsRehash: ok };
  }
  if (isHex32(storedHash)) {
    const ok = md5(password) === storedHash;
    return { ok, needsRehash: ok };
  }
  const ok = storedHash === password;
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

async function setUserMeta(userId, metaKey, metaValue) {
  await db.query('DELETE FROM tbl_usermeta WHERE user_id = ? AND meta_key = ?', [userId, metaKey]);
  await db.query(
    'INSERT INTO tbl_usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)',
    [userId, metaKey, String(metaValue ?? '')]
  );
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

// POST /store/api/auth/register
const register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Username, email and password are required.' });
  }

  try {
    const [[existing]] = await db.query(
      'SELECT ID FROM tbl_users WHERE user_login = ? OR user_email = ? LIMIT 1',
      [username, email]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const nicename = toSlug(username);

    const [result] = await db.query(
      `INSERT INTO tbl_users
       (user_type, user_login, user_email, user_pass, user_nicename, display_name, user_registered)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [3, username, email, hashed, nicename, username]
    );

    const newUserId = result.insertId;

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

// POST /store/api/auth/login
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

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.ID,
          username: user.user_login,
          email: user.user_email,
          displayName: user.display_name,
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

// POST /store/api/auth/google
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

      const [result] = await db.query(
        `INSERT INTO tbl_users
         (user_type, user_login, user_pass, user_nicename, user_email, user_url, user_registered, user_activation_key, user_status, display_name)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), '', 0, ?)`,
        [3, googleUser.email, randomPassword, nicename, googleUser.email, googleUser.picture || '', displayName]
      );

      userId = result.insertId;
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

    await setUserMeta(userId, 'auth_provider', 'google');
    await setUserMeta(userId, 'google_sub', googleUser.sub);
    await setUserMeta(userId, 'google_email', googleUser.email);
    await setUserMeta(userId, 'google_name', googleUser.name);
    await setUserMeta(userId, 'google_picture', googleUser.picture);
    if (googleUser.givenName) await setUserMeta(userId, 'first_name', googleUser.givenName);
    if (googleUser.familyName) await setUserMeta(userId, 'last_name', googleUser.familyName);
    if (googleUser.hd) await setUserMeta(userId, 'google_hd', googleUser.hd);

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

// POST /store/api/auth/logout
const logout = async (req, res) => {
  try {
    await req.destroySession();
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
};

// GET /store/api/auth/me
const me = async (req, res) => {
  const user = req.sessionData && req.sessionData.user;
  if (!user) {
    return res.json({
      success: true,
      data: { isLoggedIn: false, role: 'guest', sessionId: req.sessionId }
    });
  }

  // Fetch first_name and last_name from tbl_usermeta
  const [metaRows] = await db.query(
    `SELECT meta_key, meta_value FROM tbl_usermeta WHERE user_id = ? AND meta_key IN ('first_name','last_name')`,
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
        role: user.userTypeSlug,
        userType: user.userType,
      }
    }
  });
};

// PUT /store/api/auth/profile
const updateProfile = async (req, res) => {
  const sessionUser = req.sessionData && req.sessionData.user;
  if (!sessionUser) {
    return res.status(401).json({ success: false, message: 'Not logged in.' });
  }

  const { displayName, email, firstName, lastName, currentPassword, newPassword } = req.body;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ success: false, message: 'Display name is required.' });
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
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

    // Password change
    let newHash = null;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
      }
      const { ok } = await verifyPassword(currentPassword, user.user_pass);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
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

module.exports = { register, login, googleLogin, logout, me, updateProfile };
