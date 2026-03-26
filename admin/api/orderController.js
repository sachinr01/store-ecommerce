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

function buildOrderName() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `order-${stamp}`;
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
    country: toStr(b.country),
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
    country: toStr(s.country || b.country),
    company: toStr(s.company || b.company),
  };
}

function validateBilling(billing) {
  const errors = {};
  if (!billing.first_name) errors.first_name = 'First name required';
  if (!billing.last_name) errors.last_name = 'Last name required';
  if (!billing.email) errors.email = 'Email required';
  if (!billing.phone) errors.phone = 'Phone required';
  if (!billing.address) errors.address = 'Address required';
  if (!billing.city) errors.city = 'City required';
  if (!billing.state) errors.state = 'State required';
  if (!billing.postcode) errors.postcode = 'Postcode required';
  if (!billing.country) errors.country = 'Country required';
  return errors;
}

const placeOrder = async (req, res) => {
  const user = getSessionUser(req);
  const userId = user ? user.id : 0;
  const { key, value, cookieId, sessionId } = getCartIdentity(req);

  const billing = sanitizeBilling(req.body.billing);
  const shipping = sanitizeShipping(req.body.shipping, billing);
  const paymentMethod = toStr(req.body.payment_method) || 'cod';
  const shippingCost = toAmount(req.body.shipping_cost || 0);

  const billingErrors = validateBilling(billing);
  if (Object.keys(billingErrors).length) {
    return res.status(400).json({ success: false, message: 'Invalid billing details.', errors: billingErrors });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

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

    const subtotal = cartItems.reduce((sum, item) => sum + toAmount(item.price) * Number(item.quantity || 0), 0);
    const total = subtotal + shippingCost;
    const currency = process.env.ORDER_CURRENCY || process.env.CURRENCY || 'INR';

    const orderName = buildOrderName();
    const orderTitle = `Order - ${new Date().toLocaleString()}`;

    const [orderResult] = await conn.query(
      `INSERT INTO tbl_orders
       (parent_id, user_id, order_name, order_title, order_content, order_status, order_type, order_date, order_modified)
       VALUES (0, ?, ?, ?, '', 'wc-pending', 'shop_order', NOW(), NOW())`,
      [userId, orderName, orderTitle]
    );
    const orderId = orderResult.insertId;

    const metaEntries = [
      ['_customer_user', userId],
      ['_payment_method', paymentMethod],
      ['_order_currency', currency],
      ['_order_total', total.toFixed(2)],
      ['_order_subtotal', subtotal.toFixed(2)],
      ['_order_shipping', shippingCost.toFixed(2)],
      ['_billing_first_name', billing.first_name],
      ['_billing_last_name', billing.last_name],
      ['_billing_email', billing.email],
      ['_billing_phone', billing.phone],
      ['_billing_address_1', billing.address],
      ['_billing_address_2', billing.address_2],
      ['_billing_city', billing.city],
      ['_billing_state', billing.state],
      ['_billing_postcode', billing.postcode],
      ['_billing_country', billing.country],
      ['_billing_company', billing.company],
      ['_shipping_first_name', shipping.first_name],
      ['_shipping_last_name', shipping.last_name],
      ['_shipping_phone', shipping.phone],
      ['_shipping_address_1', shipping.address],
      ['_shipping_address_2', shipping.address_2],
      ['_shipping_city', shipping.city],
      ['_shipping_state', shipping.state],
      ['_shipping_postcode', shipping.postcode],
      ['_shipping_country', shipping.country],
      ['_shipping_company', shipping.company],
      ['_session_id', sessionId],
      ['_cookie_id', cookieId || ''],
    ];

    for (const [key, value] of metaEntries) {
      await conn.query(
        'INSERT INTO tbl_ordermeta (order_id, meta_key, meta_value) VALUES (?, ?, ?)',
        [orderId, key, value]
      );
    }

    for (const item of cartItems) {
      const [itemResult] = await conn.query(
        `INSERT INTO tbl_order_items (order_item_name, order_item_type, order_id, product_id)
         VALUES (?, 'line_item', ?, ?)`,
        [item.title || 'Item', orderId, item.product_id]
      );
      const orderItemId = itemResult.insertId;

      const variationId = item.variation_id && Number(item.variation_id) > 0 ? item.variation_id : 0;
      const lineTotal = toAmount(item.price) * Number(item.quantity || 0);

      const itemMeta = [
        ['_product_id', item.product_id],
        ['_variation_id', variationId],
        ['_qty', item.quantity],
        ['_line_subtotal', lineTotal.toFixed(2)],
        ['_line_total', lineTotal.toFixed(2)],
        ['_line_tax', '0'],
        ['_line_subtotal_tax', '0'],
      ];

      if (item.color) itemMeta.push(['pa_color', item.color]);
      if (item.size) itemMeta.push(['pa_size', item.size]);

      for (const [key, value] of itemMeta) {
        await conn.query(
          'INSERT INTO tbl_order_itemmeta (order_item_id, meta_key, meta_value) VALUES (?, ?, ?)',
          [orderItemId, key, value]
        );
      }
    }

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

const getMyOrders = async (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  try {
    const [orders] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status) AS order_status,
              MAX(o.order_date) AS order_date,
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

const getAllOrders = async (_req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.order_id,
              MAX(o.order_status) AS order_status,
              MAX(o.order_date) AS order_date,
              MAX(om_total.meta_value) AS total,
              MAX(om_email.meta_value) AS billing_email,
              GROUP_CONCAT(oi.order_item_name SEPARATOR ', ') AS items
       FROM tbl_orders o
       LEFT JOIN tbl_ordermeta om_total
         ON o.order_id = om_total.order_id AND om_total.meta_key = '_order_total'
       LEFT JOIN tbl_ordermeta om_email
         ON o.order_id = om_email.order_id AND om_email.meta_key = '_billing_email'
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
              MAX(o.order_status) AS order_status,
              MAX(o.order_date) AS order_date,
              MAX(om_total.meta_value) AS total,
              MAX(om_sub.meta_value) AS subtotal,
              MAX(om_ship.meta_value) AS shipping,
              MAX(om_pay.meta_value) AS payment_method,
              MAX(om_bemail.meta_value) AS billing_email,
              MAX(om_bfn.meta_value) AS billing_first_name,
              MAX(om_bln.meta_value) AS billing_last_name,
              MAX(om_bph.meta_value) AS billing_phone,
              MAX(om_ba1.meta_value) AS billing_address_1,
              MAX(om_ba2.meta_value) AS billing_address_2,
              MAX(om_bcity.meta_value) AS billing_city,
              MAX(om_bstate.meta_value) AS billing_state,
              MAX(om_bpc.meta_value) AS billing_postcode,
              MAX(om_bcountry.meta_value) AS billing_country,
              MAX(om_sfn.meta_value) AS ship_first_name,
              MAX(om_sln.meta_value) AS ship_last_name,
              MAX(om_sph.meta_value) AS ship_phone,
              MAX(om_sa1.meta_value) AS ship_address_1,
              MAX(om_sa2.meta_value) AS ship_address_2,
              MAX(om_scity.meta_value) AS ship_city,
              MAX(om_sstate.meta_value) AS ship_state,
              MAX(om_spc.meta_value) AS ship_postcode,
              MAX(om_scountry.meta_value) AS ship_country,
              MAX(u.display_name) AS user_display_name,
              MAX(u.user_email) AS user_email
       FROM tbl_orders o
       LEFT JOIN tbl_users u ON u.ID = o.user_id
       LEFT JOIN tbl_ordermeta om_total
         ON o.order_id = om_total.order_id AND om_total.meta_key = '_order_total'
       LEFT JOIN tbl_ordermeta om_sub
         ON o.order_id = om_sub.order_id AND om_sub.meta_key = '_order_subtotal'
       LEFT JOIN tbl_ordermeta om_ship
         ON o.order_id = om_ship.order_id AND om_ship.meta_key = '_order_shipping'
       LEFT JOIN tbl_ordermeta om_pay
         ON o.order_id = om_pay.order_id AND om_pay.meta_key = '_payment_method'
       LEFT JOIN tbl_ordermeta om_bemail
         ON o.order_id = om_bemail.order_id AND om_bemail.meta_key = '_billing_email'
       LEFT JOIN tbl_ordermeta om_bfn
         ON o.order_id = om_bfn.order_id AND om_bfn.meta_key = '_billing_first_name'
       LEFT JOIN tbl_ordermeta om_bln
         ON o.order_id = om_bln.order_id AND om_bln.meta_key = '_billing_last_name'
       LEFT JOIN tbl_ordermeta om_bph
         ON o.order_id = om_bph.order_id AND om_bph.meta_key = '_billing_phone'
       LEFT JOIN tbl_ordermeta om_ba1
         ON o.order_id = om_ba1.order_id AND om_ba1.meta_key = '_billing_address_1'
       LEFT JOIN tbl_ordermeta om_ba2
         ON o.order_id = om_ba2.order_id AND om_ba2.meta_key = '_billing_address_2'
       LEFT JOIN tbl_ordermeta om_bcity
         ON o.order_id = om_bcity.order_id AND om_bcity.meta_key = '_billing_city'
       LEFT JOIN tbl_ordermeta om_bstate
         ON o.order_id = om_bstate.order_id AND om_bstate.meta_key = '_billing_state'
       LEFT JOIN tbl_ordermeta om_bpc
         ON o.order_id = om_bpc.order_id AND om_bpc.meta_key = '_billing_postcode'
       LEFT JOIN tbl_ordermeta om_bcountry
         ON o.order_id = om_bcountry.order_id AND om_bcountry.meta_key = '_billing_country'
       LEFT JOIN tbl_ordermeta om_sfn
         ON o.order_id = om_sfn.order_id AND om_sfn.meta_key = '_shipping_first_name'
       LEFT JOIN tbl_ordermeta om_sln
         ON o.order_id = om_sln.order_id AND om_sln.meta_key = '_shipping_last_name'
       LEFT JOIN tbl_ordermeta om_sph
         ON o.order_id = om_sph.order_id AND om_sph.meta_key = '_shipping_phone'
       LEFT JOIN tbl_ordermeta om_sa1
         ON o.order_id = om_sa1.order_id AND om_sa1.meta_key = '_shipping_address_1'
       LEFT JOIN tbl_ordermeta om_sa2
         ON o.order_id = om_sa2.order_id AND om_sa2.meta_key = '_shipping_address_2'
       LEFT JOIN tbl_ordermeta om_scity
         ON o.order_id = om_scity.order_id AND om_scity.meta_key = '_shipping_city'
       LEFT JOIN tbl_ordermeta om_sstate
         ON o.order_id = om_sstate.order_id AND om_sstate.meta_key = '_shipping_state'
       LEFT JOIN tbl_ordermeta om_spc
         ON o.order_id = om_spc.order_id AND om_spc.meta_key = '_shipping_postcode'
       LEFT JOIN tbl_ordermeta om_scountry
         ON o.order_id = om_scountry.order_id AND om_scountry.meta_key = '_shipping_country'
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
              MAX(CASE WHEN oim.meta_key = '_qty' THEN oim.meta_value END) AS qty,
              MAX(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value END) AS line_total,
              MAX(CASE WHEN oim.meta_key = 'pa_color' THEN oim.meta_value END) AS color,
              MAX(CASE WHEN oim.meta_key = 'pa_size' THEN oim.meta_value END) AS size
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

const updateOrderStatus = async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  const status = toStr(req.body.status);
  if (!orderId || !status) {
    return res.status(400).json({ success: false, message: 'orderId and status required.' });
  }
  try {
    await db.query('UPDATE tbl_orders SET order_status = ?, order_modified = NOW() WHERE order_id = ?', [status, orderId]);
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
};
