const db    = require("../config/db");
const axios = require("axios");
const {
  sendProductUpdateWebhook,
  sendCollectionUpdateWebhook,
} = require("./shiprocketWebhooks");

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const toInt = (v, d = 0) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const toStr = (v)        => (v == null ? "" : String(v));
const toFloat = (v, d = 0) => { const n = parseFloat(v); return Number.isNaN(n) ? d : n; };

const BASE_URL = "https://nestcase.in";

/** Build an absolute image URL from a DB media_path value */
const buildImageUrl = (path) => {
  if (!path) return null;
  return path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\/+/, "")}`;
};

/**
 * Shared SQL fragment: fetches the LATEST value of a given meta_key
 * for a product from tbl_productmeta.
 * Usage inside a SELECT: metaSubQuery("_price", "price")
 */
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
 * Map a DB row → Shiprocket product object.
 * Both fetchProducts and fetchProductsByCollection use this so
 * the shape is always identical in both endpoints.
 */
const mapProduct = (p) => {
  const imageSrc = buildImageUrl(p.image);

  const updatedAt = p.product_date_modified
    ? new Date(p.product_date_modified).toISOString()
    : "";

  return {
    id:           p.ID,
    title:        toStr(p.product_title),
    body_html:    toStr(p.product_content),
    vendor:       "Nestcase",
    product_type: toStr(p.category_name),
    handle:       toStr(p.product_url),
    status:       p.product_status === "publish" ? "active" : "draft",

    created_at: p.product_date_added
      ? new Date(p.product_date_added).toISOString()
      : "",
    updated_at: updatedAt,

    variants: [
      {
        id:                   p.ID,
        title:                "Default",
        price:                toFloat(p.price, 0),          // ✅ real price from DB
        sku:                  toStr(p.sku),                  // ✅ real SKU from DB
        quantity:             toInt(p.stock, 0),             // ✅ real stock from DB
        inventory_quantity:   toInt(p.stock, 0),
        inventory_management: "",
        requires_shipping:    true,
        // ✅ weight: mandatory field per Shiprocket docs. Defaults to 0 if
        // _weight meta key is not set in DB.
        weight:               toFloat(p.weight, 0),
        updated_at:           updatedAt,                     // ✅ added per SR spec
        // ✅ image: mandatory field per Shiprocket docs. Always an object,
        // with src: "" if no image exists.
        image: { src: imageSrc || "" },                      // ✅ variant-level image
      },
    ],

    // ✅ images: mandatory array per Shiprocket docs. Empty array if no image.
    images: imageSrc ? [{ src: imageSrc }] : [],

    // ✅ image: mandatory field per Shiprocket docs. Always an object,
    // with src: "" if no image exists.
    image: { src: imageSrc || "" },
  };
};

/* ─────────────────────────────────────────────────────────────
   Shared product SELECT columns (used in both list endpoints)
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

  /* ── media ── */
  (
    SELECT media_path
    FROM   tbl_media
    WHERE  parent_id  = p.ID
      AND  media_type = 'product_image'
    ORDER BY media_id ASC
    LIMIT 1
  ) AS image,

  /* ── meta: price ── */
  ${metaSubQuery("_price",   "price")}
  ,
  /* ── meta: SKU ── */
  ${metaSubQuery("_sku",     "sku")}
  ,
  /* ── meta: stock ── */
  ${metaSubQuery("_stock",   "stock")}
  ,
  /* ── meta: weight (kg) ── */
  ${metaSubQuery("_weight",  "weight")}
`;

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/products
   Fetch all published products (paginated)
───────────────────────────────────────────────────────────── */
const fetchProducts = async (req, res) => {
  try {
    const page   = Math.max(1, toInt(req.query.page,  1));
    const limit  = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `
      SELECT
        ${PRODUCT_SELECT}
      FROM tbl_products p

      LEFT JOIN tbl_products_category_link pcl
        ON pcl.product_id = p.ID

      LEFT JOIN tbl_products_category c
        ON c.category_id = pcl.category_id

      WHERE p.product_status = 'publish'

      GROUP BY p.ID

      ORDER BY p.ID DESC

      LIMIT ? OFFSET ?
      `,
      [limit, offset],
    );

    return res.json({
      success:  true,
      page,
      limit,
      count:    rows.length,
      has_more: rows.length === limit,
      products: rows.map(mapProduct),
    });
  } catch (err) {
    console.error("fetchProducts error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/products/by-collection?collection_id=X
   Fetch published products that belong to a specific collection
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

    /* Verify collection exists first */
    const [categoryRows] = await db.query(
      `SELECT category_id, category_name
       FROM   tbl_products_category
       WHERE  category_id = ?
       LIMIT  1`,
      [collectionId],
    );

    if (!categoryRows.length) {
      return res.status(404).json({ success: false, message: "Collection not found" });
    }

    const [rows] = await db.query(
      `
      SELECT
        ${PRODUCT_SELECT}
      FROM tbl_products p

      INNER JOIN tbl_products_category_link pcl
        ON pcl.product_id = p.ID

      INNER JOIN tbl_products_category c
        ON c.category_id = pcl.category_id

      WHERE pcl.category_id   = ?
        AND p.product_status  = 'publish'

      GROUP BY p.ID

      ORDER BY p.ID DESC

      LIMIT ? OFFSET ?
      `,
      [collectionId, limit, offset],
    );

    return res.json({
      success:       true,
      collection_id: collectionId,
      page,
      limit,
      count:         rows.length,
      has_more:      rows.length === limit,
      products:      rows.map(mapProduct),
    });
  } catch (err) {
    console.error("fetchProductsByCollection error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/shiprocket/collections
   Fetch all product collections / categories (paginated)
───────────────────────────────────────────────────────────── */
const fetchCollections = async (req, res) => {
  try {
    const page   = Math.max(1, toInt(req.query.page,  1));
    const limit  = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

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

      -- ✅ Only include collections that have at least one published product.
      -- Empty collections (no linked products) are excluded from the feed.
      WHERE EXISTS (
        SELECT 1
        FROM   tbl_products_category_link pcl
        JOIN   tbl_products p ON p.ID = pcl.product_id
        WHERE  pcl.category_id  = c.category_id
          AND  p.product_status = 'publish'
      )

      ORDER BY c.category_id ASC

      LIMIT ? OFFSET ?
      `,
      [limit, offset],
    );

    const collections = rows.map((c) => {
      const imageSrc = buildImageUrl(c.image);
      return {
        id:         c.category_id,
        title:      toStr(c.category_name),
        body_html:  toStr(c.category_desc),
        handle:     toStr(c.category_slug),
        updated_at: new Date().toISOString(), // collections have no modified timestamp in schema
        // ✅ image: mandatory field per Shiprocket docs. Always an object,
        // with src: "" if no image exists.
        image:      { src: imageSrc || "" },
      };
    });

    return res.json({
      success:     true,
      page,
      limit,
      count:       collections.length,
      has_more:    collections.length === limit,
      collections,
    });
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
    const response = await axios.post(
      "https://api.checkout.shiprocket.in/v1/auth/access-token",
      {},
      {
        headers: {
          "x-api-key":    process.env.CHECKOUT_API_KEY,
          "x-api-secret": process.env.CHECKOUT_API_SECRET,
          "Content-Type": "application/json",
        },
      },
    );
    return res.json(response.data);
  } catch (err) {
    console.error("getCheckoutToken error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/shiprocket/webhook/product/:productId
   Manually trigger the Product Update webhook to Shiprocket.
   Wire sendProductUpdateWebhook() into your product save handler
   for automatic real-time sync; this route is for manual/testing use.
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
   Manually trigger the Collection Update webhook to Shiprocket.
   Wire sendCollectionUpdateWebhook() into your category save handler
   for automatic real-time sync; this route is for manual/testing use.
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

/* ─────────────────────────────────────────────────────────────
   Exports
───────────────────────────────────────────────────────────── */
module.exports = {
  fetchProducts,
  fetchProductsByCollection,
  fetchCollections,
  getCheckoutToken,
  triggerProductWebhook,
  triggerCollectionWebhook,
};