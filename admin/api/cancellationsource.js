
const db = require("../config/db");

const CANCELLED_BY = Object.freeze({
  USER:  "USER",
  ADMIN: "ADMIN",
});

const CANCELLED_BY_LABELS = Object.freeze({
  [CANCELLED_BY.USER]:  "You",
  [CANCELLED_BY.ADMIN]: "Admin",
});

const CANCELLED_BY_LABELS_ADMIN = Object.freeze({
  [CANCELLED_BY.USER]:  "Customer",
  [CANCELLED_BY.ADMIN]: "Admin",
});

function isValidCancelledBy(value) {
  return Object.prototype.hasOwnProperty.call(CANCELLED_BY_LABELS, value);
}

function labelForCancelledBy(value, context = 'customer') {
  const labels = context === 'admin' ? CANCELLED_BY_LABELS_ADMIN : CANCELLED_BY_LABELS;
  return labels[value] || (value ? value : null);
}

async function recordCancellationSource(conn, orderId, cancelledBy, { overwrite = false } = {}) {
  const runner = conn || db;
  const source = isValidCancelledBy(cancelledBy) ? cancelledBy : CANCELLED_BY.ADMIN;

  if (!overwrite) {
    const [[existing]] = await runner.query(
      `SELECT meta_value FROM tbl_ordermeta
       WHERE order_id = ? AND meta_key = '_cancelled_by'
       ORDER BY meta_id DESC LIMIT 1`,
      [orderId],
    );
    if (existing && existing.meta_value) {
      return { cancelledBy: existing.meta_value, alreadyRecorded: true };
    }
  }

  const cancelledAt = new Date().toISOString();
  await runner.query(
    `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_cancelled_by', ?)`,
    [orderId, source],
  );
  await runner.query(
    `INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, '_cancelled_at', ?)`,
    [orderId, cancelledAt],
  );
  return { cancelledBy: source, cancelledAt, alreadyRecorded: false };
}

async function getCancellationInfo(orderId, context = 'customer') {
  const [[row]] = await db.query(
    `SELECT
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_cancelled_by'
        ORDER BY meta_id DESC LIMIT 1) AS cancelled_by,
       (SELECT meta_value FROM tbl_ordermeta
        WHERE order_id = ? AND meta_key = '_cancelled_at'
        ORDER BY meta_id DESC LIMIT 1) AS cancelled_at`,
    [orderId, orderId],
  );
  const cancelledBy = row?.cancelled_by || null;
  return {
    cancelled_by: cancelledBy,
    cancelled_by_label: cancelledBy ? labelForCancelledBy(cancelledBy, context) : null,
    cancelled_at: row?.cancelled_at || null,
  };
}

module.exports = {
  CANCELLED_BY,
  CANCELLED_BY_LABELS,
  CANCELLED_BY_LABELS_ADMIN,
  isValidCancelledBy,
  labelForCancelledBy,
  recordCancellationSource,
  getCancellationInfo,
};
