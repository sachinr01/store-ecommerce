const db = require("../config/db");
const { getReturnInfo, RETURN_STATUS } = require("../api/returnController");

// ── Return Status Badges ──────────────────────────────────────────────────────
const returnStatusBadge = {
  "Return Requested":   { label: "Return Requested",   class: "bg-warning text-dark" },
  "Approved":           { label: "Approved",           class: "bg-info" },
  "Rejected":           { label: "Rejected",           class: "bg-danger" },
  "Return In Progress": { label: "Return In Progress", class: "bg-primary" },
  "Returned":           { label: "Returned",           class: "bg-success" },
  "Refund Processed":   { label: "Refund Processed",   class: "bg-success" },
  "Completed":          { label: "Completed",          class: "bg-dark" },
};

// ── Helper: Get order details ─────────────────────────────────────────────────
const getOrderDetails = async (orderId) => {
  const [[order]] = await db.query(
    `SELECT o.*, 
            MAX(CASE WHEN om.meta_key = '_billing_email' THEN om.meta_value END) AS billing_email,
            MAX(CASE WHEN om.meta_key = '_order_total' THEN om.meta_value END) AS order_total
     FROM tbl_orders o
     LEFT JOIN tbl_ordermeta om ON om.order_id = o.order_id
     WHERE o.order_id = ?
     GROUP BY o.order_id`,
    [orderId]
  );
  
  if (!order) return null;

  const [addresses] = await db.query(
    "SELECT * FROM tbl_user_address WHERE order_id = ? ORDER BY address_id ASC",
    [orderId]
  );

  const billingAddress = addresses.find((a) => a.address_billing === "yes");
  const shippingAddress = addresses.find((a) => a.address_billing === "no");

  order.billing_first_name = billingAddress?.first_name || "";
  order.billing_last_name = billingAddress?.last_name || "";
  order.billing_phone = billingAddress?.phone || "";
  order.shipping_first_name = shippingAddress?.first_name || order.billing_first_name;
  order.shipping_last_name = shippingAddress?.last_name || order.billing_last_name;

  return order;
};

// ── LIST RETURNS ──────────────────────────────────────────────────────────────
const showReturns = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status || "";

    let statusCondition = "";
    const params = [];

    if (statusFilter) {
      statusCondition = "AND om_return_status.meta_value = ?";
      params.push(statusFilter);
    }

    // Total count
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT o.order_id) AS total
       FROM tbl_orders o
       INNER JOIN tbl_ordermeta om_return_status 
         ON om_return_status.order_id = o.order_id
         AND om_return_status.meta_key = '_return_status'
       WHERE o.order_type = 'shop_order'
       ${statusCondition}`,
      params
    );

    // Returns list
    const [returns] = await db.query(
      `SELECT 
         o.order_id,
         o.order_date,
         o.order_status,
         o.awb_code,
         o.courier_name,
         MAX(CASE WHEN om.meta_key = '_return_status' THEN om.meta_value END) AS return_status,
         MAX(CASE WHEN om.meta_key = '_return_reason' THEN om.meta_value END) AS return_reason,
         MAX(CASE WHEN om.meta_key = '_return_reason_note' THEN om.meta_value END) AS return_custom_reason,
         MAX(CASE WHEN om.meta_key = '_return_requested_at' THEN om.meta_value END) AS return_requested_at,
         MAX(CASE WHEN om.meta_key = '_billing_email' THEN om.meta_value END) AS billing_email,
         MAX(CASE WHEN om.meta_key = '_order_total' THEN om.meta_value END) AS order_total,
         ua.first_name AS billing_first_name,
         ua.last_name AS billing_last_name,
         ua.phone AS billing_phone
       FROM tbl_orders o
       INNER JOIN tbl_ordermeta om ON om.order_id = o.order_id
       LEFT JOIN tbl_user_address ua ON ua.order_id = o.order_id AND ua.address_billing = 'yes'
       WHERE o.order_type = 'shop_order'
         AND EXISTS (
           SELECT 1 FROM tbl_ordermeta 
           WHERE order_id = o.order_id 
           AND meta_key = '_return_status'
           ${statusFilter ? "AND meta_value = ?" : ""}
         )
       GROUP BY o.order_id
       ORDER BY MAX(CASE WHEN om.meta_key = '_return_requested_at' THEN om.meta_value END) DESC
       LIMIT ? OFFSET ?`,
      statusFilter ? [statusFilter, limit, offset] : [limit, offset]
    );

    // Format reason labels
    const { RETURN_REASON_LABELS } = require("../api/returnController");
    returns.forEach(r => {
      if (r.return_reason && RETURN_REASON_LABELS[r.return_reason]) {
        r.return_reason_label = RETURN_REASON_LABELS[r.return_reason];
      } else {
        r.return_reason_label = r.return_reason || "Not specified";
      }
    });

    res.render("returns/index", {
      title: "Return Requests",
      returns,
      returnStatusBadge,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusFilter,
      returnStatuses: Object.keys(returnStatusBadge),
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("showReturns error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
};

// ── SHOW RETURN DETAIL ────────────────────────────────────────────────────────
const showReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await getOrderDetails(id);

    if (!order) {
      return res.redirect("/admin/returns?error=Order not found");
    }

    const returnInfo = await getReturnInfo(id);
    if (!returnInfo) {
      return res.redirect("/admin/returns?error=No return request found for this order");
    }

    order.return_status = returnInfo.return_status;
    order.return_reason = returnInfo.return_reason;
    order.return_reason_label = returnInfo.return_reason_label;
    order.return_custom_reason = returnInfo.return_custom_reason;
    order.return_requested_at = returnInfo.return_requested_at;

    // Get order items
    const [items] = await db.query(
      `SELECT oi.*, 
              MAX(CASE WHEN oim.meta_key = '_product_id' THEN oim.meta_value END) AS product_id,
              MAX(CASE WHEN oim.meta_key = '_qty' THEN oim.meta_value END) AS qty,
              MAX(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value END) AS line_total
       FROM tbl_order_items oi
       LEFT JOIN tbl_order_itemmeta oim ON oim.order_item_id = oi.order_item_id
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id`,
      [id]
    );

    // Get addresses
    const [addresses] = await db.query(
      "SELECT * FROM tbl_user_address WHERE order_id = ?",
      [id]
    );

    const shippingAddress = addresses.find(a => a.address_billing === "no");

    res.render("returns/show", {
      title: `Return Request - Order #${id}`,
      order,
      items,
      shippingAddress,
      returnStatusBadge,
      returnStatuses: Object.keys(returnStatusBadge),
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("showReturn error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
};

// ── UPDATE RETURN STATUS ──────────────────────────────────────────────────────
const updateReturnStatus = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status - check if it's one of the valid return statuses
    const validStatuses = Object.values(RETURN_STATUS);
    if (!status || !validStatuses.includes(status)) {
      return res.redirect(`/admin/returns/${id}?error=Invalid return status`);
    }

    await conn.beginTransaction();

    // Update return status
    await conn.query(
      `UPDATE tbl_ordermeta 
       SET meta_value = ?
       WHERE order_id = ? AND meta_key = '_return_status'`,
      [status, id]
    );

    // Add status change note if provided (append with timestamp)
    if (notes && notes.trim()) {
      const timestamp = new Date().toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const noteWithTimestamp = `[${timestamp}] ${notes.trim()}`;
      
      await conn.query(
        `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
         VALUES (?, '_return_admin_note', ?)`,
        [id, noteWithTimestamp]
      );
    }

    // Record status update timestamp
    await conn.query(
      `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value)
       VALUES (?, '_return_status_updated_at', ?)`,
      [id, new Date().toISOString()]
    );

    await conn.commit();

    // Send email notification to customer
    if (status === RETURN_STATUS.APPROVED || status === RETURN_STATUS.REJECTED) {
      const { notifyCustomerOfReturnDecision } = require("../api/returnController");
      notifyCustomerOfReturnDecision({ orderId: id, status, notes: notes?.trim() || '' }).catch(err => {
        console.error("Customer email notification failed:", err.message);
      });
    }

    res.redirect(`/admin/returns/${id}?success=Return status updated successfully`);
  } catch (err) {
    await conn.rollback();
    console.error("updateReturnStatus error:", err.message);
    res.redirect(`/admin/returns/${req.params.id}?error=` + encodeURIComponent(err.message));
  } finally {
    conn.release();
  }
};

module.exports = {
  showReturns,
  showReturn,
  updateReturnStatus,
};
