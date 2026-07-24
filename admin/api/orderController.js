const db = require("../config/db");
const crypto = require("crypto");
const https = require("https");
const { getSessionUser } = require("./session");
const { getCartIdentity } = require("./cartController");
const {
  validateAndLockCoupon,
  recordCouponUsage,
} = require("./couponController");
const { renderInvoice } = require("./invoiceTemplate");

const toStr = (val) => {
  if (val === undefined || val === null) return "";
  return String(val).trim();
};

const toAmount = (val) => {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (val, fallback = 0) => {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

const calculateInclusiveTax = (lineTotal, taxPercent, discountShare = 0) => {
  // Prices are tax-inclusive. Extract GST: tax = taxable × rate / (100 + rate)
  const taxable = Math.max(0, toAmount(lineTotal) - toAmount(discountShare));
  const rate = toAmount(taxPercent);
  return rate > 0 ? toAmount((taxable * rate) / (100 + rate)) : 0;
};

const normalizePhone = (raw) => {
  const digits = toStr(raw).replace(/\D/g, ""); // strip spaces, +, dashes, etc.
  return digits.length >= 10 ? digits.slice(-10) : digits; // always clean 10-digit
};

// Tolerance per item — accounts for floating-point accumulation across many items.
// e.g. 4 items each ₹249.99 sum to 999.96 but stored subtotal may be 999.99.
const MONEY_EPSILON_PER_ITEM = 0.02;

function normalizeOrderLineItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      order_item_id: Number(item.order_item_id || 0),
      line_total: toAmount(item.line_total),
    }))
    .sort((a, b) => a.order_item_id - b.order_item_id);
}

// Selects the correct line items for an order from potentially dirty data.
function selectEffectiveOrderItems(items, targetSubtotal) {
  const sorted = normalizeOrderLineItems(items);
  if (!sorted.length) return [];

  const target = toAmount(targetSubtotal);

  // No stored subtotal → nothing to match against; return everything.
  if (!(target > 0)) return sorted;

  // Pass 1: tight tolerance (0.02 per item in the candidate set).
  // Pass 2: relaxed tolerance (0.50 per item) for heavily rounded prices.
  const passes = [MONEY_EPSILON_PER_ITEM, 0.5];

  for (const epsilonPerItem of passes) {
    let runningTotal = 0;
    for (let start = sorted.length - 1; start >= 0; start -= 1) {
      runningTotal += sorted[start].line_total;
      const itemCount = sorted.length - start;
      const tolerance = epsilonPerItem * itemCount;
      if (Math.abs(runningTotal - target) <= tolerance) {
        return sorted.slice(start);
      }
    }
  }

  // Fallback: subtotal is stored but no suffix matched at all.
  return sorted;
}

function buildOrderItemMap(items) {
  const map = new Map();
  for (const item of normalizeOrderLineItems(items)) {
    const key = Number(item.order_id || 0);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || "India";

const axios = require("axios");
const { sendEmail: sendBrevoEmail } = require('./mailer');
const { getShiprocketToken } = require('./shiprocketAuth');

// ================================
// CREATE SHIPROCKET ORDER
// ================================

async function createShiprocketOrder(orderData) {
  try {
    const token = await getShiprocketToken();

    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      orderData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    // ✅ Log the FULL Shiprocket error response, not just message
    const shiprocketError = error.response?.data;
    console.error(
      "Shiprocket Order Error (full):",
      JSON.stringify(shiprocketError, null, 2),
    );
    console.error("Shiprocket Status Code:", error.response?.status);
    console.error("Payload sent:", JSON.stringify(orderData, null, 2));

    // ✅ Throw with real details so the catch above can log them too
    const err = new Error("Failed to create Shiprocket order");
    err.shiprocketError = shiprocketError;
    throw err;
  }
}

// ================================
// ASSIGN COURIER + GENERATE AWB
// ================================

async function generateAWB(shipment_id, courierId) {
  const token = await getShiprocketToken();

  const response = await axios.post(
    "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
    {
      shipment_id,
      courier_id: courierId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

async function resolveProductCategoryForWigzo(productId) {
  if (!productId) return { category: "", type: "" };
  try {
    const [[primaryCat]] = await db.query(
      `SELECT c.category_id, c.category_name, c.parent_id
       FROM tbl_products_category_link l
       JOIN tbl_products_category c ON c.category_id = l.category_id
       WHERE l.product_id = ?
       ORDER BY l.category_id ASC
       LIMIT 1`,
      [productId],
    );
    if (!primaryCat) return { category: "", type: "" };

    let parentName = primaryCat.category_name;
    if (primaryCat.parent_id && primaryCat.parent_id !== 0) {
      const [[parentCat]] = await db.query(
        `SELECT category_name FROM tbl_products_category WHERE category_id = ? LIMIT 1`,
        [primaryCat.parent_id],
      );
      if (parentCat) parentName = parentCat.category_name;
    }
    return { category: primaryCat.category_name || "", type: parentName || "" };
  } catch (err) {
    console.error("[wigzo] resolveProductCategoryForWigzo failed (non-fatal):", err.message);
    return { category: "", type: "" };
  }
}

async function getShippingRate(req, res) {
  try {
    const token = await getShiprocketToken();

    const user = getSessionUser(req);
    const userId = user ? user.id : 0;
    const { key, value } = getCartIdentity(req);

    const { pincode, cod = 0, declared_value = 599 } = req.body;

    // Fetch cart items
    let cartItems = [];

    if (userId) {
      [cartItems] = await db.query(
        "SELECT * FROM cart_items WHERE user_id = ?",
        [userId],
      );
    } else if (key === "cookie_id") {
      [cartItems] = await db.query(
        "SELECT * FROM cart_items WHERE cookie_id = ? AND user_id IS NULL",
        [value],
      );
    } else {
      [cartItems] = await db.query(
        "SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL",
        [value],
      );
    }

    // Same logic as placeOrder()
    let totalWeight = 0;
    let maxLength = 1;
    let maxBreadth = 1;
    let totalHeight = 1;

    for (const item of cartItems) {
      const checkId =
        item.variation_id && Number(item.variation_id) > 0
          ? item.variation_id
          : item.product_id;

      const [metaRows] = await db.query(
        `SELECT meta_key, meta_value
         FROM tbl_productmeta
         WHERE product_id = ?
         AND meta_key IN ('length','breadth','height','weight')`,
        [checkId],
      );

      const meta = {};

      metaRows.forEach((row) => {
        meta[row.meta_key] = Number(row.meta_value || 0);
      });

      const qty = Number(item.quantity || 1);

      const length = meta.length || 10;
      const breadth = meta.breadth || 10;
      const height = meta.height || 2;
      const weight = meta.weight || 0.5;

      totalWeight += weight * qty;
      totalHeight += height * qty;

      maxLength = Math.max(maxLength, length);
      maxBreadth = Math.max(maxBreadth, breadth);
    }


    const response = await axios.get(
      "https://apiv2.shiprocket.in/v1/external/courier/serviceability",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE,

          delivery_postcode: pincode,

          cod: cod ? 1 : 0,

          weight: totalWeight,
          length: maxLength,
          breadth: maxBreadth,
          height: totalHeight,

          declared_value: Number(declared_value),
        },
      },
    );

    const couriers = response.data?.data?.available_courier_companies || [];

    if (!couriers.length) {
      return res.json({
        success: false,
        message: "No courier available",
      });
    }

    const getRate = (c) =>
      Number(c.freight_charge ?? c.rate ?? c.courier_charge ?? 0);

    couriers.sort((a, b) => getRate(a) - getRate(b));

    const selected = couriers[0];

    console.log(
      "Selected courier:",
      selected.courier_company_id,
      selected.courier_name,
      getRate(selected),
    );
    
    console.log({
      weight: totalWeight,
      length: maxLength,
      breadth: maxBreadth,
      height: totalHeight,
      rate: getRate(selected),
    });

    return res.json({
      success: true,
      rate: getRate(selected),
      courier_company_id: selected.courier_company_id,
      courier_name: selected.courier_name,
      etd: selected.etd,
      is_surface: Boolean(selected.is_surface),
    });
  } catch (error) {
    console.log(error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to get shipping rate",
    });
  }
}

async function getTrackingStatus(req, res) {
  try {
    const token = await getShiprocketToken();

    const { awb } = req.params;

    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 8000,
      },
    );

    const tracking = response.data?.tracking_data;

    const shiprocketStatus =
      (tracking?.shipment_track?.[0]?.current_status || "Pending").toUpperCase().trim();

    // Aligned with SR_STATUS_MAP in shiprocketorderwebhook.js.
    // AWB is always present here (it's the route param), so processing-tier
    // statuses resolve to "Ready to Ship" rather than "processing".
    const statusMap = {
      "NEW":                           "Ready to Ship",
      "PICKUP SCHEDULED":              "Ready to Ship",
      "PICKUP ERROR":                  "Ready to Ship",
      "PICKUP QUEUED":                 "Ready to Ship",
      "PICKUP GENERATED":              "Ready to Ship",
      "PICKED UP":                     "Shipped",
      "IN TRANSIT":                    "Shipped",
      "REACHED AT SOURCE HUB":         "Shipped",
      "REACHED AT DESTINATION HUB":    "Shipped",
      "OUT FOR DELIVERY":              "Out for Delivery",
      "DELIVERED":                     "Delivered",
      "CANCELLED":                     "cancelled",
      "RTO INITIATED":                 "Return Initiated",
      "RTO IN TRANSIT":                "Return Initiated",
      "RTO OUT FOR PICKUP":            "Return Initiated",
      "RTO PICKED":                    "Return Initiated",
      "RTO DELIVERED":                 "Returned",
      "SHIPMENT RETURN":               "Return Initiated",
      "UNDELIVERED":                   "Undelivered",
      "DELAYED":                       "Delayed",
      "DAMAGED":                       "Damaged",
      "LOST":                          "Lost",
    };

    const finalStatus = statusMap[shiprocketStatus] || shiprocketStatus;

    // ── Guard: never let a live tracking pull overwrite an order that's
    // already in a cancelled / cancellation-in-progress / terminal state.
    // This route is called on every page load (a read), so without this
    // guard, simply viewing the tracking page while ops is manually
    // cancelling on the Shiprocket panel could silently revert
    // "cancellation_requested" back to "Shipped" — bypassing stock
    // restoration and notifications entirely. Cancellation status changes
    // must only happen through cancelShiprocketOrder / updateOrderStatus /
    // receiveShipmentWebhook, never here.
    const PROTECTED_STATUSES = [
      "cancelled", "cancellation_requested", "refunded", "failed",
      "Delivered", "Returned",
    ];
    const [[currentOrderRow]] = await db.query(
      `SELECT order_status FROM tbl_orders WHERE awb_code = ? AND order_type = 'shop_order' LIMIT 1`,
      [awb],
    );
    const isProtected = currentOrderRow && PROTECTED_STATUSES.includes(currentOrderRow.order_status);
    if (isProtected) {
      console.log(`[getTrackingStatus] Skipping order_status overwrite for awb=${awb} — order is in protected status "${currentOrderRow.order_status}"`);
    } else {
      await db.query(
        `UPDATE tbl_orders SET order_status = ? WHERE awb_code = ?`,
        [finalStatus, awb],
      );
    }

    // While protected, report the real local status (e.g. "cancelled") rather
    // than the raw courier status, so the UI doesn't show conflicting info.
    return res.json({
      success: true,
      current_status: isProtected ? currentOrderRow.order_status : finalStatus,
      activities: tracking?.shipment_track_activities || [],
    });
  } catch (error) {
    console.log("Tracking Error:", error.response?.data || error.message);

    // Fallback: return stored activity log from ordermeta so UI shows cached data
    try {
      const [[order]] = await db.query(
        `SELECT order_id, order_status FROM tbl_orders WHERE awb_code = ? AND order_type = 'shop_order' LIMIT 1`,
        [req.params.awb],
      );
      if (order) {
        const [activityRows] = await db.query(
          `SELECT meta_value FROM tbl_ordermeta
           WHERE order_id = ? AND meta_key = '_shipment_activity'
           ORDER BY meta_id ASC`,
          [order.order_id],
        );
        const parsed = activityRows
          .map((r) => { try { return JSON.parse(r.meta_value); } catch { return null; } })
          .filter(Boolean);
        return res.json({
          success: true,
          current_status: order.order_status || "",
          activities: parsed,
          source: "cached",
        });
      }
    } catch (fallbackErr) {
      console.error("Tracking fallback error:", fallbackErr.message);
    }

    return res.status(500).json({ success: false });
  }
}

const SHIPROCKET_TRACKING_STATUS_MAP = {
  "NEW":                           "Ready to Ship",
  "PICKUP SCHEDULED":              "Ready to Ship",
  "PICKUP ERROR":                  "Ready to Ship",
  "PICKUP QUEUED":                 "Ready to Ship",
  "PICKUP GENERATED":              "Ready to Ship",
  "PICKUP EXCEPTION":              "Ready to Ship",
  "PICKUP RESCHEDULED":            "Ready to Ship",
  "OUT FOR PICKUP":                "Ready to Ship",
  "MANIFEST GENERATED":            "Ready to Ship",
  "AWB ASSIGNED":                  "Ready to Ship",
  "FUTURE_PICKUP":                 "Ready to Ship",
  "PICKED UP":                     "Shipped",
  "IN TRANSIT":                    "Shipped",
  "REACHED AT SOURCE HUB":         "Shipped",
  "REACHED AT DESTINATION HUB":    "Shipped",
  "MISROUTED":                     "Shipped",
  "DELAYED":                       "Shipped",
  "DAMAGED":                       "Shipped",
  "LOST":                          "Shipped",
  "OUT FOR DELIVERY":              "Out for Delivery",
  "UNDELIVERED":                   "Out for Delivery",
  "DELIVERED":                     "Delivered",
  "CANCELLED":                     "cancelled",
  "RTO INITIATED":                 "Return Initiated",
  "RTO IN TRANSIT":                "Return Initiated",
  "RTO OUT FOR PICKUP":            "Return Initiated",
  "RTO PICKED":                    "Return Initiated",
  "RTO DELIVERED":                 "Returned",
  "SHIPMENT RETURN":               "Return Initiated",
  "DESTROYED":                     "Return Initiated",
  "QC FAILED":                     "Ready to Ship",
};

function mapShiprocketTrackingStatus(rawStatus) {
  const key = toStr(rawStatus).toUpperCase().trim();
  return SHIPROCKET_TRACKING_STATUS_MAP[key] || key;
}

function extractShiprocketTrackingIdentity(trackingData = {}) {
  const track = trackingData?.shipment_track?.[0] || {};
  return {
    rawStatus: toStr(track.current_status || trackingData.current_status || ""),
    awb: toStr(track.awb_code || track.awb || trackingData.awb_code || trackingData.awb || ""),
    courier: toStr(track.courier_name || trackingData.courier_name || ""),
  };
}

async function syncShipmentByShipmentId(orderId, shipmentId) {
  const cleanShipmentId = toStr(shipmentId);
  if (!cleanShipmentId) return null;

  const token = await getShiprocketToken();
  const srRes = await axios.get(
    `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${encodeURIComponent(cleanShipmentId)}`,
    { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
  );
  const trackingData = srRes.data?.tracking_data || {};
  const identity = extractShiprocketTrackingIdentity(trackingData);
  const mappedStatus = identity.rawStatus
    ? mapShiprocketTrackingStatus(identity.rawStatus)
    : "";

  const fields = [];
  const params = [];
  if (identity.awb) {
    fields.push("awb_code = ?");
    params.push(identity.awb);
  }
  if (identity.courier) {
    fields.push("courier_name = ?");
    params.push(identity.courier);
  }
  if (mappedStatus) {
    fields.push("order_status = ?");
    params.push(mappedStatus);
  }
  if (fields.length) {
    fields.push("order_modified = NOW()");
    params.push(orderId);
    await db.query(
      `UPDATE tbl_orders SET ${fields.join(", ")} WHERE order_id = ?`,
      params,
    );
  }

  return { ...identity, status: mappedStatus, activities: trackingData.shipment_track_activities || [] };
}

function formatMoney(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function buildOrderName() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  // crypto.randomBytes gives a cryptographically strong suffix — no collision risk
  // unlike Math.random() which shares a ~32-bit PRNG state across all requests.
  const suffix = crypto.randomBytes(3).toString("hex"); // 6 hex chars = 16M possibilities
  return `order-${stamp}-${suffix}`;
}
function sanitizeBilling(billing) {
  const b = billing || {};
  return {
    first_name: toStr(b.first_name),
    last_name: toStr(b.last_name),
    email: toStr(b.email),
    phone: toStr(b.phone),
    address: toStr(b.address),
    address_2: toStr(b.address_2),
    city: toStr(b.city),
    state: toStr(b.state),
    postcode: toStr(b.postcode),
    country: DEFAULT_COUNTRY,
    company: toStr(b.company),
  };
}

function sanitizeShipping(shipping, billing) {
  const s = shipping || {};
  const b = billing || {};
  return {
    first_name: toStr(s.first_name || b.first_name),
    last_name: toStr(s.last_name || b.last_name),
    phone: toStr(s.phone || b.phone),
    address: toStr(s.address || b.address),
    address_2: toStr(s.address_2 || b.address_2),
    city: toStr(s.city || b.city),
    state: toStr(s.state || b.state),
    postcode: toStr(s.postcode || b.postcode),
    country: DEFAULT_COUNTRY,
  };
}

function validateBilling(billing) {
  const errors = {};
  if (!billing.first_name) errors.first_name = "First name required";
  if (!billing.last_name) errors.last_name = "Last name required";
  if (!billing.email) errors.email = "Email required";
  if (!billing.phone) errors.phone = "Phone required";
  if (!billing.address) errors.address = "Address required";
  if (!billing.city) errors.city = "City required";
  if (!billing.state) errors.state = "State required";
  if (!billing.postcode) errors.postcode = "Postcode required";
  return errors;
}

const PROFILE_META_KEYS = [
  "first_name",
  "last_name",
  "billing_first_name",
  "billing_last_name",
  "billing_address_1",
  "billing_address_2",
  "billing_city",
  "billing_state",
  "billing_postcode",
  "billing_country",
  "billing_company",
  "billing_phone",
  "shipping_first_name",
  "shipping_last_name",
  "shipping_address_1",
  "shipping_address_2",
  "shipping_city",
  "shipping_state",
  "shipping_postcode",
  "shipping_country",
  "shipping_company",
  "shipping_phone",
];

async function getUserMetaMap(userId) {
  const [rows] = await db.query(
    `SELECT meta_key, meta_value
     FROM tbl_usermeta
     WHERE user_id = ? AND meta_key IN (?)`,
    [userId, PROFILE_META_KEYS],
  );

  return rows.reduce((acc, row) => {
    acc[row.meta_key] = toStr(row.meta_value);
    return acc;
  }, {});
}

async function upsertUserMeta(conn, userId, metaKey, metaValue) {
  await conn.query(
    `INSERT INTO tbl_usermeta (user_id, meta_key, meta_value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
    [userId, metaKey, toStr(metaValue)],
  );
}

function normalizeProfileAddressInput(payload, kind) {
  const prefix = kind === "billing" ? "billing" : "shipping";

  return {
    firstName: toStr(payload.firstName),
    lastName: toStr(payload.lastName),
    email: toStr(payload.email),
    phone: toStr(payload.phone),
    company: toStr(payload.company),
    address1: toStr(payload.address1),
    address2: toStr(payload.address2),
    city: toStr(payload.city),
    state: toStr(payload.state),
    postcode: toStr(payload.postcode),
    country: DEFAULT_COUNTRY,
    meta: {
      [`${prefix}_first_name`]: toStr(payload.firstName),
      [`${prefix}_last_name`]: toStr(payload.lastName),
      [`${prefix}_address_1`]: toStr(payload.address1),
      [`${prefix}_address_2`]: toStr(payload.address2),
      [`${prefix}_city`]: toStr(payload.city),
      [`${prefix}_state`]: toStr(payload.state),
      [`${prefix}_postcode`]: toStr(payload.postcode),
      [`${prefix}_country`]: DEFAULT_COUNTRY,
      [`${prefix}_company`]: toStr(payload.company),
      [`${prefix}_phone`]: toStr(payload.phone),
    },
  };
}

function validateProfileAddress(address) {
  const errors = {};
  if (!address.firstName) errors.firstName = "First name required";
  if (!address.lastName) errors.lastName = "Last name required";
  if (!address.address1) errors.address1 = "Address required";
  if (!address.city) errors.city = "City required";
  if (!address.state) errors.state = "State required";
  if (!address.postcode) errors.postcode = "Postcode required";
  return errors;
}

function buildProfileAddressResponse(userRow, meta) {
  return buildProfileAddressResponseWithFallback(userRow, meta, {});
}

function buildProfileAddressResponseWithFallback(userRow, meta, fallback) {
  const billingFallback = fallback.billing || {};
  const shippingFallback = fallback.shipping || {};

  return {
    billing: {
      firstName: toStr(
        meta.billing_first_name || meta.first_name || userRow.display_name,
      ),
      lastName: toStr(meta.billing_last_name || meta.last_name),
      email: toStr(userRow.user_email),
      phone: toStr(meta.billing_phone),
      company: toStr(meta.billing_company),
      address1: toStr(meta.billing_address_1 || billingFallback.address1),
      address2: toStr(meta.billing_address_2 || billingFallback.address2),
      city: toStr(meta.billing_city || billingFallback.city),
      state: toStr(meta.billing_state || billingFallback.state),
      postcode: toStr(meta.billing_postcode || billingFallback.postcode),
      country: DEFAULT_COUNTRY,
    },
    shipping: {
      firstName: toStr(
        meta.shipping_first_name || meta.first_name || userRow.display_name,
      ),
      lastName: toStr(meta.shipping_last_name || meta.last_name),
      email: toStr(userRow.user_email),
      phone: toStr(meta.shipping_phone),
      company: toStr(meta.shipping_company),
      address1: toStr(meta.shipping_address_1 || shippingFallback.address1),
      address2: toStr(meta.shipping_address_2 || shippingFallback.address2),
      city: toStr(meta.shipping_city || shippingFallback.city),
      state: toStr(meta.shipping_state || shippingFallback.state),
      postcode: toStr(meta.shipping_postcode || shippingFallback.postcode),
      country: DEFAULT_COUNTRY,
    },
  };
}

async function getLatestOrderAddressFallback(userId) {
  const [rows] = await db.query(
    `SELECT ua.address_billing,
            ua.address_line1,
            ua.address_line2,
            ua.city,
            ua.state_name,
            ua.zipcode
     FROM tbl_user_address ua
     JOIN tbl_orders o ON o.order_id = ua.order_id
     WHERE ua.user_id = ?
       AND ua.order_id IS NOT NULL
       AND o.order_type = 'shop_order'
     ORDER BY o.order_date DESC, ua.address_id DESC`,
    [userId],
  );

  const fallback = { billing: {}, shipping: {} };
  for (const row of rows) {
    if (row.address_billing === "yes" && !fallback.billing.address1) {
      fallback.billing = {
        address1: toStr(row.address_line1),
        address2: toStr(row.address_line2),
        city: toStr(row.city),
        state: toStr(row.state_name),
        postcode: toStr(row.zipcode),
      };
    }

    if (row.address_billing !== "yes" && !fallback.shipping.address1) {
      fallback.shipping = {
        address1: toStr(row.address_line1),
        address2: toStr(row.address_line2),
        city: toStr(row.city),
        state: toStr(row.state_name),
        postcode: toStr(row.zipcode),
      };
    }

    if (fallback.billing.address1 && fallback.shipping.address1) {
      break;
    }
  }

  return fallback;
}

// insertAddress helper
async function insertAddress(
  conn,
  { userId, orderId, address, isBilling, createdAt, notes = null },
) {
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
      0, NULL, 226, ?,
      ?, '', '', ?, ?, 'no')`,
    [
      userId, // user_id
      orderId, // order_id  (always a real ID for order rows)
      address.firstName || "", // first_name
      address.lastName || "", // last_name
      address.phone || "", // phone
      address.line1 || "", // address_line1
      address.line2 || "", // address_line2
      address.city || "", // city
      address.zip || "", // zipcode
      address.state || "", // state_name
      notes, // address_notes
      isBilling ? "yes" : "no", // address_billing ? 'yes'=billing, 'no'=shipping
      createdAt, // created_at
      createdAt, // updated_at
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrder
// ─────────────────────────────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const user = getSessionUser(req);
  const { key, value, cookieId, sessionId } = getCartIdentity(req);
  const requestedCartItemIds = Array.isArray(req.body.cart_item_ids)
    ? [
        ...new Set(
          req.body.cart_item_ids
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ]
    : [];

  const billing = sanitizeBilling(req.body.billing);
  const shipping = sanitizeShipping(req.body.shipping, billing);
  const paymentMethod = toStr(req.body.payment_method) || "cod";
  const shippingCost = toAmount(req.body.shipping_cost || 0);
  const orderNotes = toStr(req.body.notes) || null;
  const appliedCoupon = req.sessionData?.appliedCoupon || null;

  const razorpayPaymentId = req.body.razorpay_payment_id || null;
  const razorpayOrderId = req.body.razorpay_order_id || null;
  const razorpaySignature = req.body.razorpay_signature || null;

  const billingErrors = validateBilling(billing);
  if (Object.keys(billingErrors).length) {
    return res.status(400).json({
      success: false,
      message: "Invalid billing details.",
      errors: billingErrors,
    });
  }

  // ── 0. Resolve userId — guest checkout gets a real row in tbl_users ─────────
  let userId = user ? user.id : 0;

  if (!user) {
    const guestEmail   = billing.email.toLowerCase().trim();
    const guestDisplay = `${billing.first_name} ${billing.last_name}`.trim();

    try {
      // INSERT IGNORE: silently skips if email already exists (duplicate key).
      // Works only when tbl_users has: UNIQUE KEY `uq_user_email` (`user_email`)
      // Run once on DB: ALTER TABLE tbl_users ADD UNIQUE KEY `uq_user_email` (`user_email`);
      await db.query(
        `INSERT IGNORE INTO tbl_users
         (user_type, user_login, user_pass, user_nicename, user_email, display_name, user_registered)
         VALUES (4, ?, '', ?, ?, ?, NOW())`,
        [guestEmail, guestEmail, guestEmail, guestDisplay]
      );

      // Always re-fetch after INSERT IGNORE — whether we just inserted
      // or the IGNORE fired (row already existed), this gives the correct ID.
      const [[guestRow]] = await db.query(
        `SELECT ID FROM tbl_users WHERE user_email = ? LIMIT 1`,
        [guestEmail]
      );
      userId = guestRow ? guestRow.ID : 0;

    } catch (guestErr) {
      // Non-fatal fallback — order still placed with userId=0 so checkout
      // is never blocked by a DB issue on this upsert.
      console.error("Guest user upsert failed (order will use userId=0):", guestErr.message);
      userId = 0;
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Fetch cart items ─────────────────────────────────────────────────
    let cartItems;
    if (user) {
      // Real logged-in user — cart rows carry user_id
      [cartItems] = await conn.query(
        "SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
      );
    } else if (key === "cookie_id") {
      [cartItems] = await conn.query(
        "SELECT * FROM cart_items WHERE cookie_id = ? AND user_id IS NULL ORDER BY created_at DESC",
        [value],
      );
    } else {
      [cartItems] = await conn.query(
        "SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC",
        [value],
      );
    }

    if (requestedCartItemIds.length > 0) {
      const requestedSet = new Set(requestedCartItemIds);
      cartItems = cartItems.filter((item) => requestedSet.has(Number(item.id)));

      if (cartItems.length !== requestedCartItemIds.length) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Your cart changed before checkout. Please refresh the page and try again.",
        });
      }
    }

    if (!cartItems.length) {
      await conn.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Cart is empty." });
    }

    // ── 1b. Stock check for all cart items (with row locking for race safety) ──
    for (const item of cartItems) {
      const checkId =
        item.variation_id && item.variation_id > 0
          ? item.variation_id
          : item.product_id;
      const qty = Number(item.quantity || 0);

      // FOR UPDATE locks these rows so two simultaneous orders can't both pass
      const [[stockStatusRow]] = await conn.query(
        `SELECT meta_value AS stock_status
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = '_stock_status'
         ORDER BY meta_id DESC
         LIMIT 1
         FOR UPDATE`,
        [checkId],
      );

      const [[stockQtyRow]] = await conn.query(
        `SELECT CAST(meta_value AS SIGNED) AS stock
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = '_stock'
         ORDER BY meta_id DESC
         LIMIT 1
         FOR UPDATE`,
        [checkId],
      );

      const stockStatus = stockStatusRow
        ? stockStatusRow.stock_status
        : "instock";
      const stockQty = stockQtyRow ? stockQtyRow.stock : 0;

      if (stockStatus === "outofstock") {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `"${item.title || "A product in your cart"}" is out of stock. Please remove it before placing your order.`,
        });
      }

      if (stockQty < qty) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `"${item.title || "A product in your cart"}" only has ${stockQty} left in stock but you ordered ${qty}. Please update your cart.`,
        });
      }
    }

    // ── 2. Fetch live prices from DB (never trust cart_items.price) ──────────
    // This prevents price-tampering via Burp Suite / DevTools and ensures
    // the customer always pays the current admin-configured price.
    for (const item of cartItems) {
      const checkId =
        item.variation_id && Number(item.variation_id) > 0
          ? item.variation_id
          : item.product_id;

      const [[priceRow]] = await conn.query(
        `SELECT CAST(meta_value AS DECIMAL(10,2)) AS price
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = '_price'
         ORDER BY meta_id DESC LIMIT 1`,
        [checkId],
      );

      // If variation had no price, fall back to parent product price
      let livePrice = priceRow ? Number(priceRow.price) : null;
      if (livePrice === null) {
        const [[parentPriceRow]] = await conn.query(
          `SELECT CAST(meta_value AS DECIMAL(10,2)) AS price
           FROM tbl_productmeta
           WHERE product_id = ? AND meta_key = '_price'
           ORDER BY meta_id DESC LIMIT 1`,
          [item.product_id],
        );
        livePrice = parentPriceRow ? Number(parentPriceRow.price) : 0;
      }

      const [[taxRow]] = await conn.query(
        `SELECT CAST(meta_value AS DECIMAL(10,2)) AS tax_percent
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = 'tax'
         ORDER BY meta_id DESC LIMIT 1`,
        [checkId],
      );
      let liveTaxPercent = taxRow ? Number(taxRow.tax_percent) : null;
      if (liveTaxPercent === null) {
        const [[parentTaxRow]] = await conn.query(
          `SELECT CAST(meta_value AS DECIMAL(10,2)) AS tax_percent
           FROM tbl_productmeta
           WHERE product_id = ? AND meta_key = 'tax'
           ORDER BY meta_id DESC LIMIT 1`,
          [item.product_id],
        );
        liveTaxPercent = parentTaxRow ? Number(parentTaxRow.tax_percent) : 0;
      }

      // Fetch live title from tbl_products
      const [[titleRow]] = await conn.query(
        `SELECT product_title FROM tbl_products WHERE ID = ? LIMIT 1`,
        [item.product_id],
      );

      // Overwrite the in-memory item — cart_items row is NOT updated here;
      // getCart already returns live data. We just need the correct value
      // for this order's subtotal and order_items records.
      item.price = livePrice;
      item.tax_percent = liveTaxPercent;
      if (titleRow && titleRow.product_title) {
        item.title = titleRow.product_title;
      }
    }

    // ── 2b. Calculate totals with verified live prices ────────────────────────
    const subtotal = cartItems.reduce(
      (sum, item) => sum + toAmount(item.price) * Number(item.quantity || 0),
      0,
    );

    // Re-validate coupon inside the transaction with FOR UPDATE locking
    // This prevents race conditions (two users using the last coupon slot).
    const productIds = cartItems
      .map((i) => Number(i.product_id))
      .filter(Boolean);
    const couponCheck = await validateAndLockCoupon(
      conn,
      appliedCoupon,
      userId,
      subtotal,
      productIds,
      cartItems,
    );
    if (!couponCheck.ok) {
      await conn.rollback();
      delete req.sessionData.appliedCoupon;
      req.touchSession();
      return res.status(400).json({
        success: false,
        coupon_error: true,
        message: couponCheck.message,
      });
    }
    const discount = couponCheck.discount || 0;

    // Prices are tax-inclusive — extract GST component: tax = taxable × rate / (100 + rate)
    const taxTotal = cartItems.reduce((sum, item) => {
      const lineSubtotal = toAmount(item.price) * Number(item.quantity || 0);
      const discountShare = subtotal > 0 ? (discount * lineSubtotal) / subtotal : 0;
      return sum + calculateInclusiveTax(lineSubtotal, item.tax_percent, discountShare);
    }, 0);
    // Tax is already inside subtotal — do NOT add taxTotal again
    const total = Math.max(0, subtotal - discount) + shippingCost;

    if (paymentMethod === "razorpay" && !razorpayPaymentId) {
      const razorpay = require("../config/razorpay");

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });

      await conn.rollback();

      return res.json({
        success: true,
        razorpay: true,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      });
    }

    let razorpayMethodType = null; // e.g. 'card', 'upi', 'netbanking', 'wallet'

    if (paymentMethod === "razorpay" && razorpayPaymentId) {
      const crypto = require("crypto");

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_SECRET)
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        await conn.rollback();

        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
        });
      }

      // Fetch payment details to capture the actual payment method (card/upi/netbanking/wallet)
      try {
        const razorpay = require("../config/razorpay");
        const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);
        razorpayMethodType = paymentDetails.method || null; // 'card', 'upi', 'netbanking', 'wallet'
      } catch (e) {
        console.warn("Could not fetch Razorpay payment details:", e.message);
      }
    }

    const currency =
      process.env.ORDER_CURRENCY || process.env.CURRENCY || "INR";

    // ── 3. Insert into tbl_orders ─────────────────────────────────────────────
    const orderName = buildOrderName();
    const orderTitle = `Order - ${new Date().toLocaleString()}`;

    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified)
       VALUES (0, ?, ?, ?, '', 'pending', 'shop_order', NOW(), NOW())`,
      [userId, orderName, orderTitle],
    );
    const orderId = orderResult.insertId;

    // ===================================
    // SHIPROCKET ORDER PAYLOAD
    // ===================================

    // ===================================
    // CALCULATE PACKAGE DIMENSIONS
    // ===================================

    let totalWeight = 0;
    let maxLength = 10;
    let maxBreadth = 10;
    let totalHeight = 0;

    for (const item of cartItems) {
      const checkId =
        item.variation_id && Number(item.variation_id) > 0
          ? item.variation_id
          : item.product_id;

      const [metaRows] = await conn.query(
        `SELECT meta_key, meta_value
     FROM tbl_productmeta
     WHERE product_id = ?
     AND meta_key IN ('length','breadth','height','weight')`,
        [checkId],
      );

      const meta = {};

      metaRows.forEach((row) => {
        meta[row.meta_key] = Number(row.meta_value || 0);
      });

      const qty = Number(item.quantity || 1);

      const length = meta.length || 10;
      const breadth = meta.breadth || 10;
      const height = meta.height || 2;
      const weight = meta.weight || 0.5;

      // package calculation
      maxLength = Math.max(maxLength, length);
      maxBreadth = Math.max(maxBreadth, breadth);

      totalHeight += height * qty;
      totalWeight += weight * qty;
    }

    console.log({
      length: maxLength,
      breadth: maxBreadth,
      height: totalHeight,
      weight: totalWeight,
    });

    // order_id uses stable orderId — Shiprocket Notify uses this for WhatsApp/SMS

    // Standardize fallback metrics to match your rate calculator defaults
    const finalLength = maxLength || 10;
    const finalBreadth = maxBreadth || 10;
    const finalHeight = totalHeight || 10;
    const finalWeight = totalWeight || 0.5; // Always provide a safe minimum weight (e.g., 0.5kg)

    const shiprocketPayload = {
      order_id: String(orderId), // stable, matches DB

      order_date: new Date().toISOString().slice(0, 10),

      pickup_location: "warehouse",

      billing_customer_name: billing.first_name,

      billing_last_name: billing.last_name,

      billing_address: billing.address,

      billing_address_2: billing.address_2 || "",

      billing_city: billing.city,

      billing_pincode: billing.postcode,

      billing_state: billing.state,

      billing_country: "India",

      billing_email: billing.email,

      billing_phone: normalizePhone(billing.phone),

      shipping_is_billing: true,

      order_items: cartItems.map((item) => ({
        name: item.title || "Product",

        sku: String(item.product_id),

        units: Number(item.quantity),

        selling_price: Number(item.price),

        discount: 0,
      })),

      payment_method: paymentMethod.toLowerCase() === "cod" ? "COD" : "Prepaid",

      // Prices are inclusive — sub_total = order value customers pay (tax already inside)
      sub_total: Number(Math.max(0, subtotal - discount)),

      shipping_charges: Number(shippingCost),

      total_discount: Number(discount),

      length: finalLength,

      breadth: finalBreadth,

      height: finalHeight,

      weight: finalWeight,
    };

    // ===================================
    // CREATE SHIPROCKET ORDER
    // ===================================

    let shiprocketResponse = {};

    try {
      shiprocketResponse = await createShiprocketOrder(shiprocketPayload);
    } catch (shipErr) {
      console.error("Shiprocket failed:", shipErr.message);
      console.error(
        "Shiprocket API response:",
        JSON.stringify(shipErr.shiprocketError, null, 2),
      ); // ✅
      // continues without blocking order
    }

    console.log(
      "Shiprocket Order Created:",
      shiprocketResponse,
      Number(req.body.courier_company_id),
    );

    // ===================================
    // GENERATE AWB
    // ===================================

    let awbResponse = null;

    if (
      shiprocketResponse.shipment_id &&
      shiprocketResponse.status !== "CANCELED"
    ) {
      try {
        const courierCompanyId = Number(req.body.courier_company_id);

        awbResponse = await generateAWB(
          shiprocketResponse.shipment_id,
          courierCompanyId,
        );

        console.log("AWB Generated:", awbResponse);
        await conn.query(
          `UPDATE tbl_orders
          SET shipment_id = ?,
              awb_code = ?,
              courier_name = ?,
              shipping_status = ?
          WHERE order_id = ?`,
          [
            shiprocketResponse.shipment_id || "",
            awbResponse?.response?.data?.awb_code || "",
            awbResponse?.response?.data?.courier_name || "",
            "new",
            orderId,
          ],
        );
      } catch (awbErr) {
        // AWB failure is non-fatal — order is already saved in DB.
        // Log the error and continue so the customer gets a success response.
        console.error(
          "AWB generation failed (non-fatal):",
          awbErr?.response?.data || awbErr.message,
        );
        // Still save shipment_id so admin can assign AWB manually later
        await conn
          .query(
            `UPDATE tbl_orders SET shipment_id = ?, shipping_status = ? WHERE order_id = ?`,
            [shiprocketResponse.shipment_id || "", "new", orderId],
          )
          .catch((dbErr) =>
            console.error("Failed to save shipment_id:", dbErr.message),
          );
      }
    } else if (shiprocketResponse.status === "CANCELED") {
      console.warn(
        "Shiprocket order CANCELED — skipping AWB. shipment_id:",
        shiprocketResponse.shipment_id,
      );
    }

    // end shiprocket code

    // ── 4. tbl_ordermeta: financial + payment data ONLY ──────────────────────
    //    NO address, NO contact info here
    //    name/email  → tbl_users via user_id
    //    address     → tbl_user_address via order_id
    const metaEntries = [
      ["_customer_user", userId],
      ["_payment_method", paymentMethod],
      ["_order_currency", currency],
      ["_order_total", total.toFixed(2)],
      ["_order_subtotal", subtotal.toFixed(2)],
      ["_order_tax", taxTotal.toFixed(2)],
      ["_order_shipping", shippingCost.toFixed(2)],
      ["_order_discount", discount.toFixed(2)],
      ["_session_id", sessionId],
      ["_cookie_id", cookieId || ""],
    ];

    if (appliedCoupon) {
      metaEntries.push(["_coupon_code", appliedCoupon.coupon_code]);
      metaEntries.push(["_coupon_discount", discount.toFixed(2)]);
    }

    if (paymentMethod === "razorpay") {
      metaEntries.push(["_razorpay_payment_id", razorpayPaymentId]);
      metaEntries.push(["_razorpay_order_id", razorpayOrderId]);
      if (razorpayMethodType) {
        metaEntries.push(["_razorpay_method", razorpayMethodType]);
      }
    }

    if (shiprocketResponse.shipment_id) {
      metaEntries.push(["_shiprocket_order_id", shiprocketResponse.order_id]);
      metaEntries.push([
        "_shiprocket_shipment_id",
        shiprocketResponse.shipment_id,
      ]);
      metaEntries.push([
        "_awb_code",
        awbResponse?.response?.data?.awb_code || "",
      ]);
      metaEntries.push([
        "_courier_id",
        awbResponse?.response?.data?.courier_company_id || "",
      ]);
      metaEntries.push([
        "_courier_name",
        awbResponse?.response?.data?.courier_name || "",
      ]);
      metaEntries.push([
        "_tracking_number",
        awbResponse?.response?.data?.awb_code || "",
      ]);
      metaEntries.push([
        "_freight_charges",
        awbResponse?.response?.data?.freight_charges || "",
      ]);
    }

    for (const [metaKey, metaValue] of metaEntries) {
      await conn.query(
        "INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, ?, ?)",
        [orderId, metaKey, metaValue],
      );
    }

    // ── 5. tbl_user_address: always 2 rows per order ─────────────
    const addressUserId = userId > 0 ? userId : null;
    const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Billing address row
    await insertAddress(conn, {
      userId: addressUserId,
      orderId,
      isBilling: true,
      createdAt,
      notes: orderNotes,
      address: {
        firstName: billing.first_name,
        lastName: billing.last_name,
        phone: billing.phone,
        line1: billing.address,
        line2: billing.address_2,
        city: billing.city,
        zip: billing.postcode,
        state: billing.state,
      },
    });

    // Shipping address row
    await insertAddress(conn, {
      userId: addressUserId,
      orderId,
      isBilling: false,
      createdAt,
      notes: null,
      address: {
        firstName: shipping.first_name,
        lastName: shipping.last_name,
        phone: shipping.phone,
        line1: shipping.address,
        line2: shipping.address_2,
        city: shipping.city,
        zip: shipping.postcode,
        state: shipping.state,
      },
    });

    // ── 6. tbl_order_items + tbl_order_itemmeta ───────────────────────────────
    let firstOrderItemId = null;  // captured below for Wigzo line_item_id
    let firstItemDiscount = null; // captured below for Wigzo product_discount
    for (const item of cartItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title || "Item", orderId, item.product_id],
      );
      const orderItemId = itemResult.insertId;
      if (firstOrderItemId === null) firstOrderItemId = orderItemId;

      const variationId =
        item.variation_id && Number(item.variation_id) > 0
          ? item.variation_id
          : 0;
      const lineTotal = toAmount(item.price) * Number(item.quantity || 0);
      const discountShare = subtotal > 0 ? (discount * lineTotal) / subtotal : 0;
      if (firstItemDiscount === null) firstItemDiscount = discountShare;
      // Prices are tax-inclusive — extract GST: tax = taxable × rate / (100 + rate)
      const lineTax = calculateInclusiveTax(lineTotal, item.tax_percent, discountShare);

      const itemMeta = [
        ["_product_id", item.product_id],
        ["_variation_id", variationId],
        ["_qty", item.quantity],
        ["_line_subtotal", lineTotal.toFixed(2)],
        ["_line_total", lineTotal.toFixed(2)],
        ["_line_tax", lineTax.toFixed(2)],
        ["_line_subtotal_tax", lineTax.toFixed(2)],
      ];

      if (item.color) itemMeta.push(["pa_color", item.color]);
      if (item.size) itemMeta.push(["pa_size", item.size]);
      // Save image at order time — Amazon/Flipkart pattern
      if (item.image && !item.image.includes("dummy"))
        itemMeta.push(["_item_image", item.image]);

      for (const [metaKey, metaValue] of itemMeta) {
        await conn.query(
          "INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)",
          [orderItemId, metaKey, metaValue],
        );
      }
    }

    // ── 6b. Deduct stock for each purchased item (atomic, inside transaction) ──
    for (const item of cartItems) {
      const qty = Number(item.quantity || 0);
      if (!qty) continue;

      // Use variation_id if present, otherwise product_id
      const stockProductId =
        item.variation_id && Number(item.variation_id) > 0
          ? item.variation_id
          : item.product_id;

      // Deduct stock — rows already locked by FOR UPDATE in step 1b
      await conn.query(
        `UPDATE tbl_productmeta
         SET meta_value = GREATEST(0, CAST(meta_value AS SIGNED) - ?)
         WHERE product_id = ? AND meta_key = '_stock'`,
        [qty, stockProductId],
      );

      // Re-read remaining stock and flip status to outofstock if depleted
      const [[stockResult]] = await conn.query(
        `SELECT CAST(meta_value AS SIGNED) AS stock
         FROM tbl_productmeta
         WHERE product_id = ? AND meta_key = '_stock'
         ORDER BY meta_id DESC
         LIMIT 1`,
        [stockProductId],
      );

      const remainingStock = stockResult ? stockResult.stock : 0;

      if (remainingStock <= 0) {
        await conn.query(
          `UPDATE tbl_productmeta
           SET meta_value = 'outofstock'
           WHERE product_id = ? AND meta_key = '_stock_status'`,
          [stockProductId],
        );
      }
    }

    // ── 7. Shipping cost line item ────────────────────────────────────────────
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

    // ── 8. Clear cart ──────────────────────────────────────────────────────
    if (user) {
      await conn.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
    } else if (key === "cookie_id") {
      await conn.query(
        "DELETE FROM cart_items WHERE cookie_id = ? AND user_id IS NULL",
        [value],
      );
    } else {
      await conn.query(
        "DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL",
        [value],
      );
    }

    // ── 9. Record coupon usage ────────────────────────────────────────────────
    if (appliedCoupon && couponCheck.ok) {
      await recordCouponUsage(conn, appliedCoupon, orderId, userId);
    }

    await conn.commit();

    // Clear coupon from session after successful order
    if (appliedCoupon) {
      delete req.sessionData.appliedCoupon;
      req.touchSession();
    }

    // ── Email notifications ───────────────────────────────────────────────────
    // Reads RECEIVED_EMAIL from env (same as contactController) — comma-separated.
    const OWNER_EMAILS = (process.env.RECEIVED_EMAIL || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    let emailSent = false;
    try {
      const toEmail   = billing.email;
      const toName    = `${billing.first_name} ${billing.last_name}`.trim();
      const fullName  = toName || "Customer";
      const orderDate = new Date().toLocaleString("en-IN", {
        day:    "2-digit",
        month:  "long",
        year:   "numeric",
        hour:   "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Fetch sr_cart_id saved into ordermeta (Shiprocket checkout) — null for direct checkout
      const [[srCartRow]] = await db.query(
        `SELECT meta_value FROM tbl_ordermeta WHERE meta_key = '_sr_cart_id' AND order_id = ? LIMIT 1`,
        [orderId],
      );
      const srCartId = srCartRow ? srCartRow.meta_value : null;

      // Logo served from public folder
      const siteBase = process.env.BASE_URL || process.env.SITE_URL || "https://nestcase.in";
      const logoUrl  = `${siteBase}/images/logo-white.png`;

      // ── Shared builders ─────────────────────────────────────────────────────

      // Order meta info cards
      function buildMetaCards() {
        const colWidth = srCartId ? "25%" : "33%";
        const refCard  = srCartId
          ? `<td width="25%" style="padding:0 6px;vertical-align:top;">
               <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:12px;">
                 <tr><td style="text-align:center;">
                   <div style="font-size:11px;color:#888;margin-bottom:4px;">Order Reference ID</div>
                   <div style="font-size:12px;font-weight:700;color:#222;">SR_CART_ID: ${escapeHtml(srCartId)}</div>
                 </td></tr>
               </table>
             </td>`
          : "";
        return `
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
            <tr>
              <td width="${colWidth}" style="padding:0 6px 0 0;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:12px;">
                  <tr><td style="text-align:center;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;">Order ID</div>
                    <div style="font-size:13px;font-weight:700;color:#222;">#NC${escapeHtml(String(orderId))}</div>
                  </td></tr>
                </table>
              </td>
              ${refCard}
              <td width="${colWidth}" style="padding:0 6px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:12px;">
                  <tr><td style="text-align:center;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;">Order Date</div>
                    <div style="font-size:13px;font-weight:700;color:#222;">${escapeHtml(orderDate)}</div>
                  </td></tr>
                </table>
              </td>
              <td width="${colWidth}" style="padding:0 0 0 6px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:12px;">
                  <tr><td style="text-align:center;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;">Payment Method</div>
                    <div style="font-size:13px;font-weight:700;color:#222;">Online Payment</div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>`;
      }

      // Product rows
      const productRowsHtml = cartItems.map((item) => {
        const title     = escapeHtml(item.title || "Item");
        const qty       = Number(item.quantity || 0);
        const price     = toAmount(item.price);
        const lineTotal = price * qty;
        return `
          <tr>
            <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;">
              <div style="font-size:14px;font-weight:600;color:#1b1b1b;">${title}</div>
            </td>
            <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#444;">&#8377;${formatMoney(price)}</td>
            <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#444;">${qty}</td>
            <td style="padding:14px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#1b1b1b;">&#8377;${formatMoney(lineTotal)}</td>
          </tr>`;
      }).join("");

      // Totals footer rows
      const discountRow = discount > 0
        ? `<tr>
             <td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#666;">Discount (${escapeHtml(appliedCoupon.coupon_code)})</td>
             <td style="padding:4px 12px;text-align:right;font-size:13px;color:#2e7d32;">-&#8377;${formatMoney(discount)}</td>
           </tr>`
        : "";
      const totalsHtml = `
        <tr>
          <td colspan="3" style="padding:10px 12px;text-align:right;font-size:13px;color:#666;">Subtotal</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;">&#8377;${formatMoney(subtotal)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td colspan="3" style="padding:4px 12px;text-align:right;font-size:13px;color:#666;">Shipping</td>
          <td style="padding:4px 12px;text-align:right;font-size:13px;color:#333;">&#8377;${formatMoney(shippingCost)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td colspan="3" style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:#1b1b1b;">Total</td>
          <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:#1b1b1b;">&#8377;${formatMoney(total)}</td>
        </tr>`;

      // Shipping address
      const shipName = `${escapeHtml(shipping.first_name || billing.first_name)} ${escapeHtml(shipping.last_name || billing.last_name)}`.trim();
      const shipLines = [
        shipping.address || billing.address,
        shipping.address_2 || billing.address_2,
        shipping.city || billing.city,
        ((shipping.state || billing.state) && (shipping.postcode || billing.postcode))
          ? `${shipping.state || billing.state} \u2013 ${shipping.postcode || billing.postcode}`
          : (shipping.state || billing.state || shipping.postcode || billing.postcode),
        shipping.country || billing.country,
      ].filter(Boolean).map(escapeHtml).join("<br>");
      const shipPhone = escapeHtml(shipping.phone || billing.phone || "");

      // ── Shared email body (used for both customer and owner) ─────────────────
      function buildEmailBody() {
        return `
          <!-- HEADER: white bar with logo (logo artwork is dark green, needs a light background) -->
          <tr>
            <td style="background:#ffffff;padding:20px 28px;border-bottom:1px solid #eeeeee;">
              <img src="${logoUrl}" alt="Nestcase" height="36" style="display:block;max-height:36px;border:0;" />
            </td>
          </tr>
          <!-- CONTENT -->
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,sans-serif;">
              <h2 style="margin:0 0 6px;font-size:22px;color:#1b1b1b;">New Order Received &#x1F6D2;</h2>
              <p style="margin:0 0 4px;color:#555;font-size:14px;">Hello,</p>
              <p style="margin:0 0 20px;color:#555;font-size:14px;">
                You have received a new order on your website <strong>Nestcase</strong>.<br>
                Please find the order details below.
              </p>

              ${buildMetaCards()}

              <!-- Customer Information -->
              <h3 style="margin:0 0 12px;font-size:15px;color:#1b1b1b;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">&#x1F464; Customer Information</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:14px;margin:0 0 20px;">
                <tr>
                  <td width="50%" style="padding:6px 10px;font-size:13px;color:#555;">
                    <div style="font-size:11px;color:#888;margin-bottom:3px;">Customer Name</div>
                    <div style="font-weight:600;color:#1b1b1b;">${escapeHtml(fullName)}</div>
                  </td>
                  <td width="50%" style="padding:6px 10px;font-size:13px;color:#555;">
                    <div style="font-size:11px;color:#888;margin-bottom:3px;">Email Address</div>
                    <div style="font-weight:600;color:#1b1b1b;">${escapeHtml(billing.email)}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:6px 10px;font-size:13px;color:#555;">
                    <div style="font-size:11px;color:#888;margin-bottom:3px;">Phone Number</div>
                    <div style="font-weight:600;color:#1b1b1b;">+91 ${escapeHtml(billing.phone)}</div>
                  </td>
                </tr>
              </table>

              <!-- Shipping Address -->
              <h3 style="margin:0 0 12px;font-size:15px;color:#1b1b1b;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">&#x1F4E6; Shipping Address</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
                <tr><td style="font-size:13px;color:#333;line-height:1.8;">
                  <strong>${shipName}</strong><br>
                  ${shipLines}
                  ${shipPhone ? "<br>" + shipPhone : ""}
                </td></tr>
              </table>

              <!-- Order Summary -->
              <h3 style="margin:0 0 12px;font-size:15px;color:#1b1b1b;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">&#x1F6D2; Order Summary</h3>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;margin:0 0 6px;">
                <thead>
                  <tr style="background:#f3f3f3;">
                    <th style="text-align:left;font-size:12px;padding:10px 12px;color:#555;font-weight:600;">Product Name</th>
                    <th style="text-align:center;font-size:12px;padding:10px 12px;color:#555;font-weight:600;">Price</th>
                    <th style="text-align:center;font-size:12px;padding:10px 12px;color:#555;font-weight:600;">Quantity</th>
                    <th style="text-align:right;font-size:12px;padding:10px 12px;color:#555;font-weight:600;">Total</th>
                  </tr>
                </thead>
                <tbody>${productRowsHtml}</tbody>
                <tfoot>${totalsHtml}</tfoot>
              </table>

              <!-- Payment Status -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e8e8e8;border-radius:8px;margin:0 0 20px;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1b1b1b;">Payment Status</td>
                  <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700;color:#2e7d32;">Paid</td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#888;line-height:1.6;">
                <strong>Note:</strong><br>
                This is an automated email. Please do not reply to this email.<br>
                If you have any questions, please contact us at <a href="mailto:support@nestcase.in" style="color:#555;">support@nestcase.in</a>
              </p>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#f8f8f8;padding:16px 28px;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#888;border-top:1px solid #e8e8e8;">
              This email has been sent to the following recipients:<br>
              <strong>support@nestcase.in, growbizzmedia@gmail.com</strong>
            </td>
          </tr>`;
      }

      function wrapEmailBody() {
        return `
          <div style="margin:0;padding:0;background:#f4f4f4;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
              <tr><td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
                  ${buildEmailBody()}
                </table>
              </td></tr>
            </table>
          </div>`;
      }

      const emailHtml = wrapEmailBody();

      // 1. Customer confirmation
      emailSent = await sendBrevoEmail({
        toEmail,
        toName,
        subject: `Order Confirmed - #NC${orderId} | Nestcase`,
        html:    emailHtml,
      });

      // 2. Owner notifications → all RECEIVED_EMAIL addresses (parallel)
      if (OWNER_EMAILS.length) {
        await Promise.all(
          OWNER_EMAILS.map((ownerEmail) =>
            sendBrevoEmail({
              toEmail:  ownerEmail,
              toName:   "Store Admin",
              subject:  `New Order Received - #NC${orderId} | Nestcase`,
              html:     emailHtml,
            }),
          ),
        );
      }
    } catch (emailErr) {
      console.error("Order email error:", emailErr);
    }

    // NOTE: no server-side WhatsApp/SMS push here. Order confirmation for

    res.json({
      success: true,
      data: {
        orderId,
        total: total.toFixed(2),
        discount: discount.toFixed(2),
        emailSent,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : err.message,
    });
  } finally {
    conn.release();
  }
};

// getDefaultAddress
const getDefaultAddress = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  try {
    const [[address]] = await db.query(
      `SELECT * FROM tbl_user_address
       WHERE user_id = ? AND order_id IS NULL AND address_primary = 'yes'
       ORDER BY address_id DESC LIMIT 1`,
      [user.id],
    );
    res.json({ success: true, data: address || null });
  } catch (err) {
    console.error("getDefaultAddress error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load default address." });
  }
};

// setDefaultAddress
const setDefaultAddress = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  const addressId = Number.parseInt(req.params.addressId, 10);
  if (!addressId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid address id." });
  }
  try {
    // Step 1: Remove default from all saved addresses only (NOT order rows)
    await db.query(
      `UPDATE tbl_user_address
       SET address_primary = 'no'
       WHERE user_id = ? AND order_id IS NULL`,
      [user.id],
    );
    // Step 2: Set selected saved address as default
    await db.query(
      `UPDATE tbl_user_address
       SET address_primary = 'yes'
       WHERE address_id = ? AND user_id = ? AND order_id IS NULL`,
      [addressId, user.id],
    );
    res.json({ success: true, message: "Default address updated." });
  } catch (err) {
    console.error("setDefaultAddress error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update default address." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const getRecentOrderAddresses = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  try {
    const [rows] = await db.query(
      `SELECT address_id, order_id, address_billing,
              first_name, last_name, phone,
              address_line1, address_line2, city, state_name, zipcode
       FROM tbl_user_address
       WHERE user_id = ? AND order_id IS NOT NULL
       ORDER BY order_id DESC, address_id DESC
       LIMIT 20`,
      [user.id],
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getRecentOrderAddresses error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load recent addresses." });
  }
};
// getSavedAddresses
// Returns only saved address-book rows (order_id IS NULL).
// Order rows are excluded — they are fetched via getMyOrderById.
// Frontend: GET /api/address/saved
// ─────────────────────────────────────────────────────────────────────────────
const getSavedAddresses = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  try {
    const [addresses] = await db.query(
      `SELECT address_id, address_type, address_primary,
              address_line1, address_line2, city, zipcode,
              state_name, address_notes, address_billing
       FROM tbl_user_address
       WHERE user_id = ? AND order_id IS NULL
       ORDER BY address_primary DESC, address_id DESC`,
      [user.id],
    );
    res.json({ success: true, data: addresses });
  } catch (err) {
    console.error("getSavedAddresses error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load addresses." });
  }
};

const getProfileAddresses = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  try {
    const [[userRow]] = await db.query(
      `SELECT ID, display_name, user_email
       FROM tbl_users
       WHERE ID = ?
       LIMIT 1`,
      [user.id],
    );

    if (!userRow) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const [meta, orderFallback] = await Promise.all([
      getUserMetaMap(user.id),
      getLatestOrderAddressFallback(user.id),
    ]);
    res.json({
      success: true,
      data: buildProfileAddressResponseWithFallback(
        userRow,
        meta,
        orderFallback,
      ),
    });
  } catch (err) {
    console.error("getProfileAddresses error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load profile addresses." });
  }
};

const updateProfileAddress = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }

  const kind =
    req.params.kind === "billing"
      ? "billing"
      : req.params.kind === "shipping"
        ? "shipping"
        : "";
  if (!kind) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid address type." });
  }

  const address = normalizeProfileAddressInput(req.body || {}, kind);
  const errors = validateProfileAddress(address);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Please fill all required address fields.",
      errors,
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE tbl_users
       SET user_email = CASE WHEN ? <> '' THEN ? ELSE user_email END,
           display_name = CASE
             WHEN ? <> '' AND ? = 'billing' THEN TRIM(CONCAT(?, CASE WHEN ? <> '' THEN ' ' ELSE '' END, ?))
             ELSE display_name
           END
       WHERE ID = ?`,
      [
        address.email,
        address.email,
        address.firstName,
        kind,
        address.firstName,
        address.lastName,
        address.lastName,
        user.id,
      ],
    );

    for (const [metaKey, metaValue] of Object.entries(address.meta)) {
      await upsertUserMeta(conn, user.id, metaKey, metaValue);
    }

    await conn.commit();

    const [[userRow]] = await db.query(
      `SELECT ID, display_name, user_email
       FROM tbl_users
       WHERE ID = ?
       LIMIT 1`,
      [user.id],
    );
    const meta = await getUserMetaMap(user.id);

    res.json({
      success: true,
      message: `${kind === "billing" ? "Billing" : "Shipping"} address updated successfully.`,
      data: buildProfileAddressResponse(userRow, meta),
    });
  } catch (err) {
    await conn.rollback();
    console.error("updateProfileAddress error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile address." });
  } finally {
    conn.release();
  }
};

// resolveLinkedUserIds
async function resolveLinkedUserIds(userId, sessionEmail) {
  const userIds = new Set([userId]);

  const [[userRow]] = await db.query(
    `SELECT user_email FROM tbl_users WHERE ID = ? LIMIT 1`,
    [userId],
  );
  const userEmail = (userRow && userRow.user_email) ? userRow.user_email : sessionEmail || "";

  if (userEmail) {
    const [guestByEmail] = await db.query(
      `SELECT ID FROM tbl_users
       WHERE user_type = 4 AND (user_email = ? OR user_login = ?)
       AND ID != ?`,
      [userEmail, userEmail, userId],
    );
    guestByEmail.forEach((r) => userIds.add(r.ID));

    const [ordersByEmail] = await db.query(
      `SELECT DISTINCT o.user_id
       FROM tbl_orders o
       JOIN tbl_ordermeta om ON om.order_id = o.order_id
         AND om.meta_key = '_billing_email' AND om.meta_value = ?
       WHERE o.order_type = 'shop_order' AND o.user_id != ?`,
      [userEmail, userId],
    );
    ordersByEmail.forEach((r) => userIds.add(r.user_id));
  }

  const [phoneMetaLinkedRows] = await db.query(
    `SELECT meta_key, meta_value FROM tbl_usermeta WHERE user_id = ? AND meta_key IN ('phone', 'billing_phone')`,
    [userId],
  );
  const phoneMetaLinkedMap = Object.fromEntries(phoneMetaLinkedRows.map(r => [r.meta_key, r.meta_value]));
  const rawLinkedPhone = phoneMetaLinkedMap['phone'] || phoneMetaLinkedMap['billing_phone'] || '';
  if (rawLinkedPhone) {
    const phone = rawLinkedPhone;
    // Normalize to last 10 digits for matching
    const digits10 = phone.replace(/\D/g, '').slice(-10);

    // Guest user_login can be stored as "9876543210@guest.local" or "919876543210@guest.local"
    const [guestByPhone] = await db.query(
      `SELECT ID FROM tbl_users
       WHERE user_type = 4
         AND (user_login LIKE ? OR user_login LIKE ?)
         AND ID != ?`,
      [`${digits10}@%`, `91${digits10}@%`, userId],
    );
    guestByPhone.forEach((r) => userIds.add(r.ID));

    // _billing_phone in ordermeta can be stored with or without country code
    const [ordersByPhone] = await db.query(
      `SELECT DISTINCT o.user_id
       FROM tbl_orders o
       JOIN tbl_ordermeta om ON om.order_id = o.order_id
         AND om.meta_key = '_billing_phone'
         AND (
           REPLACE(REPLACE(om.meta_value, '+', ''), ' ', '') LIKE ?
           OR REPLACE(REPLACE(om.meta_value, '+', ''), ' ', '') LIKE ?
         )
       WHERE o.order_type = 'shop_order' AND o.user_id != ?`,
      [`%${digits10}`, `%91${digits10}`, userId],
    );
    ordersByPhone.forEach((r) => userIds.add(r.user_id));
  }

  return Array.from(userIds);
}

// getMyOrders
const getMyOrders = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  try {
    // ── Resolve the user's verified phone ─────────────────────────────────────
    // OTP users store phone under 'phone'; checkout/guest users under 'billing_phone'
    const [phoneMetaRows] = await db.query(
      `SELECT meta_key, meta_value FROM tbl_usermeta
       WHERE user_id = ? AND meta_key IN ('phone', 'billing_phone')`,
      [user.id],
    );
    const phoneMetaMap = Object.fromEntries(phoneMetaRows.map(r => [r.meta_key, r.meta_value]));
    const rawPhone = phoneMetaMap['phone'] || phoneMetaMap['billing_phone'] || '';
    const verifiedPhone = rawPhone ? normalizePhone(rawPhone) : "";

    let orders;

    if (verifiedPhone) {
      const userIdList = await resolveLinkedUserIds(user.id, user.email || "");

      const [rows] = await db.query(
        `SELECT DISTINCT
           o.order_id,
           MAX(o.order_status)    AS order_status,
           MAX(o.awb_code)        AS awb_code,
           MAX(o.courier_name)    AS courier_name,
           MAX(o.shipping_status) AS shipping_status,
           MAX(o.order_date)      AS order_date,
           MAX(CAST(CASE WHEN om.meta_key = '_order_total'    THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS total,
           MAX(CAST(CASE WHEN om.meta_key = '_order_subtotal' THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS subtotal
         FROM tbl_orders o
         LEFT JOIN tbl_ordermeta om
           ON om.order_id = o.order_id
          AND om.meta_key IN ('_order_total', '_order_subtotal')
         WHERE o.order_type = 'shop_order'
           AND (
             o.user_id IN (?)
             OR o.order_id IN (
               SELECT order_id FROM tbl_ordermeta
               WHERE meta_key = '_billing_phone'
                 AND RIGHT(REPLACE(REPLACE(REPLACE(meta_value, ' ', ''), '-', ''), '+', ''), 10) = ?
             )
             OR o.order_id IN (
               SELECT order_id FROM tbl_user_address
               WHERE address_billing = 'yes'
                 AND RIGHT(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), 10) = ?
             )
           )
         GROUP BY o.order_id
         ORDER BY MAX(o.order_date) DESC`,
        [userIdList, verifiedPhone, verifiedPhone],
      );
      orders = rows;
    } else {
      // Fallback: no verified phone on file — use linked user_id list only.
      const userIdList = await resolveLinkedUserIds(user.id, user.email || "");
      const [rows] = await db.query(
        `SELECT
           o.order_id,
           MAX(o.order_status)    AS order_status,
           MAX(o.awb_code)        AS awb_code,
           MAX(o.courier_name)    AS courier_name,
           MAX(o.shipping_status) AS shipping_status,
           MAX(o.order_date)      AS order_date,
           MAX(CAST(CASE WHEN om.meta_key = '_order_total'    THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS total,
           MAX(CAST(CASE WHEN om.meta_key = '_order_subtotal' THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS subtotal
         FROM tbl_orders o
         LEFT JOIN tbl_ordermeta om
           ON om.order_id = o.order_id
          AND om.meta_key IN ('_order_total', '_order_subtotal')
         WHERE o.user_id IN (?) AND o.order_type = 'shop_order'
         GROUP BY o.order_id
         ORDER BY MAX(o.order_date) DESC`,
        [userIdList],
      );
      orders = rows;
    }

    const orderIds = orders
      .map((order) => Number(order.order_id))
      .filter(Boolean);
    if (!orderIds.length) {
      return res.json({ success: true, data: orders });
    }

    // Single query for all line items across all orders.
    // CAST inside MAX() for same reason as above.
    const [lineItems] = await db.query(
      `SELECT
         oi.order_id,
         oi.order_item_id,
         oi.order_item_name,
         MAX(CAST(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value ELSE NULL END AS DECIMAL(10,2))) AS line_total
       FROM tbl_order_items oi
       LEFT JOIN tbl_order_itemmeta oim
         ON oim.order_item_id = oi.order_item_id
        AND oim.meta_key = '_line_total'
       WHERE oi.order_id IN (?) AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_id, oi.order_item_id, oi.order_item_name
       ORDER BY oi.order_id ASC, oi.order_item_id ASC`,
      [orderIds],
    );

    const itemsByOrderId = buildOrderItemMap(lineItems);
    for (const order of orders) {
      const effectiveItems = selectEffectiveOrderItems(
        itemsByOrderId.get(Number(order.order_id)) || [],
        order.subtotal ? Number(order.subtotal) : 0,
      );
      order.item_count = effectiveItems.length;
      order.items = effectiveItems
        .map((item) => item.order_item_name)
        .filter(Boolean)
        .join(", ");
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ success: false, message: "Failed to load orders." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getAllOrders (admin)
// Frontend: GET /api/admin/orders
// ─────────────────────────────────────────────────────────────────────────────
const getAllOrders = async (_req, res) => {
  try {
    // Single JOIN instead of correlated subqueries per row.
    // CAST inside MAX() ensures numeric comparison, not lexicographic string sort.
    const [orders] = await db.query(
      `SELECT
         o.order_id,
         MAX(o.order_status)  AS order_status,
         MAX(o.order_date)    AS order_date,
         MAX(CAST(CASE WHEN om.meta_key = '_order_total'    THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS total,
         MAX(CAST(CASE WHEN om.meta_key = '_order_subtotal' THEN om.meta_value ELSE NULL END AS DECIMAL(10,2))) AS subtotal,
         MAX(u.user_email)    AS billing_email,
         MAX(u.display_name)  AS customer_name
       FROM tbl_orders o
       LEFT JOIN tbl_ordermeta om
         ON om.order_id = o.order_id
        AND om.meta_key IN ('_order_total', '_order_subtotal')
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       WHERE o.order_type = 'shop_order'
       GROUP BY o.order_id
       ORDER BY MAX(o.order_date) DESC`,
    );

    const orderIds = orders
      .map((order) => Number(order.order_id))
      .filter(Boolean);
    if (!orderIds.length) {
      return res.json({ success: true, data: orders });
    }

    // Single query for all line items across all orders.
    // CAST inside MAX() for same reason as above.
    const [lineItems] = await db.query(
      `SELECT
         oi.order_id,
         oi.order_item_id,
         oi.order_item_name,
         MAX(CAST(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value ELSE NULL END AS DECIMAL(10,2))) AS line_total
       FROM tbl_order_items oi
       LEFT JOIN tbl_order_itemmeta oim
         ON oim.order_item_id = oi.order_item_id
        AND oim.meta_key = '_line_total'
       WHERE oi.order_id IN (?) AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_id, oi.order_item_id, oi.order_item_name
       ORDER BY oi.order_id ASC, oi.order_item_id ASC`,
      [orderIds],
    );

    const itemsByOrderId = buildOrderItemMap(lineItems);
    for (const order of orders) {
      const effectiveItems = selectEffectiveOrderItems(
        itemsByOrderId.get(Number(order.order_id)) || [],
        order.subtotal ? Number(order.subtotal) : 0,
      );
      order.item_count = effectiveItems.length;
      order.items = effectiveItems
        .map((item) => item.order_item_name)
        .filter(Boolean)
        .join(", ");
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("getAllOrders error:", err);
    res.status(500).json({ success: false, message: "Failed to load orders." });
  }
};

// getMyOrderById
const getMyOrderById = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Login required." });
  }
  const orderId = Number.parseInt(req.params.orderId, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid order id." });
  }

  try {
    // ── Resolve verified phone (same logic as getMyOrders) ───────────────────
    const [phoneMetaRows] = await db.query(
      `SELECT meta_key, meta_value FROM tbl_usermeta
       WHERE user_id = ? AND meta_key IN ('phone', 'billing_phone')`,
      [user.id],
    );
    const phoneMetaMap = Object.fromEntries(phoneMetaRows.map(r => [r.meta_key, r.meta_value]));
    const rawPhone = phoneMetaMap['phone'] || phoneMetaMap['billing_phone'] || '';
    const verifiedPhone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : '';

    const userIdList = await resolveLinkedUserIds(user.id, user.email || "");

    // ── Check if this order belongs to the user (by linked user_id or phone) ─
    // This mirrors the same OR logic used in getMyOrders so phone-login users
    // who placed orders as guests can still view their order details.
    let ownerCheck = null;
    if (verifiedPhone) {
      const [[row]] = await db.query(
        `SELECT o.order_id FROM tbl_orders o
         WHERE o.order_id = ? AND o.order_type = 'shop_order'
           AND (
             o.user_id IN (?)
             OR o.order_id IN (
               SELECT order_id FROM tbl_ordermeta
               WHERE meta_key = '_billing_phone'
                 AND RIGHT(REPLACE(REPLACE(REPLACE(meta_value, ' ', ''), '-', ''), '+', ''), 10) = ?
             )
             OR o.order_id IN (
               SELECT order_id FROM tbl_user_address
               WHERE address_billing = 'yes'
                 AND RIGHT(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), 10) = ?
             )
           )
         LIMIT 1`,
        [orderId, userIdList, verifiedPhone, verifiedPhone],
      );
      ownerCheck = row || null;
    } else {
      const [[row]] = await db.query(
        `SELECT o.order_id FROM tbl_orders o
         WHERE o.order_id = ? AND o.order_type = 'shop_order'
           AND o.user_id IN (?)
         LIMIT 1`,
        [orderId, userIdList],
      );
      ownerCheck = row || null;
    }

    if (!ownerCheck) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const [orderRows] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)      AS order_status,
              MAX(o.order_date)        AS order_date,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_order_total'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS total,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_order_subtotal'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS subtotal,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_order_shipping'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS shipping,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS payment_method,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_coupon_code'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS coupon_code,
              (
                SELECT COALESCE(
                  (SELECT om2.meta_value FROM tbl_ordermeta om2
                   WHERE om2.order_id = o.order_id AND om2.meta_key = '_coupon_discount'
                   ORDER BY om2.meta_id DESC LIMIT 1),
                  (SELECT om3.meta_value FROM tbl_ordermeta om3
                   WHERE om3.order_id = o.order_id AND om3.meta_key = '_order_discount'
                   ORDER BY om3.meta_id DESC LIMIT 1)
                )
              ) AS coupon_discount,
              (
                SELECT om.meta_value
                FROM tbl_ordermeta om
                WHERE om.order_id = o.order_id AND om.meta_key = '_razorpay_payment_id'
                ORDER BY om.meta_id DESC
                LIMIT 1
              ) AS transaction_id,
              MAX(u.display_name)      AS user_display_name,
              MAX(u.user_email)        AS user_email,
              MAX(ub.first_name)       AS billing_first_name,
              MAX(ub.last_name)        AS billing_last_name,
              MAX(ub.phone)            AS billing_phone,
              MAX(ub.address_line1)    AS billing_address_1,
              MAX(ub.address_line2)    AS billing_address_2,
              MAX(ub.city)             AS billing_city,
              MAX(ub.state_name)       AS billing_state,
              MAX(ub.zipcode)          AS billing_postcode,
              MAX(ub.address_notes)    AS billing_notes,
              MAX(us.first_name)       AS ship_first_name,
              MAX(us.last_name)        AS ship_last_name,
              MAX(us.phone)            AS ship_phone,
              MAX(us.address_line1)    AS ship_address_1,
              MAX(us.address_line2)    AS ship_address_2,
              MAX(us.city)             AS ship_city,
              MAX(us.state_name)       AS ship_state,
              MAX(us.zipcode)          AS ship_postcode,
              MAX(o.awb_code)          AS awb_code,
              MAX(o.courier_name)      AS courier_name,
              MAX(o.shipping_status)   AS shipping_status,
              MAX(o.shipment_id)       AS shipment_id
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name)   AS first_name,
                MAX(last_name)    AS last_name,
                MAX(phone)        AS phone,
                MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2,
                MAX(city)          AS city,
                MAX(state_name)    AS state_name,
                MAX(zipcode)       AS zipcode,
                MAX(address_notes) AS address_notes
         FROM tbl_user_address
         WHERE address_billing = 'yes'
         GROUP BY order_id
       ) ub ON ub.order_id = o.order_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name)   AS first_name,
                MAX(last_name)    AS last_name,
                MAX(phone)        AS phone,
                MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2,
                MAX(city)          AS city,
                MAX(state_name)    AS state_name,
                MAX(zipcode)       AS zipcode
         FROM tbl_user_address
         WHERE address_billing = 'no'
         GROUP BY order_id
       ) us ON us.order_id = o.order_id
       WHERE o.order_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId],
    );

    if (!orderRows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const order = orderRows[0];

    const [items] = await db.query(
      `SELECT oi.order_item_id,
              oi.order_item_name,
              oi.product_id,
              (
                SELECT oim.meta_value
                FROM tbl_order_itemmeta oim
                WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_variation_id'
                ORDER BY oim.meta_id DESC
                LIMIT 1
              ) AS variation_id,
              (
                SELECT oim.meta_value
                FROM tbl_order_itemmeta oim
                WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'
                ORDER BY oim.meta_id DESC
                LIMIT 1
              ) AS qty,
              (
                SELECT oim.meta_value
                FROM tbl_order_itemmeta oim
                WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_total'
                ORDER BY oim.meta_id DESC
                LIMIT 1
              ) AS line_total,
              (
                SELECT oim.meta_value
                FROM tbl_order_itemmeta oim
                WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = 'pa_color'
                ORDER BY oim.meta_id DESC
                LIMIT 1
              ) AS color,
              (
                SELECT oim.meta_value
                FROM tbl_order_itemmeta oim
                WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = 'pa_size'
                ORDER BY oim.meta_id DESC
                LIMIT 1
              ) AS size,
              (
                SELECT COALESCE(
                  -- 1. Image saved at order time (Amazon/Flipkart pattern)
                  NULLIF((SELECT oim3.meta_value FROM tbl_order_itemmeta oim3
                          WHERE oim3.order_item_id = oi.order_item_id
                            AND oim3.meta_key = '_item_image' LIMIT 1), ''),
                  -- 2. Variation thumbnail via _thumbnail_id productmeta
                  (SELECT m1.media_path FROM tbl_productmeta pm1
                   JOIN tbl_media m1 ON m1.media_id = CAST(pm1.meta_value AS UNSIGNED)
                   WHERE pm1.product_id = CAST(NULLIF(
                     (SELECT oim2.meta_value FROM tbl_order_itemmeta oim2
                      WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1
                     ), '0') AS UNSIGNED)
                     AND pm1.meta_key = '_thumbnail_id'
                   ORDER BY pm1.meta_id DESC LIMIT 1),
                  -- 3. Product thumbnail via _thumbnail_id productmeta
                  (SELECT m2.media_path FROM tbl_productmeta pm2
                   JOIN tbl_media m2 ON m2.media_id = CAST(pm2.meta_value AS UNSIGNED)
                   WHERE pm2.product_id = oi.product_id
                     AND pm2.meta_key = '_thumbnail_id'
                   ORDER BY pm2.meta_id DESC LIMIT 1)
                )
              ) AS thumbnail_url
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId],
    );

    const effectiveItems = selectEffectiveOrderItems(
      items,
      order.subtotal ? Number(order.subtotal) : 0,
    );

    const awb = toStr(order.awb_code);
    const shipmentId = toStr(order.shipment_id);
    if (!awb && shipmentId) {
      try {
        const shipmentSync = await syncShipmentByShipmentId(orderId, shipmentId);
        if (shipmentSync?.awb) {
          order.awb_code = shipmentSync.awb;
        }
        if (shipmentSync?.courier) {
          order.courier_name = shipmentSync.courier;
        }
        if (shipmentSync?.status) {
          order.order_status = shipmentSync.status;
        }
      } catch (shipmentTrackErr) {
        console.error(`[getMyOrderById] SR shipment tracking fetch failed for shipment ${shipmentId}:`, shipmentTrackErr.message);
      }
    }

    res.json({ success: true, data: { order, items: effectiveItems } });
  } catch (err) {
    console.error("getMyOrderById error:", err);
    res.status(500).json({ success: false, message: "Failed to load order." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus (admin)
// Frontend: PUT /api/admin/orders/:orderId/status
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  const status = toStr(req.body.status);
  if (!orderId || !status) {
    return res
      .status(400)
      .json({ success: false, message: "orderId and status required." });
  }

  // Whitelist — only known WooCommerce-compatible statuses are accepted.
  // Prevents arbitrary strings being written to order_status via a compromised
  // admin account, a bug, or a forged request.
  const VALID_STATUSES = [
    "pending",
    "processing",
    "on-hold",
    "cancellation_requested",
    "completed",
    "cancelled",
    "refunded",
    "failed",
  ];
  if (!VALID_STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid order status." });
  }

  const STOCK_RESTORE_STATUSES = ["cancelled", "refunded", "failed"];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE locks this row for the rest of the transaction — if two
    const [[currentOrder]] = await conn.query(
      "SELECT order_status, awb_code, shipment_id, sr_cart_id FROM tbl_orders WHERE order_id = ? LIMIT 1 FOR UPDATE",
      [orderId],
    );
    const previousStatus = currentOrder ? currentOrder.order_status : "";

    // ── Guard: admin sets status → "cancelled". Always attempt the real
    const awb        = toStr(currentOrder?.awb_code);
    const shipmentId = toStr(currentOrder?.shipment_id);
    const srCartId   = toStr(currentOrder?.sr_cart_id);

    if (status === "cancelled" && previousStatus !== "cancelled" && previousStatus !== "cancellation_requested") {
      const {
        resolveShiprocketPanelOrderId,
        cancelOnShiprocketPanel,
        notifyAdminOfCancellationRequest,
        notifyCustomerOfCancellation,
      } = require("./shiprocketorderwebhook");

      const goPending = async () => {
        const requestedAt = new Date().toISOString();
        await conn.query(
          "UPDATE tbl_orders SET order_status = 'cancellation_requested', order_modified = NOW() WHERE order_id = ?",
          [orderId],
        );
        await conn.query(
          `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_cancel_requested_at', ?)`,
          [orderId, requestedAt],
        );
        await conn.commit();

        notifyAdminOfCancellationRequest({
          orderId, srCartId, requestedAt, awb, shipmentId,
          alreadyShipped: Boolean(awb),
        }).catch((e) => console.error(`[updateOrderStatus] cancellation-request admin email failed for order ${orderId}:`, e.message));

        notifyCustomerOfCancellation({
          orderId, mode: "pending",
        }).catch((e) => console.error(`[updateOrderStatus] cancellation-request customer email failed for order ${orderId}:`, e.message));

        return res.json({
          success: true,
          message: "Shiprocket could not cancel this order automatically — flagged as cancellation_requested and ops notified.",
          cancellation_status: "pending",
        });
      };

      let srResult = { cancelled: false, stage: "not_attempted", reason: null };
      try {
        const srPanelOrderId = await resolveShiprocketPanelOrderId(conn, orderId, { srCartId });
        srResult = await cancelOnShiprocketPanel({
          srPanelOrderId,
          awb: awb || null,
          shipmentId: shipmentId || null,
          alreadyShipped: Boolean(awb),
        });
      } catch (srErr) {
        console.error(`[updateOrderStatus] Shiprocket cancel attempt threw for order ${orderId}:`, srErr.response?.data || srErr.message);
      }

      if (!srResult.cancelled) {
        return goPending();
      }
      // Cancelled successfully via the API — fall through and write
      // order_status = 'cancelled' below, same as cancelShiprocketOrder.
    }

    await conn.query(
      "UPDATE tbl_orders SET order_status = ?, order_modified = NOW() WHERE order_id = ?",
      [status, orderId],
    );

    // ── Restore stock when order is cancelled, refunded, or failed ────────────
    // Only restore if transitioning INTO a terminal status (not already there)
    const isNewlyTerminal =
      STOCK_RESTORE_STATUSES.includes(status) &&
      !STOCK_RESTORE_STATUSES.includes(previousStatus);

    if (isNewlyTerminal) {
      // Get all line items for this order
      const [orderItems] = await conn.query(
        `SELECT oi.product_id,
                MAX(CASE WHEN oim.meta_key = '_variation_id' THEN oim.meta_value END) AS variation_id,
                MAX(CASE WHEN oim.meta_key = '_qty'          THEN oim.meta_value END) AS qty
         FROM tbl_order_items oi
         LEFT JOIN tbl_order_itemmeta oim ON oim.order_item_id = oi.order_item_id
         WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
         GROUP BY oi.order_item_id, oi.product_id`,
        [orderId],
      );

      for (const item of orderItems) {
        const qty = Number(item.qty || 0);
        if (!qty) continue;

        const stockProductId =
          item.variation_id && Number(item.variation_id) > 0
            ? item.variation_id
            : item.product_id;

        // Add stock back
        await conn.query(
          `UPDATE tbl_productmeta
           SET meta_value = CAST(meta_value AS SIGNED) + ?
           WHERE product_id = ? AND meta_key = '_stock'`,
          [qty, stockProductId],
        );

        // Re-enable instock status if it was outofstock
        await conn.query(
          `UPDATE tbl_productmeta
           SET meta_value = 'instock'
           WHERE product_id = ? AND meta_key = '_stock_status'
             AND meta_value = 'outofstock'`,
          [stockProductId],
        );
      }
    }

    await conn.commit();
    res.json({ success: true });

    if (status === "cancelled" && previousStatus !== "cancelled") {
      const { notifyCustomerOfCancellation } = require("./shiprocketorderwebhook");
      notifyCustomerOfCancellation({ orderId, mode: "cancelled" })
        .catch((e) => console.error(`[updateOrderStatus] cancelled customer email failed for order ${orderId}:`, e.message));
    }

  } catch (err) {
    await conn.rollback();
    console.error("updateOrderStatus error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update order status." });
  } finally {
    conn.release();
  }
};

// ── Track order by order ID only (no auth, public) ────────────────────────────
// POST /orders/track-by-id  { orderId }
// Returns order status + live Shiprocket tracking if AWB is available.
const trackOrderById = async (req, res) => {
  const { orderId: rawId } = req.body || {};
  const orderId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  try {
    const [[order]] = await db.query(
      `SELECT o.order_id,
              o.order_status,
              o.order_date,
              o.awb_code,
              o.courier_name,
              o.shipping_status,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_order_total'
               ORDER BY om.meta_id DESC LIMIT 1) AS total,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method'
               ORDER BY om.meta_id DESC LIMIT 1) AS payment_method,
              MAX(ub.first_name) AS billing_first_name,
              MAX(ub.last_name)  AS billing_last_name,
              MAX(ub.city)       AS billing_city,
              MAX(ub.state_name) AS billing_state
       FROM tbl_orders o
       LEFT JOIN (
         SELECT order_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(city) AS city, MAX(state_name) AS state_name
         FROM tbl_user_address WHERE address_billing = 'yes' GROUP BY order_id
       ) ub ON ub.order_id = o.order_id
       WHERE o.order_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId],
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Fetch live Shiprocket tracking if we have an AWB
    // Guard against overwriting a protected status (same rationale as
    // getTrackingStatus / trackOrderByPhone) — never let a read-only page
    // view revert a cancellation/refund back to a shipping status.
    const PROTECTED_STATUSES = [
      "cancelled", "cancellation_requested", "refunded", "failed",
      "Delivered", "Returned",
    ];
    const isProtected = PROTECTED_STATUSES.includes(order.order_status);
    let trackingData = null;
    const awb = toStr(order.awb_code);
    if (awb && !isProtected) {
      try {
        let token = await getShiprocketToken();
        let srRes;
        try {
          srRes = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
          );
        } catch (fetchErr) {
          // Retry once with a forced token refresh instead of silently
          // swallowing a stale-token 401 and leaving the DB status stuck.
          if (fetchErr.response?.status === 401) {
            token = await getShiprocketToken(true);
            srRes = await axios.get(
              `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
              { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
            );
          } else {
            throw fetchErr;
          }
        }
        const td = srRes.data?.tracking_data;
        if (td) {
          const rawStatus = (td.shipment_track?.[0]?.current_status || "").toUpperCase().trim();
          // Must mirror SR_STATUS_MAP in shiprocketorderwebhook.js exactly —
          // previously this used its own smaller, inconsistent map
          // ("Order Confirmed", "Packed") that didn't match the timeline
          // stages the frontend actually renders (Pending/Processing/Ready
          // to Ship/Shipped/Out for Delivery/Delivered), so live pulls here
          // could write a status string the UI didn't recognize.
          const statusMap = {
            "NEW":                           "Ready to Ship",
            "PICKUP SCHEDULED":              "Ready to Ship",
            "PICKUP ERROR":                  "Ready to Ship",
            "PICKUP QUEUED":                 "Ready to Ship",
            "PICKUP GENERATED":              "Ready to Ship",
            "PICKUP EXCEPTION":              "Ready to Ship",
            "PICKUP RESCHEDULED":            "Ready to Ship",
            "OUT FOR PICKUP":                "Ready to Ship",
            "MANIFEST GENERATED":            "Ready to Ship",
            "AWB ASSIGNED":                  "Ready to Ship",
            "FUTURE_PICKUP":                 "Ready to Ship",
            "PICKED UP":                     "Shipped",
            "IN TRANSIT":                    "Shipped",
            "REACHED AT SOURCE HUB":         "Shipped",
            "REACHED AT DESTINATION HUB":    "Shipped",
            "MISROUTED":                     "Shipped",
            "DELAYED":                       "Shipped",
            "DAMAGED":                       "Shipped",
            "LOST":                          "Shipped",
            "OUT FOR DELIVERY":              "Out for Delivery",
            "UNDELIVERED":                   "Out for Delivery",
            "DELIVERED":                     "Delivered",
            "CANCELLED":                     "cancelled",
            "RTO INITIATED":                 "Return Initiated",
            "RTO IN TRANSIT":                "Return Initiated",
            "RTO OUT FOR PICKUP":            "Return Initiated",
            "RTO PICKED":                    "Return Initiated",
            "RTO DELIVERED":                 "Returned",
            "SHIPMENT RETURN":               "Return Initiated",
            "DESTROYED":                     "Return Initiated",
            "QC FAILED":                     "Ready to Ship",
          };
          trackingData = {
            current_status: statusMap[rawStatus] || rawStatus || order.order_status,
            activities: td.shipment_track_activities || [],
            courier_name: td.shipment_track?.[0]?.courier_name || order.courier_name || "",
            awb_code: awb,
          };
          // keep local status in sync
          if (trackingData.current_status) {
            await db.query(
              `UPDATE tbl_orders SET order_status = ? WHERE order_id = ?`,
              [trackingData.current_status, orderId],
            );
          }
        }
      } catch (trackErr) {
        console.error(`[trackOrderById] SR tracking fetch failed for AWB ${awb}:`, trackErr.message);
      }
    }

    const [items] = await db.query(
      `SELECT oi.order_item_name,
              oi.product_id,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'
               ORDER BY oim.meta_id DESC LIMIT 1) AS qty,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_total'
               ORDER BY oim.meta_id DESC LIMIT 1) AS line_total
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId],
    );

    return res.json({
      success: true,
      data: {
        order: {
          order_id: order.order_id,
          order_status: trackingData?.current_status || order.order_status,
          order_date: order.order_date,
          total: order.total,
          payment_method: order.payment_method,
          billing_first_name: order.billing_first_name,
          billing_last_name: order.billing_last_name,
          billing_city: order.billing_city,
          billing_state: order.billing_state,
          awb_code: awb || null,
          courier_name: order.courier_name || null,
        },
        items,
        tracking: trackingData,
      },
    });
  } catch (err) {
    console.error("trackOrderById error:", err);
    return res.status(500).json({ success: false, message: "Failed to load order." });
  }
};

// ── Public order tracking (no login required) ─────────────────────────────────
const trackOrderByPhone = async (req, res) => {
  const { orderId: rawId, phone: rawPhone } = req.body || {};

  const inputRef    = String(rawId || "").trim();
  const inputDigits = String(rawPhone || "").replace(/\D/g, "");

  if (!inputRef) {
    return res.status(400).json({ success: false, message: "Please enter your Order Reference." });
  }
  if (!inputDigits || inputDigits.length < 6) {
    return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
  }

  try {
    // Resolve sr_cart_id → DB order_id when the input is not a plain integer
    let orderId = Number.parseInt(inputRef, 10);
    if (!Number.isFinite(orderId) || orderId <= 0 || String(orderId) !== inputRef) {
      // Treat input as sr_cart_id and look up the real order_id
      const [[metaRow]] = await db.query(
        `SELECT order_id FROM tbl_ordermeta
         WHERE meta_key = '_sr_cart_id' AND meta_value = ?
         LIMIT 1`,
        [inputRef],
      );
      if (!metaRow) {
        return res.status(404).json({ success: false, message: "No order found with that reference." });
      }
      orderId = metaRow.order_id;
    }
    const [orderRows] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)      AS order_status,
              MAX(o.order_date)        AS order_date,
              MAX(o.awb_code)          AS awb_code,
              MAX(o.courier_name)      AS courier_name,
              MAX(o.shipment_id)       AS shipment_id,
              MAX(o.shipping_status)   AS shipping_status,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_order_total'
               ORDER BY om.meta_id DESC LIMIT 1) AS total,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_order_subtotal'
               ORDER BY om.meta_id DESC LIMIT 1) AS subtotal,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_order_shipping'
               ORDER BY om.meta_id DESC LIMIT 1) AS shipping,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method'
               ORDER BY om.meta_id DESC LIMIT 1) AS payment_method,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_coupon_code'
               ORDER BY om.meta_id DESC LIMIT 1) AS coupon_code,
              (SELECT COALESCE(
                 (SELECT om2.meta_value FROM tbl_ordermeta om2
                  WHERE om2.order_id = o.order_id AND om2.meta_key = '_coupon_discount'
                  ORDER BY om2.meta_id DESC LIMIT 1),
                 (SELECT om3.meta_value FROM tbl_ordermeta om3
                  WHERE om3.order_id = o.order_id AND om3.meta_key = '_order_discount'
                  ORDER BY om3.meta_id DESC LIMIT 1)
               )) AS coupon_discount,
              (SELECT om.meta_value FROM tbl_ordermeta om
               WHERE om.order_id = o.order_id AND om.meta_key = '_razorpay_payment_id'
               ORDER BY om.meta_id DESC LIMIT 1) AS transaction_id,
              MAX(u.display_name)      AS user_display_name,
              MAX(ub.first_name)       AS billing_first_name,
              MAX(ub.last_name)        AS billing_last_name,
              MAX(ub.phone)            AS billing_phone,
              MAX(ub.address_line1)    AS billing_address_1,
              MAX(ub.address_line2)    AS billing_address_2,
              MAX(ub.city)             AS billing_city,
              MAX(ub.state_name)       AS billing_state,
              MAX(ub.zipcode)          AS billing_postcode,
              MAX(ub.address_notes)    AS billing_notes,
              MAX(us.first_name)       AS ship_first_name,
              MAX(us.last_name)        AS ship_last_name,
              MAX(us.phone)            AS ship_phone,
              MAX(us.address_line1)    AS ship_address_1,
              MAX(us.address_line2)    AS ship_address_2,
              MAX(us.city)             AS ship_city,
              MAX(us.state_name)       AS ship_state,
              MAX(us.zipcode)          AS ship_postcode
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(phone) AS phone, MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2, MAX(city) AS city,
                MAX(state_name) AS state_name, MAX(zipcode) AS zipcode,
                MAX(address_notes) AS address_notes
         FROM tbl_user_address WHERE address_billing = 'yes' GROUP BY order_id
       ) ub ON ub.order_id = o.order_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(phone) AS phone, MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2, MAX(city) AS city,
                MAX(state_name) AS state_name, MAX(zipcode) AS zipcode
         FROM tbl_user_address WHERE address_billing = 'no' GROUP BY order_id
       ) us ON us.order_id = o.order_id
       WHERE o.order_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId],
    );

    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const order = orderRows[0];

    // Attach sr_cart_id from ordermeta
    const [[cartIdRow]] = await db.query(
      `SELECT meta_value FROM tbl_ordermeta WHERE meta_key = '_sr_cart_id' AND order_id = ? LIMIT 1`,
      [orderId],
    );
    order.sr_cart_id = cartIdRow?.meta_value || null;

    // Attach shipment_exception flag from ordermeta (null = no active exception)
    const [[exceptionRow]] = await db.query(
      `SELECT meta_value FROM tbl_ordermeta WHERE meta_key = '_shipment_exception' AND order_id = ? LIMIT 1`,
      [orderId],
    );
    order.shipment_exception = exceptionRow
      ? (() => { try { return JSON.parse(exceptionRow.meta_value); } catch { return null; } })()
      : null;

    // Verify phone server-side
    const shipDigits    = String(order.ship_phone    || "").replace(/\D/g, "");
    const billingDigits = String(order.billing_phone || "").replace(/\D/g, "");
    const phoneMatches  =
      (shipDigits    && (shipDigits.endsWith(inputDigits)    || inputDigits.endsWith(shipDigits)))    ||
      (billingDigits && (billingDigits.endsWith(inputDigits) || inputDigits.endsWith(billingDigits)));

    if (!phoneMatches) {
      return res.status(403).json({ success: false, message: "The mobile number does not match this order." });
    }

    const [items] = await db.query(
      `SELECT oi.order_item_id,
              oi.order_item_name,
              oi.product_id,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_variation_id'
               ORDER BY oim.meta_id DESC LIMIT 1) AS variation_id,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'
               ORDER BY oim.meta_id DESC LIMIT 1) AS qty,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_total'
               ORDER BY oim.meta_id DESC LIMIT 1) AS line_total,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = 'pa_color'
               ORDER BY oim.meta_id DESC LIMIT 1) AS color,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim
               WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = 'pa_size'
               ORDER BY oim.meta_id DESC LIMIT 1) AS size,
              (SELECT COALESCE(
                NULLIF((SELECT oim3.meta_value FROM tbl_order_itemmeta oim3
                        WHERE oim3.order_item_id = oi.order_item_id AND oim3.meta_key = '_item_image' LIMIT 1), ''),
                (SELECT m1.media_path FROM tbl_productmeta pm1
                 JOIN tbl_media m1 ON m1.media_id = CAST(pm1.meta_value AS UNSIGNED)
                 WHERE pm1.product_id = CAST(NULLIF(
                   (SELECT oim2.meta_value FROM tbl_order_itemmeta oim2
                    WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1
                   ), '0') AS UNSIGNED) AND pm1.meta_key = '_thumbnail_id'
                 ORDER BY pm1.meta_id DESC LIMIT 1),
                (SELECT m2.media_path FROM tbl_productmeta pm2
                 JOIN tbl_media m2 ON m2.media_id = CAST(pm2.meta_value AS UNSIGNED)
                 WHERE pm2.product_id = oi.product_id AND pm2.meta_key = '_thumbnail_id'
                 ORDER BY pm2.meta_id DESC LIMIT 1)
              )) AS thumbnail_url
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId],
    );

    const effectiveItems = selectEffectiveOrderItems(
      items,
      order.subtotal ? Number(order.subtotal) : 0,
    );

    // ── Fetch live Shiprocket tracking if AWB is available ────────────────────
    // Never let a live pull overwrite an order that's already in a protected
    // terminal / in-progress state (same rationale as getTrackingStatus above) —
    // otherwise viewing this page mid-cancellation could silently revert
    // "cancellation_requested" back to a shipping status.
    const PROTECTED_STATUSES = [
      "cancelled", "cancellation_requested", "refunded", "failed",
      "Delivered", "Returned",
    ];
    const isProtected = PROTECTED_STATUSES.includes(order.order_status);
    const awb = toStr(order.awb_code);
    if (awb && !isProtected) {
      try {
        let token = await getShiprocketToken();
        let srRes;
        try {
          srRes = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
          );
        } catch (fetchErr) {
          // Retry once with a forced token refresh — a stale cached token
          // (401) was silently swallowed before, leaving the DB status stuck.
          if (fetchErr.response?.status === 401) {
            token = await getShiprocketToken(true);
            srRes = await axios.get(
              `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
              { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
            );
          } else {
            throw fetchErr;
          }
        }
        const td = srRes.data?.tracking_data;
        if (td) {
          const rawStatus = (td.shipment_track?.[0]?.current_status || "").toUpperCase().trim();
          // Must mirror SR_STATUS_MAP in shiprocketorderwebhook.js exactly.
          const statusMap = {
            "NEW":                           "Ready to Ship",
            "PICKUP SCHEDULED":              "Ready to Ship",
            "PICKUP ERROR":                  "Ready to Ship",
            "PICKUP QUEUED":                 "Ready to Ship",
            "PICKUP GENERATED":              "Ready to Ship",
            "PICKUP EXCEPTION":              "Ready to Ship",
            "PICKUP RESCHEDULED":            "Ready to Ship",
            "OUT FOR PICKUP":                "Ready to Ship",
            "MANIFEST GENERATED":            "Ready to Ship",
            "AWB ASSIGNED":                  "Ready to Ship",
            "FUTURE_PICKUP":                 "Ready to Ship",
            "PICKED UP":                     "Shipped",
            "IN TRANSIT":                    "Shipped",
            "REACHED AT SOURCE HUB":         "Shipped",
            "REACHED AT DESTINATION HUB":    "Shipped",
            "MISROUTED":                     "Shipped",
            "DELAYED":                       "Shipped",   // exception modifier, NOT a separate stage
            "DAMAGED":                       "Shipped",   // exception modifier
            "LOST":                          "Shipped",   // exception modifier
            "OUT FOR DELIVERY":              "Out for Delivery",
            "UNDELIVERED":                   "Out for Delivery", // NDR, re-attempt expected
            "DELIVERED":                     "Delivered",
            "CANCELLED":                     "cancelled",
            "RTO INITIATED":                 "Return Initiated",
            "RTO IN TRANSIT":                "Return Initiated",
            "RTO OUT FOR PICKUP":            "Return Initiated",
            "RTO PICKED":                    "Return Initiated",
            "RTO DELIVERED":                 "Returned",
            "SHIPMENT RETURN":               "Return Initiated",
            "DESTROYED":                     "Return Initiated",
            "QC FAILED":                     "Ready to Ship",
          };
          const liveStatus = statusMap[rawStatus] || rawStatus;
          if (liveStatus) {
            order.order_status = liveStatus;
            // keep local DB in sync
            await db.query(
              `UPDATE tbl_orders SET order_status = ? WHERE order_id = ?`,
              [liveStatus, orderId],
            ).catch(() => {});
          }

          // Sync exception flag from live status
          const EXCEPTION_RAW = new Set(["UNDELIVERED", "DELAYED", "DAMAGED", "LOST"]);
          if (EXCEPTION_RAW.has(rawStatus)) {
            const exceptionValue = JSON.stringify({
              type:       rawStatus.toLowerCase(),
              raw_status: rawStatus,
              at:         new Date().toISOString(),
              remark:     "",
            });
            await db.query(
              `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
               VALUES (?, '_shipment_exception', ?)
               ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
              [orderId, exceptionValue],
            ).catch(() => {});
            order.shipment_exception = { type: rawStatus.toLowerCase(), raw_status: rawStatus, at: new Date().toISOString(), remark: "" };
          } else if (liveStatus) {
            // Forward progress — clear any stale exception flag
            await db.query(
              `DELETE FROM tbl_ordermeta WHERE order_id = ? AND meta_key = '_shipment_exception'`,
              [orderId],
            ).catch(() => {});
            order.shipment_exception = null;
          }

          order.courier_name = td.shipment_track?.[0]?.courier_name || order.courier_name || "";
        }
      } catch (trackErr) {
        console.error(`[trackOrderByPhone] SR tracking fetch failed for AWB ${awb}:`, trackErr.message);
        // non-fatal — continue with DB data
      }
    }

    res.json({ success: true, data: { order, items: effectiveItems } });
  } catch (err) {
    console.error("trackOrderByPhone error:", err);
    res.status(500).json({ success: false, message: "Failed to load order." });
  }
};

// ── Invoice Number ────────────────────────────────────────────────────────────
// Format: NEST-YYYY-NNNN  (year from order_date, sequential per-year counter)
// Stored in tbl_ordermeta under key '_invoice_number' so it never changes.
async function getOrCreateInvoiceNumber(orderId, orderDate) {
  // Return existing invoice number if already generated
  const [[existing]] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta WHERE order_id = ? AND meta_key = '_invoice_number' LIMIT 1`,
    [orderId]
  );
  if (existing) return existing.meta_value;

  const year = new Date(orderDate).getFullYear();

  // Count how many invoices were already issued for this year (excluding current order)
  const [[{ count }]] = await db.query(
    `SELECT COUNT(*) AS count
     FROM tbl_ordermeta om
     JOIN tbl_orders o ON o.order_id = om.order_id
     WHERE om.meta_key = '_invoice_number'
       AND YEAR(o.order_date) = ?`,
    [year]
  );

  const seq = Number(count) + 1;
  const invoiceNo = `NEST-${year}-${String(seq).padStart(4, '0')}`;

  await db.query(
    `INSERT IGNORE INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_invoice_number', ?)`,
    [orderId, invoiceNo]
  );

  return invoiceNo;
}

// ── Download Invoice ──────────────────────────────────────────────────────────
// GET /orders/invoice/:orderId?phone=xxxx
// Returns HTML invoice that can be printed as PDF
const downloadInvoice = async (req, res) => {
  try {
    const rawId = toStr(req.params.orderId);
    const inputDigits = toStr(req.query.phone).replace(/\D/g, '');

    if (!rawId || !inputDigits || inputDigits.length < 6) {
      return res.status(400).send('Order ID and phone number required');
    }

    // Resolve sr_cart_id → real order_id (same logic as trackOrderByPhone)
    let orderId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(orderId) || orderId <= 0 || String(orderId) !== rawId) {
      const [[metaRow]] = await db.query(
        `SELECT order_id FROM tbl_ordermeta WHERE meta_key = '_sr_cart_id' AND meta_value = ? LIMIT 1`,
        [rawId]
      );
      if (!metaRow) return res.status(404).send('Order not found');
      orderId = metaRow.order_id;
    }

    // Use the exact same JOIN as trackOrderByPhone so phone fields come from tbl_user_address
    const [orderRows] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)   AS order_status,
              MAX(o.order_date)     AS order_date,
              MAX(o.awb_code)       AS awb_code,
              MAX(o.courier_name)   AS courier_name,
              MAX(o.shipment_id)    AS shipment_id,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_total'    ORDER BY om.meta_id DESC LIMIT 1) AS total,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_subtotal' ORDER BY om.meta_id DESC LIMIT 1) AS subtotal,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_shipping' ORDER BY om.meta_id DESC LIMIT 1) AS shipping,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method' ORDER BY om.meta_id DESC LIMIT 1) AS payment_method,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_razorpay_method' ORDER BY om.meta_id DESC LIMIT 1) AS razorpay_method,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_coupon_code'    ORDER BY om.meta_id DESC LIMIT 1) AS coupon_code,
              (SELECT COALESCE(
                 (SELECT om2.meta_value FROM tbl_ordermeta om2
                  WHERE om2.order_id = o.order_id AND om2.meta_key = '_coupon_discount'
                  ORDER BY om2.meta_id DESC LIMIT 1),
                 (SELECT om3.meta_value FROM tbl_ordermeta om3
                  WHERE om3.order_id = o.order_id AND om3.meta_key = '_order_discount'
                  ORDER BY om3.meta_id DESC LIMIT 1)
               )) AS coupon_discount,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_sr_cart_id'     ORDER BY om.meta_id DESC LIMIT 1) AS sr_cart_id,
              MAX(u.display_name)   AS user_display_name,
              MAX(u.user_email)     AS user_email,
              MAX(ub.first_name)    AS billing_first_name,
              MAX(ub.last_name)     AS billing_last_name,
              MAX(ub.phone)         AS billing_phone,
              MAX(ub.address_line1) AS billing_address_1,
              MAX(ub.address_line2) AS billing_address_2,
              MAX(ub.city)          AS billing_city,
              MAX(ub.state_name)    AS billing_state,
              MAX(ub.zipcode)       AS billing_postcode,
              MAX(us.first_name)    AS ship_first_name,
              MAX(us.last_name)     AS ship_last_name,
              MAX(us.phone)         AS ship_phone,
              MAX(us.address_line1) AS ship_address_1,
              MAX(us.address_line2) AS ship_address_2,
              MAX(us.city)          AS ship_city,
              MAX(us.state_name)    AS ship_state,
              MAX(us.zipcode)       AS ship_postcode
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(phone) AS phone, MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2, MAX(city) AS city,
                MAX(state_name) AS state_name, MAX(zipcode) AS zipcode
         FROM tbl_user_address WHERE address_billing = 'yes' GROUP BY order_id
       ) ub ON ub.order_id = o.order_id
       LEFT JOIN (
         SELECT order_id,
                MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(phone) AS phone, MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2, MAX(city) AS city,
                MAX(state_name) AS state_name, MAX(zipcode) AS zipcode
         FROM tbl_user_address WHERE address_billing = 'no' GROUP BY order_id
       ) us ON us.order_id = o.order_id
       WHERE o.order_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId]
    );

    if (!orderRows.length) return res.status(404).send('Order not found');
    const orderRow = orderRows[0];

    // Same suffix-based phone match as trackOrderByPhone
    const shipDigits    = String(orderRow.ship_phone    || '').replace(/\D/g, '');
    const billingDigits = String(orderRow.billing_phone || '').replace(/\D/g, '');
    const phoneMatches  =
      (shipDigits    && (shipDigits.endsWith(inputDigits)    || inputDigits.endsWith(shipDigits)))    ||
      (billingDigits && (billingDigits.endsWith(inputDigits) || inputDigits.endsWith(billingDigits)));

    if (!phoneMatches) {
      return res.status(403).send('Phone number does not match this order');
    }

    // Fetch order items with HSN and tax details
    const [allItems] = await db.query(
      `SELECT oi.order_item_id,
              oi.order_item_name,
              oi.product_id,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'         ORDER BY oim.meta_id DESC LIMIT 1) AS qty,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_total'  ORDER BY oim.meta_id DESC LIMIT 1) AS line_total,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_tax'    ORDER BY oim.meta_id DESC LIMIT 1) AS line_tax,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_variation_id' ORDER BY oim.meta_id DESC LIMIT 1) AS variation_id,
              (SELECT COALESCE(
                NULLIF((SELECT pm.meta_value FROM tbl_productmeta pm 
                        WHERE pm.product_id = CAST(NULLIF((SELECT oim2.meta_value FROM tbl_order_itemmeta oim2 
                                                           WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1), '0') AS UNSIGNED)
                          AND pm.meta_key = 'hsn' LIMIT 1), ''),
                (SELECT pm2.meta_value FROM tbl_productmeta pm2 
                 WHERE pm2.product_id = oi.product_id AND pm2.meta_key = 'hsn' LIMIT 1)
              )) AS hsn_code,
              (SELECT COALESCE(
                NULLIF((SELECT pm.meta_value FROM tbl_productmeta pm 
                        WHERE pm.product_id = CAST(NULLIF((SELECT oim2.meta_value FROM tbl_order_itemmeta oim2 
                                                           WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1), '0') AS UNSIGNED)
                          AND pm.meta_key = 'tax' LIMIT 1), ''),
                (SELECT pm2.meta_value FROM tbl_productmeta pm2 
                 WHERE pm2.product_id = oi.product_id AND pm2.meta_key = 'tax' LIMIT 1)
              )) AS tax_percent
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId]
    );

    const effectiveItems = selectEffectiveOrderItems(allItems, orderRow.subtotal);

    const orderDate    = new Date(orderRow.order_date);
    const orderDateStr = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

    const invoiceNumber = await getOrCreateInvoiceNumber(orderId, orderRow.order_date);

    const html = renderInvoice({
      store: {
        name:         process.env.STORE_NAME           || 'Nestcase',
        address1:     process.env.STORE_ADDRESS_1      || '',
        address2:     process.env.STORE_ADDRESS_2      || '',
        cityStatePin: process.env.STORE_CITY_STATE_PIN || '',
        phone:        process.env.STORE_PHONE          || '',
        email:        process.env.SMTP_SENDER_EMAIL    || '',
        gstin:        process.env.STORE_GSTIN          || '',
        pan:          process.env.STORE_PAN            || '',
      },
      defaultGstRate: parseFloat(process.env.DEFAULT_GST_RATE || '18'),
      order: {
        invoiceNo:      invoiceNumber,
        orderId:        orderRow.sr_cart_id || orderId,
        dateStr:        orderDateStr,
        payMethod:      (orderRow.payment_method || 'cod').toUpperCase(),
        isCOD:          (orderRow.payment_method || 'cod').toLowerCase() === 'cod',
        razorpayMethod: orderRow.razorpay_method || null, // 'card', 'upi', 'netbanking', 'wallet'
        awbCode:        orderRow.awb_code     || '',
        courierName:    orderRow.courier_name || '',
        supplierRef:    orderRow.sr_cart_id   || String(orderId),   // Supplier's Ref
        otherRef:       orderRow.awb_code     || '',                // Other Reference(s)
      },
      billing: {
        name:  [orderRow.billing_first_name, orderRow.billing_last_name].filter(Boolean).join(' '),
        addr1: orderRow.billing_address_1 || '',
        addr2: orderRow.billing_address_2 || '',
        city:  orderRow.billing_city      || '',
        state: orderRow.billing_state     || '',
        pin:   orderRow.billing_postcode  || '',
        phone: orderRow.billing_phone     || '',
        email: orderRow.user_email        || '',
      },
      shipping: {
        name:  [orderRow.ship_first_name, orderRow.ship_last_name].filter(Boolean).join(' ')
               || [orderRow.billing_first_name, orderRow.billing_last_name].filter(Boolean).join(' '),
        addr1: orderRow.ship_address_1 || orderRow.billing_address_1 || '',
        addr2: orderRow.ship_address_2 || orderRow.billing_address_2 || '',
        city:  orderRow.ship_city      || orderRow.billing_city      || '',
        state: orderRow.ship_state     || orderRow.billing_state     || '',
        pin:   orderRow.ship_postcode  || orderRow.billing_postcode  || '',
        phone: orderRow.ship_phone     || orderRow.billing_phone     || '',
      },
      totals: {
        subtotal: toAmount(orderRow.subtotal        || 0),
        shipping: toAmount(orderRow.shipping        || 0),
        discount: toAmount(orderRow.coupon_discount || 0),
        total:    toAmount(orderRow.total           || 0),
        couponCode: orderRow.coupon_code || '',
      },
      items: effectiveItems,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    console.error('downloadInvoice error:', err);
    res.status(500).send('Failed to generate invoice');
  }
};

const getOrderWigzoData = async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid order id.' });
  }

  try {
    // Fetch order + billing address in one query
    const [[row]] = await db.query(
      `SELECT
         o.order_id,
         o.order_date,
         o.user_id,
         o.sr_cart_id                  AS sr_cart_id_direct,
         MAX(ua.first_name)            AS first_name,
         MAX(ua.last_name)             AS last_name,
         MAX(ua.phone)                 AS phone,
         MAX(ua.city)                  AS city,
         MAX(ua.state_name)            AS state,
         MAX(ua.zipcode)               AS zip,
         MAX(u.user_email)             AS email,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_order_total'      ORDER BY meta_id DESC LIMIT 1) AS total_price,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_order_subtotal'   ORDER BY meta_id DESC LIMIT 1) AS subtotal,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_order_shipping'   ORDER BY meta_id DESC LIMIT 1) AS shipping_cost,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_order_discount'   ORDER BY meta_id DESC LIMIT 1) AS total_discounts,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_payment_method'   ORDER BY meta_id DESC LIMIT 1) AS payment_method,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_coupon_code'      ORDER BY meta_id DESC LIMIT 1) AS coupon_code,
         (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_sr_cart_id'       ORDER BY meta_id DESC LIMIT 1) AS sr_cart_id_meta
       FROM tbl_orders o
       LEFT JOIN tbl_user_address ua ON ua.order_id = o.order_id AND ua.address_billing = 'yes'
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       WHERE o.order_id = ?
       GROUP BY o.order_id`,
      [orderId],
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Fetch first order item for product-level fields.
    // Use oi.order_item_name (title stored at order time) — more reliable than
    // joining tbl_products.product_title since the product may be edited/deleted later.
    const [[item]] = await db.query(
      `SELECT
         oi.order_item_id,
         oi.order_item_name            AS title,
         oi.product_id,
         (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_variation_id'  ORDER BY oim.meta_id DESC LIMIT 1) AS variation_id,
         (SELECT meta_value FROM tbl_order_itemmeta WHERE order_item_id = oi.order_item_id AND meta_key = '_line_total'    LIMIT 1) AS price,
         (SELECT meta_value FROM tbl_order_itemmeta WHERE order_item_id = oi.order_item_id AND meta_key = '_qty'           LIMIT 1) AS quantity,
         (SELECT meta_value FROM tbl_order_itemmeta WHERE order_item_id = oi.order_item_id AND meta_key = '_line_subtotal' LIMIT 1) AS line_subtotal
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       ORDER BY oi.order_item_id ASC
       LIMIT 1`,
      [orderId],
    );

    // Resolve category for first item
    const { category, type } = await resolveProductCategoryForWigzo(item?.product_id);

    const isCod = toStr(row.payment_method).toLowerCase() === 'cod';
    // Prefer sr_cart_id directly from tbl_orders column (most reliable),
    // fall back to the ordermeta copy (_sr_cart_id key), then DB order_id as last resort.
    const cartToken = row.sr_cart_id_direct || row.sr_cart_id_meta || String(orderId);
    const cleanPhone = normalizePhone(row.phone || '');

    return res.json({
      success: true,
      data: {
        orderId:                cartToken,
        title:                  item?.title                    || '',
        customer_id:            String(row.user_id             || 0),
        phone:                  cleanPhone ? `+91${cleanPhone}` : '',
        fullName:               `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Customer',
        email:                  row.email                      || '',
        total_price:            Number(row.total_price)        || 0,
        total_line_items_price: Number(row.subtotal)           || 0,
        cart_token:             cartToken,
        checkout_token:         cartToken,
        ga_transaction_id:      isCod ? '' : cartToken,
        created_at:             row.order_date ? new Date(row.order_date).toISOString() : new Date().toISOString(),
        updated_at:             row.order_date ? new Date(row.order_date).toISOString() : new Date().toISOString(),
        shipping_cost:          Number(row.shipping_cost)      || 0,
        total_discounts:        Number(row.total_discounts)    || 0,
        city:                   row.city                       || '',
        state:                  row.state                      || '',
        country:                'India',
        zip:                    row.zip                        || '',
        financial_status:       isCod ? 'COD' : 'Prepaid',
        taxes_included:         true,
        coupons:                row.coupon_code ? [row.coupon_code] : [],
        fulfillment_status:     'Pending',
        line_item_id:           String(item?.order_item_id     || ''),
        product_id:             String(item?.product_id        || ''),
        variant_id:             String(item?.variation_id      || ''),
        price:                  Number(item?.price)            || 0,
        quantity:               Number(item?.quantity)         || 1,
        // Proportional discount for this line item:
        // (line_subtotal / order_subtotal) × total_discount
        // Both values are already fetched — line_subtotal from tbl_order_itemmeta,
        // total_discounts from tbl_ordermeta. Matches the formula used in placeOrder.
        product_discount: (() => {
          const lineSubtotal   = Number(item?.line_subtotal)    || 0;
          const orderSubtotal  = Number(row.subtotal)           || 0;
          const totalDiscount  = Number(row.total_discounts)    || 0;
          if (totalDiscount <= 0 || orderSubtotal <= 0) return 0;
          return Math.round((lineSubtotal / orderSubtotal) * totalDiscount * 100) / 100;
        })(),
        categories:             category,
        type,
      },
    });
  } catch (err) {
    console.error('getOrderWigzoData error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch order data.' });
  }
};

/**
 * GET /orders/my/invoice/:orderId
 * Authenticated invoice download — no phone verification needed.
 * Only the order owner can download their own invoice.
 */
const downloadMyInvoice = async (req, res) => {
  try {
    const user = getSessionUser(req);
    if (!user) return res.status(401).send('Login required');

    const orderId = Number.parseInt(req.params.orderId, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).send('Invalid order ID');
    }

    const linkedIds = await resolveLinkedUserIds(user.id, user.email || '');

    const [orderRows] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)   AS order_status,
              MAX(o.order_date)     AS order_date,
              MAX(o.awb_code)       AS awb_code,
              MAX(o.courier_name)   AS courier_name,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_total'     ORDER BY om.meta_id DESC LIMIT 1) AS total,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_subtotal'  ORDER BY om.meta_id DESC LIMIT 1) AS subtotal,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_order_shipping'  ORDER BY om.meta_id DESC LIMIT 1) AS shipping,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method'  ORDER BY om.meta_id DESC LIMIT 1) AS payment_method,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_razorpay_method' ORDER BY om.meta_id DESC LIMIT 1) AS razorpay_method,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_coupon_code'     ORDER BY om.meta_id DESC LIMIT 1) AS coupon_code,
              (SELECT COALESCE(
                 (SELECT om2.meta_value FROM tbl_ordermeta om2 WHERE om2.order_id = o.order_id AND om2.meta_key = '_coupon_discount' ORDER BY om2.meta_id DESC LIMIT 1),
                 (SELECT om3.meta_value FROM tbl_ordermeta om3 WHERE om3.order_id = o.order_id AND om3.meta_key = '_order_discount'  ORDER BY om3.meta_id DESC LIMIT 1)
               )) AS coupon_discount,
              (SELECT om.meta_value FROM tbl_ordermeta om WHERE om.order_id = o.order_id AND om.meta_key = '_sr_cart_id'      ORDER BY om.meta_id DESC LIMIT 1) AS sr_cart_id,
              MAX(u.display_name)   AS user_display_name,
              MAX(u.user_email)     AS user_email,
              MAX(ub.first_name)    AS billing_first_name,
              MAX(ub.last_name)     AS billing_last_name,
              MAX(ub.phone)         AS billing_phone,
              MAX(ub.address_line1) AS billing_address_1,
              MAX(ub.address_line2) AS billing_address_2,
              MAX(ub.city)          AS billing_city,
              MAX(ub.state_name)    AS billing_state,
              MAX(ub.zipcode)       AS billing_postcode,
              MAX(us.first_name)    AS ship_first_name,
              MAX(us.last_name)     AS ship_last_name,
              MAX(us.address_line1) AS ship_address_1,
              MAX(us.address_line2) AS ship_address_2,
              MAX(us.city)          AS ship_city,
              MAX(us.state_name)    AS ship_state,
              MAX(us.zipcode)       AS ship_postcode
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN (
         SELECT order_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(phone) AS phone, MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2, MAX(city) AS city,
                MAX(state_name) AS state_name, MAX(zipcode) AS zipcode
         FROM tbl_user_address WHERE address_billing = 'yes' GROUP BY order_id
       ) ub ON ub.order_id = o.order_id
       LEFT JOIN (
         SELECT order_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name,
                MAX(address_line1) AS address_line1, MAX(address_line2) AS address_line2,
                MAX(city) AS city, MAX(state_name) AS state_name, MAX(zipcode) AS zipcode
         FROM tbl_user_address WHERE address_billing = 'no' GROUP BY order_id
       ) us ON us.order_id = o.order_id
       WHERE o.order_id = ? AND o.user_id IN (?) AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId, linkedIds],
    );

    if (!orderRows.length) return res.status(404).send('Order not found');
    const orderRow = orderRows[0];

    const [allItems] = await db.query(
      `SELECT oi.order_item_id, oi.order_item_name, oi.product_id,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_qty'          ORDER BY oim.meta_id DESC LIMIT 1) AS qty,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_total'   ORDER BY oim.meta_id DESC LIMIT 1) AS line_total,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_line_tax'     ORDER BY oim.meta_id DESC LIMIT 1) AS line_tax,
              (SELECT oim.meta_value FROM tbl_order_itemmeta oim WHERE oim.order_item_id = oi.order_item_id AND oim.meta_key = '_variation_id' ORDER BY oim.meta_id DESC LIMIT 1) AS variation_id,
              (SELECT COALESCE(
                NULLIF((SELECT pm.meta_value FROM tbl_productmeta pm
                        WHERE pm.product_id = CAST(NULLIF((SELECT oim2.meta_value FROM tbl_order_itemmeta oim2
                                                           WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1), '0') AS UNSIGNED)
                          AND pm.meta_key = 'hsn' LIMIT 1), ''),
                (SELECT pm2.meta_value FROM tbl_productmeta pm2 WHERE pm2.product_id = oi.product_id AND pm2.meta_key = 'hsn' LIMIT 1)
              )) AS hsn_code,
              (SELECT COALESCE(
                NULLIF((SELECT pm.meta_value FROM tbl_productmeta pm
                        WHERE pm.product_id = CAST(NULLIF((SELECT oim2.meta_value FROM tbl_order_itemmeta oim2
                                                           WHERE oim2.order_item_id = oi.order_item_id AND oim2.meta_key = '_variation_id' LIMIT 1), '0') AS UNSIGNED)
                          AND pm.meta_key = 'tax' LIMIT 1), ''),
                (SELECT pm2.meta_value FROM tbl_productmeta pm2 WHERE pm2.product_id = oi.product_id AND pm2.meta_key = 'tax' LIMIT 1)
              )) AS tax_percent
       FROM tbl_order_items oi
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId],
    );

    const effectiveItems = selectEffectiveOrderItems(allItems, orderRow.subtotal);
    const orderDate      = new Date(orderRow.order_date);
    const orderDateStr   = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    const invoiceNumber  = await getOrCreateInvoiceNumber(orderId, orderRow.order_date);

    const html = renderInvoice({
      store: {
        name:         process.env.STORE_NAME           || 'Nestcase',
        address1:     process.env.STORE_ADDRESS_1      || '',
        address2:     process.env.STORE_ADDRESS_2      || '',
        cityStatePin: process.env.STORE_CITY_STATE_PIN || '',
        phone:        process.env.STORE_PHONE          || '',
        email:        process.env.SMTP_SENDER_EMAIL    || '',
        gstin:        process.env.STORE_GSTIN          || '',
        pan:          process.env.STORE_PAN            || '',
      },
      defaultGstRate: parseFloat(process.env.DEFAULT_GST_RATE || '18'),
      order: {
        invoiceNo:      invoiceNumber,
        orderId:        orderRow.sr_cart_id || orderId,
        dateStr:        orderDateStr,
        payMethod:      (orderRow.payment_method || 'cod').toUpperCase(),
        isCOD:          (orderRow.payment_method || 'cod').toLowerCase() === 'cod',
        razorpayMethod: orderRow.razorpay_method || null,
        awbCode:        orderRow.awb_code     || '',
        courierName:    orderRow.courier_name || '',
        supplierRef:    orderRow.sr_cart_id   || String(orderId),
        otherRef:       orderRow.awb_code     || '',
      },
      billing: {
        name:  [orderRow.billing_first_name, orderRow.billing_last_name].filter(Boolean).join(' '),
        addr1: orderRow.billing_address_1 || '',
        addr2: orderRow.billing_address_2 || '',
        city:  orderRow.billing_city      || '',
        state: orderRow.billing_state     || '',
        pin:   orderRow.billing_postcode  || '',
        phone: orderRow.billing_phone     || '',
        email: orderRow.user_email        || '',
      },
      shipping: {
        name:  [orderRow.ship_first_name, orderRow.ship_last_name].filter(Boolean).join(' ')
               || [orderRow.billing_first_name, orderRow.billing_last_name].filter(Boolean).join(' '),
        addr1: orderRow.ship_address_1 || orderRow.billing_address_1 || '',
        addr2: orderRow.ship_address_2 || orderRow.billing_address_2 || '',
        city:  orderRow.ship_city      || orderRow.billing_city      || '',
        state: orderRow.ship_state     || orderRow.billing_state     || '',
        pin:   orderRow.ship_postcode  || orderRow.billing_postcode  || '',
      },
      totals: {
        subtotal:   toAmount(orderRow.subtotal        || 0),
        shipping:   toAmount(orderRow.shipping        || 0),
        discount:   toAmount(orderRow.coupon_discount || 0),
        total:      toAmount(orderRow.total           || 0),
        couponCode: orderRow.coupon_code || '',
      },
      items: effectiveItems,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('downloadMyInvoice error:', err);
    res.status(500).send('Failed to generate invoice');
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getMyOrderById,
  trackOrderByPhone,
  trackOrderById,
  getAllOrders,
  resolveLinkedUserIds,
  updateOrderStatus,
  getDefaultAddress,
  setDefaultAddress,
  getRecentOrderAddresses,
  getSavedAddresses,
  getProfileAddresses,
  updateProfileAddress,
  getShippingRate,
  getTrackingStatus,
  createShiprocketOrder,
  getOrderWigzoData,
  downloadInvoice,
  downloadMyInvoice,
};
