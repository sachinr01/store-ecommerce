
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
        ORDER BY meta_id DESC LIMIT 1) AS return_requested_at`,
    [orderId, orderId, orderId, orderId],
  );
  if (!row || !row.return_status) return null;

  const reasonKey = row.return_reason || "";
  return {
    return_status:        row.return_status,
    return_reason:         reasonKey || null,
    return_reason_label:   reasonKey ? (RETURN_REASON_LABELS[reasonKey] || reasonKey) : null,
    return_custom_reason:  row.return_custom_reason || null,
    return_requested_at:   row.return_requested_at || null,
  };
}


function isReturnEligible(orderStatus, existingReturnInfo) {
  if (existingReturnInfo) return false;
  const cleanStatus = toStr(orderStatus).replace(/^wc-/, "").trim().toLowerCase();
  return DELIVERED_STATUSES.has(cleanStatus);
}

// ── Admin email ──────────────────────────────────────────────────────────────
function buildReturnRequestEmailHtml({
  orderId, srCartId, requestedAt, customerName, customerEmail, customerPhone,
  shippingAddr, items, total, paymentMethod, awb, shipmentId, courierName,
  reasonLabel,
}) {
  const payLabel = (paymentMethod || "").toLowerCase() === "cod" ? "Cash on Delivery" : "Online Payment";

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
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#e3f2fd;border-bottom:1px solid #bbdefb;">
          <tr><td style="padding:14px 26px;font-family:Arial,sans-serif;font-size:14px;color:#0d47a1;">
            &#8617;&#65039; <strong>Return requested:</strong> the customer has asked to return this delivered order.
            Please review the reason below and process the return in your usual workflow.
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

const notifyAdminOfReturnRequest = async ({ orderId, srCartId, requestedAt, awb, shipmentId, reasonLabel }) => {
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
    orderId, srCartId, requestedAt, awb, shipmentId, reasonLabel, ...data,
  });

  await Promise.all(
    recipients.map((toEmail) =>
      sendBrevoEmail({
        toEmail,
        subject: `↩️ Order Return Request — Order #NC${orderId} (SR Cart: ${srCartId || "—"})`,
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
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_requested_at', ?)`,
      [orderId, requestedAt],
    );
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_return_status', ?)`,
      [orderId, RETURN_STATUS.REQUESTED],
    );

    await conn.commit();
    console.log(`[createReturnRequest] ✅ Order ${orderId} → return requested (reason=${reasonKey}).`);

    notifyAdminOfReturnRequest({
      orderId,
      srCartId: toStr(order.sr_cart_id),
      requestedAt,
      awb: toStr(order.awb_code),
      shipmentId: toStr(order.shipment_id),
      reasonLabel,
    }).catch((e) => console.error(`[createReturnRequest] admin email failed for order ${orderId}:`, e.message));

    return res.json({
      success: true,
      message: "Your return request has been submitted successfully. Our team has been notified and will review your request shortly.",
      return: {
        return_status: RETURN_STATUS.REQUESTED,
        return_reason: reasonKey,
        return_reason_label: reasonLabel,
        return_custom_reason: customReasonRaw || null,
        return_requested_at: requestedAt,
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
  const data = await gatherCancellationEmailData(orderId);
  if (!data || !data.customerEmail) {
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
    toEmail: data.customerEmail,
    toName: data.customerName,
    subject: `${isApproved ? "✓" : "✕"} Return Request ${isApproved ? "Approved" : "Declined"} - Order #NC${orderId}`,
    html,
  }).catch((e) =>
    console.error(`[notifyCustomerOfReturnDecision] email to ${data.customerEmail} failed:`, e.message),
  );
};

module.exports = {
  RETURN_STATUS,
  RETURN_REASON_LABELS,
  formatReturnReason,
  isReturnEligible,
  getReturnInfo,
  createReturnRequest,
  notifyAdminOfReturnRequest,
  notifyCustomerOfReturnDecision,
};