const db = require("../config/db");
const {
  sendEmail: sendBrevoEmail,
  gatherCancellationEmailData,
  escHtml,
  fmtMoney,
  toStr,
  LOGO_URL,
  OWNER_EMAILS,
} = (() => {
  const webhook = require("./shiprocketorderwebhook");
  const { sendEmail } = require("./mailer");
  return { sendEmail, ...webhook };
})();

const axios = require("axios");
const { getShiprocketToken } = require("./shiprocketAuth");

// ── Status flow ─────────────────────────────────────────────────────
const RETURN_STATUS = Object.freeze({
  REQUESTED:        "Return Requested",
  APPROVED:         "Approved",
  REJECTED:         "Rejected",
  IN_PROGRESS:      "Return In Progress",
  RETURNED:         "Returned",
  REFUND_PROCESSED: "Refund Processed",
  COMPLETED:        "Completed",
});

const RETURN_REASON_LABELS = {
  damaged_product:  "Damaged product",
  wrong_item:       "Wrong item received",
  quality_issue:    "Product quality issue",
  no_longer_needed: "Item no longer needed",
  other:            "Other",
};

function formatReturnReason(reasonKey, customReason) {
  const key    = toStr(reasonKey);
  const custom = toStr(customReason);
  if (!key) return custom || "Not specified";
  if (key === "other") return custom ? `Other — ${custom}` : "Other (no details given)";
  const label = RETURN_REASON_LABELS[key];
  if (label) return custom ? `${label} — ${custom}` : label;
  // Unknown key — treat as free text (covers older clients / manual API calls).
  return custom ? `${key} — ${custom}` : key;
}

// Statuses that make an order eligible to *start* a return.
const DELIVERED_STATUSES = new Set(["delivered", "completed"]);


async function getReturnInfo(orderId) {
  const [[row]] = await db.query(
    `SELECT
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_return_status'
        ORDER BY meta_id DESC LIMIT 1) AS return_status,
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_return_reason'
        ORDER BY meta_id DESC LIMIT 1) AS return_reason,
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_return_reason_note'
        ORDER BY meta_id DESC LIMIT 1) AS return_custom_reason,
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_return_requested_at'
        ORDER BY meta_id DESC LIMIT 1) AS return_requested_at,
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_return_customer_email'
        ORDER BY meta_id DESC LIMIT 1) AS return_customer_email`,
    [orderId, orderId, orderId, orderId, orderId],
  );
  if (!row || !row.return_status) return null;

  const reasonKey = row.return_reason || "";
  return {
    return_status:        row.return_status,
    return_reason:         reasonKey || null,
    return_reason_label:   reasonKey ? (RETURN_REASON_LABELS[reasonKey] || reasonKey) : null,
    return_custom_reason:  row.return_custom_reason || null,
    return_requested_at:   row.return_requested_at || null,
    return_customer_email: row.return_customer_email || null,
  };
}


function isReturnEligible(orderStatus, existingReturnInfo) {
  if (existingReturnInfo) return false;
  const cleanStatus = toStr(orderStatus).replace(/^wc-/, "").trim().toLowerCase();
  return DELIVERED_STATUSES.has(cleanStatus);
}

// ══════════════════════════════════════════════════════════════════════════
// Automatic Shiprocket reverse-pickup creation
//
// Mirrors cancelOnShiprocketPanel's philosophy for cancellations: the moment
// the customer submits a return request we try to schedule the reverse pickup
// on Shiprocket ourselves via their "Create Return Order" API, instead of
// leaving it for an admin to create manually on the Shiprocket panel. If the
// automated call fails for any reason (missing config, address issue, SR
// down, etc.) we never block the customer — the return request is still
// recorded as "Return Requested" and ops gets an email flagging that manual
// creation on Shiprocket is needed, exactly like the pre-existing behaviour.
// ══════════════════════════════════════════════════════════════════════════

// The address returns are shipped BACK to (your warehouse / return facility).
// Reuses the existing STORE_* invoice fields already in .env (STORE_NAME,
// STORE_ADDRESS_1, STORE_PHONE) so nothing needs to be duplicated — the only
// two things not already broken out anywhere in .env are city/state, so those
// get their own small SHIPROCKET_RETURN_CITY / SHIPROCKET_RETURN_STATE vars.
// Everything else has a SHIPROCKET_RETURN_* override available if the return
// facility ever differs from the store/invoice address.
function getReturnWarehouseAddress() {
  const name    = toStr(process.env.SHIPROCKET_RETURN_WAREHOUSE_NAME || process.env.STORE_NAME);
  const address = toStr(process.env.SHIPROCKET_RETURN_ADDRESS || process.env.STORE_ADDRESS_1);
  const city    = toStr(process.env.SHIPROCKET_RETURN_CITY);
  const state   = toStr(process.env.SHIPROCKET_RETURN_STATE);
  const pincode = toStr(
    process.env.SHIPROCKET_RETURN_PINCODE ||
    process.env.SHIPROCKET_PICKUP_PINCODE ||
    process.env.STORE_CITY_STATE_PIN,
  );
  const phone = toStr(process.env.SHIPROCKET_RETURN_PHONE || process.env.STORE_PHONE);
  const email = toStr(
    process.env.SHIPROCKET_RETURN_EMAIL ||
    process.env.SMTP_SENDER_EMAIL ||
    process.env.SHIPROCKET_EMAIL,
  );

  if (!name || !address || !city || !state || !pincode || !phone) return null;

  return {
    name,
    address,
    address2: toStr(process.env.SHIPROCKET_RETURN_ADDRESS_2),
    city,
    state,
    pincode,
    phone,
    email: email || "returns@nestcase.in",
  };
}

const PINCODE_RE = /^\d{6}$/;
const digits10 = (v) => toStr(v).replace(/\D/g, "").slice(-10);

// Line items + total shipment weight for the reverse pickup, built the same
// way the forward order was (sku = product_id, weight from tbl_productmeta
// 'weight', defaulting to 0.5kg per unit — same default used at checkout).
// Two queries total regardless of item count (no N+1).
async function getReturnShipmentItems(orderId) {
  const [items] = await db.query(
    `SELECT oi.order_item_name AS title, oi.product_id,
            MAX(CASE WHEN oim.meta_key = '_qty'        THEN oim.meta_value END) AS qty,
            MAX(CASE WHEN oim.meta_key = '_line_total'  THEN oim.meta_value END) AS line_total
     FROM tbl_order_items oi
     LEFT JOIN tbl_order_itemmeta oim ON oim.order_item_id = oi.order_item_id
     WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
     GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
    [orderId],
  );
  if (!items.length) return { orderItems: [], totalWeight: 0.5 };

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  let weightByProduct = {};
  if (productIds.length) {
    const [weightRows] = await db.query(
      `SELECT product_id, meta_value FROM tbl_productmeta
       WHERE product_id IN (?) AND meta_key = 'weight'`,
      [productIds],
    );
    weightByProduct = Object.fromEntries(weightRows.map((r) => [r.product_id, Number(r.meta_value) || 0]));
  }

  const orderItems = [];
  let totalWeight = 0;

  for (const item of items) {
    const qty       = Number(item.qty || 0) || 1;
    const lineTotal = Number(item.line_total || 0);
    const price     = lineTotal ? Number((lineTotal / qty).toFixed(2)) : 0;
    const unitWeight = weightByProduct[item.product_id] || 0.5;
    totalWeight += unitWeight * qty;

    orderItems.push({
      name: item.title || `Product #${item.product_id}`,
      sku: String(item.product_id),
      units: qty,
      selling_price: price,
      discount: 0,
      qc_enable: false,
    });
  }

  return { orderItems, totalWeight: totalWeight || 0.5 };
}

// POST with a single automatic retry if the token turns out to be stale
// (401) — same defensive pattern as cancelOnShiprocketPanel's AWB-cancel call.
async function postToShiprocket(url, payload, token) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    return await axios.post(url, payload, { headers, timeout: 15000 });
  } catch (err) {
    if (err.response?.status === 401) {
      const freshToken = await getShiprocketToken(true);
      return axios.post(url, payload, {
        headers: { ...headers, Authorization: `Bearer ${freshToken}` },
        timeout: 15000,
      });
    }
    throw err;
  }
}

// Calls Shiprocket's "Create Return Order" API to schedule a reverse pickup
// from the customer's shipping address back to our warehouse. Never throws —
// callers get { created: false, stage, reason } on any failure so the return
// request can still fall back to the existing manual-review email flow.
// IMPORTANT: this makes a network call and should be invoked *after* the DB
// transaction that recorded the return request has already committed —
// never hold a row lock open across an external HTTP call.
const createReturnOnShiprocketPanel = async (orderId) => {
  const warehouse = getReturnWarehouseAddress();
  if (!warehouse) {
    return {
      created: false,
      stage: "config",
      reason: "Warehouse/return address is not fully configured (need SHIPROCKET_RETURN_CITY + SHIPROCKET_RETURN_STATE at minimum — everything else falls back to STORE_* / SHIPROCKET_PICKUP_PINCODE).",
    };
  }
  const warehousePincode = toStr(warehouse.pincode).trim();
  const warehousePhone   = digits10(warehouse.phone);
  if (!PINCODE_RE.test(warehousePincode)) {
    return { created: false, stage: "config", reason: `Warehouse pincode "${warehouse.pincode}" is not a valid 6-digit pincode` };
  }
  if (warehousePhone.length !== 10) {
    return { created: false, stage: "config", reason: `Warehouse phone "${warehouse.phone}" is not a valid 10-digit number` };
  }

  const data = await gatherCancellationEmailData(orderId);
  if (!data) {
    return { created: false, stage: "order_lookup", reason: "Could not load order/customer data" };
  }

  const addr = data.shippingAddr || {};
  const customerPincode = toStr(addr.zip).trim();
  const customerPhone   = digits10(data.customerPhone);
  if (!addr.line1 || !addr.city || !addr.state) {
    return { created: false, stage: "address", reason: "Customer shipping address on file is missing address line, city, or state" };
  }
  if (!PINCODE_RE.test(customerPincode)) {
    return { created: false, stage: "address", reason: `Customer pincode "${addr.zip}" is not a valid 6-digit pincode` };
  }
  if (customerPhone.length !== 10) {
    return { created: false, stage: "address", reason: "Customer phone on file is missing or not a valid 10-digit number" };
  }

  const { orderItems, totalWeight } = await getReturnShipmentItems(orderId);
  if (!orderItems.length) {
    return { created: false, stage: "items", reason: "No line items found for this order" };
  }

  let token;
  try {
    token = await getShiprocketToken();
  } catch (err) {
    try {
      token = await getShiprocketToken(true);
    } catch (err2) {
      return { created: false, stage: "auth", reason: err2.message };
    }
  }

  const subTotal = orderItems.reduce((sum, i) => sum + i.selling_price * i.units, 0);

  const srPayload = {
    order_id: `RET_${orderId}_${Date.now()}`,
    order_date: new Date().toISOString().slice(0, 10),

    // Pickup = FROM the customer (their delivery address)
    pickup_customer_name: addr.firstName || data.customerName || "Customer",
    pickup_last_name: addr.lastName || "",
    pickup_address: addr.line1,
    pickup_address_2: addr.line2 || "",
    pickup_city: addr.city,
    pickup_state: addr.state,
    pickup_country: "India",
    pickup_pincode: customerPincode,
    pickup_email: data.customerEmail || "noemail@example.com",
    pickup_phone: customerPhone,
    pickup_isd_code: "91",

    // Shipping (destination) = TO our warehouse/return facility
    shipping_customer_name: warehouse.name,
    shipping_address: warehouse.address,
    shipping_address_2: warehouse.address2 || "",
    shipping_city: warehouse.city,
    shipping_country: "India",
    shipping_pincode: warehousePincode,
    shipping_state: warehouse.state,
    shipping_email: warehouse.email,
    shipping_isd_code: "91",
    shipping_phone: warehousePhone,

    order_items: orderItems,
    payment_method: (data.paymentMethod || "").toLowerCase() === "cod" ? "COD" : "Prepaid",
    sub_total: Number(data.total) > 0 ? Number(data.total) : subTotal,
    length: 10, breadth: 10, height: 10, weight: totalWeight,
  };

  try {
    const res = await postToShiprocket(
      "https://apiv2.shiprocket.in/v1/external/orders/create/return",
      srPayload,
      token,
    );
    console.log(`[createReturnOnShiprocketPanel] order ${orderId} → SR response:`, res.data);

    const srOrderId  = res.data?.order_id || null;
    const shipmentId = res.data?.shipment_id || null;

    if (!srOrderId && !shipmentId) {
      return {
        created: false,
        stage: "response",
        reason: "Shiprocket returned HTTP 200 but no order/shipment id — treating as not created",
        raw: res.data,
      };
    }

    return { created: true, srOrderId, shipmentId, raw: res.data };
  } catch (err) {
    const srErr = err.response?.data;
    console.error(`[createReturnOnShiprocketPanel] SR return-create failed for order ${orderId}:`, JSON.stringify(srErr || err.message));
    console.error(`[createReturnOnShiprocketPanel] payload sent:`, JSON.stringify(srPayload, null, 2));
    return {
      created: false,
      stage: "api",
      reason: srErr?.message || err.message || "Shiprocket API call failed",
      raw: srErr,
    };
  }
};

// ── Admin email ──────────────────────────────────────────────────────────────
function buildReturnRequestEmailHtml({
  orderId, srCartId, requestedAt, customerName, customerEmail, customerPhone,
  shippingAddr, items, total, paymentMethod, awb, shipmentId, courierName,
  reasonLabel, srStatus,
}) {
  const payLabel = (paymentMethod || "").toLowerCase() === "cod" ? "Cash on Delivery" : "Online Payment";

  const autoCreated = !!(srStatus && srStatus.created);
  const bannerBg     = autoCreated ? "#e8f5e9" : "#e3f2fd";
  const bannerBorder = autoCreated ? "#c8e6c9" : "#bbdefb";
  const bannerColor  = autoCreated ? "#2e7d32" : "#0d47a1";
  const bannerHtml = autoCreated
    ? `&#9989; <strong>Reverse pickup auto-scheduled on Shiprocket</strong> — no action needed. Shiprocket return order
       <strong>${escHtml(srStatus.srOrderId ? String(srStatus.srOrderId) : "—")}</strong>${srStatus.shipmentId ? ` (shipment ${escHtml(String(srStatus.shipmentId))})` : ""}
       has been created and a courier will be assigned for pickup.`
    : `&#9888;&#65039; <strong>Could not auto-schedule the reverse pickup on Shiprocket</strong>${srStatus && srStatus.reason ? ` — ${escHtml(srStatus.reason)}` : ""}.
       Please create the return manually on the Shiprocket panel, then update its status here.`;

  const itemRows = (items || []).map((item) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#1b1b1b;font-family:Arial,sans-serif;">
        ${escHtml(item.title)}${item.sku ? `<div style="font-size:11px;color:#888;">SKU: ${escHtml(item.sku)}</div>` : ""}
      </td>
      <td style="padding:8px 12px;text-align:center;font-size:13px;color:#444;font-family:Arial,sans-serif;">${escHtml(String(item.quantity))}</td>
      <td style="padding:8px 12px;text-align:right;font-size:13px;color:#444;font-family:Arial,sans-serif;">&#8377;${fmtMoney(item.price)}</td>
    </tr>`).join("");

  const addrLines = [
    shippingAddr.line1, shippingAddr.line2, shippingAddr.city,
    (shippingAddr.state && shippingAddr.zip) ? `${shippingAddr.state} - ${shippingAddr.zip}` : (shippingAddr.state || shippingAddr.zip),
    "India",
  ].filter(Boolean).map(escHtml).join("<br>");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">

      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>

      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:${bannerBg};border-bottom:1px solid ${bannerBorder};">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:${bannerColor};">
            ${bannerHtml}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order Return Request</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          The customer requested a return for order <strong>#NC${escHtml(String(orderId))}</strong> on
          ${escHtml(requestedAt)}. It is showing as <strong>"Return Requested"</strong> on their Order Details page.
        </p>

        <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
          <tr>
            <td width="50%" style="padding:0 5px 0 0;vertical-align:top;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;">
                <tr><td style="padding:10px 8px;text-align:center;">
                  <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Order ID</div>
                  <div style="font-size:13px;font-weight:700;color:#222;font-family:Arial,sans-serif;">#NC${escHtml(String(orderId))}</div>
                </td></tr>
              </table>
            </td>
            <td width="50%" style="padding:0 0 0 5px;vertical-align:top;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:2px solid #90caf9;border-radius:8px;">
                <tr><td style="padding:10px 8px;text-align:center;">
                  <div style="font-size:10px;color:#0d47a1;margin-bottom:3px;font-family:Arial,sans-serif;">Shiprocket Reference (sr_cart_id)</div>
                  <div style="font-size:13px;font-weight:700;color:#0d47a1;font-family:Arial,sans-serif;">${escHtml(srCartId || "—")}</div>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>

        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Return Reason</h3>
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#333;font-family:Arial,sans-serif;">
            ${escHtml(reasonLabel || "Not specified")}
          </td></tr>
        </table>

        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Shipment Details</h3>
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr>
            <td width="33%" style="padding:10px 14px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">AWB</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(awb || "—")}</div></td>
            <td width="33%" style="padding:10px 14px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">Shipment ID</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(shipmentId || "—")}</div></td>
            <td width="34%" style="padding:10px 14px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">Courier</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(courierName || "—")}</div></td>
          </tr>
        </table>

        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Customer</h3>
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr>
            <td width="50%" style="padding:10px 14px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">Name</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(customerName)}</div></td>
            <td width="50%" style="padding:10px 14px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">Phone</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">+91 ${escHtml(customerPhone)}</div></td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px 14px 12px;"><div style="font-size:10px;color:#888;font-family:Arial,sans-serif;">Email</div><div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(customerEmail || "—")}</div></td>
          </tr>
        </table>

        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Shipping Address</h3>
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#333;line-height:1.8;font-family:Arial,sans-serif;">
            <strong>${escHtml([shippingAddr.firstName, shippingAddr.lastName].filter(Boolean).join(" "))}</strong><br>
            ${addrLines}${shippingAddr.phone ? `<br>+91 ${escHtml(shippingAddr.phone)}` : ""}
          </td></tr>
        </table>

        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Order Items</h3>
        <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #e4e4e4;border-radius:8px;overflow:hidden;margin:0 0 6px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="text-align:left;font-size:11px;padding:9px 12px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Product</th>
            <th style="text-align:center;font-size:11px;padding:9px 8px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Qty</th>
            <th style="text-align:right;font-size:11px;padding:9px 12px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Price</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr><td colspan="2" style="padding:4px 12px;text-align:right;font-size:13px;color:#666;font-family:Arial,sans-serif;">Payment Method</td>
              <td style="padding:4px 12px;text-align:right;font-size:13px;color:#333;font-family:Arial,sans-serif;">${escHtml(payLabel)}</td></tr>
            <tr style="background:#f9f9f9;"><td colspan="2" style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#1b1b1b;font-family:Arial,sans-serif;">Total</td>
              <td style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#1b1b1b;font-family:Arial,sans-serif;">&#8377;${fmtMoney(total)}</td></tr>
          </tfoot>
        </table>

        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          Once the return is resolved, update its status against this order so the customer sees the right info
          on their Order Details page.
        </p>
      </td></tr>

      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        This is an automated ops alert from Nestcase.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function getReturnEmailRecipients() {
  return OWNER_EMAILS.length
    ? OWNER_EMAILS
    : (process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_SENDER_EMAIL || "")
        .split(",").map((e) => e.trim()).filter(Boolean);
}

const notifyAdminOfReturnRequest = async ({ orderId, srCartId, requestedAt, awb, shipmentId, reasonLabel, srStatus }) => {
  const recipients = getReturnEmailRecipients();
  if (!recipients.length) {
    console.warn(`[notifyAdminOfReturnRequest] No RECEIVED_EMAIL configured — skipping alert for order ${orderId}`);
    return;
  }

  const data = await gatherCancellationEmailData(orderId);
  if (!data) {
    console.warn(`[notifyAdminOfReturnRequest] order ${orderId} not found — skipping alert`);
    return;
  }

  const html = buildReturnRequestEmailHtml({
    orderId, srCartId, requestedAt, awb, shipmentId, reasonLabel, srStatus, ...data,
  });

  const subjectPrefix = srStatus && srStatus.created
    ? "✅ Return Pickup Auto-Scheduled"
    : "↩️ Order Return Request — needs manual Shiprocket action";

  await Promise.all(
    recipients.map((toEmail) =>
      sendBrevoEmail({
        toEmail,
        subject: `${subjectPrefix} — Order #NC${orderId} (SR Cart: ${srCartId || "—"})`,
        html,
      }).catch((e) =>
        console.error(`[notifyAdminOfReturnRequest] alert email to ${toEmail} failed:`, e.message),
      ),
    ),
  );
};

// ── POST /orders/:orderId/return  (also mounted as /shiprocket/return-order) ─
// Accepts either a numeric internal order_id or a Shiprocket sr_cart_id /
// checkout order id in the same field — same convention as cancellation.
const createReturnRequest = async (req, res) => {
  const { getSessionUser } = require("./session");
  const rawId      = toStr(req.body.orderId || req.params.orderId || "");
  const inputPhone = toStr(req.body.phone || "").replace(/\D/g, "");
  const reasonKey       = toStr(req.body.reason || "");
  const customReasonRaw = toStr(req.body.customReason || "").slice(0, 500);
  const customerEmail   = toStr(req.body.email || "").trim(); // NEW: Accept email from frontend
  const sessionUser = getSessionUser(req);

  if (!rawId) {
    return res.status(400).json({ success: false, message: "orderId is required" });
  }
  if (inputPhone.length < 6 && !sessionUser) {
    return res.status(400).json({ success: false, message: "orderId and phone are required" });
  }
  if (!reasonKey) {
    return res.status(400).json({ success: false, message: "A return reason is required." });
  }
  if (reasonKey === "other" && !customReasonRaw) {
    return res.status(400).json({ success: false, message: "Please specify a reason for the return." });
  }
  // Email is required for return notifications
  if (!customerEmail) {
    return res.status(400).json({ success: false, message: "Email address is required for return updates." });
  }
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address." });
  }

  const reasonLabel = formatReturnReason(reasonKey, customReasonRaw);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Resolve sr_cart_id → internal order_id ──────────────────────────
    let orderId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(orderId) || orderId <= 0 || String(orderId) !== rawId) {
      const [[metaRow]] = await conn.query(
        `SELECT order_id FROM tbl_ordermeta
         WHERE meta_key IN ('_sr_cart_id', '_sr_checkout_order_id')
           AND meta_value = ? LIMIT 1`,
        [rawId],
      );
      if (!metaRow) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Order not found" });
      }
      orderId = metaRow.order_id;
    }

    // ── 2. Load order + phone (FOR UPDATE guards double-submit) ─────────────
    const [[order]] = await conn.query(
      `SELECT o.order_id, o.user_id, o.order_status, o.awb_code, o.shipment_id, o.sr_cart_id,
              COALESCE(
                MAX(CASE WHEN ua.address_billing = 'yes' THEN ua.phone END),
                (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_billing_phone' ORDER BY meta_id DESC LIMIT 1)
              ) AS billing_phone,
              COALESCE(
                MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.phone END),
                (SELECT meta_value FROM tbl_ordermeta WHERE order_id = o.order_id AND meta_key = '_shipping_phone' ORDER BY meta_id DESC LIMIT 1)
              ) AS ship_phone
       FROM tbl_orders o
       LEFT JOIN tbl_user_address ua ON ua.order_id = o.order_id
       WHERE o.order_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id
       FOR UPDATE`,
      [orderId],
    );
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ── 3. Verify caller — logged-in owner OR matching phone ────────────────
    let authorized = false;
    if (sessionUser) {
      const { resolveLinkedUserIds } = require("./orderController");
      const linkedIds = await resolveLinkedUserIds(sessionUser.id, sessionUser.email || "");
      authorized = linkedIds.includes(Number(order.user_id));

      if (!authorized) {
        const [phoneMetaRows] = await conn.query(
          `SELECT meta_key, meta_value FROM tbl_usermeta
           WHERE user_id = ? AND meta_key IN ('phone', 'billing_phone')`,
          [sessionUser.id],
        );
        const phoneMetaMap = Object.fromEntries(phoneMetaRows.map(r => [r.meta_key, r.meta_value]));
        const rawPhone = phoneMetaMap['phone'] || phoneMetaMap['billing_phone'] || '';
        const sessionPhone = rawPhone.replace(/\D/g, '').slice(-10);
        if (sessionPhone) {
          const billingDigits = toStr(order.billing_phone).replace(/\D/g, '').slice(-10);
          const shipDigits    = toStr(order.ship_phone).replace(/\D/g, '').slice(-10);
          authorized = (!!billingDigits && billingDigits === sessionPhone) ||
                       (!!shipDigits && shipDigits === sessionPhone);
        }
      }
    }
    if (!authorized && inputPhone.length >= 6) {
      const billingDigits = toStr(order.billing_phone).replace(/\D/g, "");
      const shipDigits    = toStr(order.ship_phone).replace(/\D/g, "");
      authorized =
        (billingDigits && (billingDigits.endsWith(inputPhone) || inputPhone.endsWith(billingDigits))) ||
        (shipDigits    && (shipDigits.endsWith(inputPhone)    || inputPhone.endsWith(shipDigits)));
    }
    if (!authorized) {
      await conn.rollback();
      return res.status(403).json({
        success: false,
        message: sessionUser
          ? "You are not allowed to return this order."
          : "Mobile number does not match this order",
      });
    }

    // ── 4. Guard: must be delivered, and no existing return already on file ─
    const existingReturn = await getReturnInfo(orderId);
    if (existingReturn) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: existingReturn.return_status === RETURN_STATUS.REQUESTED
          ? "A return request has already been submitted for this order."
          : `This order already has a return on file (status: ${existingReturn.return_status}).`,
      });
    }
    if (!isReturnEligible(order.order_status, null)) {
      await conn.rollback();
      const statusLower = toStr(order.order_status).toLowerCase();
      const message = statusLower === "cancelled"
        ? "Cancelled orders cannot be returned."
        : "This order is not eligible for return yet. Returns can be requested after delivery.";
      return res.status(400).json({ success: false, message });
    }

    // ── 5. Record the return request ────────────────────────────────────────
    const requestedAt = new Date().toISOString();
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_reason', ?)`,
      [orderId, reasonKey],
    );
    if (customReasonRaw) {
      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_reason_note', ?)`,
        [orderId, customReasonRaw],
      );
    }
    // Store customer email for return notifications (required field)
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_customer_email', ?)`,
      [orderId, customerEmail],
    );
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_requested_at', ?)`,
      [orderId, requestedAt],
    );

    // ── 5b. Try to auto-schedule the reverse pickup on Shiprocket right now —
    //       same philosophy as auto-cancel: no admin has to touch the
    //       Shiprocket panel for the happy path. If this fails for any
    //       reason we still record the request as "Return Requested" so the
    //       existing manual-review flow (admin panel → update status) keeps
    //       working exactly as before. ──────────────────────────────────────
    let srStatus = { created: false, stage: "not_attempted", reason: null };
    try {
      srStatus = await createReturnOnShiprocketPanel(orderId);
    } catch (srErr) {
      // createReturnOnShiprocketPanel is written to never throw, but keep a
      // last-resort safety net so a Shiprocket hiccup can never fail the
      // customer's return submission.
      srStatus = { created: false, stage: "unexpected_error", reason: srErr.message };
      console.error(`[createReturnRequest] SR return auto-create threw unexpectedly for order ${orderId}:`, srErr.response?.data || srErr.message);
    }

    const finalStatus = srStatus.created ? RETURN_STATUS.IN_PROGRESS : RETURN_STATUS.REQUESTED;

    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_status', ?)`,
      [orderId, finalStatus],
    );
    if (srStatus.created) {
      if (srStatus.srOrderId) {
        await conn.query(
          `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_shiprocket_order_id', ?)`,
          [orderId, String(srStatus.srOrderId)],
        );
      }
      if (srStatus.shipmentId) {
        await conn.query(
          `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_shipment_id', ?)`,
          [orderId, String(srStatus.shipmentId)],
        );
      }
    } else {
      console.warn(
        `[createReturnRequest] SR reverse-pickup auto-create failed for order ${orderId} ` +
        `(stage=${srStatus.stage}): ${srStatus.reason} — left as "${RETURN_STATUS.REQUESTED}" for manual handling.`,
      );
    }

    await conn.commit();
    console.log(
      `[createReturnRequest] ✅ Order ${orderId} → return requested (reason=${reasonKey}), ` +
      `shiprocket_auto_created=${srStatus.created}.`,
    );

    // Send admin notification
    notifyAdminOfReturnRequest({
      orderId,
      srCartId: toStr(order.sr_cart_id),
      requestedAt,
      awb: toStr(order.awb_code),
      shipmentId: toStr(order.shipment_id),
      reasonLabel,
      srStatus,
    }).catch((e) => console.error(`[createReturnRequest] admin email failed for order ${orderId}:`, e.message));

    // Send customer "Return Initiated" email (ONLY email #1)
    notifyCustomerOfReturnInitiated({
      orderId,
      customerEmail,
      reasonLabel,
      srStatus,
    }).catch((e) => console.error(`[createReturnRequest] customer initiated email failed for order ${orderId}:`, e.message));

    return res.json({
      success: true,
      message: srStatus.created
        ? "Your return request has been accepted and a courier pickup has been scheduled."
        : "Your return request has been submitted successfully. Our team has been notified and will review your request shortly.",
      return: {
        return_status: finalStatus,
        return_reason: reasonKey,
        return_reason_label: reasonLabel,
        return_custom_reason: customReasonRaw || null,
        return_requested_at: requestedAt,
        shiprocket_auto_created: srStatus.created,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("[createReturnRequest] error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to submit return request. Please try again or contact support." });
  } finally {
    conn.release();
  }
};

// ── Customer email notification for return decision ──────────────────────────
const notifyCustomerOfReturnDecision = async ({ orderId, status, notes }) => {
  // Fetch stored return customer email
  const [[emailRow]] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta 
     WHERE order_id = ? AND meta_key = '_return_customer_email' 
     ORDER BY meta_id DESC LIMIT 1`,
    [orderId]
  );
  const customerEmail = emailRow ? emailRow.meta_value : null;

  if (!customerEmail) {
    console.warn(`[notifyCustomerOfReturnDecision] No customer email on file for order ${orderId} — skipping`);
    return;
  }

  const isApproved = status === RETURN_STATUS.APPROVED;
  const bannerColor = isApproved ? "#e8f5e9" : "#ffebee";
  const bannerTextColor = isApproved ? "#2e7d32" : "#c62828";
  const icon = isApproved ? "✓" : "✕";
  const heading = isApproved ? "Return Request Approved" : "Return Request Declined";
  const message = isApproved
    ? "Your return request has been approved. Our team will provide you with return shipping instructions shortly."
    : "We're sorry, but your return request could not be approved at this time.";

  const notesHtml = notes ? `
    <div style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;padding:14px 16px;margin:20px 0;">
      <div style="font-size:11px;color:#888;margin-bottom:4px;font-family:Arial,sans-serif;">Message from our team</div>
      <div style="font-size:13px;color:#333;font-family:Arial,sans-serif;">${escHtml(notes)}</div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:${bannerColor};border-bottom:1px solid ${isApproved ? "#c8e6c9" : "#ffcdd2"};">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:${bannerTextColor};text-align:center;">
            <strong style="font-size:18px;">${icon}</strong> ${heading}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">${message}</p>
        ${notesHtml}
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          If you have any questions, please contact our support team.
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: customerEmail,
    subject: `${isApproved ? "✓" : "✕"} Return Request ${isApproved ? "Approved" : "Declined"} - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnDecision] email to ${customerEmail} failed:`, e.message),
  );
};

// ── Customer email: return request initiated ──────────────────────────────────
const notifyCustomerOfReturnInitiated = async ({ orderId, customerEmail, reasonLabel, srStatus }) => {
  const isAutoScheduled = srStatus && srStatus.created;
  const statusText = isAutoScheduled
    ? "Your return request has been accepted and a courier pickup has been scheduled automatically."
    : "Your return request has been received and is being processed. We'll notify you once the pickup is scheduled.";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e3f2fd;border-bottom:1px solid #bbdefb;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#0d47a1;text-align:center;">
            <strong style="font-size:18px;">&#8634;</strong> Return Request Initiated
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          ${statusText}
        </p>
        <div style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;padding:14px 16px;margin:20px 0;">
          <div style="font-size:11px;color:#888;margin-bottom:4px;font-family:Arial,sans-serif;">Return Reason</div>
          <div style="font-size:13px;color:#333;font-family:Arial,sans-serif;">${escHtml(reasonLabel)}</div>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          ${isAutoScheduled
            ? "A courier will contact you soon to pick up the item from your delivery address. Please keep the item ready with its original packaging."
            : "Our team is reviewing your request and will schedule a pickup shortly. You'll receive another email with pickup details."
          }
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          If you have any questions, please contact our support team.
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: customerEmail,
    subject: `↩️ Return Request Initiated - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnInitiated] email to ${customerEmail} failed:`, e.message),
  );
};

// ── Customer email: reverse pickup auto-scheduled (no admin step needed) ─────
const notifyCustomerOfReturnPickupScheduled = async ({ orderId, srOrderId, shipmentId, customerEmail }) => {
  // If customerEmail not passed, try to fetch from order meta
  let emailToUse = customerEmail;
  if (!emailToUse) {
    const [[emailRow]] = await db.query(
      `SELECT meta_value FROM tbl_ordermeta 
       WHERE order_id = ? AND meta_key = '_return_customer_email' 
       ORDER BY meta_id DESC LIMIT 1`,
      [orderId]
    );
    emailToUse = emailRow ? emailRow.meta_value : null;
  }

  if (!emailToUse) {
    console.warn(`[notifyCustomerOfReturnPickupScheduled] No customer email found for order ${orderId} — skipping`);
    return;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;text-align:center;">
            <strong style="font-size:18px;">&#128666;</strong> Return Pickup Scheduled
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          Your return request has been accepted and a courier pickup has been scheduled from your shipping address.
          You'll receive tracking updates as the courier is assigned and picks up the item.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          If you have any questions, please contact our support team.
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: emailToUse,
    subject: `🚚 Return Pickup Scheduled - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnPickupScheduled] email to ${emailToUse} failed:`, e.message),
  );
};

// ══════════════════════════════════════════════════════════════════════════
// Shiprocket Return Tracking Webhook Handler
// 
// Automatically updates return status to "Returned" when Shiprocket
// delivers the reverse pickup to your warehouse. This eliminates the
// manual step of marking returns as received in the admin panel.
//
// Webhook Setup: In your Shiprocket account, configure a shipment
// tracking webhook pointing to: POST /shiprocket/return-tracking-webhook
// ══════════════════════════════════════════════════════════════════════════

const receiveReturnTrackingWebhook = async (req, res) => {
  try {
    // ── 0. Token auth ─────────────────────────────────────────────────────
    // Same shared secret used by receiveShipmentWebhook (shiprocketorderwebhook.js).
    // Without this, anyone who can guess/observe an AWB or shipment_id (both
    // appear on shipping labels and tracking emails) could POST a fake
    // "delivered" payload and force stock to be auto-restored on a live
    // order. Returns 200 on rejection (not 401/403) so Shiprocket doesn't
    // retry-storm an unauthorised call, matching the sibling webhook's behaviour.
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
    const receivedToken =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
      "";
    if (expectedToken && receivedToken !== expectedToken) {
      console.warn("[Return Tracking Webhook] Unauthorised — token mismatch");
      return res.status(200).json({ success: false, message: "Unauthorised" });
    }

    console.log("[Return Tracking Webhook] Received payload:", JSON.stringify(req.body, null, 2));

    const body = req.body;
    const data = body?.data || body?.tracking_data || body || {};
    
    // Extract shipment info from various payload formats
    const shipmentTrack = data?.shipment_track?.[0] || data?.shipments?.[0] || data?.shipment || data;
    
    const shipmentId = toStr(
      body.shipment_id || data.shipment_id || shipmentTrack.shipment_id || shipmentTrack.id || ""
    );
    const awb = toStr(
      body.awb || body.awb_code || data.awb || data.awb_code || 
      shipmentTrack.awb_code || shipmentTrack.awb || ""
    );
    const currentStatus = toStr(
      body.current_status || body.status || data.current_status || 
      data.status || shipmentTrack.current_status || shipmentTrack.status || ""
    ).toLowerCase();

    if (!shipmentId && !awb) {
      console.warn("[Return Tracking Webhook] No shipment_id or AWB in payload — ignoring");
      return res.status(200).json({ success: true, message: "No shipment identifier" });
    }

    // Only process actual delivery statuses for returns
    // Shiprocket return delivery statuses: "delivered", "delivered to origin", "rto delivered", "dto delivered"
    // DO NOT match on "return" alone - that fires on "return pickup scheduled", "return in transit", etc.
    const statusLower = currentStatus.toLowerCase();
    const isDelivered = statusLower.includes("delivered") && 
                       (statusLower.includes("rto") || 
                        statusLower.includes("dto") || 
                        statusLower.includes("origin") ||
                        statusLower === "delivered");
    if (!isDelivered) {
      console.log(`[Return Tracking Webhook] Status "${currentStatus}" is not warehouse delivery — ignoring`);
      return res.status(200).json({ success: true, message: `Status ${currentStatus} ignored` });
    }

    // Find the order by matching return shipment identifiers (shipment_id, sr_order_id, or AWB)
    // Search multiple meta keys since different Shiprocket webhooks send different identifiers
    let orderId = null;
    
    if (shipmentId) {
      const [[orderByShipment]] = await db.query(
        `SELECT order_id FROM tbl_ordermeta
         WHERE meta_key IN ('_return_shipment_id', '_return_shiprocket_order_id')
         AND meta_value = ?
         LIMIT 1`,
        [shipmentId]
      );
      if (orderByShipment) orderId = orderByShipment.order_id;
    }
    
    // Fallback: Try matching by AWB code if shipment_id didn't match
    if (!orderId && awb) {
      const [[orderByAwb]] = await db.query(
        `SELECT o.order_id FROM tbl_orders o
         INNER JOIN tbl_ordermeta om ON om.order_id = o.order_id
         WHERE o.awb_code = ?
         AND om.meta_key = '_return_status'
         LIMIT 1`,
        [awb]
      );
      if (orderByAwb) orderId = orderByAwb.order_id;
    }

    if (!orderId) {
      console.warn(`[Return Tracking Webhook] No order found for shipment_id=${shipmentId}, awb=${awb} — ignoring`);
      return res.status(200).json({ success: true, message: "Order not found for this return shipment" });
    }

    // Check current return status — only update if not already "Returned" or later
    const returnInfo = await getReturnInfo(orderId);
    if (!returnInfo) {
      console.warn(`[Return Tracking Webhook] Order ${orderId} has no return request — ignoring`);
      return res.status(200).json({ success: true, message: "No return request on this order" });
    }

    const terminalStatuses = [
      RETURN_STATUS.RETURNED,
      RETURN_STATUS.REFUND_PROCESSED,
      RETURN_STATUS.COMPLETED
    ];
    if (terminalStatuses.includes(returnInfo.return_status)) {
      console.log(`[Return Tracking Webhook] Order ${orderId} already at "${returnInfo.return_status}" — no update needed`);
      return res.status(200).json({ success: true, message: "Return already in terminal status" });
    }

    // Update to "Returned" status
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Update return status to "Returned"
      await conn.query(
        `UPDATE tbl_ordermeta 
         SET meta_value = ?
         WHERE order_id = ? AND meta_key = '_return_status'`,
        [RETURN_STATUS.RETURNED, orderId]
      );

      // Record webhook-triggered update
      const timestamp = new Date().toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
         VALUES (?, '_return_admin_note', ?)`,
        [orderId, `[${timestamp}] Return delivered to warehouse (auto-updated by Shiprocket webhook)`]
      );

      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
         VALUES (?, '_return_status_updated_at', ?)`,
        [orderId, new Date().toISOString()]
      );

      // Auto-restore stock (with idempotency check)
      const [[alreadyRestored]] = await conn.query(
        `SELECT meta_id FROM tbl_ordermeta 
         WHERE order_id = ? AND meta_key = '_return_stock_restored' 
         LIMIT 1`,
        [orderId]
      );

      if (!alreadyRestored) {
        const { restoreOrderStock } = require("./shiprocketorderwebhook");
        await restoreOrderStock(conn, orderId);
        await conn.query(
          `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) 
           VALUES (?, '_return_stock_restored', ?)`,
          [orderId, new Date().toISOString()]
        );
        console.log(`[Return Tracking Webhook] ✅ Stock restored for order ${orderId}`);
      }

      await conn.commit();
      console.log(`[Return Tracking Webhook] ✅ Order ${orderId} updated to "Returned" status`);

      // NO customer email sent here - only send on final "Completed" status

      return res.status(200).json({ 
        success: true, 
        message: `Return status updated to "Returned" for order ${orderId}`,
        stock_restored: !alreadyRestored
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error("[Return Tracking Webhook] Error:", err.message);
    return res.status(500).json({ success: false, message: "Internal error processing webhook" });
  }
};

// ── Customer email: return received at warehouse ──────────────────────────────
const notifyCustomerOfReturnReceived = async ({ orderId }) => {
  // Fetch stored return customer email
  const [[emailRow]] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta 
     WHERE order_id = ? AND meta_key = '_return_customer_email' 
     ORDER BY meta_id DESC LIMIT 1`,
    [orderId]
  );
  const customerEmail = emailRow ? emailRow.meta_value : null;

  if (!customerEmail) {
    console.warn(`[notifyCustomerOfReturnReceived] No customer email on file for order ${orderId} — skipping`);
    return;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;text-align:center;">
            <strong style="font-size:18px;">&#9989;</strong> Return Received
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          Good news! We've received your returned item at our warehouse. Our team will inspect it shortly and process your refund within 3-5 business days.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          You'll receive another email once the refund has been initiated. If you have any questions, please contact our support team.
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: customerEmail,
    subject: `✓ Return Received - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnReceived] email to ${customerEmail} failed:`, e.message),
  );
};

// ── Customer email: refund processed ──────────────────────────────────────────
const notifyCustomerOfRefundProcessed = async ({ orderId }) => {
  const [[emailRow]] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta 
     WHERE order_id = ? AND meta_key = '_return_customer_email' 
     ORDER BY meta_id DESC LIMIT 1`,
    [orderId]
  );
  const customerEmail = emailRow ? emailRow.meta_value : null;

  if (!customerEmail) {
    console.warn(`[notifyCustomerOfRefundProcessed] No customer email on file for order ${orderId} — skipping`);
    return;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid#ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;text-align:center;">
            <strong style="font-size:18px;">&#128176;</strong> Refund Processed
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          Your refund has been processed! The amount will be credited to your original payment method within 5-7 business days depending on your bank.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          If you don't see the refund after 7 business days, please contact your bank or our support team.
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: customerEmail,
    subject: `💰 Refund Processed - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfRefundProcessed] email to ${customerEmail} failed:`, e.message),
  );
};

// ── Customer email: return completed ──────────────────────────────────────────
const notifyCustomerOfReturnCompleted = async ({ orderId }) => {
  const [[emailRow]] = await db.query(
    `SELECT meta_value FROM tbl_ordermeta 
     WHERE order_id = ? AND meta_key = '_return_customer_email' 
     ORDER BY meta_id DESC LIMIT 1`,
    [orderId]
  );
  const customerEmail = emailRow ? emailRow.meta_value : null;

  if (!customerEmail) {
    console.warn(`[notifyCustomerOfReturnCompleted] No customer email on file for order ${orderId} — skipping`);
    return;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34" style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>
      <tr><td style="padding:0;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#2e7d32;text-align:center;">
            <strong style="font-size:18px;">✅</strong> Return Completed
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">Order #NC${escHtml(String(orderId))}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          Your return has been completed successfully. Thank you for your patience throughout the process.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          We hope to serve you again soon. If you have any feedback, we'd love to hear from you!
        </p>
      </td></tr>
      <tr><td style="background:#f8f8f8;padding:14px 26px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
        Thank you for shopping with Nestcase.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendBrevoEmail({
    toEmail: customerEmail,
    subject: `✅ Return Completed - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnCompleted] email to ${customerEmail} failed:`, e.message),
  );
};

module.exports = {
  RETURN_STATUS,
  RETURN_REASON_LABELS,
  formatReturnReason,
  isReturnEligible,
  getReturnInfo,
  createReturnRequest,
  createReturnOnShiprocketPanel,
  notifyAdminOfReturnRequest,
  notifyCustomerOfReturnInitiated,
  notifyCustomerOfReturnDecision,
  notifyCustomerOfReturnPickupScheduled,
  notifyCustomerOfReturnReceived,
  notifyCustomerOfRefundProcessed,
  notifyCustomerOfReturnCompleted,
  receiveReturnTrackingWebhook,
};