const crypto = require("crypto");
const db     = require("../config/db");
const {
  validateAndLockCoupon,
  recordCouponUsage,
} = require("./couponController");
const { sendEmail: sendBrevoEmail } = require("./mailer");

// ── Email config ──────────────────────────────────────────────────────────────
const BASE_URL    = process.env.BASE_URL || "https://nestcase.in";
const LOGO_URL    = `${BASE_URL}/images/logo-white.png`;
const OWNER_EMAILS = (process.env.RECEIVED_EMAIL || "")
  .split(",").map((e) => e.trim()).filter(Boolean);

const buildImageUrl = (p) =>
  !p ? "" : p.startsWith("http") ? p : `${BASE_URL}/${p.replace(/^\/+/, "")}`;

const escHtml = (v) =>
  String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const fmtMoney = (v) => { const n = parseFloat(v); return isFinite(n) ? n.toFixed(2) : "0.00"; };

function buildOrderEmailHtml({ orderId, srCartId, orderDate, orderTime,
  paymentMethod, customerName, customerEmail, customerPhone,
  shippingAddr, items, subtotal, shippingCost, discount, couponCode, total }) {

  const payLabel    = (paymentMethod || "").toLowerCase() === "cod" ? "Cash on Delivery" : "Online Payment";
  const payStatus   = (paymentMethod || "").toLowerCase() === "cod" ? "COD - Pending" : "Paid";
  const payStatusColor = (paymentMethod || "").toLowerCase() === "cod" ? "#e65100" : "#2e7d32";

  // Info cards (Order ID, Reference, Date, Payment)
  const refCard = srCartId ? `
    <td width="25%" style="padding:0 5px;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;">
        <tr><td style="padding:10px 8px;text-align:center;">
          <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Order Reference ID</div>
          <div style="font-size:11px;font-weight:700;color:#222;font-family:Arial,sans-serif;">${escHtml(srCartId)}</div>
        </td></tr>
      </table>
    </td>` : "";

  const colW = srCartId ? "25%" : "33%";

  const infoCards = `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;">
      <tr>
        <td width="${colW}" style="padding:0 5px 0 0;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;">
            <tr><td style="padding:10px 8px;text-align:center;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Order ID</div>
              <div style="font-size:13px;font-weight:700;color:#222;font-family:Arial,sans-serif;">#NC${escHtml(String(orderId))}</div>
            </td></tr>
          </table>
        </td>
        ${refCard}
        <td width="${colW}" style="padding:0 5px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;">
            <tr><td style="padding:10px 8px;text-align:center;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Order Date</div>
              <div style="font-size:12px;font-weight:700;color:#222;font-family:Arial,sans-serif;">${escHtml(orderDate)}</div>
              <div style="font-size:11px;color:#666;font-family:Arial,sans-serif;">${escHtml(orderTime)}</div>
            </td></tr>
          </table>
        </td>
        <td width="${colW}" style="padding:0 0 0 5px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;">
            <tr><td style="padding:10px 8px;text-align:center;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Payment Method</div>
              <div style="font-size:12px;font-weight:700;color:#222;font-family:Arial,sans-serif;">${escHtml(payLabel)}</div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;

  // Product rows
  const productRows = items.map((item) => {
    const hasImage = typeof item.image === "string" && /^https?:\/\/.+/i.test(item.image.trim());
    const imgCell = hasImage
      ? `<td width="52" style="padding:10px 10px 10px 12px;vertical-align:middle;">
           <img src="${escHtml(item.image)}" width="44" height="44" alt=""
             style="display:block;border-radius:6px;object-fit:cover;border:1px solid #eee;background-color:#f0f0f0;" />
         </td>`
      : `<td width="52" style="padding:10px 10px 10px 12px;vertical-align:middle;">
           <div style="width:44px;height:44px;background:#f0f0f0;border-radius:6px;border:1px solid #e0e0e0;"></div>
         </td>`;
    const skuLine = item.sku
      ? `<div style="font-size:11px;color:#888;font-family:Arial,sans-serif;">SKU: ${escHtml(item.sku)}</div>` : "";
    const lTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
    return `
      <tr>
        ${imgCell}
        <td style="padding:10px 8px;vertical-align:middle;">
          <div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(item.title)}</div>
          ${skuLine}
        </td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:#444;font-family:Arial,sans-serif;vertical-align:middle;">&#8377;${fmtMoney(item.price)}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:#444;font-family:Arial,sans-serif;vertical-align:middle;">${escHtml(String(item.quantity))}</td>
        <td style="padding:10px 12px 10px 8px;text-align:right;font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;vertical-align:middle;">&#8377;${fmtMoney(lTotal)}</td>
      </tr>`;
  }).join("");

  const discountRow = discount > 0 ? `
    <tr>
      <td colspan="4" style="padding:4px 12px;text-align:right;font-size:13px;color:#666;font-family:Arial,sans-serif;">
        Discount${couponCode ? ` (${escHtml(couponCode)})` : ""}
      </td>
      <td style="padding:4px 12px;text-align:right;font-size:13px;color:#2e7d32;font-family:Arial,sans-serif;">-&#8377;${fmtMoney(discount)}</td>
    </tr>` : "";

  // Shipping address lines
  const addrLines = [
    shippingAddr.line1, shippingAddr.line2,
    shippingAddr.city,
    (shippingAddr.state && shippingAddr.zip)
      ? `${shippingAddr.state} - ${shippingAddr.zip}`
      : (shippingAddr.state || shippingAddr.zip),
    "India",
  ].filter(Boolean).map(escHtml).join("<br>");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f4;padding:28px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">

      <!-- HEADER: white bar with logo (logo artwork is dark green, needs a light background) -->
      <tr>
        <td style="background:#ffffff;padding:18px 26px;border-bottom:1px solid #eeeeee;">
          <img src="${escHtml(LOGO_URL)}" alt="Nestcase" height="34"
            style="display:block;max-height:34px;border:0;" />
        </td>
      </tr>

      <!-- BODY -->
      <tr><td style="padding:26px 26px 10px;">

        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">
          New Order Received &#x1F6D2;
        </h2>
        <p style="margin:0 0 4px;font-size:14px;color:#555;font-family:Arial,sans-serif;">Hello,</p>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          You have received a new order on your website <strong>Nestcase</strong>.<br>
          Please find the order details below.
        </p>

        ${infoCards}

        <!-- Customer Information -->
        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;
          border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Customer Information</h3>
        <table cellpadding="0" cellspacing="0" width="100%"
          style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr>
            <td width="50%" style="padding:10px 14px;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Customer Name</div>
              <div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(customerName)}</div>
            </td>
            <td width="50%" style="padding:10px 14px;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Email Address</div>
              <div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(customerEmail || "—")}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px 14px 12px;">
              <div style="font-size:10px;color:#888;margin-bottom:3px;font-family:Arial,sans-serif;">Phone Number</div>
              <div style="font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">+91 ${escHtml(customerPhone)}</div>
            </td>
          </tr>
        </table>

        <!-- Shipping Address -->
        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;
          border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Shipping Address</h3>
        <table cellpadding="0" cellspacing="0" width="100%"
          style="background:#f9f9f9;border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#333;line-height:1.8;font-family:Arial,sans-serif;">
            <strong>${escHtml([shippingAddr.firstName, shippingAddr.lastName].filter(Boolean).join(" "))}</strong><br>
            ${addrLines}
            ${shippingAddr.phone ? `<br>+91 ${escHtml(shippingAddr.phone)}` : ""}
          </td></tr>
        </table>

        <!-- Order Summary -->
        <h3 style="margin:0 0 10px;font-size:14px;color:#1b1b1b;font-family:Arial,sans-serif;
          border-bottom:2px solid #f0f0f0;padding-bottom:8px;">Order Summary</h3>
        <table cellpadding="0" cellspacing="0" width="100%"
          style="border-collapse:collapse;border:1px solid #e4e4e4;border-radius:8px;overflow:hidden;margin:0 0 6px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th colspan="2" style="text-align:left;font-size:11px;padding:9px 12px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Product Name</th>
              <th style="text-align:center;font-size:11px;padding:9px 8px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Price</th>
              <th style="text-align:center;font-size:11px;padding:9px 8px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Quantity</th>
              <th style="text-align:right;font-size:11px;padding:9px 12px;color:#555;font-weight:600;font-family:Arial,sans-serif;">Total</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:10px 12px;text-align:right;font-size:13px;color:#666;font-family:Arial,sans-serif;">Subtotal</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;color:#333;font-family:Arial,sans-serif;">&#8377;${fmtMoney(subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td colspan="4" style="padding:4px 12px;text-align:right;font-size:13px;color:#666;font-family:Arial,sans-serif;">Shipping</td>
              <td style="padding:4px 12px;text-align:right;font-size:13px;color:#333;font-family:Arial,sans-serif;">&#8377;${fmtMoney(shippingCost)}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td colspan="4" style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#1b1b1b;font-family:Arial,sans-serif;"><strong>Total</strong></td>
              <td style="padding:12px;text-align:right;font-size:14px;font-weight:700;color:#1b1b1b;font-family:Arial,sans-serif;"><strong>&#8377;${fmtMoney(total)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <!-- Payment Status -->
        <table cellpadding="0" cellspacing="0" width="100%"
          style="border:1px solid #e4e4e4;border-radius:8px;margin:0 0 20px;">
          <tr>
            <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1b1b1b;font-family:Arial,sans-serif;">Payment Status</td>
            <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700;
              color:${payStatusColor};font-family:Arial,sans-serif;">${escHtml(payStatus)}</td>
          </tr>
        </table>

        <!-- Note -->
        <p style="margin:0;font-size:11px;color:#888;line-height:1.7;font-family:Arial,sans-serif;">
          <strong>Note:</strong><br>
          This is an automated email. Please do not reply to this email.<br>
          If you have any questions, please contact us at
          <a href="mailto:support@nestcase.in" style="color:#555;">support@nestcase.in</a>
        </p>

      </td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#f8f8f8;padding:14px 26px;text-align:center;
          font-family:Arial,sans-serif;font-size:11px;color:#888;border-top:1px solid #e8e8e8;">
          This email has been sent to the following recipients:<br>
          <strong>support@nestcase.in, growbizzmedia@gmail.com</strong>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

async function sendOrderEmails({ orderId, srCartId, orderDate, orderTime,
  paymentMethod, customerName, customerEmail, customerPhone,
  shippingAddr, items, subtotal, shippingCost, discount, couponCode, total }) {

  const isValidEmail = (e) =>
    !!e &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) &&
    !e.includes("@shiprocket.guest") &&
    !e.includes("@guest.local");

  const html = buildOrderEmailHtml({ orderId, srCartId, orderDate, orderTime,
    paymentMethod, customerName, customerEmail, customerPhone,
    shippingAddr, items, subtotal, shippingCost, discount, couponCode, total });

  // Seller notification — always sent; subject includes SR cart ID as Order ID
  const srRef = srCartId ? ` | Order ID: ${srCartId}` : "";
  const sellerSubject = `New Order #NC${orderId}${srRef} | Nestcase`;

  const sends = [];

  // ── Customer confirmation — only if they entered a real email in the SR iframe ──
  if (isValidEmail(customerEmail)) {
    sends.push(
      sendBrevoEmail({
        toEmail: customerEmail,
        toName:  customerName,
        subject: `Order Confirmed - #NC${orderId}${srRef} | Nestcase`,
        html,
      }).catch((e) => console.error("[SR OW] Customer email failed:", e.message))
    );
  }

  // ── Seller notification — all RECEIVED_EMAIL addresses ──
  OWNER_EMAILS.forEach((ownerEmail) => {
    sends.push(
      sendBrevoEmail({ toEmail: ownerEmail, toName: "Store Admin", subject: sellerSubject, html })
        .catch((e) => console.error(`[SR OW] Owner email to ${ownerEmail} failed:`, e.message))
    );
  });

  await Promise.all(sends);
}

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

   //parseAddress
   
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
  // Shiprocket order webhooks do not include a buyer email field.
  // Keeping this as a safe future-proof fallback in case SR adds it later.
  // SR webhook rarely sends email at top level; more commonly it appears in billing_address.email
  const rawEnteredEmail = toStr(
    body.email || body.buyer_email || body.customer_email ||
    body.billing_address?.email || body.shipping_address?.email || ""
  );
  const isRealEmail = (e) =>
    !!e &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) &&
    !e.includes("@shiprocket.guest") &&
    !e.includes("@guest.local");
  const enteredEmail = isRealEmail(rawEnteredEmail) ? rawEnteredEmail.trim() : "";
  console.log("[SR OW][EMAIL-DEBUG] enteredEmail=", enteredEmail, "body.email=", body.email, "billing_address.email=", body.billing_address?.email);


  const paymentDetails = body.paymentDetails || {};
  const rawPaymentType = toStr(
    body.payment_type || body.payment_method || paymentDetails.paymentMode || "",
  ).toUpperCase();
  const paymentMethod  =
    rawPaymentType.includes("COD") || rawPaymentType.includes("CASH") ? "cod" :
    rawPaymentType ? "prepaid" : // any non-empty, non-COD mode (UPI/CARD/NETBANKING/WALLET/etc.) = paid online
    "cod"; // no payment info at all in the payload — safe default
  const paymentGateway = toStr(paymentDetails.paymentGateway || "");
  const paymentTransactionId = toStr(
    paymentDetails.transactionId || body.transaction_id || "",
  );
  const paymentAmount = toFloat(paymentDetails.amount, 0);
  const srOrderId = toStr(body.order_id || body.sr_order_id || cartId);
  console.log(
    `[SR OW][PAYMENT-CHECK] cart_id=${cartId} paymentMode(raw)=${paymentDetails.paymentMode || "—"} ` +
    `gateway=${paymentGateway || "—"} transactionId=${paymentTransactionId || "—"} ` +
    `amount=${paymentAmount || "—"} resolved_paymentMethod=${paymentMethod}`,
  );

  // ── COUPON/DISCOUNT DEBUG
  const couponLikeKeys = Object.keys(body).filter((k) =>
    /coupon|discount|promo|voucher/i.test(k),
  );
  console.log(
    `[SR OW][COUPON-CHECK] cart_id=${cartId} stage=${latestStage} ` +
    `total_price=${totalPrice} total_discount=${totalDiscount} ` +
    `coupon_code=${body.coupon_code ?? "—"} discount_code=${body.discount_code ?? "—"} ` +
    `all_discount_like_keys_in_body=${JSON.stringify(couponLikeKeys)}`,
  );

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
  const normalizePhone = (raw) => {
    const digits = toStr(raw).replace(/\D/g, ""); // strip everything except digits
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };
  const phone10 = normalizePhone(phone); // clean 10-digit phone used for storage & dedup

  let userId = 0;
  let userEmail = "";

  // ── Resolve user by phone — check all dedup paths before inserting ────────
  if (phone10) {
    // Path 1: matched by billing_phone usermeta (covers registered customers too)
    const [[userByPhone]] = await db.query(
      `SELECT u.ID, u.user_email
       FROM tbl_users u
       JOIN tbl_usermeta um ON um.user_id = u.ID
       WHERE um.meta_key = 'billing_phone' AND um.meta_value = ?
       ORDER BY u.ID ASC
       LIMIT 1`,
      [phone10],
    );
    if (userByPhone) {
      userId    = userByPhone.ID;
      userEmail = userByPhone.user_email;
    }

    // Path 2: matched by clean 10-digit phone as user_login (new format)
    if (!userId) {
      const [[userByLogin]] = await db.query(
        `SELECT ID, user_email FROM tbl_users
         WHERE user_login = ? AND user_type = 4
         ORDER BY ID ASC
         LIMIT 1`,
        [phone10],
      );
      if (userByLogin) {
        userId    = userByLogin.ID;
        userEmail = userByLogin.user_email;
      }
    }

    // Path 3: matched by old synthetic email format (backward compat for existing rows)
    if (!userId) {
      const oldSyntheticEmail = `${phone10}@shiprocket.guest`;
      const [[userByOldLogin]] = await db.query(
        `SELECT ID, user_email FROM tbl_users
         WHERE user_login = ? OR user_email = ?
         ORDER BY ID ASC
         LIMIT 1`,
        [oldSyntheticEmail, oldSyntheticEmail],
      );
      if (userByOldLogin) {
        userId    = userByOldLogin.ID;
        userEmail = userByOldLogin.user_email;
      }
    }

    // Path 4: matched by phone prefix on user_login (catches any other old variants)
    if (!userId) {
      const [[userByPrefix]] = await db.query(
        `SELECT ID, user_email FROM tbl_users
         WHERE user_login LIKE ? AND user_type = 4
         ORDER BY ID ASC
         LIMIT 1`,
        [`${phone10}@%`],
      );
      if (userByPrefix) {
        userId    = userByPrefix.ID;
        userEmail = userByPrefix.user_email;
      }
    }
  }

  // Path 5: create guest row only if all lookups above found nothing
  if (!userId && (phone10 || billing.firstName)) {
    const displayName = [billing.firstName, billing.lastName].filter(Boolean).join(" ") ||
                        phone10 || "Guest";
    // user_login = plain 10-digit phone; user_email = real email if entered, else empty
    const guestLogin = phone10 || `guest_${Date.now()}`;
    const guestEmailToStore = enteredEmail || "";

    try {
      // INSERT IGNORE skips silently if a unique constraint fires (race condition).
      // The SELECT immediately after always fetches the canonical row.
      await db.query(
        `INSERT IGNORE INTO tbl_users
         (user_type, user_login, user_pass, user_nicename, user_email, display_name, user_registered)
         VALUES (4, ?, '', ?, ?, ?, NOW())`,
        [guestLogin, displayName, guestEmailToStore, displayName],
      );
      const [[newRow]] = await db.query(
        `SELECT ID, user_email FROM tbl_users
         WHERE user_login = ?
         ORDER BY ID ASC
         LIMIT 1`,
        [guestLogin],
      );
      userId    = newRow ? newRow.ID : 0;
      userEmail = newRow ? newRow.user_email : guestEmailToStore;
    } catch (e) {
      console.error("[SR OrderWebhook] Guest user upsert failed:", e.message);
    }
  }

  // ── 5b. If we resolved an existing user AND have a real entered email,
  //        update their user_email if it's currently blank or stale
  if (userId && enteredEmail) {
    try {
      await db.query(
        `UPDATE tbl_users SET user_email = ? WHERE ID = ? AND (user_email = '' OR user_email IS NULL)`,
        [enteredEmail, userId],
      );
      // Always keep userEmail in sync with what we'll use for sending
      userEmail = enteredEmail;
    } catch (e) {
      console.error("[SR OrderWebhook] Email update failed (non-fatal):", e.message);
    }
  }

  // ── 6. Resolve items — use product_id from webhook, fetch live title from DB ─
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
    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified, sr_cart_id)
       VALUES (0, ?, ?, ?, '', 'processing', 'shop_order', NOW(), NOW(), ?)`,
      [userId, orderName, orderTitle, cartId],
    );
    const orderId = orderResult.insertId;

    // ── tbl_user_address (billing row) ─────────────────────────────────────────
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
        normalizePhone(billing.phone) || phone10 || "",
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
        normalizePhone(shipping.phone) || phone10 || "",
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
    const subtotalForDiscount = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Track how much discount we've allocated so far (avoid floating-point drift)
    let discountAllocated = 0;
    let firstOrderItemId  = null; // captured below for the WhatsApp/SMS (Wigzo) line_item_id

    for (const [itemIndex, item] of resolvedItems.entries()) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title, orderId, item.product_id],
      );
      const orderItemId  = itemResult.insertId;
      if (firstOrderItemId === null) firstOrderItemId = orderItemId;
      const lineSubtotal = item.price * item.quantity; // original pre-discount amount

      // Proportional discount for this line item.
      // Last item gets the remainder to avoid rounding drift across items.
      let lineDiscount = 0;
      if (totalDiscount > 0 && subtotalForDiscount > 0) {
        const isLastItem = itemIndex === resolvedItems.length - 1;
        if (isLastItem) {
          lineDiscount = Math.max(0, totalDiscount - discountAllocated);
        } else {
          lineDiscount = Math.round((lineSubtotal / subtotalForDiscount) * totalDiscount * 100) / 100;
          discountAllocated += lineDiscount;
        }
      }

      const lineTotal = Math.max(0, lineSubtotal - lineDiscount); // actual charged amount

      // ── COUPON/DISCOUNT DEBUG LOG #2 — per-item before/after price ──────────
      console.log(
        `[SR OrderWebhook][COUPON-CHECK] item="${item.title}" product_id=${item.product_id} ` +
        `qty=${item.quantity} unit_price=${item.price} ` +
        `line_subtotal(before_discount)=${lineSubtotal.toFixed(2)} ` +
        `line_discount_applied=${lineDiscount.toFixed(2)} ` +
        `line_total(after_discount)=${lineTotal.toFixed(2)} ` +
        `coupon_applied=${lineDiscount > 0 ? "YES — storing discounted price" : "NO — storing core product price"}`,
      );

      const itemMeta = [
        ["_product_id",       item.product_id],
        ["_variation_id",     0],               // no variants in your store
        ["_qty",              item.quantity],
        ["_line_subtotal",    lineSubtotal.toFixed(2)], // original price (pre-discount)
        ["_line_total",       lineTotal.toFixed(2)],    // actual price after coupon discount
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
    const couponCodeFromBody = toStr(body.coupon_code || body.discount_code || "");

    // ── COUPON/DISCOUNT DEBUG LOG #3 — order-level summary ─────────────────────
    console.log(
      `[SR OrderWebhook][COUPON-CHECK] SUMMARY cart_id=${cartId} ` +
      `subtotal(before_discount)=${subtotal.toFixed(2)} ` +
      `discount_from_SR=${discount.toFixed(2)} ` +
      `order_total(SR authoritative)=${orderTotal.toFixed(2)} ` +
      `coupon_code_field_present=${couponCodeFromBody ? `YES ("${couponCodeFromBody}")` : "NO"} ` +
      `will_store=${
        discount > 0
          ? couponCodeFromBody
            ? "_coupon_code + _coupon_discount + discounted _line_total"
            : "discounted _line_total ONLY (no coupon code field sent by SR — _coupon_code meta will be skipped)"
          : "core/original _line_total (no discount on this order)"
      }`,
    );

    const metaEntries = [
      ["_payment_method",       paymentMethod],
      ["_payment_method_title", paymentMethod === "cod"
                                   ? "Cash on Delivery"
                                   : (paymentGateway || rawPaymentType || "Online Payment")],
      // Real payment reference for online/prepaid orders — used to reconcile
      // with the payment gateway dashboard. Left unset for COD (no transaction).
      ...(paymentMethod !== "cod" && paymentTransactionId
          ? [["_transaction_id",  paymentTransactionId]]
          : []),
      ...(paymentMethod !== "cod" && paymentGateway
          ? [["_payment_gateway", paymentGateway]]
          : []),
      ...(paymentMethod !== "cod"
          ? [["_date_paid", createdAt]]
          : []),
      ["_order_currency",       currency],
      ["_order_total",          orderTotal.toFixed(2)],
      ["_order_subtotal",       subtotal.toFixed(2)],
      ["_order_shipping",       shippingCost.toFixed(2)],
      ["_order_tax",            tax.toFixed(2)],
      ["_order_item_count",     String(itemCount || resolvedItems.length)],
      ["_order_discount",       discount.toFixed(2)],
      // Coupon applied via Shiprocket Checkout — store code if present in webhook
      ...(couponCodeFromBody
          ? [["_coupon_code", couponCodeFromBody],
             ["_coupon_discount", discount.toFixed(2)]]
          : []),
      ["_billing_phone",        phone10],
      ["_billing_email",        enteredEmail || ""],
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
    console.log(`[SR OrderWebhook]    Customer: ${billing.firstName} ${billing.lastName} | Phone: ${phone10}`);
    console.log(`[SR OrderWebhook]    Total: ₹${orderTotal} | Items: ${resolvedItems.length}`);

    const buyerEmail = isRealEmail(enteredEmail)
      ? enteredEmail
      : isRealEmail(userEmail) ? userEmail : "";
    const couponFromMeta = toStr(body.coupon_code || body.discount_code || "");

    // ── Clear the server-side cart (best-effort, non-fatal) ───────────────
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

    try {
      const { createShiprocketOrder } = require("./orderController");

      // ── Aggregate real package dimensions from tbl_productmeta 
      let totalWeight = 0;
      let totalHeight = 0;
      let maxLength   = 0;
      let maxBreadth  = 0;

      for (const item of resolvedItems) {
        const [dimRows] = await db.query(
          `SELECT meta_key, meta_value
           FROM tbl_productmeta
           WHERE product_id = ?
             AND meta_key IN ('length', 'breadth', 'height', 'weight')`,
          [item.product_id],
        );

        const meta = {};
        dimRows.forEach((row) => { meta[row.meta_key] = toFloat(row.meta_value, 0); });

        const qty     = Number(item.quantity || 1);
        const pLen    = meta.length  || 10;
        const pBreadth= meta.breadth || 10;
        const pHeight = meta.height  || 2;
        const pWeight = meta.weight  || 0.5;

        totalWeight += pWeight * qty;
        totalHeight += pHeight * qty;
        maxLength    = Math.max(maxLength,  pLen);
        maxBreadth   = Math.max(maxBreadth, pBreadth);
      }

      // Final safe values — never send 0 to Shiprocket
      const pkgLength  = maxLength  || 10;
      const pkgBreadth = maxBreadth || 10;
      const pkgHeight  = totalHeight || 2;
      const pkgWeight  = totalWeight || 0.5;

      const srPayload = {
        order_id:               cartId,
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
        billing_phone:          normalizePhone(billing.phone) || phone10 || "0000000000",
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
        length: pkgLength, breadth: pkgBreadth, height: pkgHeight, weight: pkgWeight,
      };

      const shiprocketResponse = await createShiprocketOrder(srPayload);
      if (shiprocketResponse?.shipment_id) {
        console.log(`[SR OrderWebhook] ✅ Pushed to SR fulfillment panel — shipment_id=${shiprocketResponse.shipment_id}`);
        await db.query(
          `UPDATE tbl_orders SET shipment_id = ?, shipping_status = 'new' WHERE order_id = ?`,
          [shiprocketResponse.shipment_id, orderId],
        );
      }
      if (shiprocketResponse?.order_id) {
        await db.query(
          `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_shiprocket_order_id', ?)`,
          [orderId, String(shiprocketResponse.order_id)],
        );
        console.log(`[SR OrderWebhook] Stored _shiprocket_order_id=${shiprocketResponse.order_id}`);
      }
    } catch (e) {
      // Logged inside createShiprocketOrder too — keep this short
      console.error("[SR OrderWebhook] Fulfillment push failed (non-fatal):", e.message);
    }

    // ── Send order emails (fire-and-forget, non-blocking) ──────────────────────
    try {
      // Fetch product image + SKU for each item (for rich email display)
      const emailItems = [];
      for (const item of resolvedItems) {
        const [[imgRow]] = await db.query(
          `SELECT media_path AS img_path
           FROM tbl_media
           WHERE parent_id = ? AND media_type = 'product_image'
           ORDER BY media_id ASC LIMIT 1`,
          [item.product_id],
        );
        const [[skuRow]] = await db.query(
          `SELECT meta_value AS sku FROM tbl_productmeta
           WHERE product_id = ? AND meta_key = '_sku' LIMIT 1`,
          [item.product_id],
        );
        emailItems.push({
          title:    item.title,
          price:    item.price,
          quantity: item.quantity,
          image:    imgRow ? buildImageUrl(imgRow.img_path) : "",
          sku:      skuRow ? toStr(skuRow.sku) : "",
        });
      }

      const now       = new Date();
      const orderDate = now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
      const orderTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

      // buyerEmail is already declared in outer scope (right after commit) —
      // shared with the Wigzo block below, not redeclared here.
      const buyerName    = [billing.firstName, billing.lastName].filter(Boolean).join(" ") || "Customer";
      const buyerPhone   = phone10 || toStr(billing.phone || shipping.phone || "");
      // couponFromMeta is already declared in outer scope (right after commit) —
      // shared with the Wigzo block below, not redeclared here.

      await sendOrderEmails({
        orderId,
        srCartId:      cartId,
        orderDate,
        orderTime,
        paymentMethod,
        customerName:  buyerName,
        customerEmail: buyerEmail,
        customerPhone: buyerPhone,
        shippingAddr: {
          firstName: shipping.firstName || billing.firstName || "",
          lastName:  shipping.lastName  || billing.lastName  || "",
          line1:     shipping.line1     || billing.line1     || "",
          line2:     shipping.line2     || billing.line2     || "",
          city:      shipping.city      || billing.city      || "",
          state:     shipping.state     || billing.state     || "",
          zip:       shipping.zip       || billing.zip       || "",
          phone:     toStr(shipping.phone || billing.phone || ""),
        },
        items:       emailItems,
        subtotal,
        shippingCost,
        discount,
        couponCode:  couponFromMeta,
        total:       orderTotal,
      });

      console.log(`[SR OrderWebhook] Emails sent for order_id=${orderId}`);
    } catch (emailErr) {
      console.error("[SR OrderWebhook] Email send failed (non-fatal):", emailErr.message);
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

/*fetchSROrderDetails*/
const axios = require("axios");

const fetchSROrderDetails = async (srOrderId) => {
  const apiKey    = process.env.CHECKOUT_API_KEY    || "";
  const apiSecret = process.env.CHECKOUT_API_SECRET || "";

  if (!srOrderId || !apiKey) {
    return null;
  }

  try {
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


const { getShiprocketToken: getSRPanelToken } = require("./shiprocketAuth");

/** Resolve Shiprocket panel order ID (numeric) for cancel API. */
const resolveShiprocketPanelOrderId = async (conn, orderId, hints = {}) => {
  const [[metaRow]] = await conn.query(
    `SELECT meta_value FROM tbl_ordermeta
     WHERE order_id = ? AND meta_key = '_shiprocket_order_id'
     LIMIT 1`,
    [orderId],
  );
  if (metaRow?.meta_value) {
    const stored = Number(metaRow.meta_value);
    if (Number.isFinite(stored) && stored > 0) return stored;
  }

  let channelOrderId = toStr(hints.srCartId || hints.channelOrderId);
  if (!channelOrderId) {
    const [[cartMeta]] = await conn.query(
      `SELECT meta_value FROM tbl_ordermeta
       WHERE order_id = ? AND meta_key IN ('_sr_cart_id', '_sr_checkout_order_id')
       ORDER BY FIELD(meta_key, '_sr_cart_id', '_sr_checkout_order_id')
       LIMIT 1`,
      [orderId],
    );
    channelOrderId = toStr(cartMeta?.meta_value);
  }
  if (!channelOrderId) return null;

  try {
    const token = await getSRPanelToken();
    const searchRes = await axios.get(
      "https://apiv2.shiprocket.in/v1/external/orders",
      {
        params: { search: channelOrderId, per_page: 10 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
    );
    const orders = searchRes.data?.data || [];
    if (!Array.isArray(orders) || !orders.length) return null;

    const match =
      orders.find((o) => toStr(o.channel_order_id) === channelOrderId) ||
      orders.find((o) => toStr(o.id) === channelOrderId) ||
      orders[0];
    const srPanelOrderId = Number(match?.id);
    if (!Number.isFinite(srPanelOrderId) || srPanelOrderId <= 0) return null;

    const [[existing]] = await conn.query(
      `SELECT meta_id FROM tbl_ordermeta
       WHERE order_id = ? AND meta_key = '_shiprocket_order_id' LIMIT 1`,
      [orderId],
    );
    if (existing) {
      await conn.query(
        `UPDATE tbl_ordermeta SET meta_value = ? WHERE meta_id = ?`,
        [String(srPanelOrderId), existing.meta_id],
      );
    } else {
      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_shiprocket_order_id', ?)`,
        [orderId, String(srPanelOrderId)],
      );
    }
    return srPanelOrderId;
  } catch (err) {
    console.error(
      `[resolveShiprocketPanelOrderId] lookup failed for order ${orderId}:`,
      err.response?.data || err.message,
    );
    return null;
  }
};

const cancelOnShiprocketPanel = async ({ srPanelOrderId, awb, shipmentId, alreadyShipped }) => {
  // ── 0. Get a token, with one forced-refresh retry if the cached one is bad ──
  let token;
  try {
    token = await getSRPanelToken();
  } catch (err) {
    console.error(
      `[cancelOnShiprocketPanel] token fetch failed, retrying with forceRefresh:`,
      err.response?.data || err.message,
    );
    try {
      token = await getSRPanelToken(true);
    } catch (err2) {
      console.error(
        `[cancelOnShiprocketPanel] token fetch failed after forceRefresh — giving up:`,
        err2.response?.data || err2.message,
      );
      return { cancelled: false, stage: "auth", reason: err2.message };
    }
  }
  const srHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── 1. Cancel order (works pre-shipment; Shiprocket will reject/no-op if the
  //      order is already picked up by a courier) ─────────────────────────────
  if (srPanelOrderId) {
    try {
      const orderRes = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/orders/cancel",
        { ids: [Number(srPanelOrderId)] },
        { headers: srHeaders, timeout: 10000 },
      );
      const ok =
        orderRes.status === 200 &&
        (orderRes.data?.status === 200 ||
          /cancel/i.test(toStr(orderRes.data?.message)));
      console.log(`[cancelOnShiprocketPanel] order cancel id=${srPanelOrderId}:`, orderRes.data);
      if (ok) return { cancelled: true, stage: "order" };
    } catch (err) {
      console.error(
        `[cancelOnShiprocketPanel] order cancel failed id=${srPanelOrderId}:`,
        err.response?.data || err.message,
      );
    }
  }

  // ── 2. AWB cancel — the real path once a courier is assigned ────────────────
  if (awb) {
    try {
      const awbRes = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs",
        { awbs: [awb] },
        { headers: srHeaders, timeout: 10000 },
      );
      console.log(`[cancelOnShiprocketPanel] AWB cancel awb=${awb}:`, awbRes.data);
      if (awbRes.status === 200) return { cancelled: true, stage: "awb" };
    } catch (err) {
      console.error(
        `[cancelOnShiprocketPanel] AWB cancel failed awb=${awb}:`,
        err.response?.data || err.message,
      );
    }
  }

  // ── 3. Shipment cancel fallback ──────────────────────────────────────────────
  if (shipmentId) {
    try {
      const shipRes = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/shipments/cancel",
        { ids: [Number(shipmentId)] },
        { headers: srHeaders, timeout: 10000 },
      );
      console.log(`[cancelOnShiprocketPanel] shipment cancel id=${shipmentId}:`, shipRes.data);
      if (shipRes.status === 200) return { cancelled: true, stage: "shipment" };
    } catch (err) {
      console.error(
        `[cancelOnShiprocketPanel] shipment cancel failed id=${shipmentId}:`,
        err.response?.data || err.message,
      );
    }
  }


  return {
    cancelled: false,
    stage: "exhausted",
    reason: alreadyShipped
      ? "Order already shipped/AWB assigned — cancel/AWB/shipment calls all failed. Likely needs manual RTO on the Shiprocket panel."
      : "All cancel attempts failed before shipment — check credentials, order id resolution, and Shiprocket API status.",
  };
};

const restoreOrderStock = async (runner, orderId) => {
  const [orderItems] = await runner.query(
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
    const qty            = Number(item.qty || 0);
    const stockProductId = item.variation_id && Number(item.variation_id) > 0
      ? item.variation_id : item.product_id;
    if (!qty || !stockProductId) continue;

    await runner.query(
      `UPDATE tbl_productmeta
       SET meta_value = CAST(meta_value AS SIGNED) + ?
       WHERE product_id = ? AND meta_key = '_stock'`,
      [qty, stockProductId],
    );
    await runner.query(
      `UPDATE tbl_productmeta SET meta_value = 'instock'
       WHERE product_id = ? AND meta_key = '_stock_status' AND meta_value = 'outofstock'`,
      [stockProductId],
    );

    // Fire-and-forget: push updated stock to Shiprocket catalog
    const { sendProductUpdateWebhook } = require("./shiprocketWebhooks");
    sendProductUpdateWebhook(stockProductId).catch((e) =>
      console.error(`[restoreOrderStock] Stock webhook failed for product ${stockProductId}:`, e.message),
    );
  }
};


function buildCancellationRequestEmailHtml({
  orderId, srCartId, requestedAt, customerName, customerEmail, customerPhone,
  shippingAddr, items, total, paymentMethod, awb, shipmentId, courierName,
  mode = "pending", // "pending" = needs manual action | "auto_cancelled" = already done, FYI only
}) {
  const payLabel = (paymentMethod || "").toLowerCase() === "cod" ? "Cash on Delivery" : "Online Payment";
  const isAutoCancelled = mode === "auto_cancelled";

  const banner = isAutoCancelled
    ? `&#9989; <strong>FYI — no action needed:</strong> this order had already shipped (AWB assigned), but Shiprocket
       accepted the cancellation automatically. It's marked <strong>Cancelled</strong> and the customer has been
       notified via WhatsApp. Sharing the details below for your records.`
    : `&#9888;&#65039; <strong>Action needed:</strong> this order has already been shipped (AWB assigned), so it
       couldn't be cancelled automatically. Please cancel it manually on the
       <a href="https://app.shiprocket.in/seller/orders/all" style="color:#7a4a00;">Shiprocket seller panel</a>
       using the reference below.`;
  const bannerBg     = isAutoCancelled ? "#e8f5e9" : "#fff3e0";
  const bannerBorder = isAutoCancelled ? "#c8e6c9" : "#ffe0b2";
  const bannerColor  = isAutoCancelled ? "#256029" : "#7a4a00";

  const heading = isAutoCancelled ? "Order Cancelled (Shipped)" : "Cancellation Requested";
  const introText = isAutoCancelled
    ? `The customer requested cancellation of order <strong>#NC${escHtml(String(orderId))}</strong> on
       ${escHtml(requestedAt)}. It had already shipped, but Shiprocket cancelled it successfully — it's now
       showing as <strong>"Cancelled"</strong> to the customer.`
    : `The customer has requested cancellation of order <strong>#NC${escHtml(String(orderId))}</strong> on
       ${escHtml(requestedAt)}. It is showing as <strong>"Cancellation Requested"</strong> to the customer
       until it's cancelled on Shiprocket.`;
  const footerNote = isAutoCancelled
    ? `This order is fully cancelled — nothing further to do. Stock has been restored automatically.`
    : `Once this order is cancelled on the Shiprocket panel, Shiprocket's status webhook will automatically
       mark it cancelled here and the customer will get a WhatsApp cancellation notice — no further action
       needed beyond cancelling it there.`;

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
            ${banner}
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 26px 10px;">
        <h2 style="margin:0 0 6px;font-size:20px;color:#1b1b1b;font-family:Arial,sans-serif;">${escHtml(heading)}</h2>
        <p style="margin:0 0 22px;font-size:14px;color:#555;font-family:Arial,sans-serif;">
          ${introText}
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
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9f9f9;border:2px solid #ffb74d;border-radius:8px;">
                <tr><td style="padding:10px 8px;text-align:center;">
                  <div style="font-size:10px;color:#7a4a00;margin-bottom:3px;font-family:Arial,sans-serif;">Shiprocket Reference (sr_cart_id)</div>
                  <div style="font-size:13px;font-weight:700;color:#7a4a00;font-family:Arial,sans-serif;">${escHtml(srCartId || "—")}</div>
                </td></tr>
              </table>
            </td>
          </tr>
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
          ${footerNote}
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

async function gatherCancellationEmailData(orderId) {
  const [[order]] = await db.query(
    `SELECT o.order_id, o.courier_name, o.user_id,
            MAX(u.user_email) AS user_email,
            (SELECT om.meta_value FROM tbl_ordermeta om
             WHERE om.order_id = o.order_id AND om.meta_key = '_order_total' ORDER BY om.meta_id DESC LIMIT 1) AS total,
            (SELECT om.meta_value FROM tbl_ordermeta om
             WHERE om.order_id = o.order_id AND om.meta_key = '_payment_method' ORDER BY om.meta_id DESC LIMIT 1) AS payment_method,
            (SELECT om.meta_value FROM tbl_ordermeta om
             WHERE om.order_id = o.order_id AND om.meta_key = '_billing_email' ORDER BY om.meta_id DESC LIMIT 1) AS billing_email,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.first_name    END) AS ship_first_name,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.last_name     END) AS ship_last_name,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.address_line1 END) AS ship_line1,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.address_line2 END) AS ship_line2,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.city         END) AS ship_city,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.state_name   END) AS ship_state,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.zipcode      END) AS ship_zip,
            MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.phone        END) AS ship_phone,
            MAX(CASE WHEN ua.address_billing = 'yes' THEN ua.first_name   END) AS bill_first_name,
            MAX(CASE WHEN ua.address_billing = 'yes' THEN ua.last_name    END) AS bill_last_name,
            MAX(CASE WHEN ua.address_billing = 'yes' THEN ua.phone        END) AS bill_phone
     FROM tbl_orders o
     LEFT JOIN tbl_users u ON u.ID = o.user_id
     LEFT JOIN tbl_user_address ua ON ua.order_id = o.order_id
     WHERE o.order_id = ?
     GROUP BY o.order_id`,
    [orderId],
  );
  if (!order) return null;

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
  const itemsWithSku = [];
  for (const item of items) {
    const [[skuRow]] = await db.query(
      `SELECT meta_value AS sku FROM tbl_productmeta WHERE product_id = ? AND meta_key = '_sku' LIMIT 1`,
      [item.product_id],
    );
    const qty       = Number(item.qty || 0) || 1;
    const lineTotal = Number(item.line_total || 0);
    itemsWithSku.push({
      title: item.title, quantity: qty, price: lineTotal ? (lineTotal / qty) : 0,
      sku: skuRow ? toStr(skuRow.sku) : "",
    });
  }

  return {
    customerName: [order.ship_first_name || order.bill_first_name, order.ship_last_name || order.bill_last_name].filter(Boolean).join(" ") || "Customer",
    customerEmail: toStr(order.billing_email || order.user_email),
    customerPhone: toStr(order.ship_phone || order.bill_phone),
    shippingAddr: {
      firstName: order.ship_first_name || order.bill_first_name || "",
      lastName:  order.ship_last_name  || order.bill_last_name  || "",
      line1: order.ship_line1 || "", line2: order.ship_line2 || "",
      city: order.ship_city || "", state: order.ship_state || "", zip: order.ship_zip || "",
      phone: toStr(order.ship_phone || order.bill_phone),
    },
    items: itemsWithSku,
    total: order.total,
    paymentMethod: order.payment_method,
    courierName: order.courier_name,
  };
}

function getCancellationEmailRecipients() {
  return OWNER_EMAILS.length
    ? OWNER_EMAILS
    : (process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_SENDER_EMAIL || "")
        .split(",").map((e) => e.trim()).filter(Boolean);
}

const notifyAdminOfCancellationRequest = async ({ orderId, srCartId, requestedAt, awb, shipmentId }) => {
  const recipients = getCancellationEmailRecipients();
  if (!recipients.length) {
    console.warn(`[notifyAdminOfCancellationRequest] No RECEIVED_EMAIL configured — skipping alert for order ${orderId}`);
    return;
  }

  const data = await gatherCancellationEmailData(orderId);
  if (!data) {
    console.warn(`[notifyAdminOfCancellationRequest] order ${orderId} not found — skipping alert`);
    return;
  }

  const html = buildCancellationRequestEmailHtml({
    orderId, srCartId, requestedAt, awb, shipmentId, mode: "pending", ...data,
  });

  await Promise.all(
    recipients.map((toEmail) =>
      sendBrevoEmail({
        toEmail,
        subject: `🛑 Cancellation Requested — Order #NC${orderId} (SR Cart: ${srCartId || "—"}) — please cancel on Shiprocket`,
        html,
      }).catch((e) =>
        console.error(`[notifyAdminOfCancellationRequest] alert email to ${toEmail} failed:`, e.message),
      ),
    ),
  );
};

const notifyAdminOfOrderAutoCancelled = async ({ orderId, srCartId, requestedAt, awb, shipmentId }) => {
  const recipients = getCancellationEmailRecipients();
  if (!recipients.length) {
    console.warn(`[notifyAdminOfOrderAutoCancelled] No RECEIVED_EMAIL configured — skipping FYI for order ${orderId}`);
    return;
  }

  const data = await gatherCancellationEmailData(orderId);
  if (!data) {
    console.warn(`[notifyAdminOfOrderAutoCancelled] order ${orderId} not found — skipping FYI`);
    return;
  }

  const html = buildCancellationRequestEmailHtml({
    orderId, srCartId, requestedAt, awb, shipmentId, mode: "auto_cancelled", ...data,
  });

  await Promise.all(
    recipients.map((toEmail) =>
      sendBrevoEmail({
        toEmail,
        subject: `✅ Order Cancelled — Order #NC${orderId} (SR Cart: ${srCartId || "—"}) — shipped order, cancelled automatically`,
        html,
      }).catch((e) =>
        console.error(`[notifyAdminOfOrderAutoCancelled] alert email to ${toEmail} failed:`, e.message),
      ),
    ),
  );
};

const cancelShiprocketOrder = async (req, res) => {
  const { getSessionUser } = require("./session");
  const rawId      = toStr(req.body.orderId  || req.params.orderId || "");
  const inputPhone = toStr(req.body.phone || "").replace(/\D/g, "");
  const sessionUser = getSessionUser(req);

  if (!rawId) {
    return res.status(400).json({ success: false, message: "orderId is required" });
  }
  if (inputPhone.length < 6 && !sessionUser) {
    return res.status(400).json({ success: false, message: "orderId and phone are required" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Resolve sr_cart_id → internal order_id ──────────────────────────
    let orderId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(orderId) || orderId <= 0 || String(orderId) !== rawId) {
      // rawId looks like a Shiprocket cart_id string
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

    // ── 2. Load order + phone (FOR UPDATE: locks this row so a double-click
    //      or duplicate request for the same order can't race past the
    //      "already cancelled" guard below before either commits) ───────────
    const [[order]] = await conn.query(
      `SELECT o.order_id, o.user_id, o.order_status, o.awb_code, o.shipment_id, o.sr_cart_id,
              MAX(CASE WHEN ua.address_billing = 'yes' THEN ua.phone END) AS billing_phone,
              MAX(CASE WHEN ua.address_billing = 'no'  THEN ua.phone END) AS ship_phone
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

      // Phone-login users: if not matched by user_id linking, also check by phone
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
          ? "You are not allowed to cancel this order."
          : "Mobile number does not match this order",
      });
    }

    // ── 4. Guard already-cancelled / non-cancellable ────────────────────────
    if (order.order_status === "cancelled") {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Order is already cancelled" });
    }
    if (order.order_status === "cancellation_requested") {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "Your cancellation request is already being processed. We'll notify you once it's confirmed.",
      });
    }
    const cancellable = ["pending", "processing", "on-hold", "Shipped", "Out for Delivery"];
    if (!cancellable.includes(order.order_status)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage. Please contact support.",
      });
    }

    const awb        = toStr(order.awb_code);
    const shipmentId = toStr(order.shipment_id);
    const srCartId   = toStr(order.sr_cart_id);
    const POST_SHIPMENT_STATUSES = ["Shipped", "Out for Delivery"];
    const hasEnteredShipping = Boolean(awb) || POST_SHIPMENT_STATUSES.includes(order.order_status);

    // Fallback path — Shiprocket genuinely rejected the cancel (or the call
    // failed for any reason). Never marks anything "cancelled" without real
    // confirmation; ops gets the actionable email either way.
    const goPending = async () => {
      const requestedAt = new Date().toISOString();
      await conn.query(
        `UPDATE tbl_orders SET order_status = 'cancellation_requested', order_modified = NOW() WHERE order_id = ?`,
        [orderId],
      );
      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_cancel_requested_at', ?)`,
        [orderId, requestedAt],
      );
      await conn.commit();
      console.log(`[cancelShiprocketOrder] ⏳ Order ${orderId} (status=${order.order_status}) → cancellation_requested, ops notified.`);

      notifyAdminOfCancellationRequest({
        orderId, srCartId, requestedAt, awb, shipmentId,
      }).catch((e) => console.error(`[cancelShiprocketOrder] cancellation-request admin email failed for order ${orderId}:`, e.message));

      return res.json({
        success: true,
        message: "Your order has already been shipped. Your cancellation request has been sent to our support team. We'll review your request and notify you once it's processed.",
        shiprocket_cancelled: false,
        requires_manual_review: true,
        cancellation_status: "pending",
      });
    };

    // ── Always attempt the real cancel — cancelOnShiprocketPanel has its own
    //    fallback chain (order-level → AWB → shipment cancel). If it fails
    //    for any reason, route to the pending + actionable-email flow. ──────
    let srResult = { cancelled: false, stage: "not_attempted", reason: null };
    try {
      const srPanelOrderId = await resolveShiprocketPanelOrderId(conn, orderId, { srCartId });
      srResult = await cancelOnShiprocketPanel({
        srPanelOrderId,
        awb: awb || null,
        shipmentId: shipmentId || null,
        alreadyShipped: hasEnteredShipping,
      });
      if (!srResult.cancelled) {
        console.warn(
          `[cancelShiprocketOrder] SR panel cancel failed for order ${orderId} ` +
          `(stage=${srResult.stage}, srPanelOrderId=${srPanelOrderId || "—"}, awb=${awb || "—"}): ${srResult.reason}`,
        );
      }
    } catch (srErr) {
      // Should be unreachable now that cancelOnShiprocketPanel never throws,
      // but keep this as a last-resort safety net.
      srResult = { cancelled: false, stage: "unexpected_error", reason: srErr.message };
      console.error(`[cancelShiprocketOrder] SR panel cancel threw unexpectedly:`, srErr.response?.data || srErr.message);
    }

    if (!srResult.cancelled) {
      return goPending();
    }

    // ── Cancelled for real — restore stock and finalize. ─────────────────────
    await conn.query(
      `UPDATE tbl_orders SET order_status = 'cancelled', order_modified = NOW() WHERE order_id = ?`,
      [orderId],
    );
    await restoreOrderStock(conn, orderId);

    await conn.commit();
    console.log(`[cancelShiprocketOrder] ✅ Order ${orderId} cancelled (Shiprocket confirmed, stage=${srResult.stage}).`);
    notifyAdminOfOrderAutoCancelled({
      orderId, srCartId, requestedAt: new Date().toISOString(), awb, shipmentId,
    }).catch((e) => console.error(`[cancelShiprocketOrder] auto-cancelled FYI email failed for order ${orderId}:`, e.message));

    return res.json({
      success: true,
      message: "Order cancelled successfully.",
      shiprocket_cancelled: true,
      requires_manual_review: false,
      cancellation_status: "cancelled",
    });
  } catch (err) {
    await conn.rollback();
    console.error("[cancelShiprocketOrder] error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to cancel order. Please try again or contact support." });
  } finally {
    conn.release();
  }
};


// Map every Shiprocket status string → our internal status
const SR_STATUS_MAP = {
  // Forward journey
  "NEW":                  "processing",
  "PICKUP SCHEDULED":     "processing",
  "PICKUP ERROR":         "processing",
  "PICKUP QUEUED":        "processing",
  "PICKUP GENERATED":     "processing",
  "PICKED UP":            "Shipped",
  "IN TRANSIT":           "Shipped",
  "REACHED AT SOURCE HUB":"Shipped",
  "REACHED AT DESTINATION HUB": "Shipped",
  "OUT FOR DELIVERY":     "Out for Delivery",
  "DELIVERED":            "Delivered",
  // Return / RTO
  "CANCELLED":            "cancelled",
  "RTO INITIATED":        "Return Initiated",
  "RTO IN TRANSIT":       "Return Initiated",
  "RTO OUT FOR PICKUP":   "Return Initiated",
  "RTO PICKED":           "Return Initiated",
  "RTO DELIVERED":        "Returned",
  // Exceptions
  "SHIPMENT RETURN":      "Return Initiated",
  "UNDELIVERED":          "Out for Delivery", // re-attempt expected
  "DELAYED":              "In Transit",
  "DAMAGED":              "In Transit",
  "LOST":                 "In Transit",
};

const receiveShipmentWebhook = async (req, res) => {
  // ── 1. Token auth ───────────────────────────────────────────────────────────
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  const receivedToken =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    "";

  if (expectedToken && receivedToken !== expectedToken) {
    console.warn("[SR ShipmentWebhook] Unauthorised — token mismatch");
    return res.status(200).json({ success: false, message: "Unauthorised" });
  }

  const body = req.body || {};

  // ── 2. Extract fields ───────────────────────────────────────────────────────
  const awb        = toStr(body.awb || body.awb_code || "");
  const shipmentId = toStr(body.shipment_id || "");
  const srOrderId  = toStr(body.order_id || "");
  const rawStatus  = toStr(
    body.current_status || body.status || body.event || body.shipment_status || ""
  ).toUpperCase().trim();

  console.log(`[SR ShipmentWebhook] awb=${awb} shipment_id=${shipmentId} status="${rawStatus}" body_keys=${Object.keys(body).join(",")}`);

  if (!rawStatus) {
    return res.status(200).json({ success: false, message: "Missing status field" });
  }

  // Map to internal status; if unknown just store as-is (title-cased)
  const mappedStatus = SR_STATUS_MAP[rawStatus] ||
    rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  // ── 3. Resolve order_id from DB ─────────────────────────────────────────────
  let orderId = null;

  if (awb) {
    const [[row]] = await db.query(
      `SELECT order_id FROM tbl_orders WHERE awb_code = ? AND order_type = 'shop_order' LIMIT 1`,
      [awb],
    );
    if (row) orderId = row.order_id;
  }

  if (!orderId && shipmentId) {
    const [[row]] = await db.query(
      `SELECT order_id FROM tbl_orders WHERE shipment_id = ? AND order_type = 'shop_order' LIMIT 1`,
      [shipmentId],
    );
    if (row) orderId = row.order_id;
  }

  if (!orderId && srOrderId) {
    // Try ordermeta _shiprocket_order_id
    const [[row]] = await db.query(
      `SELECT order_id FROM tbl_ordermeta WHERE meta_key = '_shiprocket_order_id' AND meta_value = ? LIMIT 1`,
      [srOrderId],
    );
    if (row) orderId = row.order_id;
  }

  if (!orderId) {
    console.warn(`[SR ShipmentWebhook] Could not resolve order for awb=${awb} shipment_id=${shipmentId} sr_order_id=${srOrderId}`);
    return res.status(200).json({ success: false, message: "Order not found" });
  }

  // ── 4-5. Read + update order_status atomically ─────
  const courier = toStr(
    body.courier || body.courier_name || body.service_provider || ""
  );

  const conn = await db.getConnection();
  let currentStatus = "";
  let justCancelled = false;
  try {
    await conn.beginTransaction();

    const [[current]] = await conn.query(
      `SELECT order_status, awb_code FROM tbl_orders WHERE order_id = ? LIMIT 1 FOR UPDATE`,
      [orderId],
    );
    currentStatus = toStr(current?.order_status || "");
    const terminalStatuses = ["Delivered", "cancelled", "Returned"];

    if (terminalStatuses.includes(currentStatus) && currentStatus === mappedStatus) {
      await conn.commit();
      console.log(`[SR ShipmentWebhook] order_id=${orderId} already at "${currentStatus}" — skipping`);
      return res.status(200).json({ success: true, message: "Already at this status" });
    }

    let updateQuery = `UPDATE tbl_orders SET order_status = ?, order_modified = NOW()`;
    const updateParams = [mappedStatus];

    if (awb && !current?.awb_code) {
      updateQuery += `, awb_code = ?`;
      updateParams.push(awb);
    }
    if (courier) {
      updateQuery += `, courier_name = ?`;
      updateParams.push(courier);
    }
    updateQuery += ` WHERE order_id = ?`;
    updateParams.push(orderId);

    await conn.query(updateQuery, updateParams);

    justCancelled = mappedStatus === "cancelled" && currentStatus !== "cancelled";

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error(`[SR ShipmentWebhook] status update failed for order_id=${orderId}:`, err.message);
    return res.status(200).json({ success: false, message: "Update failed" });
  } finally {
    conn.release();
  }

  // ── 6. Append to shipment activity log in ordermeta ─────────────────────────
  const activityEntry = JSON.stringify({
    date:     toStr(body.updated_at || body.created_at || new Date().toISOString()),
    activity: rawStatus,
    location: toStr(body.city || body.location || body.current_city || ""),
    remark:   toStr(body.remark || body.description || ""),
  });

  await db.query(
    `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_shipment_activity', ?)`,
    [orderId, activityEntry],
  ).catch((e) => console.error("[SR ShipmentWebhook] activity log insert failed:", e.message));

  console.log(`[SR ShipmentWebhook] ✅ order_id=${orderId} status updated: "${currentStatus}" → "${mappedStatus}"`);

  // ── 7. Shiprocket just confirmed this order as CANCELLED — this is the
  if (justCancelled) {
    restoreOrderStock(db, orderId)
      .then(() => console.log(`[SR ShipmentWebhook] Stock restored for cancelled order_id=${orderId}`))
      .catch((e) => console.error(`[SR ShipmentWebhook] Stock restore failed for order_id=${orderId}:`, e.message));
  }

  return res.status(200).json({ success: true, message: "Status updated", order_id: orderId, status: mappedStatus });
};

module.exports = {
  receiveOrderWebhook,
  fetchSROrderDetails,
  cancelShiprocketOrder,
  receiveShipmentWebhook,
  resolveShiprocketPanelOrderId,
  cancelOnShiprocketPanel,
  notifyAdminOfCancellationRequest,
  notifyAdminOfOrderAutoCancelled,
};