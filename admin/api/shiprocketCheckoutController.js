const db = require("../config/db");
const axios = require("axios");

const getCheckoutToken = async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.checkout.shiprocket.in/v1/auth/access-token",
      {},
      {
        headers: {
          "x-api-key": process.env.CHECKOUT_API_KEY,
          "x-api-secret": process.env.CHECKOUT_API_SECRET,
          "Content-Type": "application/json",
        },
      },
    );
    return res.json(response.data);
  } catch (err) {
    console.log(err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Helpers
 */
const toInt = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? d : n;
};

const toStr = (v) => (v == null ? "" : String(v));

const BASE_URL = "https://nestcase.in";

/**
 * =========================================
 * GET /shiprocket/products
 * =========================================
 */
const fetchProducts = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `
      SELECT
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

        (
          SELECT media_path
          FROM tbl_media
          WHERE parent_id = p.ID
          AND media_type = 'product_image'
          ORDER BY media_id ASC
          LIMIT 1
        ) AS image

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

    const products = rows.map((p) => ({
      id: p.ID,

      title: toStr(p.product_title),

      body_html: toStr(p.product_content),

      vendor: "Nestcase",

      product_type: toStr(p.category_name),

      handle: toStr(p.product_url),

      status: p.product_status === "publish" ? "active" : "draft",

      created_at: p.product_date_added
        ? new Date(p.product_date_added).toISOString()
        : "",

      updated_at: p.product_date_modified
        ? new Date(p.product_date_modified).toISOString()
        : "",

      variants: [
        {
          id: p.ID,

          title: "Default",

          price: 0,

          sku: "",

          inventory_quantity: 100,

          inventory_management: "shopify",

          requires_shipping: true,
        },
      ],

      images: p.image
        ? [
            {
              src: p.image.startsWith("http")
                ? p.image
                : `${BASE_URL}/${p.image.replace(/^\/+/, "")}`,
            },
          ]
        : [],
    }));

    return res.json({
      success: true,
      page,
      limit,
      count: products.length,
      has_more: products.length === limit,
      products,
    });
  } catch (err) {
    console.error("fetchProducts error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * =========================================
 * GET /shiprocket/products/by-collection
 * =========================================
 */
const fetchProductsByCollection = async (req, res) => {
  try {
    const collectionId = toInt(req.query.collection_id, 0);

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: "collection_id is required",
      });
    }

    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    /**
     * Verify collection exists
     */
    const [categoryRows] = await db.query(
      `
      SELECT
        category_id,
        category_name
      FROM tbl_products_category
      WHERE category_id = ?
      LIMIT 1
      `,
      [collectionId],
    );

    if (!categoryRows.length) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
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

        (
          SELECT media_path
          FROM tbl_media
          WHERE parent_id = p.ID
          AND media_type = 'product_image'
          ORDER BY media_id ASC
          LIMIT 1
        ) AS image

      FROM tbl_products p

      INNER JOIN tbl_products_category_link pcl
        ON pcl.product_id = p.ID

      INNER JOIN tbl_products_category c
        ON c.category_id = pcl.category_id

      WHERE pcl.category_id = ?
      AND p.product_status = 'publish'

      GROUP BY p.ID

      ORDER BY p.ID DESC

      LIMIT ? OFFSET ?
      `,
      [collectionId, limit, offset],
    );

    const products = rows.map((p) => ({
      id: p.ID,

      title: toStr(p.product_title),

      body_html: toStr(p.product_content),

      vendor: "Nestcase",

      product_type: toStr(p.category_name),

      handle: toStr(p.product_url),

      status: p.product_status === "publish" ? "active" : "draft",

      created_at: p.product_date_added
        ? new Date(p.product_date_added).toISOString()
        : "",

      updated_at: p.product_date_modified
        ? new Date(p.product_date_modified).toISOString()
        : "",

      variants: [
        {
          id: p.ID,

          title: "Default",

          price: 0,

          sku: "",

          inventory_quantity: 100,

          inventory_management: "shopify",

          requires_shipping: true,
        },
      ],

      images: p.image
        ? [
            {
              src: p.image.startsWith("http")
                ? p.image
                : `${BASE_URL}/${p.image.replace(/^\/+/, "")}`,
            },
          ]
        : [],
    }));

    return res.json({
      success: true,
      collection_id: collectionId,
      page,
      limit,
      count: products.length,
      has_more: products.length === limit,
      products,
    });
  } catch (err) {
    console.error("fetchProductsByCollection error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * =========================================
 * GET /shiprocket/collections
 * =========================================
 */
const fetchCollections = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(250, Math.max(1, toInt(req.query.limit, 100)));
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `
      SELECT
        c.category_id,
        c.category_name,
        c.category_desc,

        (
          SELECT media_path
          FROM tbl_media
          WHERE parent_id = c.category_id
          AND media_type = 'category_image'
          ORDER BY media_id ASC
          LIMIT 1
        ) AS image

      FROM tbl_products_category c

      ORDER BY c.category_id DESC

      LIMIT ? OFFSET ?
      `,
      [limit, offset],
    );

    const collections = rows.map((c) => ({
      id: c.category_id,

      title: toStr(c.category_name),

      body_html: toStr(c.category_desc),

      image: c.image
        ? {
            src: c.image.startsWith("http")
              ? c.image
              : `${BASE_URL}/${c.image.replace(/^\/+/, "")}`,
          }
        : {},
    }));

    return res.json({
      success: true,
      page,
      limit,
      count: collections.length,
      has_more: collections.length === limit,
      collections,
    });
  } catch (err) {
    console.error("fetchCollections error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  fetchProducts,
  fetchProductsByCollection,
  fetchCollections,
  getCheckoutToken,
};
