const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a comma-separated varchar list (include_products, exclude_products,
 * include_categories, exclude_categories) into an array of integers.
 */
function parseIdList(str) {
  if (!str) return [];
  return String(str)
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Core coupon validation — checks every rule in tbl_coupons against the
 * current context. Called at both apply-time and order-placement time.
 *
 * When called inside a DB transaction pass the transaction `conn`;
 * at apply-time it is fine to pass the pool (`db`).
 *
 * The FOR UPDATE lock on tbl_coupons_usage is only effective inside a
 * transaction — when called at apply-time it still runs the COUNT check
 * (no lock) which is fine for UX feedback; the hard lock happens at
 * order-placement time.
 */
async function validateCouponRules(coupon, userId, cartTotal, productIds, conn) {
  const query = conn.query.bind(conn);

  // ── 1. usage_limit_per_coupon ─────────────────────────────────────────────
  if (coupon.usage_limit_per_coupon > 0) {
    const [[usageRow]] = await query(
      `SELECT COUNT(*) AS total_used
       FROM tbl_coupons_usage
       WHERE coupon_id = ? AND order_id > 0
       FOR UPDATE`,
      [coupon.coupon_id]
    );
    if (usageRow.total_used >= coupon.usage_limit_per_coupon) {
      return { ok: false, status: 400, message: 'This coupon has reached its usage limit.' };
    }
  }

  // ── 2. usage_limit_per_user ───────────────────────────────────────────────
  if (coupon.usage_limit_per_user > 0 && userId > 0) {
    const [[userUsage]] = await query(
      `SELECT COUNT(*) AS user_used
       FROM tbl_coupons_usage
       WHERE coupon_id = ? AND user_id = ? AND order_id > 0`,
      [coupon.coupon_id, userId]
    );
    if (userUsage.user_used >= coupon.usage_limit_per_user) {
      return { ok: false, status: 400, message: 'You have already used this coupon the maximum number of times.' };
    }
  }

  // ── 3. minimum_spend ──────────────────────────────────────────────────────
  const minSpend = Number(coupon.minimum_spend) || 0;
  if (minSpend > 0 && cartTotal < minSpend) {
    return {
      ok: false,
      status: 400,
      message: `A minimum cart total of \u20B9${minSpend.toFixed(2)} is required to use this coupon.`,
    };
  }

  // ── 4. maximum_spend ──────────────────────────────────────────────────────
  const maxSpend = Number(coupon.maximum_spend) || 0;
  if (maxSpend > 0 && cartTotal > maxSpend) {
    return {
      ok: false,
      status: 400,
      message: `This coupon is only valid for cart totals up to \u20B9${maxSpend.toFixed(2)}.`,
    };
  }

  // ── 5. include_products ───────────────────────────────────────────────────
  const includeProducts = parseIdList(coupon.include_products);
  if (includeProducts.length > 0 && productIds.length > 0) {
    const hasMatch = productIds.some((pid) => includeProducts.includes(pid));
    if (!hasMatch) {
      return {
        ok: false,
        status: 400,
        message: 'This coupon is not valid for the products in your cart.',
      };
    }
  }

  // ── 6. exclude_products ───────────────────────────────────────────────────
  const excludeProducts = parseIdList(coupon.exclude_products);
  if (excludeProducts.length > 0 && productIds.length > 0) {
    const hasExcluded = productIds.some((pid) => excludeProducts.includes(pid));
    if (hasExcluded) {
      return {
        ok: false,
        status: 400,
        message: 'Your cart contains products that are excluded from this coupon.',
      };
    }
  }

  return { ok: true };
}

/**
 * Compute the discount rupee amount for a coupon.
 */
function calculateDiscount(coupon, cartTotal) {
  const amount = Number(coupon.coupon_amount) || 0;
  if (coupon.coupon_type === 'percent') {
    return Math.round((cartTotal * amount) / 100);
  }
  if (coupon.coupon_type === 'fixed_cart') {
    return Math.min(amount, cartTotal);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /store/api/coupon/active
// ─────────────────────────────────────────────────────────────────────────────
const active = (req, res) => {
  const c = req.session?.appliedCoupon;
  if (!c) return res.json({ success: true, coupon: null });
  return res.json({
    success: true,
    coupon: {
      code:   c.coupon_code,
      type:   c.coupon_type,
      amount: c.coupon_amount,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /store/api/coupon/apply
// ─────────────────────────────────────────────────────────────────────────────
const apply = async (req, res) => {
  const rawCode = String(req.body.coupon_code || '').trim();
  if (!rawCode) {
    return res.status(400).json({ success: false, message: 'Coupon code is required.' });
  }

  try {
    const [[coupon]] = await db.query(
      `SELECT *
       FROM tbl_coupons
       WHERE LOWER(coupon_code) = LOWER(?)
         AND coupon_status = 'publish'
       LIMIT 1`,
      [rawCode]
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code.' });
    }

    // Check expiry separately for a specific message
    if (coupon.coupon_expiry_date && new Date(coupon.coupon_expiry_date) < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon has expired.' });
    }

    const userId = req.sessionData?.user?.id || 0;

    // Read cart for spend + product checks
    let cartItems = [];
    try {
      const { getCartIdentity } = require('./cartController');
      const { key, value } = getCartIdentity(req);
      let rows = [];
      if (userId) {
        [rows] = await db.query(
          'SELECT product_id, price, quantity FROM cart_items WHERE user_id = ?',
          [userId]
        );
      } else if (key === 'cookie_id' && value) {
        [rows] = await db.query(
          'SELECT product_id, price, quantity FROM cart_items WHERE cookie_id = ? AND user_id IS NULL',
          [value]
        );
      } else if (value) {
        [rows] = await db.query(
          'SELECT product_id, price, quantity FROM cart_items WHERE session_id = ? AND user_id IS NULL',
          [value]
        );
      }
      cartItems = rows || [];
    } catch (_) { /* cart unreadable — spend/product checks deferred to order placement */ }

    const cartTotal  = cartItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
    const productIds = cartItems.map((i) => Number(i.product_id)).filter(Boolean);

    const result = await validateCouponRules(coupon, userId, cartTotal, productIds, db);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const discount = calculateDiscount(coupon, cartTotal);

    req.session.appliedCoupon = {
      coupon_id:     coupon.coupon_id,
      coupon_code:   coupon.coupon_code,
      coupon_type:   coupon.coupon_type,
      coupon_amount: Number(coupon.coupon_amount),
    };

    return res.json({
      success: true,
      message: 'Coupon applied successfully!',
      data: {
        code:     coupon.coupon_code,
        type:     coupon.coupon_type,
        amount:   Number(coupon.coupon_amount),
        discount,
      },
    });
  } catch (err) {
    console.error('coupon/apply error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /store/api/coupon/remove
// ─────────────────────────────────────────────────────────────────────────────
const remove = (req, res) => {
  delete req.session.appliedCoupon;
  return res.json({ success: true, message: 'Coupon removed.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// validateAndLockCoupon  (used inside a DB transaction in orderController.js)
//
// Re-validates all rules with FOR UPDATE locking to prevent race conditions.
// Must be called BEFORE inserting the order row, inside the same transaction.
// ─────────────────────────────────────────────────────────────────────────────
async function validateAndLockCoupon(conn, sessionCoupon, userId, cartTotal, productIds) {
  if (!sessionCoupon) return { ok: true, discount: 0 };

  const [[coupon]] = await conn.query(
    `SELECT *
     FROM tbl_coupons
     WHERE coupon_id = ?
       AND coupon_status = 'publish'
       AND (coupon_expiry_date IS NULL OR coupon_expiry_date >= NOW())
     LIMIT 1`,
    [sessionCoupon.coupon_id]
  );

  if (!coupon) {
    return { ok: false, status: 400, message: 'The applied coupon is no longer valid.' };
  }

  const result = await validateCouponRules(coupon, userId, cartTotal, productIds, conn);
  if (!result.ok) return result;

  const discount = calculateDiscount(coupon, cartTotal);
  return { ok: true, discount, coupon };
}

/**
 * Record coupon usage — MUST be called inside the same DB transaction
 * as the order insert.
 */
async function recordCouponUsage(conn, sessionCoupon, orderId, userId) {
  await conn.query(
    `INSERT INTO tbl_coupons_usage (coupon_id, coupon_code, order_id, user_id)
     VALUES (?, ?, ?, ?)`,
    [sessionCoupon.coupon_id, sessionCoupon.coupon_code, orderId, userId || 0]
  );
  await conn.query(
    `UPDATE tbl_coupons SET coupon_count = coupon_count + 1 WHERE coupon_id = ?`,
    [sessionCoupon.coupon_id]
  );
}

module.exports = {
  apply,
  remove,
  active,
  validateAndLockCoupon,
  recordCouponUsage,
  calculateDiscount,
};
