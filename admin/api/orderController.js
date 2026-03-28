const db = require('../config/db');
const { getSessionUser } = require('./session');
const { getCartIdentity } = require('./cartController');

const toStr = (val) => {
  if (val === undefined || val === null) return '';
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

function buildOrderName() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `order-${stamp}`;
}

function sanitizeBilling(billing) {
  const b = billing || {};
  return {
    first_name: toStr(b.first_name),
    last_name:  toStr(b.last_name),
    email:      toStr(b.email),
    phone:      toStr(b.phone),
    address:    toStr(b.address),
    address_2:  toStr(b.address_2),
    city:       toStr(b.city),
    state:      toStr(b.state),
    postcode:   toStr(b.postcode),
    country:    toStr(b.country),
    company:    toStr(b.company),
  };
}

function sanitizeShipping(shipping, billing) {
  const s = shipping || {};
  const b = billing || {};
  return {
    address:   toStr(s.address   || b.address),
    address_2: toStr(s.address_2 || b.address_2),
    city:      toStr(s.city      || b.city),
    state:     toStr(s.state     || b.state),
    postcode:  toStr(s.postcode  || b.postcode),
    country:   toStr(s.country   || b.country),
  };
}

function validateBilling(billing) {
  const errors = {};
  if (!billing.first_name) errors.first_name = 'First name required';
  if (!billing.last_name)  errors.last_name  = 'Last name required';
  if (!billing.email)      errors.email      = 'Email required';
  if (!billing.phone)      errors.phone      = 'Phone required';
  if (!billing.address)    errors.address    = 'Address required';
  if (!billing.city)       errors.city       = 'City required';
  if (!billing.state)      errors.state      = 'State required';
  if (!billing.postcode)   errors.postcode   = 'Postcode required';
  if (!billing.country)    errors.country    = 'Country required';
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// insertAddress helper
//
// address_primary → ALWAYS 'no' for order rows.
//   Only set to 'yes' from profile/address-book page (like Amazon "Set as default").
//
// address_billing → identifies billing vs shipping ROW for this order:
//   'yes' = billing address row
//   'no'  = shipping address row
//
// Two types of rows in tbl_user_address:
//   ORDER rows        → order_id = real ID, address_primary = 'no'
//   SAVED ADDR rows   → order_id = NULL,    address_primary = 'yes'/'no'
// ─────────────────────────────────────────────────────────────────────────────
async function insertAddress(conn, {
  userId,
  orderId,
  address,
  isBilling,
  createdAt,
  notes = null,
}) {
  await conn.query(
    `INSERT INTO tbl_user_address
     (user_id, order_id, address_type, address_primary,
      address_line1, address_line2, city, zipcode, state_name,
      city_id, state_id, country_id, address_notes,
      address_billing, latitude, longitude, created_at, updated_at, update_done)
     VALUES
     (?, ?, 'general', 'no',
      ?, ?, ?, ?, ?,
      0, NULL, 226, ?,
      ?, '', '', ?, ?, 'no')`,
    [
      userId,                    // user_id
      orderId,                   // order_id  (always a real ID for order rows)
      address.line1 || '',       // address_line1
      address.line2 || '',       // address_line2
      address.city  || '',       // city
      address.zip   || '',       // zipcode
      address.state || '',       // state_name
      notes,                     // address_notes
      isBilling ? 'yes' : 'no', // address_billing → 'yes'=billing, 'no'=shipping
      createdAt,                 // created_at
      createdAt,                 // updated_at
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// placeOrder
// ─────────────────────────────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const user          = getSessionUser(req);
  const userId        = user ? user.id : 0;
  const { key, value, cookieId, sessionId } = getCartIdentity(req);

  const billing       = sanitizeBilling(req.body.billing);
  const shipping      = sanitizeShipping(req.body.shipping, billing);
  const paymentMethod = toStr(req.body.payment_method) || 'cod';
  const shippingCost  = toAmount(req.body.shipping_cost || 0);
  const orderNotes    = toStr(req.body.notes) || null;

  const billingErrors = validateBilling(billing);
  if (Object.keys(billingErrors).length) {
    return res.status(400).json({
      success: false,
      message: 'Invalid billing details.',
      errors: billingErrors,
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Fetch cart items ───────────────────────────────────────────────────
    let cartItems;
    if (userId) {
      [cartItems] = await conn.query(
        'SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
    } else if (key === 'cookie_id') {
      [cartItems] = await conn.query(
        'SELECT * FROM cart_items WHERE cookie_id = ? AND user_id IS NULL ORDER BY created_at DESC',
        [value]
      );
    } else {
      [cartItems] = await conn.query(
        'SELECT * FROM cart_items WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC',
        [value]
      );
    }

    if (!cartItems.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    // ── 2. Calculate totals ───────────────────────────────────────────────────
    const subtotal = cartItems.reduce(
      (sum, item) => sum + toAmount(item.price) * Number(item.quantity || 0), 0
    );
    const total    = subtotal + shippingCost;
    const currency = process.env.ORDER_CURRENCY || process.env.CURRENCY || 'INR';

    // ── 3. Insert into tbl_orders ─────────────────────────────────────────────
    const orderName  = buildOrderName();
    const orderTitle = `Order - ${new Date().toLocaleString()}`;

    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content,
        order_status, order_type, order_date, order_modified)
       VALUES (0, ?, ?, ?, '', 'wc-pending', 'shop_order', NOW(), NOW())`,
      [userId, orderName, orderTitle]
    );
    const orderId = orderResult.insertId;

    // ── 4. tbl_ordermeta: financial + payment data ONLY ──────────────────────
    //    NO address, NO contact info here
    //    name/email  → tbl_users via user_id
    //    address     → tbl_user_address via order_id
    const metaEntries = [
      ['_customer_user',  userId],
      ['_payment_method', paymentMethod],
      ['_order_currency', currency],
      ['_order_total',    total.toFixed(2)],
      ['_order_subtotal', subtotal.toFixed(2)],
      ['_order_shipping', shippingCost.toFixed(2)],
      ['_session_id',     sessionId],
      ['_cookie_id',      cookieId || ''],
    ];

    for (const [metaKey, metaValue] of metaEntries) {
      await conn.query(
        'INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, ?, ?)',
        [orderId, metaKey, metaValue]
      );
    }

    // ── 5. tbl_user_address: always 2 rows per order ─────────────────────────
    //    Whether user used saved address or typed new address — always insert fresh.
    //    Saved address (order_id = NULL) is just a template to pre-fill the form.
    //    Order rows always get a real order_id.
    //
    //    address_primary = 'no' always for order rows
    //    address_billing = 'yes' → billing row
    //    address_billing = 'no'  → shipping row
    const addressUserId = userId > 0 ? userId : null;
    const createdAt     = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Billing address row
    await insertAddress(conn, {
      userId:    addressUserId,
      orderId,
      isBilling: true,
      createdAt,
      notes:     orderNotes,
      address: {
        line1: billing.address,
        line2: billing.address_2,
        city:  billing.city,
        zip:   billing.postcode,
        state: billing.state,
      },
    });

    // Shipping address row
    await insertAddress(conn, {
      userId:    addressUserId,
      orderId,
      isBilling: false,
      createdAt,
      notes:     null,
      address: {
        line1: shipping.address,
        line2: shipping.address_2,
        city:  shipping.city,
        zip:   shipping.postcode,
        state: shipping.state,
      },
    });

    // ── 6. tbl_order_items + tbl_order_itemmeta ───────────────────────────────
    for (const item of cartItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title || 'Item', orderId, item.product_id]
      );
      const orderItemId = itemResult.insertId;

      const variationId = item.variation_id && Number(item.variation_id) > 0
        ? item.variation_id : 0;
      const lineTotal = toAmount(item.price) * Number(item.quantity || 0);

      const itemMeta = [
        ['_product_id',        item.product_id],
        ['_variation_id',      variationId],
        ['_qty',               item.quantity],
        ['_line_subtotal',     lineTotal.toFixed(2)],
        ['_line_total',        lineTotal.toFixed(2)],
        ['_line_tax',          '0'],
        ['_line_subtotal_tax', '0'],
      ];

      if (item.color) itemMeta.push(['pa_color', item.color]);
      if (item.size)  itemMeta.push(['pa_size',  item.size]);

      for (const [metaKey, metaValue] of itemMeta) {
        await conn.query(
          'INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)',
          [orderItemId, metaKey, metaValue]
        );
      }
    }

    // ── 7. Shipping cost line item ────────────────────────────────────────────
    if (shippingCost > 0) {
      const [shipResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES ('Shipping', 'shipping', ?, 0)`,
        [orderId]
      );
      await conn.query(
        'INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)',
        [shipResult.insertId, 'cost', shippingCost.toFixed(2)]
      );
    }

    // ── 8. Clear cart ─────────────────────────────────────────────────────────
    if (userId) {
      await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    } else if (key === 'cookie_id') {
      await conn.query('DELETE FROM cart_items WHERE cookie_id = ? AND user_id IS NULL', [value]);
    } else {
      await conn.query('DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL', [value]);
    }

    await conn.commit();
    res.json({ success: true, data: { orderId, total: total.toFixed(2) } });

  } catch (err) {
    await conn.rollback();
    console.error('placeOrder error:', err);
    res.status(500).json({ success: false, message: 'Order placement failed.' });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getDefaultAddress
// Pre-fills checkout form with user's default saved address.
// Only looks at saved address rows (order_id IS NULL).
// Frontend: GET /store/api/address/default
// ─────────────────────────────────────────────────────────────────────────────
const getDefaultAddress = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  try {
    const [[address]] = await db.query(
      `SELECT * FROM tbl_user_address
       WHERE user_id = ? AND order_id IS NULL AND address_primary = 'yes'
       ORDER BY address_id DESC LIMIT 1`,
      [user.id]
    );
    res.json({ success: true, data: address || null });
  } catch (err) {
    console.error('getDefaultAddress error:', err);
    res.status(500).json({ success: false, message: 'Failed to load default address.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// setDefaultAddress
// User sets a saved address as default from profile/address-book page.
// Only touches saved address rows (order_id IS NULL).
// Order rows are never affected.
// Frontend: PUT /store/api/address/default/:addressId
// ─────────────────────────────────────────────────────────────────────────────
const setDefaultAddress = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  const addressId = Number.parseInt(req.params.addressId, 10);
  if (!addressId) {
    return res.status(400).json({ success: false, message: 'Invalid address id.' });
  }
  try {
    // Step 1: Remove default from all saved addresses only (NOT order rows)
    await db.query(
      `UPDATE tbl_user_address
       SET address_primary = 'no'
       WHERE user_id = ? AND order_id IS NULL`,
      [user.id]
    );
    // Step 2: Set selected saved address as default
    await db.query(
      `UPDATE tbl_user_address
       SET address_primary = 'yes'
       WHERE address_id = ? AND user_id = ? AND order_id IS NULL`,
      [addressId, user.id]
    );
    res.json({ success: true, message: 'Default address updated.' });
  } catch (err) {
    console.error('setDefaultAddress error:', err);
    res.status(500).json({ success: false, message: 'Failed to update default address.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getSavedAddresses
// Returns only saved address-book rows (order_id IS NULL).
// Order rows are excluded — they are fetched via getMyOrderById.
// Frontend: GET /store/api/address/saved
// ─────────────────────────────────────────────────────────────────────────────
const getSavedAddresses = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  try {
    const [addresses] = await db.query(
      `SELECT address_id, address_type, address_primary,
              address_line1, address_line2, city, zipcode,
              state_name, address_notes, address_billing
       FROM tbl_user_address
       WHERE user_id = ? AND order_id IS NULL
       ORDER BY address_primary DESC, address_id DESC`,
      [user.id]
    );
    res.json({ success: true, data: addresses });
  } catch (err) {
    console.error('getSavedAddresses error:', err);
    res.status(500).json({ success: false, message: 'Failed to load addresses.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getMyOrders
// Frontend: GET /store/api/orders/my
// ─────────────────────────────────────────────────────────────────────────────
const getMyOrders = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  try {
    const [orders] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)      AS order_status,
              MAX(o.order_date)        AS order_date,
              MAX(om_total.meta_value) AS total,
              GROUP_CONCAT(oi.order_item_name SEPARATOR ', ') AS items
       FROM tbl_orders o
       LEFT JOIN tbl_ordermeta om_total
         ON o.order_id = om_total.order_id AND om_total.meta_key = '_order_total'
       LEFT JOIN tbl_order_items oi
         ON o.order_id = oi.order_id AND oi.order_item_type = 'line_item'
       WHERE o.user_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id
       ORDER BY MAX(o.order_date) DESC`,
      [user.id]
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('getMyOrders error:', err);
    res.status(500).json({ success: false, message: 'Failed to load orders.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getAllOrders (admin)
// Frontend: GET /store/api/admin/orders
// ─────────────────────────────────────────────────────────────────────────────
const getAllOrders = async (_req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)      AS order_status,
              MAX(o.order_date)        AS order_date,
              MAX(om_total.meta_value) AS total,
              MAX(u.user_email)        AS billing_email,
              MAX(u.display_name)      AS customer_name,
              GROUP_CONCAT(oi.order_item_name SEPARATOR ', ') AS items
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN tbl_ordermeta om_total
         ON o.order_id = om_total.order_id AND om_total.meta_key = '_order_total'
       LEFT JOIN tbl_order_items oi
         ON o.order_id = oi.order_id AND oi.order_item_type = 'line_item'
       WHERE o.order_type = 'shop_order'
       GROUP BY o.order_id
       ORDER BY MAX(o.order_date) DESC`
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('getAllOrders error:', err);
    res.status(500).json({ success: false, message: 'Failed to load orders.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getMyOrderById
// name/email  → tbl_users via user_id        (sir's instruction)
// address     → tbl_user_address via order_id (sir's instruction)
// financials  → tbl_ordermeta
// Frontend: GET /store/api/orders/:orderId
// ─────────────────────────────────────────────────────────────────────────────
const getMyOrderById = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  const orderId = Number.parseInt(req.params.orderId, 10);
  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Invalid order id.' });
  }

  try {
    const [orderRows] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status)      AS order_status,
              MAX(o.order_date)        AS order_date,
              MAX(om_total.meta_value) AS total,
              MAX(om_sub.meta_value)   AS subtotal,
              MAX(om_ship.meta_value)  AS shipping,
              MAX(om_pay.meta_value)   AS payment_method,
              MAX(u.display_name)      AS user_display_name,
              MAX(u.user_email)        AS user_email,
              MAX(ub.address_line1)    AS billing_address_1,
              MAX(ub.address_line2)    AS billing_address_2,
              MAX(ub.city)             AS billing_city,
              MAX(ub.state_name)       AS billing_state,
              MAX(ub.zipcode)          AS billing_postcode,
              MAX(ub.address_notes)    AS billing_notes,
              MAX(us.address_line1)    AS ship_address_1,
              MAX(us.address_line2)    AS ship_address_2,
              MAX(us.city)             AS ship_city,
              MAX(us.state_name)       AS ship_state,
              MAX(us.zipcode)          AS ship_postcode
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN (
         SELECT order_id,
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
                MAX(address_line1) AS address_line1,
                MAX(address_line2) AS address_line2,
                MAX(city)          AS city,
                MAX(state_name)    AS state_name,
                MAX(zipcode)       AS zipcode
         FROM tbl_user_address
         WHERE address_billing = 'no'
         GROUP BY order_id
       ) us ON us.order_id = o.order_id
       LEFT JOIN tbl_ordermeta om_total
         ON o.order_id = om_total.order_id AND om_total.meta_key = '_order_total'
       LEFT JOIN tbl_ordermeta om_sub
         ON o.order_id = om_sub.order_id AND om_sub.meta_key = '_order_subtotal'
       LEFT JOIN tbl_ordermeta om_ship
         ON o.order_id = om_ship.order_id AND om_ship.meta_key = '_order_shipping'
       LEFT JOIN tbl_ordermeta om_pay
         ON o.order_id = om_pay.order_id AND om_pay.meta_key = '_payment_method'
       WHERE o.order_id = ? AND o.user_id = ? AND o.order_type = 'shop_order'
       GROUP BY o.order_id`,
      [orderId, user.id]
    );

    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orderRows[0];

    const [items] = await db.query(
      `SELECT oi.order_item_id,
              oi.order_item_name,
              oi.product_id,
              MAX(CASE WHEN oim.meta_key = '_qty'        THEN oim.meta_value END) AS qty,
              MAX(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value END) AS line_total,
              MAX(CASE WHEN oim.meta_key = 'pa_color'    THEN oim.meta_value END) AS color,
              MAX(CASE WHEN oim.meta_key = 'pa_size'     THEN oim.meta_value END) AS size
       FROM tbl_order_items oi
       LEFT JOIN tbl_order_itemmeta oim ON oim.order_item_id = oi.order_item_id
       WHERE oi.order_id = ? AND oi.order_item_type = 'line_item'
       GROUP BY oi.order_item_id, oi.order_item_name, oi.product_id`,
      [orderId]
    );

    res.json({ success: true, data: { order, items } });
  } catch (err) {
    console.error('getMyOrderById error:', err);
    res.status(500).json({ success: false, message: 'Failed to load order.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus (admin)
// Frontend: PUT /store/api/admin/orders/:orderId/status
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  const status  = toStr(req.body.status);
  if (!orderId || !status) {
    return res.status(400).json({ success: false, message: 'orderId and status required.' });
  }
  try {
    await db.query(
      'UPDATE tbl_orders SET order_status = ?, order_modified = NOW() WHERE order_id = ?',
      [status, orderId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  updateOrderStatus,
  getDefaultAddress,
  setDefaultAddress,
  getSavedAddresses,
};
