const crypto = require('crypto');
const db = require('../config/db');
const { getSessionUser } = require('./session');

const toStr = (val) => {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s ? s : null;
};

const toInt = (val, fallback = null) => {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

function buildCartSessionId(userId, sessionId) {
  return userId ? `user_${userId}` : sessionId;
}

function syntheticVariationId(productId, color, size) {
  const raw = `${productId || ''}:${color || ''}:${size || ''}`;
  const hex = crypto.createHash('md5').update(raw).digest('hex').slice(0, 8);
  const value = Number.parseInt(hex, 16);
  return -Math.abs(value);
}

function resolveVariationId(inputVarId, productId, color, size) {
  const parsed = toInt(inputVarId, null);
  if (parsed) return parsed;
  if (color || size) return syntheticVariationId(productId, color, size);
  return null;
}

function getCartIdentity(req) {
  const user = getSessionUser(req);
  const userId = user ? user.id : null;
  const sessionId = req.sessionId;
  const cookieId = req.guestId || null;

  if (userId) {
    return { key: 'user_id', value: userId, userId, sessionId, cookieId };
  }
  if (cookieId) {
    return { key: 'cookie_id', value: cookieId, userId: null, sessionId, cookieId };
  }
  return { key: 'session_id', value: sessionId, userId: null, sessionId, cookieId: null };
}

const getCart = async (req, res) => {
  const { key, value, userId, cookieId } = getCartIdentity(req);
  try {
    let items;
    if (userId) {
      [items] = await db.query(
        'SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
    } else if (key === 'cookie_id') {
      [items] = await db.query(
        'SELECT * FROM cart_items WHERE cookie_id = ? AND user_id IS NULL ORDER BY created_at DESC',
        [value]
      );
    } else {
      [items] = await db.query(
        'SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC',
        [value]
      );
    }
    const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    res.json({ success: true, data: { items, count, total } });
  } catch (err) {
    console.error('getCart error:', err);
    res.status(500).json({ success: false, message: 'Failed to load cart.' });
  }
};

const addToCart = async (req, res) => {
  const { key, value, userId, sessionId, cookieId } = getCartIdentity(req);
  const body = req.body || {};
  const productId = toInt(body.product_id);
  if (!productId) {
    return res.status(400).json({ success: false, message: 'product_id is required.' });
  }
  const color = toStr(body.color);
  const size = toStr(body.size);
  const variationId = resolveVariationId(body.variation_id, productId, color, size);
  const quantity = Math.max(toInt(body.quantity, 1), 1);
  const title = toStr(body.title);
  const price = Number.parseFloat(body.price ?? 0) || 0;
  const image = toStr(body.image);

  try {
    let existing;
    if (key === 'user_id') {
      [existing] = await db.query(
        `SELECT id, quantity
         FROM cart_items
         WHERE user_id = ?
           AND product_id = ?
           AND (variation_id <=> ?)
           AND (color <=> ?)
           AND (size <=> ?)
         LIMIT 1`,
        [value, productId, variationId, color, size]
      );
    } else if (key === 'cookie_id') {
      [existing] = await db.query(
        `SELECT id, quantity
         FROM cart_items
         WHERE cookie_id = ?
           AND user_id IS NULL
           AND product_id = ?
           AND (variation_id <=> ?)
           AND (color <=> ?)
           AND (size <=> ?)
         LIMIT 1`,
        [value, productId, variationId, color, size]
      );
    } else {
      [existing] = await db.query(
        `SELECT id, quantity
         FROM cart_items
         WHERE session_id = ?
           AND user_id IS NULL
           AND product_id = ?
           AND (variation_id <=> ?)
           AND (color <=> ?)
           AND (size <=> ?)
         LIMIT 1`,
        [value, productId, variationId, color, size]
      );
    }

    if (existing.length) {
      await db.query(
        'UPDATE cart_items SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?',
        [quantity, existing[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO cart_items
         (session_id, cookie_id, user_id, product_id, variation_id, quantity, color, size, title, price, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, cookieId, userId, productId, variationId, quantity, color, size, title, price, image]
      );
    }

    res.json({ success: true, message: 'Added to cart.' });
  } catch (err) {
    console.error('addToCart error:', err);
    res.status(500).json({ success: false, message: 'Failed to add to cart.' });
  }
};

const updateCartItem = async (req, res) => {
  const { key, value, userId } = getCartIdentity(req);
  const itemId = toInt(req.params.itemId);
  const body = req.body || {};
  const quantity = toInt(body.quantity, null);
  if (!itemId || !quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: 'Valid quantity is required.' });
  }

  try {
    let result;
    if (userId) {
      [result] = await db.query(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [quantity, itemId, userId]
      );
    } else if (key === 'cookie_id') {
      [result] = await db.query(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ? AND cookie_id = ? AND user_id IS NULL',
        [quantity, itemId, value]
      );
    } else {
      [result] = await db.query(
        'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ? AND session_id = ? AND user_id IS NULL',
        [quantity, itemId, value]
      );
    }
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }
    res.json({ success: true, message: 'Cart updated.' });
  } catch (err) {
    console.error('updateCartItem error:', err);
    res.status(500).json({ success: false, message: 'Failed to update cart.' });
  }
};

const removeCartItem = async (req, res) => {
  const { key, value, userId } = getCartIdentity(req);
  const itemId = toInt(req.params.itemId);
  if (!itemId) {
    return res.status(400).json({ success: false, message: 'Invalid item id.' });
  }
  try {
    let result;
    if (userId) {
      [result] = await db.query(
        'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
        [itemId, userId]
      );
    } else if (key === 'cookie_id') {
      [result] = await db.query(
        'DELETE FROM cart_items WHERE id = ? AND cookie_id = ? AND user_id IS NULL',
        [itemId, value]
      );
    } else {
      [result] = await db.query(
        'DELETE FROM cart_items WHERE id = ? AND session_id = ? AND user_id IS NULL',
        [itemId, value]
      );
    }
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }
    res.json({ success: true, message: 'Removed from cart.' });
  } catch (err) {
    console.error('removeCartItem error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove cart item.' });
  }
};

const clearCart = async (req, res) => {
  const { key, value, userId } = getCartIdentity(req);
  try {
    if (userId) {
      await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    } else if (key === 'cookie_id') {
      await db.query('DELETE FROM cart_items WHERE cookie_id = ? AND user_id IS NULL', [value]);
    } else {
      await db.query('DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL', [value]);
    }
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) {
    console.error('clearCart error:', err);
    res.status(500).json({ success: false, message: 'Failed to clear cart.' });
  }
};

async function mergeGuestCart(userId, guestSessionId, guestCookieId) {
  if (!userId) return;

  let guestItems = [];

  if (guestCookieId) {
    [guestItems] = await db.query(
      'SELECT * FROM cart_items WHERE cookie_id = ? AND user_id IS NULL',
      [guestCookieId]
    );
  }

  if (!guestItems.length && guestSessionId) {
    [guestItems] = await db.query(
      'SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL',
      [guestSessionId]
    );
  }

  if (!guestItems.length) return;

  for (const item of guestItems) {
    const color = toStr(item.color);
    const size = toStr(item.size);
    const variationId = resolveVariationId(item.variation_id, item.product_id, color, size);

    const [existing] = await db.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE user_id = ?
         AND product_id = ?
         AND (variation_id <=> ?)
         AND (color <=> ?)
         AND (size <=> ?)
       LIMIT 1`,
      [userId, item.product_id, variationId, color, size]
    );

    if (existing.length) {
      await db.query(
        'UPDATE cart_items SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?',
        [item.quantity, existing[0].id]
      );
      await db.query('DELETE FROM cart_items WHERE id = ?', [item.id]);
    } else {
      await db.query(
        `UPDATE cart_items
         SET user_id = ?, variation_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [userId, variationId, item.id]
      );
    }
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  mergeGuestCart,
  getCartIdentity,
  buildCartSessionId,
};

