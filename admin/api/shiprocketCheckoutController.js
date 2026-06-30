const crypto = require("crypto");
const db     = require("../config/db");
const axios  = require("axios");
const {
  validateAndLockCoupon,
  recordCouponUsage,
} = require("./couponController");
const {
  sendProductUpdateWebhook,
  sendCollectionUpdateWebhook,
} = require("./shiprocketWebhooks");
const { fetchSROrderDetails } = require("./shiprocketorderwebhook");
const { createShiprocketOrder } = require('./orderController');
/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const toInt   = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const toStr   = (v)         => (v == null ? "" : String(v).trim());
const toFloat = (v, d = 0) => { const n = parseFloat(v);   return Number.isNaN(n) ? d : n; };
const calculateExclusiveTax = (subtotal, taxPercent, discountShare = 0) => {
  const taxable = Math.max(0, toFloat(subtotal) - toFloat(discountShare));
  return (taxable * toFloat(taxPercent)) / 100;
};

const BASE_URL = "https://nestcase.in";

const buildImageUrl = (path) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

/**
 * Shared SQL fragment: fetches the LATEST non-empty value of a given
 * meta_key for a product from tbl_productmeta.
 *
 * DB-confirmed meta keys used here:
 *   _price          → actual selling price (what customer pays)
 *   _regular_price  → MRP / original price (compare-at / strikethrough)
 *   _sku            → product SKU
 *   _stock          → stock quantity
 *   weight          → weight in kg (NO underscore prefix — confirmed in DB)
 *                     e.g. product 61 has meta_key='weight', meta_value='7'
 *   tax             → GST rate percentage (e.g. "18")
 *   hsn             → HSN/SAC code (e.g. "39269099")
 */
const metaSubQuery = (key, alias) => `
  (
    SELECT meta_value
    FROM   tbl_productmeta
    WHERE  product_id = p.ID
      AND  meta_key   = '${key}'
      AND  meta_value IS NOT NULL
      AND  meta_value <> ''
    ORDER BY meta_id DESC
    LIMIT 1
  ) AS ${alias}
`;

/**
 * Map a DB row → Shiprocket-compliant product object.
 *
 * Price logic:
 *   selling_price    = _price         (what customer pays)
 *   compare_at_price = _regular_price (original MRP, shown crossed-out)
 *                    → sent only when strictly greater than selling price
 *                    → sent as "" when not applicable (Shiprocket accepts "")
 *
 * Weight logic:
 *   meta_key = 'weight' (no underscore) — value in kg (e.g. "7")
 *   weight_unit is always "kg" per Shiprocket spec
 *   grams = weight * 1000 (rounded)
 */
const mapProduct = (p) => {
  const imageSrc = buildImageUrl(p.image);

  const updatedAt = p.product_date_modified
    ? new Date(p.product_date_modified).toISOString()
    : "";
  const createdAt = p.product_date_added
    ? new Date(p.product_date_added).toISOString()
    : updatedAt;

  // ── Prices ──────────────────────────────────────────────────────
  const sellingPrice  = toFloat(p.price,         0); // _price
  const regularPrice  = toFloat(p.regular_price, 0); // _regular_price (MRP)
  const taxPercent    = toFloat(p.tax_percent,   0);

  // compare_at_price = MRP only when MRP > selling price (real discount exists)
  const compareAtPrice =
    regularPrice > 0 && regularPrice > sellingPrice ? regularPrice : 0;

  // ── Stock / Weight ───────────────────────────────────────────────
  const stockQty = toInt(p.stock,  0);
  const weight   = toFloat(p.weight, 0); // meta_key='weight' (no underscore), value in kg
  const hsnCode  = toStr(p.hsn_code);   // meta_key='hsn'
  const gstRate  = toFloat(p.gst_rate, taxPercent); // meta_key='tax' (same value, aliased for clarity)

  return {
    id:           p.ID,
    title:        toStr(p.product_title),
    body_html:    toStr(p.product_content),
    vendor:       "Nestcase",
    product_type: toStr(p.category_name),
    created_at:   createdAt,
    handle:       toStr(p.product_url),
    status:       p.product_status === "publish" ? "active" : "draft",
    tags:         "",
    updated_at:   updatedAt,
    variants: [
      {
        id:               p.ID,
        title:            "Default",
        price:            sellingPrice.toFixed(2),          // ✅ string e.g. "999.00"
        compare_at_price: compareAtPrice > 0
                            ? compareAtPrice.toFixed(2)     // ✅ string e.g. "1499.00" (MRP)
                            : "",                           // ✅ "" when no discount
        sku:              toStr(p.sku),
        created_at:       createdAt,
        updated_at:       updatedAt,
        taxable:          true,
        tax_percent:      taxPercent,
        gst_rate:         String(gstRate),                  // GST % e.g. "18"
        hsn_code:         hsnCode,                          // HSN/SAC e.g. "39269099"
        quantity:         stockQty,
        option_values:    {},
        grams:            Math.round(weight * 1000),        // e.g. 7 kg → 7000 grams
        image:            { src: imageSrc },
        weight:           weight,                           // real value from DB e.g. 7
        weight_unit:      "kg",
      },
    ],
    image:       { src: imageSrc },
    tax_percent: taxPercent,
    gst_rate:    String(gstRate),
    hsn_code:    hsnCode,
    options:     [],
  };
};

/* ─────────────────────────────────────────────────────────────
   Shared product SELECT columns
   Fetches: price (_price), compare-at (_regular_price),
            sku (_sku), stock (_stock), weight (weight), image,
            gst_rate (tax), hsn_code (hsn)
───────────────────────────────────────────────────────────── */
const PRODUCT_SELECT = `
  p.ID,
  p.product_title,
  p.product_content,
  p.product_short_desc,
  p.product_status,
  p.product_type,
  p.product_url,
  p.product_date_added,
  p.product_date_modified,

  c.category_name,

  /* ── Primary product image ── */
  (
    SELECT media_path
    FROM   tbl_media
    WHERE  parent_id  = p.ID
      AND  media_type = 'product_image'
    ORDER BY media_id ASC
    LIMIT 1
  ) AS image,

  /* ── Selling price ── */
  ${metaSubQuery("_price",         "price")}
  ,
  /* ── Original MRP → compare_at_price ── */
  ${metaSubQuery("_regular_price", "regular_price")}
  ,
  /* ── SKU ── */
  ${metaSubQuery("_sku",           "sku")}
  ,
  /* ── Stock quantity ── */
  ${metaSubQuery("_stock",         "stock")}
  ,
  /* ── Weight in kg (key = 'weight', NO underscore, confirmed in tbl_productmeta) ── */
  ${metaSubQuery("weight",         "weight")}
  ,
  /* ── GST rate % ── */
  ${metaSubQuery("tax",            "gst_rate")}
  ,
  /* ── tax_percent alias (same value, kept for backward compat in other consumers) ── */
  ${metaSubQuery("tax",            "tax_percent")}
  ,
  /* ── HSN / SAC code ── */
  ${metaSubQuery("hsn",            "hsn_code")}
`;

/* ─────────────────────────────────────────────────────────────
   Count helpers
───────────────────────────────────────────────────────────── */
const countPublishedProducts = async (collectionId = null) => {
  if (collectionId) {
    const [rows] = await db.query(
      `SELECT COUNT(DISTINCT p.ID) AS total
       FROM   tbl_products p
       INNER JOIN tbl_products_category_link pcl ON pcl.product_id = p.ID
       WHERE  pcl.category_id  = ?
         AND  p.product_status = 'publish'`,
      [collectionId],
    );
    return toInt(rows?.[0]?.total, 0);
  }
  const [rows] = await db.query(
    `SELECT COUNT(DISTINCT p.ID) AS total
     FROM   tbl_products p
     WHERE  p.product_status = 'publish'`,
  );
  return toInt(rows?.[0]?.total, 0);
};

const countPublishedCollections = async () => {
  const [rows] = await db.query(
    `SELECT COUNT(DISTINCT c.category_id) AS total
     FROM   tbl_products_category c
     WHERE EXISTS (
       SELECT 1
       FROM   tbl_products_category_link pcl
       JOIN   tbl_products p ON p.ID = pcl.product_id
       WHERE  pcl.category_id  = c.category_id
         AND  p.product_status = 'publish'
     )`,
  );
  return toInt(rows?.[0]?.total, 0);
};

const persistCheckoutContext = async (context) => {
  if (!context?.checkout_ref && !context?.sr_order_id) return;

  await db.query(
    `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
     VALUES (0, '_shiprocket_checkout_ctx', ?)`,
    [JSON.stringify(context)],
  );
};

const findCheckoutContext = async ({ checkout_ref = "", sr_order_id = "" }) => {
  const ref = toStr(checkout_ref);
  const orderId = toStr(sr_order_id);
  const where = [];
  const params = [];
  if (ref) {
    where.push(`meta_value LIKE ?`);
    params.push(`%"checkout_ref":"${ref.replace(/"/g, '\\"')}"%`);
  }
  if (orderId) {
    where.push(`meta_value LIKE ?`);
    params.push(`%"sr_order_id":"${orderId.replace(/"/g, '\\"')}"%`);
  }
  if (!where.length) return null;

  const [rows] = await db.query(
    `SELECT meta_value
     FROM tbl_ordermeta
     WHERE meta_key = '_shiprocket_checkout_ctx'
       AND (${where.join(" OR ")})
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

const resolveShiprocketCheckoutItems = async (cartItems = []) => {
  const resolved = [];
  for (const item of cartItems) {
    const variantId = toInt(item?.variant_id, 0);
    const quantity = Math.max(1, toInt(item?.quantity, 1));
    
    // GRAB THE EXACT PRICE SHIPROCKET CHARGED
    const srPrice = Number(item?.price || 0); 
    
    if (!variantId) continue;

    // Remove the _price join, we only need title/SKU/tax now
    const [[dbRow]] = await db.query(
      `SELECT 
         p.ID, 
         p.product_title, 
         sku_meta.meta_value AS sku,
         COALESCE(NULLIF(tax_meta.meta_value, ''), parent_tax_meta.meta_value, 0) AS tax_percent
       FROM tbl_products p
       LEFT JOIN tbl_productmeta sku_meta ON sku_meta.product_id = p.ID AND sku_meta.meta_key = '_sku'
       LEFT JOIN tbl_productmeta tax_meta ON tax_meta.product_id = p.ID AND tax_meta.meta_key = 'tax'
       LEFT JOIN tbl_productmeta parent_tax_meta ON parent_tax_meta.product_id = p.parent_id AND parent_tax_meta.meta_key = 'tax'
       WHERE p.ID = ? 
       ORDER BY tax_meta.meta_id DESC, parent_tax_meta.meta_id DESC
       LIMIT 1`,
      [variantId],
    );

    if (dbRow) {
      resolved.push({
        product_id: dbRow.ID,
        title: dbRow.product_title || "Product",
        price: srPrice > 0 ? srPrice : 0, // USE SHIPROCKET'S PRICE
        sku: dbRow.sku || "",
        tax_percent: toFloat(dbRow.tax_percent, 0),
        quantity,
      });
    }
  }
  return resolved;
};


const insertShiprocketOrder = async ({ checkoutContext, srOrderId, userId, email, phone, srDetails }) => {
  const cartData = checkoutContext?.cart_data || {};
  const cartItems = Array.isArray(cartData.items) ? cartData.items : [];
  const resolvedItems = await resolveShiprocketCheckoutItems(cartItems);
  if (!resolvedItems.length) {
    return { success: false, message: "No cart items found in checkout context" };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const subtotal = resolvedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paymentMethod = toStr(checkoutContext?.payment_method || "prepaid");
    const orderName = `#SR-${Date.now()}`;
    const orderTitle = `Order - ${new Date().toLocaleString()}`;

    let discount = toFloat(checkoutContext?.coupon_discount, 0);
    let appliedCouponRow = null;
    const checkoutCouponCode = toStr(checkoutContext?.coupon_code || "");
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
          if (couponCheck.ok) discount = couponCheck.discount || 0;
        }
      }
    }

    const shippingCost = Math.max(0, toFloat(checkoutContext?.shipping_cost, 0));
    // item.price is the INCLUSIVE price (GST already embedded).
    // Reverse-calculate the GST component:  tax = inclusive * rate / (100 + rate)
    const taxTotal = resolvedItems.reduce((sum, item) => {
      const lineInclusive  = item.price * item.quantity;
      const discountShare  = subtotal > 0 ? (discount * lineInclusive) / subtotal : 0;
      const taxableInclusive = Math.max(0, lineInclusive - discountShare);
      const rate = toFloat(item.tax_percent, 0);
      return sum + (rate > 0 ? (taxableInclusive * rate) / (100 + rate) : 0);
    }, 0);
    // grandTotal = inclusive subtotal − discount + shipping (tax is already inside subtotal)
    const grandTotal = Math.max(0, subtotal - discount + shippingCost);

    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified, sr_cart_id)
       VALUES (0, ?, ?, ?, '', 'pending', 'shop_order', NOW(), NOW(), ?)`,
      [userId, orderName, orderTitle, toStr(srOrderId)],
    );
    const orderId = orderResult.insertId;

  const shipping = srDetails?.shipping_address || {};
    const billing = srDetails?.billing_address || shipping;
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    await conn.query(
      `INSERT INTO tbl_user_address
       (user_id, order_id, address_type, address_primary, first_name, last_name, phone, address_line1, address_line2, city, zipcode, state_name, city_id, state_id, country_id, address_notes, address_billing, latitude, longitude, created_at, updated_at, update_done)
       VALUES (?, ?, 'general', 'no', ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 226, '', 'yes', '', '', ?, ?, 'no')`,
      [userId || null, orderId, billing.first_name || 'Customer', billing.last_name || '', billing.phone || phone || '', billing.address1  || billing.address1 || '', billing.address2 || billing.address_2 || '', billing.city || '', billing.zip || billing.zip || '', billing.state || '', createdAt, createdAt]
    );

    await conn.query(
      `INSERT INTO tbl_user_address
       (user_id, order_id, address_type, address_primary, first_name, last_name, phone, address_line1, address_line2, city, zipcode, state_name, city_id, state_id, country_id, address_notes, address_billing, latitude, longitude, created_at, updated_at, update_done)
       VALUES (?, ?, 'general', 'no', ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 226, '', 'no', '', '', ?, ?, 'no')`,
      [userId || null, orderId, shipping.first_name || 'Customer', shipping.last_name || '', shipping.phone || phone || '', shipping.address1 || shipping.address1 || '', shipping.address2 || shipping.address_2 || '', shipping.city || '', shipping.zip || shipping.zip || '', shipping.state || '', createdAt, createdAt]
    );

    for (const item of resolvedItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title || "Product", orderId, item.product_id],
      );
      const orderItemId = itemResult.insertId;
      const lineTotal = item.price * item.quantity;
      const discountShare = subtotal > 0 ? (discount * lineTotal) / subtotal : 0;
      const taxableInclusive = Math.max(0, lineTotal - discountShare);
      const rate = toFloat(item.tax_percent, 0);
      const lineTax = rate > 0 ? (taxableInclusive * rate) / (100 + rate) : 0;
      const itemMeta = [
        ["_product_id", item.product_id],
        ["_variation_id", item.product_id],
        ["_qty", item.quantity],
        ["_line_subtotal", lineTotal.toFixed(2)],
        ["_line_total", lineTotal.toFixed(2)],
        ["_line_tax", lineTax.toFixed(2)],
        ["_line_subtotal_tax", lineTax.toFixed(2)],
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

    const metaEntries = [
      ["_payment_method", paymentMethod],
      ["_order_total", String(grandTotal)],
      ["_order_subtotal", String(subtotal)],
      ["_order_tax", taxTotal.toFixed(2)],
      ["_order_shipping", shippingCost.toFixed(2)],
      ["_billing_phone", toStr(phone)],
      ["_billing_email", toStr(email)],
      ["_sr_checkout_order_id", toStr(srOrderId)],
      ["_shiprocket_checkout_ref", toStr(checkoutContext?.checkout_ref || "")],
      ["_order_source", "shiprocket_checkout"],
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
      await recordCouponUsage(
        conn,
        { coupon_id: appliedCouponRow.coupon_id, coupon_code: appliedCouponRow.coupon_code },
        orderId,
        userId,
      );
    }

    await conn.commit();
    try {
      const srPayload = {
        order_id: "ORD_" + orderId + "_" + Date.now(),
        order_date: new Date().toISOString().slice(0, 10),
        pickup_location: "warehouse", // Ensure this matches your SR pickup location
        billing_customer_name: billing.first_name || "Customer",
        billing_last_name: billing.last_name || "",
        billing_address: billing.address1 || billing.address1 || "No Address",
        billing_address_2: billing.address2 || billing.address_2 || "",
        billing_city: billing.city || "Unknown",
        billing_pincode: billing.zip || billing.zip || "000000",
        billing_state: billing.state || "Unknown",
        billing_country: "India",
        billing_email: email || "noemail@example.com",
        billing_phone: billing.phone || phone || "0000000000",
        shipping_is_billing: true,
        order_items: resolvedItems.map((item) => ({
          name: item.title,
          sku: String(item.product_id),
          units: item.quantity,
          selling_price: item.price,
          discount: 0,
        })),
        payment_method: paymentMethod.toUpperCase() === "COD" ? "COD" : "Prepaid",
        sub_total: Math.max(0, subtotal - discount),
        shipping_charges: shippingCost,
        total_discount: discount,
        length: 10, breadth: 10, height: 10, weight: 0.5,
      };

      const shiprocketResponse = await createShiprocketOrder(srPayload);
      
      if (shiprocketResponse && shiprocketResponse.shipment_id) {
        //  console.log(`[SR Polling] ✅ Order pushed to SR Panel! Shipment ID: ${shiprocketResponse.shipment_id}`);
         // Save the shipment ID back to your local order (outside the main transaction)
         await db.query(`UPDATE tbl_orders SET shipment_id = ?, shipping_status = 'new' WHERE order_id = ?`, 
            [shiprocketResponse.shipment_id, orderId]);
      }
    } catch (e) {
      console.error("[SR Polling] Failed to push to SR Panel:", e.message);
    }
    
    return { success: true, orderId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * The Order Webhook (shiprocketorderwebhook.js) is the ONLY place that
 * should decide a checkout is genuinely complete — it inserts this meta
 * row exclusively when Shiprocket's webhook payload says status === "SUCCESS".
 *
 * If a row exists here, the order is real. If it doesn't, all we know is
 * that a checkout was *initiated* — NOT that the customer finished paying.
 */
const findOrderBySrOrderId = async (srOrderId) => {
  const orderId = toStr(srOrderId);
  if (!orderId) return null;

  // 1. Direct match on _sr_checkout_order_id
  const [rows] = await db.query(
    `SELECT order_id FROM tbl_ordermeta
     WHERE meta_key = '_sr_checkout_order_id' AND meta_value = ?
     LIMIT 1`,
    [orderId],
  );
  if (rows.length) return rows[0].order_id;

  // 2. Match on _sr_cart_id
  const [rows2] = await db.query(
    `SELECT order_id FROM tbl_ordermeta
     WHERE meta_key = '_sr_cart_id' AND meta_value = ?
     LIMIT 1`,
    [orderId],
  );
  if (rows2.length) return rows2[0].order_id;

  // 3. Match via redirect-id mapping stored by registerRedirectOrderId()
  const [rows3] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta
     WHERE meta_key = '_sr_redirect_order_id'
       AND meta_value LIKE ?
     ORDER BY meta_id DESC LIMIT 1`,
    [orderId + '|%'],
  );
  if (rows3.length) {
    const checkoutRef = toStr(rows3[0].meta_value).split('|')[1] || '';
    if (checkoutRef) {
      // Find order via checkout_ref stored on the order itself
      const [rows4] = await db.query(
        `SELECT order_id FROM tbl_ordermeta
         WHERE meta_key = '_shiprocket_checkout_ref' AND meta_value = ?
         LIMIT 1`,
        [checkoutRef],
      );
      if (rows4.length) return rows4[0].order_id;

      // Also walk back through the checkout context to get the sr_order_id (= cart_id)
      const [ctxRows] = await db.query(
        `SELECT meta_value FROM tbl_ordermeta
         WHERE meta_key = '_shiprocket_checkout_ctx'
           AND meta_value LIKE ?
         ORDER BY meta_id DESC LIMIT 1`,
        ['%"checkout_ref":"' + checkoutRef + '"%'],
      );
      if (ctxRows.length) {
        try {
          const ctx = JSON.parse(ctxRows[0].meta_value);
          const ctxSrOrderId = toStr(ctx?.sr_order_id || '');
          if (ctxSrOrderId && ctxSrOrderId !== orderId) {
            const [rows5] = await db.query(
              `SELECT order_id FROM tbl_ordermeta
               WHERE meta_key = '_sr_cart_id' AND meta_value = ?
               LIMIT 1`,
              [ctxSrOrderId],
            );
            if (rows5.length) return rows5[0].order_id;
          }
        } catch { /* skip */ }
      }
    }
  }

  return null;
};

const bindCheckoutContextToOrder = async ({ checkout_ref, sr_order_id }) => {
  const ref = toStr(checkout_ref);
  const orderId = toStr(sr_order_id);
  if (!ref || !orderId) {
    return { success: false, message: "checkout_ref and sr_order_id are required" };
  }

  const [rows] = await db.query(
    `SELECT meta_id, meta_value
     FROM tbl_ordermeta
     WHERE meta_key = '_shiprocket_checkout_ctx'
       AND meta_value LIKE ?
     ORDER BY meta_id DESC
     LIMIT 1`,
    [`%\"checkout_ref\":\"${ref.replace(/"/g, '\\"')}\"%`],
  );

  if (!rows.length) {
    return { success: false, message: "Checkout context not found" };
  }

  let context;
  try {
    context = JSON.parse(rows[0].meta_value);
  } catch {
    context = { checkout_ref: ref };
  }

  context.checkout_ref = ref;
  context.sr_order_id = orderId;

  await db.query(
    `UPDATE tbl_ordermeta
     SET meta_value = ?
     WHERE meta_id = ?`,
    [JSON.stringify(context), rows[0].meta_id],
  );

  return { success: true };
};

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/products
   Share with Shiprocket: https://nestcase.in/api/shiprocket/products?page=1&limit=100
───────────────────────────────────────────────────────────── */
const fetchProducts = async (req, res) => {
  try {
    const page   = Math.max(1, toInt(req.query.page,  1));
    const limit  = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT
         ${PRODUCT_SELECT}
       FROM  tbl_products p
       LEFT JOIN tbl_products_category_link pcl ON pcl.product_id = p.ID
       LEFT JOIN tbl_products_category c        ON c.category_id  = pcl.category_id
       WHERE p.product_status = 'publish'
       GROUP BY p.ID
       ORDER BY p.ID DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const total    = await countPublishedProducts();
    const products = rows.map(mapProduct);

    return res.json({ data: { total, products } });
  } catch (err) {
    console.error("fetchProducts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/products/by-collection?collection_id=X
   Share with Shiprocket: https://nestcase.in/api/shiprocket/products/by-collection?collection_id=1&page=1&limit=100
───────────────────────────────────────────────────────────── */
const fetchProductsByCollection = async (req, res) => {
  try {
    const collectionId = toInt(req.query.collection_id, 0);
    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: "collection_id query param is required",
      });
    }

    const page   = Math.max(1, toInt(req.query.page,  1));
    const limit  = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [categoryRows] = await db.query(
      `SELECT category_id FROM tbl_products_category WHERE category_id = ? LIMIT 1`,
      [collectionId],
    );
    if (!categoryRows.length) {
      return res.status(404).json({ success: false, message: "Collection not found" });
    }

    const [rows] = await db.query(
      `SELECT
         ${PRODUCT_SELECT}
       FROM  tbl_products p
       INNER JOIN tbl_products_category_link pcl ON pcl.product_id = p.ID
       INNER JOIN tbl_products_category c        ON c.category_id  = pcl.category_id
       WHERE pcl.category_id  = ?
         AND p.product_status = 'publish'
       GROUP BY p.ID
       ORDER BY p.ID DESC
       LIMIT ? OFFSET ?`,
      [collectionId, limit, offset],
    );

    const total    = await countPublishedProducts(collectionId);
    const products = rows.map(mapProduct);

    return res.json({ data: { total, products } });
  } catch (err) {
    console.error("fetchProductsByCollection error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/collections
   Share with Shiprocket: https://nestcase.in/api/shiprocket/collections?page=1&limit=100
───────────────────────────────────────────────────────────── */
const fetchCollections = async (req, res) => {
  try {
    const page   = Math.max(1, toInt(req.query.page,  1));
    const limit  = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT
         c.category_id,
         c.category_name,
         c.category_desc,
         c.category_slug,
         (
           SELECT media_path
           FROM   tbl_media
           WHERE  parent_id  = c.category_id
             AND  media_type = 'category_image'
           ORDER BY media_id ASC
           LIMIT 1
         ) AS image
       FROM tbl_products_category c
       WHERE EXISTS (
         SELECT 1
         FROM   tbl_products_category_link pcl
         JOIN   tbl_products p ON p.ID = pcl.product_id
         WHERE  pcl.category_id  = c.category_id
           AND  p.product_status = 'publish'
       )
       ORDER BY c.category_id ASC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const nowIso = new Date().toISOString();
    const collections = rows.map((c) => ({
      id:         c.category_id,
      updated_at: nowIso,
      body_html:  toStr(c.category_desc),
      handle:     toStr(c.category_slug),
      image:      { src: buildImageUrl(c.image) },
      title:      toStr(c.category_name),
      created_at: nowIso,
    }));

    const total = await countPublishedCollections();
    return res.json({ data: { total, collections } });
  } catch (err) {
    console.error("fetchCollections error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/shiprocket/token
   Called by the frontend cart page when the user clicks
   "Proceed to Checkout".
───────────────────────────────────────────────────────────── */
const getCheckoutToken = async (req, res) => {
  try {
    const apiKey    = process.env.CHECKOUT_API_KEY    || "";
    const apiSecret = process.env.CHECKOUT_API_SECRET || "";

    if (!apiKey || !apiSecret) {
      console.error("getCheckoutToken: CHECKOUT_API_KEY or CHECKOUT_API_SECRET not set in env");
      return res.status(500).json({
        success: false,
        message: "Checkout not configured. Contact support.",
      });
    }

    // Fetch fresh prices from DB for all items instead of trusting frontend prices
    const frontendItems = req.body?.cart_data?.items || [];
    const freshItems = [];

    for (const item of frontendItems) {
      const variantId = toInt(item?.variant_id, 0);
      const quantity = Math.max(1, toInt(item?.quantity, 1));
      
      if (!variantId) continue;

      // Query DB for fresh exclusive price and tax percent.
      const [[dbRow]] = await db.query(
        `SELECT 
           COALESCE(
             (SELECT meta_value FROM tbl_productmeta WHERE product_id = ? AND meta_key = '_price' ORDER BY meta_id DESC LIMIT 1),
             (SELECT meta_value FROM tbl_productmeta WHERE product_id = (SELECT parent_id FROM tbl_products WHERE ID = ? LIMIT 1) AND meta_key = '_price' ORDER BY meta_id DESC LIMIT 1),
             0
           ) AS price,
           COALESCE(
             NULLIF((SELECT meta_value FROM tbl_productmeta WHERE product_id = ? AND meta_key = 'tax' ORDER BY meta_id DESC LIMIT 1), ''),
             (SELECT meta_value FROM tbl_productmeta WHERE product_id = (SELECT parent_id FROM tbl_products WHERE ID = ? LIMIT 1) AND meta_key = 'tax' ORDER BY meta_id DESC LIMIT 1),
             0
           ) AS tax_percent
         LIMIT 1`,
        [variantId, variantId, variantId, variantId]
      );

      // _price in DB is the inclusive selling price (GST already embedded)
      const freshPrice = Math.max(0, toFloat(dbRow?.price, 0));
      const gstRate    = Math.max(0, toFloat(dbRow?.tax_percent, 0));

      // Reverse-calculate GST from inclusive price:
      //   tax_amount = inclusive_price * gst_rate / (100 + gst_rate)
      const lineTotal   = freshPrice * quantity;
      const taxAmount   = gstRate > 0
        ? (lineTotal * gstRate) / (100 + gstRate)
        : 0;
      const lineExcl    = lineTotal - taxAmount; // pre-tax subtotal

      freshItems.push({
        variant_id:     String(variantId),
        quantity:        quantity,
        price:           freshPrice,           // inclusive price per unit
        gst_rate:        String(gstRate),       // GST % e.g. "18" — field Shiprocket expects
        tax_amount:      Number(taxAmount.toFixed(2)),
        line_subtotal:   Number(lineExcl.toFixed(2)),   // pre-tax total for this line
        line_total:      Number(lineTotal.toFixed(2)),  // inclusive total for this line
      });
    }

    const payload = {
      cart_data: {
        items: freshItems,
        discount_amount: parseFloat(req.body?.coupon_discount || 0) || 0,
      },
      redirect_url: req.body?.redirect_url || "",
      timestamp:    req.body?.timestamp    || new Date().toISOString(),
    };

    // ── COUPON/DISCOUNT DEBUG LOG — what THIS site sends to Shiprocket ────────
    // This is the only place the actual coupon CODE (text) exists in your
    // system — Shiprocket's order webhook never echoes the code back later,
    // only the resulting total_discount amount. Compare this line against the
    // [COUPON-CHECK] SUMMARY log in shiprocketorderwebhook.js for the same
    // order (match by checkout_ref / cart_id) to confirm the discount carried
    // through end-to-end, from "coupon applied on your site" all the way to
    // "discounted price stored on the order."
    console.log(
      `[SR Checkout][COUPON-CHECK][TOKEN-GEN] checkout_ref=${toStr(req.body?.checkout_ref || "") || "—"} ` +
      `coupon_code_from_frontend=${toStr(req.body?.coupon_code || "") || "—"} ` +
      `coupon_discount_from_frontend=${toFloat(req.body?.coupon_discount, 0)} ` +
      `discount_amount_sent_to_SR=${payload.cart_data.discount_amount} ` +
      `item_count=${freshItems.length}`,
    );

    const sessionUser = req.sessionData?.user || null;

    // HMAC must be computed over the exact JSON string sent as the body.
    // Shiprocket verifies this on their end.
    const bodyStr = JSON.stringify(payload);
    const hmac    = crypto
      .createHmac("sha256", apiSecret)
      .update(bodyStr)
      .digest("base64");

    const response = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
      payload,
      {
        headers: {
          "X-Api-Key":         apiKey,
          "X-Api-HMAC-SHA256": hmac,
          "Content-Type":      "application/json",
        },
      },
    );


    const responseData = response.data || {};
    const srOrderId =
      toStr(responseData?.order_id) ||
      toStr(responseData?.result?.order_id) ||
      toStr(responseData?.result?.data?.order_id) ||
      toStr(responseData?.data?.order_id);

    await persistCheckoutContext({
      sr_order_id: srOrderId,
      checkout_ref: toStr(req.body?.checkout_ref || ""),
      coupon_code: toStr(req.body?.coupon_code || ""),
      coupon_discount: toFloat(req.body?.coupon_discount, 0),
      cart_data: payload.cart_data,
      redirect_url: payload.redirect_url,
      timestamp: payload.timestamp,
      user_id: sessionUser?.id || 0,
      user_email: toStr(sessionUser?.email || ""),
      user_name: toStr(sessionUser?.name || sessionUser?.display_name || ""),
    });

    return res.json({
      ...responseData,
      order_id: srOrderId || responseData?.order_id || responseData?.result?.order_id || "",
    });
  } catch (err) {
    const status  = err.response?.status  || 500;
    const errData = err.response?.data    || err.message;
    console.error("getCheckoutToken error:", errData);
    return res.status(status).json({
      success: false,
      error: errData,
    });
  }
};

const completeCheckoutFromShiprocket = async (req, res) => {
  try {
    const checkout_ref = toStr(req.body?.checkout_ref || "");
    const sr_order_id = toStr(req.body?.sr_order_id || req.body?.order_id || "");

    if (!sr_order_id) {
      return res.status(400).json({ success: false, message: "order_id is required" });
    }

    // (poll log removed — was firing on every single poll attempt and flooding pm2 logs)

    // ── 1. Direct lookup: has the webhook already created this order? ──────
    const existingOrderId = await findOrderBySrOrderId(sr_order_id);
    if (existingOrderId) {
      console.log(`[SR Complete-Checkout] ✅ found via direct ID lookup → order_id=${existingOrderId}`);
      return res.json({ success: true, order_id: existingOrderId, sr_cart_id: sr_order_id });
    }

    // ── 1b. Walk checkout context via checkout_ref ──────────────────────────
    // The redirect ?order_id= Shiprocket puts in the URL is NOT the cart_id
    // the webhook stores. Use checkout_ref to find the context, get the real
    // cart_id (ctx.sr_order_id), then look that up against _sr_cart_id.
    if (checkout_ref) {
      const ctx = await findCheckoutContext({ checkout_ref });
      // (ctx lookup log removed — was repeating every poll attempt)
      if (ctx) {
        const ctxCartId = toStr(ctx.sr_order_id || "");
        if (ctxCartId) {
          const [ctxRows] = await db.query(
            `SELECT order_id FROM tbl_ordermeta
             WHERE meta_key = '_sr_cart_id' AND meta_value = ?
             LIMIT 1`,
            [ctxCartId],
          );
          if (ctxRows.length) {
            console.log(`[SR Complete-Checkout] ✅ found via _sr_cart_id=${ctxCartId} → order_id=${ctxRows[0].order_id}`);
            return res.json({ success: true, order_id: ctxRows[0].order_id, sr_cart_id: ctxCartId });
          }
          const [ctxRows2] = await db.query(
            `SELECT order_id FROM tbl_ordermeta
             WHERE meta_key = '_sr_checkout_order_id' AND meta_value = ?
             LIMIT 1`,
            [ctxCartId],
          );
          if (ctxRows2.length) {
            console.log(`[SR Complete-Checkout] ✅ found via _sr_checkout_order_id=${ctxCartId} → order_id=${ctxRows2[0].order_id}`);
            return res.json({ success: true, order_id: ctxRows2[0].order_id, sr_cart_id: ctxCartId });
          }
          // (removed — was repeating "no order found yet" on every poll attempt)
        } else {
          console.log(`[SR Complete-Checkout] ctx found but sr_order_id is empty — token response may not have returned order_id`);
        }
      }
    }

    // ── 1c. Last-resort: find most recent shiprocket/fastrr order in last 10 min ──
    // Covers both webhook-created orders (source='fastrr') and polling-created
    // orders (source='shiprocket_checkout'). The webhook fires before the
    // redirect arrives so this will almost always catch it.
    {
      const [recentRows] = await db.query(
        `SELECT om.order_id
         FROM tbl_ordermeta om
         WHERE om.meta_key = '_order_source'
           AND om.meta_value IN ('shiprocket_checkout', 'fastrr')
           AND om.order_id IN (
             SELECT order_id FROM tbl_orders
             WHERE order_date >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
           )
         ORDER BY om.order_id DESC
         LIMIT 1`,
      );
      if (recentRows.length) {
        console.log(`[SR Complete-Checkout] ✅ found via recent order fallback → order_id=${recentRows[0].order_id}`);
        // Fetch sr_cart_id for this order
        const [[cartIdRow]] = await db.query(
          `SELECT meta_value FROM tbl_ordermeta WHERE meta_key = '_sr_cart_id' AND order_id = ? LIMIT 1`,
          [recentRows[0].order_id],
        );
        return res.json({ success: true, order_id: recentRows[0].order_id, sr_cart_id: cartIdRow?.meta_value || sr_order_id });
      }
    }

    // ── 2. Webhook hasn't arrived yet — fall back to asking Shiprocket. ────
    // This mirrors the documented fallback path in Shiprocket's integration
    // guide ("Order Webhook Not Received" → "Call Order Details API using
    // Order ID"). Crucially: we do NOT treat the mere existence of a
    // checkout context as proof of payment — that context is written the
    // instant the customer clicks "Proceed to Checkout", before the iframe
    // even opens, so it proves nothing about whether they actually paid.
    //
    // KNOWN ISSUE (2026-06-23): this fallback currently fails with
    // "511 NETWORK_AUTHENTICATION_REQUIRED" against fastrr-api-dev.pickrr.com
    // — the host name suggests it needs separate sandbox credentials, not
    // your production CHECKOUT_API_KEY/SECRET. Until Shiprocket support
    // confirms the correct production host + credentials, this call is
    // gated behind SR_ORDER_DETAILS_ENABLED so it doesn't spam guaranteed
    // failures on every 2.5s poll tick. Set that env var to "true" once you
    // have working credentials to re-enable this fallback.
    let confirmed = false;
    let srDetails = null; // hoisted so it's visible after the try block below
    if (toStr(process.env.SR_ORDER_DETAILS_ENABLED).toLowerCase() === "true") {
      try {
        srDetails = await fetchSROrderDetails(sr_order_id);
        // NOTE: confirm the exact field name against your Shiprocket sandbox
        // response (log it below) and adjust if it differs — defaulting to
        // "not confirmed" on any unrecognized shape is intentional, since a
        // false negative just means "keep polling," while a false positive
        // means creating an order nobody paid for.
        const srStatus = toStr(
          srDetails?.status ??
          srDetails?.order_status ??
          srDetails?.payment_status ??
          srDetails?.data?.status ??
          srDetails?.result?.status ??
          ""
        ).toUpperCase();

        if (srDetails) {
          console.log(`[SR Complete-Checkout] order ${sr_order_id} raw details:`, JSON.stringify(srDetails).slice(0, 800));
        }

        confirmed = srStatus === "SUCCESS" || srStatus === "PAID" || srStatus === "COMPLETED";
      } catch (e) {
        console.error("[SR Complete-Checkout] fetchSROrderDetails failed:", e.message);
      }
    }

    if (!confirmed) {
      // Not verified yet — keep polling. Do NOT create an order.
      return res.status(202).json({ success: false, status: "PENDING" });
    }

    // ── 3. Shiprocket confirms the order — safe to create it now. ──────────
    const checkoutContext = await findCheckoutContext({ checkout_ref, sr_order_id });
    if (!checkoutContext) {
      return res.status(404).json({ success: false, message: "Checkout context not found" });
    }

    const sessionUser = req.sessionData?.user || null;
    let userId = toInt(checkoutContext.user_id || sessionUser?.id || 0, 0);
    let email = toStr(checkoutContext.user_email || sessionUser?.email || "");
    let phone = toStr(checkoutContext.user_phone || "");

    // Reject synthetic Shiprocket guest addresses — treat them as no email provided
    const isRealEmail = (e) =>
      !!e &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) &&
      !e.includes("@shiprocket.guest") &&
      !e.includes("@guest.local");

    if (!isRealEmail(email)) {
      email = "";
    }

    if (!userId && email) {
      // Deduplicate by email OR user_login (Shiprocket uses phone@shiprocket.guest
      // as both email and login — check both columns to avoid duplicate rows when
      // the same guest checks out more than once).
      const [guestRows] = await db.query(
        `SELECT ID FROM tbl_users
         WHERE user_email = ? OR user_login = ?
         ORDER BY ID ASC
         LIMIT 1`,
        [email, email],
      );
      if (guestRows.length) {
        userId = toInt(guestRows[0].ID, 0);
      }
    }

    // Extra safety: if Shiprocket guest email carries the phone number
    // (e.g. "8459908676@shiprocket.guest"), try to match an existing guest
    // row by that phone so we don't create yet another duplicate.
    if (!userId && phone) {
      const [phoneRows] = await db.query(
        `SELECT u.ID
         FROM tbl_users u
         WHERE u.user_login LIKE ? AND u.user_type = 4
         ORDER BY u.ID ASC
         LIMIT 1`,
        [`${phone}@%`],
      );
      if (phoneRows.length) {
        userId = toInt(phoneRows[0].ID, 0);
      }
    }

    if (!userId && email) {
      const display = toStr(checkoutContext.user_name || email);
      // INSERT IGNORE silently skips if a UNIQUE constraint fires on user_login.
      await db.query(
        `INSERT IGNORE INTO tbl_users
         (user_type, user_login, user_pass, user_nicename, user_email, display_name, user_registered)
         VALUES (4, ?, '', ?, ?, ?, NOW())`,
        [email, email, email, display],
      );
      const [[newUser]] = await db.query(
        `SELECT ID FROM tbl_users
         WHERE user_email = ? OR user_login = ?
         ORDER BY ID ASC
         LIMIT 1`,
        [email, email],
      );
      userId = newUser ? toInt(newUser.ID, 0) : 0;
    }

    // If we resolved an existing guest user via phone but they now have a real email,
    // update their user_email if it is currently empty (one phone → latest email wins)
    if (userId && email) {
      try {
        await db.query(
          `UPDATE tbl_users SET user_email = ? WHERE ID = ? AND (user_email = '' OR user_email IS NULL)`,
          [email, userId],
        );
      } catch (e) {
        console.error("[SR Checkout] Email update failed (non-fatal):", e.message);
      }
    }

    if (!userId) {
      userId = 0;
    }

    const orderDetails =
    srDetails?.result ||
    srDetails?.data ||
    srDetails ||
    {};

   const result = await insertShiprocketOrder({
      checkoutContext,
      srOrderId: sr_order_id,
      userId,
      email,
      phone,
      srDetails: orderDetails
    });

    if (!result.success) {
      return res.status(202).json({ success: false, status: "PENDING", message: result.message });
    }

    await bindCheckoutContextToOrder({ checkout_ref, sr_order_id });

    // ── Clear the server-side cart so the frontend shows empty on next load ──
    try {
      if (userId) {
        await db.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
      } else {
        const sessionUser = req.sessionData?.user || null;
        const sessionId   = req.sessionId || "";
        const cookieId    = req.guestId   || "";
        if (cookieId) {
          await db.query(
            "DELETE FROM cart_items WHERE cookie_id = ? AND user_id IS NULL",
            [cookieId],
          );
        } else if (sessionId) {
          await db.query(
            "DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL",
            [sessionId],
          );
        }
      }
      console.log(`[SR Complete-Checkout] ✅ Cart cleared for user_id=${userId || "guest"}`);
    } catch (clearErr) {
      // Non-fatal — log only, order is already safe
      console.error("[SR Complete-Checkout] Cart clear failed (non-fatal):", clearErr.message);
    }

    return res.json({ success: true, order_id: result.orderId, sr_cart_id: sr_order_id });
  } catch (err) {
    console.error("completeCheckoutFromShiprocket error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* POST /api/shiprocket/register-redirect*/
const registerRedirectOrderId = async (req, res) => {
  try {
    const redirect_order_id = toStr(req.body?.redirect_order_id || req.body?.order_id || "");
    const checkout_ref      = toStr(req.body?.checkout_ref || "");

    if (!redirect_order_id) {
      return res.status(400).json({ success: false, message: "redirect_order_id is required" });
    }

    // Store mapping even without checkout_ref — at minimum the redirect_order_id
    // can be checked directly against _sr_checkout_order_id / _sr_cart_id later.
    await db.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (0, '_sr_redirect_order_id', ?)`,
      [`${redirect_order_id}|${checkout_ref}`],
    );

    console.log(`[SR RegisterRedirect] redirect_id=${redirect_order_id} checkout_ref=${checkout_ref || "(none)"}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("registerRedirectOrderId error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const finalizeCheckoutContext = async (req, res) => {
  try {
    const checkout_ref = toStr(req.body?.checkout_ref || "");
    const sr_order_id = toStr(req.body?.sr_order_id || req.body?.order_id || "");

    const result = await bindCheckoutContextToOrder({ checkout_ref, sr_order_id });
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("finalizeCheckoutContext error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/shiprocket/webhook/product/:productId
   Manually trigger Product Update webhook to Shiprocket.
   Protected by requireAdmin middleware in routes.js.
───────────────────────────────────────────────────────────── */
const triggerProductWebhook = async (req, res) => {
  try {
    const productId = toInt(req.params.productId, 0);
    if (!productId) {
      return res.status(400).json({ success: false, message: "Invalid productId" });
    }
    const result = await sendProductUpdateWebhook(productId);
    if (!result.success) {
      return res.status(502).json({ success: false, message: "Webhook failed", error: result.error });
    }
    return res.json({ success: true, shiprocket_response: result.data });
  } catch (err) {
    console.error("triggerProductWebhook error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/shiprocket/webhook/collection/:categoryId
   Manually trigger Collection Update webhook to Shiprocket.
   Protected by requireAdmin middleware in routes.js.
───────────────────────────────────────────────────────────── */
const triggerCollectionWebhook = async (req, res) => {
  try {
    const categoryId = toInt(req.params.categoryId, 0);
    if (!categoryId) {
      return res.status(400).json({ success: false, message: "Invalid categoryId" });
    }
    const result = await sendCollectionUpdateWebhook(categoryId);
    if (!result.success) {
      return res.status(502).json({ success: false, message: "Webhook failed", error: result.error });
    }
    return res.json({ success: true, shiprocket_response: result.data });
  } catch (err) {
    console.error("triggerCollectionWebhook error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  fetchProducts,
  fetchProductsByCollection,
  fetchCollections,
  getCheckoutToken,
  completeCheckoutFromShiprocket,
  finalizeCheckoutContext,
  registerRedirectOrderId,
  triggerProductWebhook,
  triggerCollectionWebhook,
};
