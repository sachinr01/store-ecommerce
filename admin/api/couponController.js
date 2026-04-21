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
 * Shared cart-reading helper. Resolves the correct cart rows for both
 * logged-in users (by user_id) and guests (by cookie_id or session_id).
 *
 * Accepts the pool or a transaction connection so it can be reused in both
 * apply/active (pool) and validateAndLockCoupon (transaction conn).
 */
async function readCartItems(req, conn) {
  const { getCartIdentity } = require('./cartController');
  const userId = req.sessionData?.user?.id || 0;
  const { key, value } = getCartIdentity(req);

  let rows = [];
  if (userId) {
    [rows] = await conn.query(
      'SELECT product_id, price, quantity FROM cart_items WHERE user_id = ?',
      [userId]
    );
  } else if (key === 'cookie_id' && value) {
    [rows] = await conn.query(
      'SELECT product_id, price, quantity FROM cart_items WHERE cookie_id = ? AND user_id IS NULL',
      [value]
    );
  } else if (value) {
    [rows] = await conn.query(
      'SELECT product_id, price, quantity FROM cart_items WHERE session_id = ? AND user_id IS NULL',
      [value]
    );
  }
  return rows || [];
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
 * order-placement time via validateAndLockCoupon().
 */
async function validateCouponRules(coupon, userId, cartTotal, productIds, conn, cartItems) {
  // Guard: never allow a coupon to be applied to an empty cart
  if (!productIds || productIds.length === 0) {
    return { ok: false, status: 400, message: 'Your cart is empty.' };
  }

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
       WHERE coupon_id = ? AND user_id = ? AND order_id > 0
       FOR UPDATE`,
      [coupon.coupon_id, userId]
    );
    if (userUsage.user_used >= coupon.usage_limit_per_user) {
      return { ok: false, status: 400, message: 'You have already used this coupon the maximum number of times.' };
    }
  }

  // ── 3 & 4. minimum_spend / maximum_spend ─────────────────────────────────
  // NOTE: Intentionally checked AFTER eligibleSubtotal is computed below.
  // Checking against cartTotal here would allow a user to game the threshold
  // with ineligible items (e.g. add a ₹95 ineligible item to meet a ₹100
  // minimum on a category-restricted coupon).
  const minSpend          = Number(coupon.minimum_spend)  || 0;
  const maxSpend          = Number(coupon.maximum_spend)  || 0;
  const includeProducts   = parseIdList(coupon.include_products);
  const excludeProducts   = parseIdList(coupon.exclude_products);
  const includeCategories = parseIdList(coupon.include_categories);
  const excludeCategories = parseIdList(coupon.exclude_categories);

  // Fetch category links once for all cart products (used in eligibility block)
  let productCatMap = {}; // product_id → [category_id, ...]
  if (productIds.length > 0 && (includeCategories.length > 0 || excludeCategories.length > 0)) {
    const ph = productIds.map(() => '?').join(',');
    const [catLinks] = await query(
      `SELECT product_id, category_id FROM tbl_products_category_link WHERE product_id IN (${ph})`,
      productIds
    );
    for (const row of catLinks) {
      if (!productCatMap[row.product_id]) productCatMap[row.product_id] = [];
      productCatMap[row.product_id].push(row.category_id);
    }
  }

  // ── 5. include_products — gate check ─────────────────────────────────────
  // If include_products is set, at least one cart product must be in that list,
  // otherwise the coupon has no eligible products at all.
  // (The actual per-product filtering happens in the eligibility block below.)
  if (includeProducts.length > 0) {
    const hasMatch = productIds.some((pid) => includeProducts.includes(pid));
    if (!hasMatch) {
      return {
        ok: false,
        status: 400,
        message: 'This coupon is not valid for the products in your cart.',
      };
    }
  }

  // ── 6–8. Unified per-product eligibility ─────────────────────────────────
  //
  // Both product-level and category-level exclusions are treated as FILTERS,
  // not poison pills. A product is simply skipped from the discount base;
  // it does NOT block the coupon for other eligible products in the cart.
  //
  // Priority order per product:
  //   (a) In include_products                              → ALWAYS eligible
  //   (b) In exclude_products                              → NOT eligible (skipped)
  //   (c) Category in exclude_categories                   → NOT eligible (skipped)
  //   (d) include_categories set, category not in list     → NOT eligible (skipped)
  //   (e) No restrictions apply                            → ELIGIBLE
  //
  // The coupon is only blocked entirely when ZERO products pass eligibility.
  // Otherwise, the discount is calculated on the eligible subtotal only.
  //
  // IMPORTANT: cartItems is REQUIRED whenever any eligibility rule is active.
  // We never guess eligible subtotal via proportional math — that would give
  // wrong discounts when item prices differ (e.g. a ₹5000 mug + ₹200 coaster).

  const hasAnyProductRule =
    includeProducts.length   > 0 ||
    excludeProducts.length   > 0 ||
    includeCategories.length > 0 ||
    excludeCategories.length > 0;

  let eligibleSubtotal = cartTotal; // default: full cart eligible when no rules set

  if (hasAnyProductRule) {
    // cartItems is required for accurate subtotal calculation
    if (!cartItems || cartItems.length === 0) {
      return {
        ok: false,
        status: 400,
        message: 'Unable to verify coupon eligibility. Please refresh and try again.',
      };
    }

    const eligibleProductIds = productIds.filter((pid) => {
      // (a) Explicitly included product → always eligible, skip all other checks
      if (includeProducts.length > 0 && includeProducts.includes(pid)) return true;

      // (b) Explicitly excluded product → not eligible
      if (excludeProducts.length > 0 && excludeProducts.includes(pid)) return false;

      const cats = productCatMap[pid] || [];

      // (c) Product's category is excluded → not eligible
      if (excludeCategories.length > 0 && cats.some((cid) => excludeCategories.includes(cid))) {
        return false;
      }

      // (d) include_categories is set → product must belong to one of them
      if (includeCategories.length > 0) {
        return cats.some((cid) => includeCategories.includes(cid));
      }

      // (e) No restrictions → eligible
      return true;
    });

    if (eligibleProductIds.length === 0) {
      return {
        ok: false,
        status: 400,
        message: 'This coupon is not valid for the products in your cart.',
      };
    }

    // Compute eligible subtotal using actual item prices — never approximate
    eligibleSubtotal = cartItems
      .filter((item) => eligibleProductIds.includes(Number(item.product_id)))
      .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  }

  // ── 3 & 4. minimum_spend / maximum_spend — checked against eligibleSubtotal
  // Both thresholds are evaluated against the eligible subtotal only, so
  // ineligible items in the cart cannot be used to satisfy the minimum.
  if (minSpend > 0 && eligibleSubtotal < minSpend) {
    return {
      ok: false,
      status: 400,
      message: `A minimum eligible spend of ₹${minSpend.toFixed(2)} is required to use this coupon.`,
    };
  }
  if (maxSpend > 0 && eligibleSubtotal > maxSpend) {
    return {
      ok: false,
      status: 400,
      message: `This coupon is only valid for eligible spend up to ₹${maxSpend.toFixed(2)}.`,
    };
  }

  return { ok: true, eligibleSubtotal };
}

/**
 * Compute the discount rupee amount for a coupon.
 *
 * Discount is computed on the eligible subtotal (category/product-filtered
 * items only). Falls back to full cartTotal when no filter is in effect.
 */
function calculateDiscount(coupon, cartTotal, eligibleSubtotal) {
  const base   = (eligibleSubtotal !== undefined && eligibleSubtotal !== null)
    ? eligibleSubtotal
    : cartTotal;
  const amount = Number(coupon.coupon_amount) || 0;

  if (coupon.coupon_type === 'percent') {
    return Math.round((base * amount) / 100);
  }
  if (coupon.coupon_type === 'fixed_cart') {
    return Math.min(amount, base);
  }
  if (coupon.coupon_type === 'fixed_product') {
    // fixed_product: flat amount off each eligible product unit —
    // but never discount more than the eligible subtotal itself.
    return Math.min(amount, base);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared SQL fragment for coupon validity.
//
// Expiry is checked entirely in SQL to avoid JavaScript's Invalid Date bug
// with MySQL's '0000-00-00 00:00:00' sentinel value (which new Date() would
// parse as Invalid Date, causing JS comparisons to silently pass and letting
// expired coupons through).
//
// Column is NOT NULL in our schema so the IS NULL guard is intentionally
// omitted; the zero-date sentinel handles "no expiry" rows.
// ─────────────────────────────────────────────────────────────────────────────
const COUPON_VALID_SQL = `
  coupon_status = 'publish'
  AND (coupon_expiry_date = '0000-00-00 00:00:00' OR coupon_expiry_date >= NOW())
`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /store/api/coupon/active
// ─────────────────────────────────────────────────────────────────────────────
const active = async (req, res) => {
  const c = req.sessionData?.appliedCoupon;
  if (!c) return res.json({ success: true, coupon: null });

  try {
    // Re-fetch the coupon row so we can recompute eligibleSubtotal against
    // the current cart (cart may have changed since the coupon was applied).
    // Expiry is checked in SQL — avoids the Invalid Date JS bug.
    const [[coupon]] = await db.query(
      `SELECT * FROM tbl_coupons
       WHERE coupon_id = ? AND ${COUPON_VALID_SQL}
       LIMIT 1`,
      [c.coupon_id]
    );

    if (!coupon) {
      // Coupon expired or was deleted/unpublished — strip from session silently
      delete req.sessionData.appliedCoupon;
      req.touchSession();
      return res.json({ success: true, coupon: null });
    }

    let cartTotal        = 0;
    let eligibleSubtotal;
    let discount         = 0;

    try {
      const userId  = req.sessionData?.user?.id || 0;
      const cartItems = await readCartItems(req, db);

      cartTotal        = cartItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
      const productIds = cartItems.map((i) => Number(i.product_id)).filter(Boolean);

      // Pass real userId so per-user usage limits are correctly enforced
      // when a logged-in user reloads the checkout page.
      const result = await validateCouponRules(coupon, userId, cartTotal, productIds, db, cartItems);

      // Cart has changed and made the coupon invalid (e.g. items removed,
      // fell below minimum_spend) — strip immediately so the frontend clears
      // the discount.
      if (!result.ok) {
        delete req.sessionData.appliedCoupon;
        req.touchSession();
        return res.json({ success: true, coupon: null });
      }

      eligibleSubtotal = result.eligibleSubtotal;
      discount         = calculateDiscount(coupon, cartTotal, eligibleSubtotal);
    } catch (_) {
      // Cart unreadable due to a DB error — safest to strip the coupon and
      // return null rather than risk showing a wrong discount to the user.
      delete req.sessionData.appliedCoupon;
      req.touchSession();
      return res.json({ success: true, coupon: null });
    }

    return res.json({
      success: true,
      coupon: {
        code:     c.coupon_code,
        type:     c.coupon_type,
        amount:   c.coupon_amount,
        discount,
        ...(eligibleSubtotal !== undefined && { eligibleSubtotal }),
      },
    });
  } catch (err) {
    console.error('coupon/active error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
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
    // Expiry check is done entirely in SQL — avoids the Invalid Date JS bug
    // with '0000-00-00 00:00:00'. An expired coupon returns no row, giving
    // a single clean "Invalid or expired coupon code." message.
    const [[coupon]] = await db.query(
      `SELECT *
       FROM tbl_coupons
       WHERE LOWER(coupon_code) = LOWER(?)
         AND ${COUPON_VALID_SQL}
       LIMIT 1`,
      [rawCode]
    );

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    const userId = req.sessionData?.user?.id || 0;

    // Read cart for spend + product eligibility checks
    let cartItems = [];
    try {
      cartItems = await readCartItems(req, db);
    } catch (_) {
      // Cart unreadable — cartItems stays []. If this coupon has any product
      // or category rules, validateCouponRules will return a 400 ("Unable to
      // verify coupon eligibility") rather than guessing. This is intentional:
      // we never grant a discount when cart state is unknown.
    }

    const cartTotal  = cartItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
    const productIds = cartItems.map((i) => Number(i.product_id)).filter(Boolean);

    const result = await validateCouponRules(coupon, userId, cartTotal, productIds, db, cartItems);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const eligibleSubtotal = result.eligibleSubtotal !== undefined ? result.eligibleSubtotal : cartTotal;
    const discount         = calculateDiscount(coupon, cartTotal, eligibleSubtotal);

    req.sessionData.appliedCoupon = {
      coupon_id:     coupon.coupon_id,
      coupon_code:   coupon.coupon_code,
      coupon_type:   coupon.coupon_type,
      coupon_amount: Number(coupon.coupon_amount),
    };
    req.touchSession();

    return res.json({
      success: true,
      message: 'Coupon applied successfully!',
      data: {
        code:            coupon.coupon_code,
        type:            coupon.coupon_type,
        amount:          Number(coupon.coupon_amount),
        discount,
        eligibleSubtotal,
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
  delete req.sessionData.appliedCoupon;
  req.touchSession();
  return res.json({ success: true, message: 'Coupon removed.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// validateAndLockCoupon  (used inside a DB transaction in orderController.js)
//
// Re-validates all rules with FOR UPDATE locking to prevent race conditions.
// Must be called BEFORE inserting the order row, inside the same transaction.
// ─────────────────────────────────────────────────────────────────────────────
async function validateAndLockCoupon(conn, sessionCoupon, userId, cartTotal, productIds, cartItems) {
  if (!sessionCoupon) return { ok: true, discount: 0 };

  // FOR UPDATE on tbl_coupons prevents two concurrent orders from both
  // passing the usage-limit check against the same coupon row.
  // Expiry checked in SQL — same reason as apply/active endpoints.
  const [[coupon]] = await conn.query(
    `SELECT *
     FROM tbl_coupons
     WHERE coupon_id = ?
       AND ${COUPON_VALID_SQL}
     LIMIT 1
     FOR UPDATE`,
    [sessionCoupon.coupon_id]
  );

  if (!coupon) {
    return { ok: false, status: 400, message: 'The applied coupon is no longer valid.' };
  }

  const result = await validateCouponRules(coupon, userId, cartTotal, productIds, conn, cartItems);
  if (!result.ok) return result;

  const eligibleSubtotal = result.eligibleSubtotal !== undefined ? result.eligibleSubtotal : cartTotal;
  const discount         = calculateDiscount(coupon, cartTotal, eligibleSubtotal);
  return { ok: true, discount, coupon, eligibleSubtotal };
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