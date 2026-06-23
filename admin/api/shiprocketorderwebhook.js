const crypto = require("crypto");
const db     = require("../config/db");
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
───────────────────────────────────────────────────────────── */
const verifyHmac = (rawBody, receivedHmac) => {
  if (!receivedHmac) return true; // Fastrr order webhooks are unsigned
  const secret = process.env.CHECKOUT_API_SECRET || "";
  if (!secret) return true;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(receivedHmac),
    );
  } catch { return false; }
};

/* ─────────────────────────────────────────────────────────────
   parseAddress
   Converts either billing_address or shipping_address from the
   Shiprocket Checkout webhook payload into our standard shape.

   ACTUAL payload received (confirmed from your logs):
   {
     billing_address: {
       zip, city, name, phone, country,
       address1, address2, last_name, first_name
     }
   }
───────────────────────────────────────────────────────────── */
const parseAddress = (addr) => {
  if (!addr || typeof addr !== "object") return null;

  // "name" field is the full name — split it only as fallback
  const fullName   = toStr(addr.name || "");
  const nameParts  = fullName.split(" ");
  const firstName  = toStr(addr.first_name || nameParts[0] || "");
  const lastName   = toStr(addr.last_name  || nameParts.slice(1).join(" ") || "");

  const line1 = toStr(addr.address1 || addr.address_line1 || addr.address || "");
  const line2 = toStr(addr.address2 || addr.address_line2 || "");
  const city  = toStr(addr.city || "");
  const zip   = toStr(addr.zip  || addr.pincode || addr.zipcode || addr.postcode || "");
  const state = toStr(addr.state || addr.state_name || addr.province || "");
  const phone = toStr(addr.phone || addr.mobile || "");

  if (!line1 && !city && !zip) return null;

  return { firstName, lastName, line1, line2, city, state, zip, phone };
};

/* ─────────────────────────────────────────────────────────────
   Main webhook handler
   POST /api/shiprocket/order-webhook

   ACTUAL payload shape (from your confirmed logs):
   {
     rtoPrediction: 'low',
     cart_id:       '6a367facc0f1576a0d37f46c',
     latest_stage:  'ORDER_PLACED',
     items: [{ name, price, title, quantity, product_id, variant_id }],
     currency:        'INR',
     item_count:      1,
     source_name:     'fastrr',
     total_price:     799,
     shipping_price:  0,
     total_discount:  0,
     tax:             0,
     billing_address:  { zip, city, name, phone, country, address1, address2, last_name, first_name },
     shipping_address: { zip, city, name, phone, country, address1, address2, last_name, first_name },
     cart_attributes:  { ipv4_address: '...' }
   }
───────────────────────────────────────────────────────────── */
const receiveOrderWebhook = async (req, res) => {
  console.log("Webhook body:", req.body);

  // ── 1. HMAC verification ────────────────────────────────────────────────────
  const rawBody      = req.rawBody || JSON.stringify(req.body);
  const receivedHmac = req.headers["x-api-hmac-sha256"] || "";

  if (!verifyHmac(rawBody, receivedHmac)) {
    console.warn("[SR OrderWebhook] HMAC verification failed — rejecting request");
    return res.status(200).json({ success: false, message: "HMAC mismatch" });
  }

  const body = req.body;

  // ── 2. Parse the actual payload fields ─────────────────────────────────────
  const cartId        = toStr(body.cart_id      || "");
  const latestStage   = toStr(body.latest_stage || "");
  const totalPrice    = toFloat(body.total_price,    0);
  const shippingPrice = toFloat(body.shipping_price, 0);
  const totalDiscount = toFloat(body.total_discount, 0);
  const tax           = toFloat(body.tax, 0);
  const itemCount     = toInt(body.item_count, 0);
  const currency      = toStr(body.currency || "INR");
  const sourceName    = toStr(body.source_name || "fastrr");
  const rawItems      = Array.isArray(body.items) ? body.items : [];

  // CONFIRMED (2026-06-23): this store's Shiprocket Checkout is configured
  // COD-only — "always prepaid" was a wrong assumption. Shiprocket's own
  // documented payload includes a payment_type field (e.g. "CASH_ON_DELIVERY"),
  // though your real production payloads haven't shown it yet — fall back to
  // "cod" since that's this store's only real option, rather than "prepaid".
  const rawPaymentType = toStr(body.payment_type || body.payment_method || "").toUpperCase();
  const paymentMethod  =
    rawPaymentType.includes("COD") || rawPaymentType.includes("CASH") ? "cod" :
    rawPaymentType.includes("PREPAID") || rawPaymentType.includes("PAID") ? "prepaid" :
    "cod"; // store default — change here if you later enable prepaid too

  // CONFIRMED (2026-06-22, side-by-side log comparison): the webhook's cart_id
  // and the token response's order_id (what the frontend polls with) are the
  // SAME Shiprocket identifier, just exposed under different field names at
  // different stages of the flow. Use cart_id as the dedup/lookup key so the
  // polling path's findOrderBySrOrderId() can actually find this order.
  // (Still also check body.order_id/sr_order_id in case Shiprocket ever adds
  // an explicit field — falls back to cartId if absent.)
  const srOrderId = toStr(body.order_id || body.sr_order_id || cartId);

  // Only process placed orders
  if (latestStage !== "ORDER_PLACED") {
    console.log(`[SR OrderWebhook] Skipping stage "${latestStage}" for cart_id=${cartId}`);
    return res.status(200).json({ success: true, message: `Stage ${latestStage} ignored` });
  }

  if (!cartId) {
    console.warn("[SR OrderWebhook] Missing cart_id in payload");
    return res.status(200).json({ success: false, message: "Missing cart_id" });
  }

  // ── 3. Idempotency — skip if already processed ─────────────────────────────
  const [[existing]] = await db.query(
    `SELECT order_id FROM tbl_ordermeta
     WHERE meta_key = '_sr_cart_id' AND meta_value = ?
     LIMIT 1`,
    [cartId],
  );
  if (existing) {
    console.log(`[SR OrderWebhook] cart_id=${cartId} already processed → order_id=${existing.order_id}`);
    return res.status(200).json({ success: true, message: "Already processed" });
  }

  // ── 4. Parse addresses (billing + shipping) directly from webhook ──────────
  const billing  = parseAddress(body.billing_address)  || {};
  const shipping = parseAddress(body.shipping_address) || billing; // fallback to billing

  // Get the phone from whichever address has it
  const phone = toStr(billing.phone || shipping.phone || "");

  if (!billing.line1 && !billing.city) {
    console.warn(`[SR OrderWebhook] cart_id=${cartId}: billing address is empty — will store blank address row`);
  }

  // ── 5. Resolve user by phone number ────────────────────────────────────────
  // Shiprocket Checkout payload gives us phone and name but NOT always email.
  // We store by phone. If tbl_users has a unique phone column, use that.
  // Otherwise we store as a guest user with a synthetic login.
  let userId = 0;
  let userEmail = "";

  // Try to find user by phone in tbl_usermeta (billing_phone meta key)
  if (phone) {
    const [[userByPhone]] = await db.query(
      `SELECT u.ID, u.user_email
       FROM tbl_users u
       JOIN tbl_usermeta um ON um.user_id = u.ID
       WHERE um.meta_key = 'billing_phone' AND um.meta_value = ?
       LIMIT 1`,
      [phone],
    );
    if (userByPhone) {
      userId    = userByPhone.ID;
      userEmail = userByPhone.user_email;
    }
  }

  // If not found by phone, create a guest user row for order history
  if (!userId && (phone || billing.firstName)) {
    const displayName = [billing.firstName, billing.lastName].filter(Boolean).join(" ") ||
                        phone || "Guest";
    // Use phone@shiprocket.guest as a synthetic email so INSERT IGNORE works
    // without a real email address
    const syntheticEmail = phone
      ? `${phone}@shiprocket.guest`
      : `guest_${Date.now()}@shiprocket.guest`;

    try {
      await db.query(
        `INSERT IGNORE INTO tbl_users
         (user_type, user_login, user_pass, user_nicename, user_email, display_name, user_registered)
         VALUES (4, ?, '', ?, ?, ?, NOW())`,
        [syntheticEmail, syntheticEmail, syntheticEmail, displayName],
      );
      const [[newRow]] = await db.query(
        `SELECT ID FROM tbl_users WHERE user_email = ? LIMIT 1`,
        [syntheticEmail],
      );
      userId    = newRow ? newRow.ID : 0;
      userEmail = syntheticEmail;
    } catch (e) {
      console.error("[SR OrderWebhook] Guest user upsert failed:", e.message);
    }
  }

  // ── 6. Resolve items — use product_id from webhook, fetch live title from DB ─
  // We do NOT use variant_id (you confirmed no variants).
  // We trust Shiprocket's item.price directly (this is the agreed checkout price).
  const resolvedItems = [];
  for (const item of rawItems) {
    const productId = toInt(item.product_id, 0);
    const quantity  = toInt(item.quantity, 1);
    const price     = toFloat(item.price, 0);

    if (!productId) continue;

    // Fetch live title from DB
    const [[dbRow]] = await db.query(
      `SELECT ID, product_title FROM tbl_products WHERE ID = ? LIMIT 1`,
      [productId],
    );

    resolvedItems.push({
      product_id: productId,
      title:      (dbRow && dbRow.product_title) ? dbRow.product_title : toStr(item.name || item.title || "Product"),
      price,
      quantity,
    });
  }

  if (!resolvedItems.length) {
    console.error(`[SR OrderWebhook] No resolvable items for cart_id=${cartId}`);
    return res.status(200).json({ success: false, message: "No valid items in cart" });
  }

  // ── 7. Write order to DB in a transaction ──────────────────────────────────
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Subtotal = sum of (price × qty) — matches Shiprocket's total_price - shipping - tax + discount
    const subtotal    = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount    = totalDiscount;
    const shippingCost = shippingPrice;
    const orderTotal  = totalPrice; // use Shiprocket's authoritative total

    // paymentMethod is now resolved earlier from the webhook payload (COD-aware)
    const orderName     = `#SR-${cartId}`;
    const orderTitle    = `Order - ${new Date().toLocaleString()}`;
    const createdAt     = new Date().toISOString().slice(0, 19).replace("T", " ");

    // ── tbl_orders ─────────────────────────────────────────────────────────────
    // TABLE: tbl_orders
    // Stores: order identity, user, status, shipment tracking info, sr_cart_id
    // CONFIRMED via production schema export (phpMyAdmin, 2026-06-23): the real
    // column is `sr_cart_id`, not `cart_id`. Every previous INSERT using
    // `cart_id` would have thrown "Unknown column 'cart_id'" and rolled back
    // the whole transaction — including the tbl_ordermeta rows.
    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified, sr_cart_id)
       VALUES (0, ?, ?, ?, '', 'processing', 'shop_order', NOW(), NOW(), ?)`,
      [userId, orderName, orderTitle, cartId],
    );
    const orderId = orderResult.insertId;

    // ── tbl_user_address (billing row) ─────────────────────────────────────────
    // TABLE: tbl_user_address
    // Stores: customer billing + shipping addresses, linked to order by order_id
    // address_billing = 'yes' → billing row
    // address_billing = 'no'  → shipping row
    await conn.query(
      `INSERT INTO tbl_user_address
       (user_id, order_id, address_type, address_primary,
        first_name, last_name, phone,
        address_line1, address_line2, city, zipcode, state_name,
        city_id, state_id, country_id, address_notes,
        address_billing, latitude, longitude, created_at, updated_at, update_done)
       VALUES
       (?, ?, 'general', 'no',
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        0, NULL, 226, '',
        'yes', '', '', ?, ?, 'no')`,
      [
        userId || null,
        orderId,
        billing.firstName || shipping.firstName || "",
        billing.lastName  || shipping.lastName  || "",
        billing.phone     || phone              || "",
        billing.line1     || "",
        billing.line2     || "",
        billing.city      || "",
        billing.zip       || "",
        billing.state     || "",
        createdAt,
        createdAt,
      ],
    );

    // ── tbl_user_address (shipping row) ────────────────────────────────────────
    await conn.query(
      `INSERT INTO tbl_user_address
       (user_id, order_id, address_type, address_primary,
        first_name, last_name, phone,
        address_line1, address_line2, city, zipcode, state_name,
        city_id, state_id, country_id, address_notes,
        address_billing, latitude, longitude, created_at, updated_at, update_done)
       VALUES
       (?, ?, 'general', 'no',
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        0, NULL, 226, '',
        'no', '', '', ?, ?, 'no')`,
      [
        userId || null,
        orderId,
        shipping.firstName || billing.firstName || "",
        shipping.lastName  || billing.lastName  || "",
        shipping.phone     || phone             || "",
        shipping.line1     || billing.line1     || "",
        shipping.line2     || billing.line2     || "",
        shipping.city      || billing.city      || "",
        shipping.zip       || billing.zip       || "",
        shipping.state     || billing.state     || "",
        createdAt,
        createdAt,
      ],
    );

    // ── tbl_order_items + tbl_order_itemmeta ───────────────────────────────────
    // TABLE: tbl_order_items — one row per product line
    // TABLE: tbl_order_itemmeta — price, qty, totals for each line item
    for (const item of resolvedItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title, orderId, item.product_id],
      );
      const orderItemId = itemResult.insertId;
      const lineTotal   = item.price * item.quantity;

      const itemMeta = [
        ["_product_id",       item.product_id],
        ["_variation_id",     0],               // no variants in your store
        ["_qty",              item.quantity],
        ["_line_subtotal",    lineTotal.toFixed(2)],
        ["_line_total",       lineTotal.toFixed(2)],
        ["_line_tax",         tax > 0 ? (tax / resolvedItems.length).toFixed(2) : "0"],
        ["_line_subtotal_tax","0"],
      ];

      for (const [metaKey, metaValue] of itemMeta) {
        await conn.query(
          "INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
          [orderItemId, metaKey, metaValue],
        );
      }
    }

    // Shipping line item (if charged)
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

    // ── Deduct stock ────────────────────────────────────────────────────────────
    for (const item of resolvedItems) {
      const qty = Number(item.quantity || 0);
      if (!qty) continue;

      await conn.query(
        `UPDATE tbl_productmeta
         SET meta_value = GREATEST(0, CAST(meta_value AS SIGNED) - ?)
         WHERE product_id = ? AND meta_key = '_stock'`,
        [qty, item.product_id],
      );

      const [[stockResult]] = await conn.query(
        `SELECT CAST(meta_value AS SIGNED) AS stock
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = '_stock'
         ORDER BY meta_id DESC LIMIT 1`,
        [item.product_id],
      );
      if ((stockResult?.stock ?? 0) <= 0) {
        await conn.query(
          `UPDATE tbl_productmeta
           SET meta_value = 'outofstock'
           WHERE product_id = ? AND meta_key = '_stock_status'`,
          [item.product_id],
        );
      }
    }

    // ── tbl_ordermeta ──────────────────────────────────────────────────────────
    // TABLE: tbl_ordermeta — financial data, identifiers, source info
    const metaEntries = [
      ["_payment_method",       paymentMethod],
      ["_order_currency",       currency],
      ["_order_total",          orderTotal.toFixed(2)],
      ["_order_subtotal",       subtotal.toFixed(2)],
      ["_order_shipping",       shippingCost.toFixed(2)],
      ["_order_tax",            tax.toFixed(2)],
      ["_order_item_count",     String(itemCount || resolvedItems.length)],
      ["_order_discount",       discount.toFixed(2)],
      ["_billing_phone",        phone],
      ["_billing_first_name",   billing.firstName  || ""],
      ["_billing_last_name",    billing.lastName   || ""],
      ["_sr_cart_id",           cartId],              // idempotency key (dedup within webhook path)
      ...(srOrderId ? [["_sr_checkout_order_id", srOrderId]] : []), // links to polling path dedup
      ["_order_source",         sourceName],          // 'fastrr'
      ["_rto_prediction",       toStr(body.rtoPrediction || "")],
    ];

    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES ?`,
      [metaEntries.map(([k, v]) => [orderId, k, v])],
    );

    await conn.commit();
    console.log(`[SR OrderWebhook] ✅ Order ${orderId} saved for cart_id=${cartId}`);
    console.log(`[SR OrderWebhook]    Customer: ${billing.firstName} ${billing.lastName} | Phone: ${phone}`);
    console.log(`[SR OrderWebhook]    Total: ₹${orderTotal} | Items: ${resolvedItems.length}`);

    // ── Clear the server-side cart (best-effort, non-fatal) ───────────────
    // The webhook path knows userId (resolved by phone above).
    // The frontend's polling success path also calls clearCart() client-side,
    // but clearing here ensures it's gone even if the tab was closed.
    if (userId) {
      try {
        await db.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
        console.log(`[SR OrderWebhook] Cart cleared for user_id=${userId}`);
      } catch (clearErr) {
        console.error("[SR OrderWebhook] Cart clear failed (non-fatal):", clearErr.message);
      }
    }

    // ── Fire-and-forget: sync stock back to Shiprocket catalog ────────────────
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

    // ── Push to Shiprocket's fulfillment/shipping panel (separate product
    // from Shiprocket Checkout — apiv2.shiprocket.in handles pickup/AWB).
    // Non-fatal: the order is already safely committed above regardless of
    // whether this succeeds. Runs AFTER commit so a slow/failed call here
    // can never roll back a real, paid order.
    try {
      const { createShiprocketOrder } = require("./orderController");
      const srPayload = {
        order_id:               `ORD_${orderId}_${Date.now()}`,
        order_date:             new Date().toISOString().slice(0, 10),
        pickup_location:        "warehouse", // must match your SR pickup location name
        billing_customer_name:  billing.firstName || "Customer",
        billing_last_name:      billing.lastName  || "",
        billing_address:        billing.line1     || "No Address",
        billing_address_2:      billing.line2     || "",
        billing_city:           billing.city      || "Unknown",
        billing_pincode:        billing.zip       || "000000",
        billing_state:          billing.state     || "Unknown",
        billing_country:        "India",
        billing_email:          userEmail || "noemail@example.com",
        billing_phone:          billing.phone || phone || "0000000000",
        shipping_is_billing:    true,
        order_items: resolvedItems.map((item) => ({
          name:          item.title,
          sku:           String(item.product_id),
          units:         item.quantity,
          selling_price: item.price,
          discount:      0,
        })),
        payment_method:   paymentMethod === "cod" ? "COD" : "Prepaid",
        sub_total:        subtotal - discount,
        shipping_charges: shippingCost,
        total_discount:   discount,
        length: 10, breadth: 10, height: 10, weight: 0.5,
      };

      const shiprocketResponse = await createShiprocketOrder(srPayload);
      if (shiprocketResponse?.shipment_id) {
        console.log(`[SR OrderWebhook] ✅ Pushed to SR fulfillment panel — shipment_id=${shiprocketResponse.shipment_id}`);
        await db.query(
          `UPDATE tbl_orders SET shipment_id = ?, shipping_status = 'new' WHERE order_id = ?`,
          [shiprocketResponse.shipment_id, orderId],
        );
      }
    } catch (e) {
      // Logged inside createShiprocketOrder too — keep this short
      console.error("[SR OrderWebhook] Fulfillment push failed (non-fatal):", e.message);
    }

    return res.status(200).json({ success: true, order_id: orderId });

  } catch (err) {
    await conn.rollback();
    console.error("[SR OrderWebhook] DB error:", err.message, err.stack);
    return res.status(500).json({ success: false, message: "DB error" });
  } finally {
    conn.release();
  }
};

/* ─────────────────────────────────────────────────────────────
   fetchSROrderDetails
   Calls Shiprocket Checkout API to verify whether a given
   sr_order_id has been paid. Used by completeCheckoutFromShiprocket
   as a polling fallback when the order webhook hasn't arrived yet.

   Returns the raw API response object, or null on failure.
   The caller is responsible for inspecting .status / .order_status.
───────────────────────────────────────────────────────────── */
const axios = require("axios");

const fetchSROrderDetails = async (srOrderId) => {
  const apiKey    = process.env.CHECKOUT_API_KEY    || "";
  const apiSecret = process.env.CHECKOUT_API_SECRET || "";

  if (!srOrderId || !apiKey) {
    return null;
  }

  try {
    // CONFIRMED from Shiprocket's official integration PDF (page 8-9):
    // this is a DIFFERENT host than checkout-api.shiprocket.com, it's a POST
    // (not GET), and the HMAC is computed over the JSON request body — same
    // pattern as the access-token call — not over a bare order_id string.
    // Previous attempts guessed at checkout-api.shiprocket.com/.../orders/:id
    // (a GET) and got 404s because that endpoint never existed.
    const body = JSON.stringify({
      order_id:  String(srOrderId),
      timestamp: new Date().toISOString(),
    });

    const hmac = crypto
      .createHmac("sha256", apiSecret)
      .update(body)
      .digest("base64");

    const response = await axios.post(
      "https://fastrr-api-dev.pickrr.com/api/v1/custom-platform-order/details",
      body,
      {
        headers: {
          "X-Api-Key":         apiKey,
          "X-Api-HMAC-SHA256": hmac,
          "Content-Type":      "application/json",
        },
        timeout: 8000,
      },
    );

    return response.data || null;
  } catch (err) {
    // Log but don't throw — caller handles null as "not confirmed"
    console.error(
      `[fetchSROrderDetails] Failed for order ${srOrderId}:`,
      err.response?.data || err.message,
    );
    return null;
  }
};

module.exports = { receiveOrderWebhook, fetchSROrderDetails };