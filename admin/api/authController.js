const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { mergeGuestCart } = require('./cartController');

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
      data: {
        isLoggedIn: false,
        role: 'guest',
        sessionId: req.sessionId,
      }
    });
  }

  res.json({
    success: true,
    data: {
      isLoggedIn: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.name,
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

module.exports = { register, login, logout, me, updateProfile };
