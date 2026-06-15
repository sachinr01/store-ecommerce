const axios  = require("axios");
const crypto = require("crypto");
const db     = require("../config/db");

/* ─────────────────────────────────────────────────────────────
   Catalog Sync Webhooks (Shiprocket Checkout Guide, Section 2)
   ─────────────────────────────────────────────────────────────
   These send real-time updates to Shiprocket whenever a product
   or collection is created/updated on the merchant's site, so
   Shiprocket's catalog stays in sync without waiting for a full
   re-fetch.

   Configure these env vars:
     SHIPROCKET_API_KEY        - X-Api-Key value (provided by Shiprocket)
     SHIPROCKET_API_SECRET     - secret used to compute the HMAC
     SHIPROCKET_PRODUCT_WEBHOOK_URL     (default below)
     SHIPROCKET_COLLECTION_WEBHOOK_URL  (default below)

   Usage (call after any product/collection create or update):
     const { sendProductUpdateWebhook } = require('./shiprocketWebhooks');
     await sendProductUpdateWebhook(productId);

     const { sendCollectionUpdateWebhook } = require('./shiprocketWebhooks');
     await sendCollectionUpdateWebhook(categoryId);
───────────────────────────────────────────────────────────── */

const PRODUCT_WEBHOOK_URL =
  process.env.SHIPROCKET_PRODUCT_WEBHOOK_URL ||
  "https://checkout-api.shiprocket.com/wh/v1/custom/product";

const COLLECTION_WEBHOOK_URL =
  process.env.SHIPROCKET_COLLECTION_WEBHOOK_URL ||
  "https://checkout-api.shiprocket.com/wh/v1/custom/collection";

const BASE_URL = "https://nestcase.in";

const toInt   = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const toStr   = (v)        => (v == null ? "" : String(v));
const toFloat = (v, d = 0) => { const n = parseFloat(v); return Number.isNaN(n) ? d : n; };

const buildImageUrl = (path) => {
  if (!path) return null;
  return path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

const metaSubQuery = (key, alias) => `
  (
    SELECT meta_value
    FROM   tbl_productmeta
    WHERE  product_id = p.ID
      AND  meta_key   = '${key}'
    ORDER BY meta_id DESC
    LIMIT 1
  ) AS ${alias}
`;

/**
 * Compute the HMAC-SHA256 (Base64) signature for a request body,
 * as required by Shiprocket's X-Api-HMAC-SHA256 header.
 */
const computeHmac = (body) => {
  const secret = process.env.SHIPROCKET_API_SECRET || "";
  return crypto
    .createHmac("sha256", secret)
    .update(typeof body === "string" ? body : JSON.stringify(body))
    .digest("base64");
};

const shiprocketHeaders = (bodyString) => ({
  "Content-Type":       "application/json",
  "X-Api-Key":          process.env.SHIPROCKET_API_KEY || "",
  "X-Api-HMAC-SHA256":  computeHmac(bodyString),
});

/* ─────────────────────────────────────────────────────────────
   PRODUCT UPDATE WEBHOOK
   Fires whenever a product is created or updated.
───────────────────────────────────────────────────────────── */

/**
 * Build the Shiprocket "Product Update" webhook payload for a
 * single product, matching the same shape used by the catalog
 * sync APIs (fetchProducts / fetchProductsByCollection).
 */
const buildProductPayload = async (productId) => {
  const [rows] = await db.query(
    `
    SELECT
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

      ${metaSubQuery("_price",  "price")},
      ${metaSubQuery("_sku",    "sku")},
      ${metaSubQuery("_stock",  "stock")},
      ${metaSubQuery("_weight", "weight")}

    FROM tbl_products p

    LEFT JOIN tbl_products_category_link pcl
      ON pcl.product_id = p.ID

    LEFT JOIN tbl_products_category c
      ON c.category_id = pcl.category_id

    WHERE p.ID = ?

    GROUP BY p.ID
    LIMIT 1
    `,
    [productId],
  );

  if (!rows.length) return null;

  const p = rows[0];
  const imageSrc = buildImageUrl(p.image);
  const updatedAt = p.product_date_modified
    ? new Date(p.product_date_modified).toISOString()
    : new Date().toISOString();

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
        id:                   p.ID,
        title:                "Default",
        price:                toFloat(p.price, 0),
        sku:                  toStr(p.sku),
        quantity:             toInt(p.stock, 0),
        inventory_quantity:   toInt(p.stock, 0),
        updated_at:           updatedAt,
        image:                { src: imageSrc || "" },
        weight:               toFloat(p.weight, 0),
      },
    ],

    image: { src: imageSrc || "" },
  };
};

/**
 * Send the Product Update webhook to Shiprocket for the given product.
 * Call this after creating or updating a product (price, title, stock,
 * weight, image, status, etc.).
 *
 * Returns { success, status, data } or { success: false, error }.
 */
const sendProductUpdateWebhook = async (productId) => {
  try {
    const payload = await buildProductPayload(productId);
    if (!payload) {
      return { success: false, error: `Product ${productId} not found` };
    }

    const body = JSON.stringify(payload);
    const response = await axios.post(PRODUCT_WEBHOOK_URL, body, {
      headers: shiprocketHeaders(body),
    });

    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    console.error(
      "sendProductUpdateWebhook error:",
      err.response?.data || err.message,
    );
    return {
      success: false,
      error: err.response?.data || err.message,
    };
  }
};

/* ─────────────────────────────────────────────────────────────
   COLLECTION UPDATE WEBHOOK
   Fires whenever a collection/category is created or updated.
───────────────────────────────────────────────────────────── */

const buildCollectionPayload = async (categoryId) => {
  const [rows] = await db.query(
    `
    SELECT
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
    LIMIT 1
    `,
    [categoryId],
  );

  if (!rows.length) return null;

  const c = rows[0];
  const imageSrc = buildImageUrl(c.image);

  return {
    id:         c.category_id,
    title:      toStr(c.category_name),
    body_html:  toStr(c.category_desc),
    handle:     toStr(c.category_slug),
    updated_at: new Date().toISOString(),
    image:      { src: imageSrc || "" },
  };
};

/**
 * Send the Collection Update webhook to Shiprocket for the given category.
 * Call this after creating or updating a category (name, slug, description,
 * image).
 *
 * Returns { success, status, data } or { success: false, error }.
 */
const sendCollectionUpdateWebhook = async (categoryId) => {
  try {
    const payload = await buildCollectionPayload(categoryId);
    if (!payload) {
      return { success: false, error: `Collection ${categoryId} not found` };
    }

    const body = JSON.stringify(payload);
    const response = await axios.post(COLLECTION_WEBHOOK_URL, body, {
      headers: shiprocketHeaders(body),
    });

    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    console.error(
      "sendCollectionUpdateWebhook error:",
      err.response?.data || err.message,
    );
    return {
      success: false,
      error: err.response?.data || err.message,
    };
  }
};

module.exports = {
  sendProductUpdateWebhook,
  sendCollectionUpdateWebhook,
  buildProductPayload,      // exported for testing/inspection
  buildCollectionPayload,   // exported for testing/inspection
};