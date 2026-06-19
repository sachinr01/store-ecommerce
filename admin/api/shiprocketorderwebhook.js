const crypto = require("crypto");
const db     = require("../config/db");
const axios  = require("axios");
const {
  validateAndLockCoupon,
  recordCouponUsage,
} = require("./couponController");


const toStr   = (v)         => (v == null ? "" : String(v).trim());
const toFloat = (v, d = 0) => { const n = parseFloat(v);   return Number.isNaN(n) ? d : n; };
const toInt   = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };

/* ─────────────────────────────────────────────────────────────
   HMAC Verification
   Shiprocket signs the raw request body with your CHECKOUT_API_SECRET.
   We verify before touching any data.
───────────────────────────────────────────────────────────── */
const verifyHmac = (rawBody, receivedHmac) => {
  const secret = process.env.CHECKOUT_API_SECRET || "";
  if (!secret) {
    console.error("[SR OrderWebhook] CHECKOUT_API_SECRET not set — cannot verify HMAC");
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  // Constant-time comparison prevents timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(receivedHmac || ""),
    );
  } catch {
    return false;
  }
};

/* ─────────────────────────────────────────────────────────────
   Fetch order details from Shiprocket  (Guide Section 6)
   Used as fallback when the order webhook body lacks full cart data.
───────────────────────────────────────────────────────────── */
const fetchSROrderDetails = async (orderId) => {
  try {
    const timestamp = new Date().toISOString();
    const payload   = { order_id: orderId, timestamp };
    const bodyStr   = JSON.stringify(payload);
    const hmac      = crypto
      .createHmac("sha256", process.env.CHECKOUT_API_SECRET || "")
      .update(bodyStr)
      .digest("base64");

    const response = await axios.post(
      "https://fastrr-api-dev.pickrr.com/api/v1/custom-platform-order/details",
      payload,
      {
        headers: {
          "X-Api-Key":         process.env.CHECKOUT_API_KEY || "",
          "X-Api-HMAC-SHA256": hmac,
          "Content-Type":      "application/json",
        },
        timeout: 8000,
      },
    );
    return response.data;
  } catch (err) {
    console.error("[SR OrderWebhook] fetchSROrderDetails failed:", err.response?.data || err.message);
    return null;
  }
};

const findCheckoutContext = async (srOrderId, checkoutRef = "") => {
  const orderNeedle = srOrderId ? String(srOrderId).replace(/"/g, '\\"') : "";
  const refNeedle = checkoutRef ? String(checkoutRef).replace(/"/g, '\\"') : "";
  if (!orderNeedle && !refNeedle) return null;

  const whereClauses = [];
  const params = [];
  if (orderNeedle) {
    whereClauses.push(`meta_value LIKE ?`);
    params.push(`%"sr_order_id":"${orderNeedle}"%`);
  }
  if (refNeedle) {
    whereClauses.push(`meta_value LIKE ?`);
    params.push(`%"checkout_ref":"${refNeedle}"%`);
  }

  const [rows] = await db.query(
    `SELECT meta_value
     FROM tbl_ordermeta
     WHERE meta_key = '_shiprocket_checkout_ctx'
       AND (${whereClauses.join(" OR ")})
     ORDER BY meta_id DESC
     LIMIT 1`,
    params,
  );

  if (!rows.length) return null;

  try {
    return JSON.parse(rows[0].meta_value);
  } catch {
    return null;
  }
};

/* ─────────────────────────────────────────────────────────────
   Main webhook handler
   POST /api/shiprocket/order-webhook
───────────────────────────────────────────────────────────── */
const receiveOrderWebhook = async (req, res) => {
  // ── 1. HMAC verification ───────────────────────────────────────────────────
  // req.rawBody is set by the express bodyParser rawBody option (see server setup note below).
  // If you don't have rawBody captured, use the parsed JSON body stringified — it works in
  // practice as long as Shiprocket doesn't alter key ordering.
  const rawBody      = req.rawBody || JSON.stringify(req.body);
  const receivedHmac = req.headers["x-api-hmac-sha256"] || "";

  if (!verifyHmac(rawBody, receivedHmac)) {
    console.warn("[SR OrderWebhook] HMAC verification failed — rejecting request");
    // Return 200 anyway so Shiprocket doesn't retry (we don't want spam from invalid requests)
    return res.status(200).json({ success: false, message: "HMAC mismatch" });
  }

  const body = req.body;

  // ── 2. Parse payload ────────────────────────────────────────────────────────
  const srOrderId       = toStr(body.order_id);
  const checkoutRef     = toStr(body.checkout_ref || "");
  const status          = toStr(body.status);       // "SUCCESS" | "FAILED" | "PENDING"
  const phone           = toStr(body.phone);
  const email           = toStr(body.email || "").toLowerCase().trim();
  const paymentType     = toStr(body.payment_type); // "CASH_ON_DELIVERY" | "PREPAID" | "UPI" etc.
  const totalAmount     = toFloat(body.total_amount_payable, 0);
  const cartData        = body.cart_data || {};
  const cartItems       = Array.isArray(cartData.items) ? cartData.items : [];

  // Only process successful orders
  if (status !== "SUCCESS") {
    console.log(`[SR OrderWebhook] Skipping non-success order ${srOrderId} (status: ${status})`);
    return res.status(200).json({ success: true, message: "Non-success status ignored" });
  }

  if (!srOrderId) {
    console.warn("[SR OrderWebhook] Missing order_id in payload");
    return res.status(200).json({ success: false, message: "Missing order_id" });
  }

  // ── 3. Idempotency check — don't create duplicate orders ────────────────────
  const [[existing]] = await db.query(
    `SELECT order_id FROM tbl_ordermeta
     WHERE meta_key = '_sr_checkout_order_id' AND meta_value = ?
     LIMIT 1`,
    [srOrderId],
  );
  if (existing) {
    console.log(`[SR OrderWebhook] Order ${srOrderId} already processed — skipping`);
    return res.status(200).json({ success: true, message: "Already processed" });
  }

  // ── 4. Resolve user by phone/email ──────────────────────────────────────────
  let userId = 0;
  if (email) {
    const [[userRow]] = await db.query(
      `SELECT ID FROM tbl_users WHERE user_email = ? LIMIT 1`,
      [email],
    );
    if (userRow) {
      userId = userRow.ID;
    } else {
      // Create guest user row so order history works if they register later
      try {
        await db.query(
          `INSERT IGNORE INTO tbl_users
           (user_type, user_login, user_pass, user_nicename, user_email, display_name, user_registered)
           VALUES (4, ?, '', ?, ?, ?, NOW())`,
          [email, email, email, phone || email],
        );
        const [[newRow]] = await db.query(
          `SELECT ID FROM tbl_users WHERE user_email = ? LIMIT 1`,
          [email],
        );
        userId = newRow ? newRow.ID : 0;
      } catch (e) {
        console.error("[SR OrderWebhook] Guest user upsert failed:", e.message);
      }
    }
  }

  // ── 5. Resolve product details for each cart item ───────────────────────────
  //   SR sends variant_id (which is our product/variation ID) + quantity.
  //   We re-fetch live prices from DB — never trust prices from external webhooks.
  const resolvedItems = [];
  for (const item of cartItems) {
    const variantId = toInt(item.variant_id, 0);
    const quantity  = toInt(item.quantity, 1);
    if (!variantId) continue;

    const [[priceRow]] = await db.query(
      `SELECT
         p.ID, p.product_title,
         CAST(pm.meta_value AS DECIMAL(10,2)) AS price,
         sku_meta.meta_value AS sku
       FROM tbl_products p
       LEFT JOIN tbl_productmeta pm       ON pm.product_id  = p.ID AND pm.meta_key = '_price'
       LEFT JOIN tbl_productmeta sku_meta ON sku_meta.product_id = p.ID AND sku_meta.meta_key = '_sku'
       WHERE p.ID = ?
       LIMIT 1`,
      [variantId],
    );

    if (priceRow) {
      resolvedItems.push({
        product_id: priceRow.ID,
        title:      priceRow.product_title || "Product",
        price:      Number(priceRow.price  || 0),
        sku:        priceRow.sku            || "",
        quantity,
      });
    }
  }

  if (resolvedItems.length === 0) {
    // Fallback: fetch full order details from Shiprocket's API
    console.warn(`[SR OrderWebhook] No cart items resolved locally for ${srOrderId} — fetching from SR`);
    const srDetails = await fetchSROrderDetails(srOrderId);
    if (!srDetails) {
      console.error(`[SR OrderWebhook] Could not resolve items for order ${srOrderId}`);
      return res.status(200).json({ success: false, message: "Could not resolve cart items" });
    }
    // srDetails payload structure varies — log it for debugging
    console.log("[SR OrderWebhook] SR order details response:", JSON.stringify(srDetails).slice(0, 500));
  }

  // ── 6. Write order to DB inside a transaction ────────────────────────────────
  const conn = await db.getConnection();
  const checkoutContext = await findCheckoutContext(srOrderId, checkoutRef);
  const checkoutCouponCode = toStr(checkoutContext?.coupon_code || "");
  const checkoutCouponDiscount = toFloat(checkoutContext?.coupon_discount, 0);
  try {
    await conn.beginTransaction();

    const subtotal = resolvedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const paymentMethod = paymentType === "CASH_ON_DELIVERY" ? "cod" : "prepaid";
    const orderName     = `#SR-${Date.now()}`;
    const orderTitle    = `Order - ${new Date().toLocaleString()}`;

    let discount = checkoutCouponDiscount;
    let appliedCouponRow = null;
    if (checkoutCouponCode) {
      const [[couponRow]] = await conn.query(
        `SELECT *
         FROM tbl_coupons
         WHERE LOWER(coupon_code) = LOWER(?)
         LIMIT 1`,
        [checkoutCouponCode],
      );
      if (couponRow) {
        appliedCouponRow = couponRow;
        if (discount <= 0) {
          const couponCheck = await validateAndLockCoupon(
            conn,
            { coupon_id: couponRow.coupon_id, coupon_code: couponRow.coupon_code },
            userId,
            subtotal,
            resolvedItems.map((item) => item.product_id),
            resolvedItems,
          );
          if (couponCheck.ok) {
            discount = couponCheck.discount || 0;
          }
        }
      }
    }
    const shippingCost = Math.max(0, totalAmount - subtotal + discount);

    // Insert order row
    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified)
       VALUES (0, ?, ?, ?, '', 'pending', 'shop_order', NOW(), NOW())`,
      [userId, orderName, orderTitle],
    );
    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of resolvedItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title || "Product", orderId, item.product_id],
      );
      const orderItemId = itemResult.insertId;
      const lineTotal = item.price * item.quantity;
      const itemMeta = [
        ["_product_id", item.product_id],
        ["_variation_id", item.product_id],
        ["_qty", item.quantity],
        ["_line_subtotal", lineTotal.toFixed(2)],
        ["_line_total", lineTotal.toFixed(2)],
        ["_line_tax", "0"],
        ["_line_subtotal_tax", "0"],
        ["_item_sku", item.sku || ""],
      ];

      for (const [metaKey, metaValue] of itemMeta) {
        await conn.query(
          "INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
          [orderItemId, metaKey, metaValue],
        );
      }
    }

    if (shippingCost > 0) {
      const [shipResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES ('Shipping', 'shipping', ?, 0)`,
        [orderId],
      );
      await conn.query(
        "INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
        [shipResult.insertId, "cost", shippingCost.toFixed(2)],
      );
    }

    // Insert order meta
    const metaEntries = [
      ["_payment_method",       paymentMethod],
      ["_order_total",          String(totalAmount || subtotal)],
      ["_order_subtotal",       String(subtotal)],
      ["_order_shipping",       shippingCost.toFixed(2)],
      ["_billing_phone",        phone],
      ["_billing_email",        email],
      ["_sr_checkout_order_id", srOrderId],      // idempotency key
      ["_order_source",         "shiprocket_checkout"],
    ];

    if (checkoutCouponCode) {
      metaEntries.push(["_coupon_code", checkoutCouponCode]);
      metaEntries.push(["_coupon_discount", discount.toFixed(2)]);
    }

    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES ?`,
      [metaEntries.map(([k, v]) => [orderId, k, v])],
    );

    if (appliedCouponRow) {
      try {
        await recordCouponUsage(conn, {
          coupon_id: appliedCouponRow.coupon_id,
          coupon_code: appliedCouponRow.coupon_code,
        }, orderId, userId);
      } catch (couponErr) {
        console.error("[SR OrderWebhook] Coupon usage record failed:", couponErr.message);
      }
    }

    await conn.commit();

    console.log(`[SR OrderWebhook] ✅ Order ${orderId} created for SR order ${srOrderId}`);

    // ── 7. Trigger stock update webhooks back to Shiprocket ────────────────────
    //   Fire-and-forget — don't await, don't block the response
    try {
      const { sendProductUpdateWebhook } = require("./shiprocketWebhooks");
      for (const item of resolvedItems) {
        sendProductUpdateWebhook(item.product_id).catch((e) =>
          console.error(`[SR OrderWebhook] Stock webhook failed for product ${item.product_id}:`, e.message),
        );
      }
    } catch (e) {
      console.error("[SR OrderWebhook] Could not trigger stock webhooks:", e.message);
    }

    return res.status(200).json({ success: true, order_id: orderId });

  } catch (err) {
    await conn.rollback();
    console.error("[SR OrderWebhook] DB error:", err.message);
    // Return 500 so Shiprocket retries — the idempotency check above
    // will skip the retry if we already partially succeeded.
    return res.status(500).json({ success: false, message: "DB error" });
  } finally {
    conn.release();
  }
};

module.exports = { receiveOrderWebhook, fetchSROrderDetails };