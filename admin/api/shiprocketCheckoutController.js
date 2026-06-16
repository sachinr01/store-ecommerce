const crypto = require("crypto");
const db     = require("../config/db");
const axios  = require("axios");
const {
  sendProductUpdateWebhook,
  sendCollectionUpdateWebhook,
} = require("./shiprocketWebhooks");

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const toInt   = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const toStr   = (v)         => (v == null ? "" : String(v).trim());
const toFloat = (v, d = 0) => { const n = parseFloat(v);   return Number.isNaN(n) ? d : n; };

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

  // compare_at_price = MRP only when MRP > selling price (real discount exists)
  const compareAtPrice =
    regularPrice > 0 && regularPrice > sellingPrice ? regularPrice : 0;

  // ── Stock / Weight ───────────────────────────────────────────────
  const stockQty = toInt(p.stock,  0);
  const weight   = toFloat(p.weight, 0); // meta_key='weight' (no underscore), value in kg

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
        quantity:         stockQty,
        option_values:    {},
        grams:            Math.round(weight * 1000),        // e.g. 7 kg → 7000 grams
        image:            { src: imageSrc },
        weight:           weight,                           // real value from DB e.g. 7
        weight_unit:      "kg",
      },
    ],
    image:   { src: imageSrc },
    options: [],
  };
};

/* ─────────────────────────────────────────────────────────────
   Shared product SELECT columns
   Fetches: price (_price), compare-at (_regular_price),
            sku (_sku), stock (_stock), weight (weight), image
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
   Generate Shiprocket checkout access token
───────────────────────────────────────────────────────────── */
const getCheckoutToken = async (req, res) => {
  try {
    const payload = {
      cart_data:    req.body?.cart_data    || { items: [] },
      redirect_url: req.body?.redirect_url || "",
      timestamp:    req.body?.timestamp    || new Date().toISOString(),
    };
    const bodyStr   = JSON.stringify(payload);
    const apiKey    = process.env.CHECKOUT_API_KEY    || "";
    const apiSecret = process.env.CHECKOUT_API_SECRET || "";

    const response = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
      payload,
      {
        headers: {
          "X-Api-Key":         apiKey,
          "X-Api-HMAC-SHA256": crypto
            .createHmac("sha256", apiSecret)
            .update(bodyStr)
            .digest("base64"),
          "Content-Type": "application/json",
        },
      },
    );
    return res.json(response.data);
  } catch (err) {
    console.error("getCheckoutToken error:", err.response?.data || err.message);
    return res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/shiprocket/webhook/product/:productId
   Manually trigger Product Update webhook (or use for testing)
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
   Manually trigger Collection Update webhook (or use for testing)
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
  triggerProductWebhook,
  triggerCollectionWebhook,
};