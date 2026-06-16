const axios  = require("axios");
const crypto = require("crypto");
const db     = require("../config/db");

/* ─────────────────────────────────────────────────────────────
   Catalog Sync Webhooks (Shiprocket Checkout Guide, Section 2)*/

const PRODUCT_WEBHOOK_URL =
  process.env.SHIPROCKET_PRODUCT_WEBHOOK_URL ||
  "https://checkout-api.shiprocket.com/wh/v1/custom/product";

const COLLECTION_WEBHOOK_URL =
  process.env.SHIPROCKET_COLLECTION_WEBHOOK_URL ||
  "https://checkout-api.shiprocket.com/wh/v1/custom/collection";

const BASE_URL = "https://nestcase.in";

const toInt   = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const toStr   = (v)         => (v == null ? "" : String(v).trim());
const toFloat = (v, d = 0) => { const n = parseFloat(v);   return Number.isNaN(n) ? d : n; };

const buildImageUrl = (path) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

/**
 * Meta sub-query: fetches latest non-empty value for a given meta_key.
 *
 * DB-confirmed meta keys:
 *   _price          → selling price
 *   _regular_price  → MRP / original price (compare-at)
 *   _sku            → SKU
 *   _stock          → stock quantity
 *   weight          → weight in kg (NO underscore — confirmed in tbl_productmeta)
 *                     e.g. product 61: meta_key='weight', meta_value='7'
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

/* ─────────────────────────────────────────────────────────────
   HMAC helpers
───────────────────────────────────────────────────────────── */
const computeHmac = (bodyStr) =>
  crypto
    .createHmac("sha256", process.env.SHIPROCKET_API_SECRET || "")
    .update(bodyStr)
    .digest("base64");

const shiprocketHeaders = (bodyStr) => ({
  "Content-Type":      "application/json",
  "X-Api-Key":         process.env.SHIPROCKET_API_KEY || "",
  "X-Api-HMAC-SHA256": computeHmac(bodyStr),
});

/* ─────────────────────────────────────────────────────────────
   PRODUCT UPDATE WEBHOOK
───────────────────────────────────────────────────────────── */
const buildProductPayload = async (productId) => {
  const [rows] = await db.query(
    `SELECT
       p.ID,
       p.product_title,
       p.product_content,
       p.product_status,
       p.product_url,
       p.product_date_added,
       p.product_date_modified,

       c.category_name,

       (
         SELECT media_path
         FROM   tbl_media
         WHERE  parent_id  = p.ID
           AND  media_type = 'product_image'
         ORDER BY media_id ASC
         LIMIT 1
       ) AS image,

       /* selling price */
       ${metaSubQuery("_price",         "price")},
       /* MRP / original price → compare_at_price */
       ${metaSubQuery("_regular_price", "regular_price")},
       /* SKU */
       ${metaSubQuery("_sku",           "sku")},
       /* stock */
       ${metaSubQuery("_stock",         "stock")},
       /* weight in kg (key = 'weight', no underscore — confirmed in DB) */
       ${metaSubQuery("weight",         "weight")}

     FROM tbl_products p
     LEFT JOIN tbl_products_category_link pcl ON pcl.product_id = p.ID
     LEFT JOIN tbl_products_category c        ON c.category_id  = pcl.category_id
     WHERE p.ID = ?
     GROUP BY p.ID
     LIMIT 1`,
    [productId],
  );

  if (!rows.length) return null;

  const p        = rows[0];
  const imageSrc = buildImageUrl(p.image);

  const updatedAt = p.product_date_modified
    ? new Date(p.product_date_modified).toISOString()
    : new Date().toISOString();
  const createdAt = p.product_date_added
    ? new Date(p.product_date_added).toISOString()
    : updatedAt;

  // ── Prices ──────────────────────────────────────────────────────
  const sellingPrice = toFloat(p.price,         0); // _price
  const regularPrice = toFloat(p.regular_price, 0); // _regular_price (MRP)
  const compareAt    = regularPrice > 0 && regularPrice > sellingPrice ? regularPrice : 0;

  // ── Weight ──────────────────────────────────────────────────────
  const weight = toFloat(p.weight, 0); // meta_key='weight', value in kg e.g. 7

  return {
    id:           p.ID,
    title:        toStr(p.product_title),
    body_html:    toStr(p.product_content),
    vendor:       "Nestcase",
    product_type: toStr(p.category_name),
    handle:       toStr(p.product_url),
    status:       p.product_status === "publish" ? "active" : "draft",
    updated_at:   updatedAt,

    variants: [
      {
        id:               p.ID,
        title:            "Default",
        price:            sellingPrice.toFixed(2),      // ✅ string "999.00"
        compare_at_price: compareAt > 0
                            ? compareAt.toFixed(2)      // ✅ string "1499.00" (MRP)
                            : "",                       // ✅ "" when no discount
        sku:              toStr(p.sku),
        quantity:         toInt(p.stock, 0),
        updated_at:       updatedAt,
        taxable:          true,
        option_values:    {},
        grams:            Math.round(weight * 1000),    // e.g. 7 kg → 7000 grams
        image:            { src: imageSrc },
        weight:           weight,                       // real value from DB e.g. 7
        weight_unit:      "kg",
      },
    ],

    image: { src: imageSrc },
  };
};

/**
 * Send the Product Update webhook to Shiprocket.
 * Call this after any product create or update.
 * Returns { success, status, data } or { success: false, error }.
 */
const sendProductUpdateWebhook = async (productId) => {
  try {
    const payload = await buildProductPayload(productId);
    if (!payload) {
      return { success: false, error: `Product ${productId} not found` };
    }
    const body     = JSON.stringify(payload);
    const response = await axios.post(PRODUCT_WEBHOOK_URL, body, {
      headers: shiprocketHeaders(body),
    });
    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    console.error("sendProductUpdateWebhook error:", err.response?.data || err.message);
    return { success: false, error: err.response?.data || err.message };
  }
};

/* ─────────────────────────────────────────────────────────────
   COLLECTION UPDATE WEBHOOK
───────────────────────────────────────────────────────────── */
const buildCollectionPayload = async (categoryId) => {
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
     WHERE c.category_id = ?
     LIMIT 1`,
    [categoryId],
  );

  if (!rows.length) return null;

  const c = rows[0];
  return {
    id:         c.category_id,
    title:      toStr(c.category_name),
    body_html:  toStr(c.category_desc),
    handle:     toStr(c.category_slug),
    updated_at: new Date().toISOString(),
    image:      { src: buildImageUrl(c.image) },
  };
};

/**
 * Send the Collection Update webhook to Shiprocket.
 * Call this after any category create or update.
 * Returns { success, status, data } or { success: false, error }.
 */
const sendCollectionUpdateWebhook = async (categoryId) => {
  try {
    const payload = await buildCollectionPayload(categoryId);
    if (!payload) {
      return { success: false, error: `Collection ${categoryId} not found` };
    }
    const body     = JSON.stringify(payload);
    const response = await axios.post(COLLECTION_WEBHOOK_URL, body, {
      headers: shiprocketHeaders(body),
    });
    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    console.error("sendCollectionUpdateWebhook error:", err.response?.data || err.message);
    return { success: false, error: err.response?.data || err.message };
  }
};

module.exports = {
  sendProductUpdateWebhook,
  sendCollectionUpdateWebhook,
  buildProductPayload,       // exported for testing/inspection
  buildCollectionPayload,    // exported for testing/inspection
};