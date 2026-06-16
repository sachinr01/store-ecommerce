const crypto = require("crypto");
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
const toStr = (v)        => (v == null ? "" : String(v).trim());
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
  const createdAt = p.product_date_added
    ? new Date(p.product_date_added).toISOString()
    : updatedAt;
  const price = toFloat(p.price, 0);
  const regularPrice = toFloat(p.regular_price, 0);
  const salePrice = toFloat(p.sale_price, 0);
  const compareAt = salePrice > 0 && regularPrice > 0 && salePrice < regularPrice ? regularPrice : 0;
  const stockQty = toInt(p.stock, 0);
  const weight = toFloat(p.weight, 0);

  return {
    id:           p.ID,
    title:        toStr(p.product_title),
    body_html:    toStr(p.product_content),
    vendor:       "Nestcase",
    product_type: toStr(p.category_name),
    created_at: createdAt,
    handle:       toStr(p.product_url),
    status:       p.product_status === "publish" ? "active" : "draft",
    tags:         "",
    updated_at: updatedAt,
    variants: [
      {
        id:                   p.ID,
        title:                "Default",
        price:                price.toFixed(2),
        compare_at_price:     compareAt > 0 ? compareAt.toFixed(2) : "",
        sku:                  toStr(p.sku),                  // ✅ real SKU from DB
        created_at:           createdAt,
        updated_at:           updatedAt,                     // ✅ added per SR spec
        taxable:              true,
        quantity:             stockQty,                      // ✅ real stock from DB
        option_values:        {},
        grams:                Math.round(weight * 1000),
        image: { src: imageSrc || "" },                      // ✅ variant-level image
        // ✅ weight: mandatory field per Shiprocket docs. Defaults to 0 if
        // _weight meta key is not set in DB.
        weight:               weight,
        weight_unit:          "kg",
      },
    ],
    // ✅ image: mandatory field per Shiprocket docs. Always an object,
    // with src: "" if no image exists.
    image: { src: imageSrc || "" },
    options: [],
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

const countPublishedProducts = async (collectionId = null) => {
  if (collectionId) {
    const [rows] = await db.query(
      `
      SELECT COUNT(DISTINCT p.ID) AS total
      FROM tbl_products p
      INNER JOIN tbl_products_category_link pcl
        ON pcl.product_id = p.ID
      WHERE pcl.category_id = ?
        AND p.product_status = 'publish'
      `,
      [collectionId],
    );
    return toInt(rows?.[0]?.total, 0);
  }

  const [rows] = await db.query(
    `
    SELECT COUNT(DISTINCT p.ID) AS total
    FROM tbl_products p
    WHERE p.product_status = 'publish'
    `,
  );
  return toInt(rows?.[0]?.total, 0);
};

const countPublishedCollections = async () => {
  const [rows] = await db.query(
    `
    SELECT COUNT(DISTINCT c.category_id) AS total
    FROM tbl_products_category c
    WHERE EXISTS (
      SELECT 1
      FROM   tbl_products_category_link pcl
      JOIN   tbl_products p ON p.ID = pcl.product_id
      WHERE  pcl.category_id  = c.category_id
        AND  p.product_status = 'publish'
    )
    `,
  );
  return toInt(rows?.[0]?.total, 0);
};

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

    const total = await countPublishedProducts();
    const products = rows.map(mapProduct);

    return res.json({
      data: {
        total,
        products,
      },
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

    const total = await countPublishedProducts(collectionId);
    const products = rows.map(mapProduct);

    return res.json({
      data: {
        total,
        products,
      },
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

    const nowIso = new Date().toISOString();
    const collections = rows.map((c) => {
      const imageSrc = buildImageUrl(c.image);
      return {
        id:         c.category_id,
        updated_at: nowIso, // collections have no modified timestamp in schema
        body_html:  toStr(c.category_desc),
        handle:     toStr(c.category_slug),
        // ✅ image: mandatory field per Shiprocket docs. Always an object,
        // with src: "" if no image exists.
        image:      { src: imageSrc || "" },
        title:      toStr(c.category_name),
        created_at: nowIso,
      };
    });

    const total = await countPublishedCollections();

    return res.json({
      data: {
        total,
        collections,
      },
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
    const payload = {
      cart_data: req.body?.cart_data || { items: [] },
      redirect_url: req.body?.redirect_url || "",
      timestamp: req.body?.timestamp || new Date().toISOString(),
    };
    const bodyStr = JSON.stringify(payload);
    const apiKey = process.env.CHECKOUT_API_KEY || "";
    const apiSecret = process.env.CHECKOUT_API_SECRET || "";

    const response = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
      payload,
      {
        headers: {
          "X-Api-Key": apiKey,
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
