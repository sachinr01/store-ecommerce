const db = require('../config/db');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Retry once on transient connection errors (ECONNRESET, ENOTFOUND, PROTOCOL_CONNECTION_LOST)
const RETRYABLE = new Set(['ECONNRESET', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED']);
const ATTRIBUTE_TAXONOMIES = new Set(['pa_color','pa_material','pa_style','pa_occasion','pa_feature','pa_size']);

// Human-readable label for each taxonomy prefix
const TAXONOMY_LABELS = {
  pa_color:    'Color',
  pa_material: 'Material',
  pa_style:    'Style',
  pa_occasion: 'Occasion',
  pa_feature:  'Feature',
  pa_size:     'Size',
};

const toSlug = (value) =>
    String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const stripShortcodes = (value = '') => String(value || '').replace(/\[[^\]]+\]/g, ' ');

const sanitizeContent = (value) => String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');

const sanitizeSummary = (value) => String(value || '')
    .replace(/<[^>]+>/g, '')
    .trim();


const BLOG_IMAGES = [
    'https://nestasia.in/cdn/shop/articles/467.png?v=1773144465&width=600',
    'https://nestasia.in/cdn/shop/articles/Blog_Banners_500_x_500_px_25_c53d2c3d-1367-46fc-a922-ae67ccc299c5.png?v=1774874256&width=780',
    'https://nestasia.in/cdn/shop/articles/What_s_your_dinner_hosting_score_f9aac14d-58ea-4a8c-a08f-215822835ad3.png?v=1774874314&width=780',
    'https://nestasia.in/cdn/shop/articles/WhatsApp_Image_2026-02-27_at_20.47.07_7b452509-c434-4d10-ad9c-ebb3b212868a.jpg?v=1774871271&width=780',
];

const formatPostDate = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
};

const normalizePost = (row, index = 0) => {
    const rawContent = stripShortcodes(row.post_content || '');
    const rawSummary = stripShortcodes(row.post_short_desc || '');
    const safeContent = sanitizeContent(rawContent).trim();
    const safeSummary = sanitizeSummary(rawSummary);
    return {
        slug: row.post_slug,
        title: row.post_title,
        content: safeContent,
        summary: safeSummary,
        date: formatPostDate(row.post_date),
        image: BLOG_IMAGES[index % BLOG_IMAGES.length],
    };
};

const normalizePage = (row) => {
    const rawContent = stripShortcodes(row.post_content || '');
    const rawSummary = stripShortcodes(row.post_short_desc || '');
    const safeContent = sanitizeContent(rawContent).trim();
    const safeSummary = sanitizeSummary(rawSummary);
    return {
        slug: row.post_slug,
        title: row.post_title,
        content: safeContent,
        summary: safeSummary,
        date: formatPostDate(row.post_date),
    };
};

async function withRetry(fn) {
    try {
        return await fn();
    } catch (err) {
        if (RETRYABLE.has(err.code)) {
            console.warn(`DB connection error (${err.code}), retrying once...`);
            await new Promise(r => setTimeout(r, 1000));
            return await fn();
        }
        throw err;
    }
}

//  shared product list query builder 
async function queryProductList(extraWhere = '', orderBy = 'p.menu_order ASC', limit = null, params = [], extraHaving = '') {
    const parsedLimit = parseInt(limit, 10);
    const limitClause = Number.isFinite(parsedLimit) ? `LIMIT ${parsedLimit}` : '';
    const havingClause = extraHaving ? `HAVING ${extraHaving}` : '';
    const [rows] = await db.query(`
        SELECT
            p.ID,
            p.product_title       AS title,
            p.product_url         AS slug,
            p.product_short_desc  AS short_description,
            p.menu_order,
            p.product_date_added  AS date_added,
            (
                SELECT MIN(CAST(pm.meta_value AS DECIMAL(10,2)))
                FROM tbl_productmeta pm
                WHERE pm.meta_key = '_price'
                  AND pm.product_id IN (
                      SELECT ID FROM tbl_products
                      WHERE (parent_id = p.ID AND product_type = 'product_variation')
                         OR (ID = p.ID AND product_type = 'product')
                  )
                  AND pm.meta_value != ''
            ) AS price_min,
            (
                SELECT MAX(CAST(pm.meta_value AS DECIMAL(10,2)))
                FROM tbl_productmeta pm
                WHERE pm.meta_key = '_price'
                  AND pm.product_id IN (
                      SELECT ID FROM tbl_products
                      WHERE (parent_id = p.ID AND product_type = 'product_variation')
                         OR (ID = p.ID AND product_type = 'product')
                  )
                  AND pm.meta_value != ''
            ) AS price_max,
            (
                SELECT MIN(CAST(pm.meta_value AS DECIMAL(10,2)))
                FROM tbl_productmeta pm
                WHERE pm.meta_key = '_sale_price'
                  AND pm.product_id IN (
                      SELECT ID FROM tbl_products
                      WHERE parent_id = p.ID AND product_type = 'product_variation'
                  )
                  AND pm.meta_value != ''
            ) AS sale_price_min,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_thumbnail_id' ORDER BY meta_id DESC LIMIT 1) AS thumbnail_id,
            (
                SELECT mm.meta_value
                FROM tbl_productmeta pm
                JOIN tbl_media m2 ON m2.media_id = CAST(pm.meta_value AS UNSIGNED)
                JOIN tbl_mediameta mm ON mm.media_id = m2.media_id
                                     AND mm.meta_key = '_wp_attached_file'
                WHERE pm.product_id = p.ID AND pm.meta_key = '_thumbnail_id'
                ORDER BY pm.meta_id DESC
                LIMIT 1
            ) AS thumbnail_url,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_product_image_gallery' LIMIT 1) AS gallery_ids,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_sku'           LIMIT 1) AS sku,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_stock_status'  LIMIT 1) AS stock_status,
            (SELECT CAST(meta_value AS UNSIGNED) FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = 'total_sales' LIMIT 1) AS total_sales,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_color'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
                        ) AS color_slugs,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_material'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
            ) AS material_slugs,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_style'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
            ) AS style_slugs,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_occasion'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
            ) AS occasion_slugs,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_feature'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
            ) AS feature_slugs,
            (
                SELECT GROUP_CONCAT(DISTINCT a.attr_slug ORDER BY a.attr_slug SEPARATOR ',')
                FROM tbl_attributes_lookup al
                JOIN tbl_attributes a ON a.attr_id = al.attr_id
                WHERE al.taxonomy = 'pa_size'
                  AND al.product_or_parent_id IN (
                      SELECT ID FROM tbl_products
                      WHERE ID = p.ID
                         OR (parent_id = p.ID AND product_type = 'product_variation')
                  )
            ) AS size_slugs
        FROM tbl_products p
        WHERE p.product_type   = 'product'
          AND p.product_status = 'publish'
          AND (p.parent_id = 0 OR p.parent_id IS NULL)
          ${extraWhere}
        ${havingClause}
        ORDER BY ${orderBy}
        ${limitClause}
    `, params);
    return rows;
}

//  GET /store/api/products 
// All published parent products ordered by menu_order.
// Query params: ?limit=N
const getProducts = async (req, res) => {
    try {
        const getArray = (key) => {
            const value = req.query[key];
            if (!value) return [];
            return Array.isArray(value) ? value : [value];
        };

        const getSingle = (key) => {
            const value = req.query[key];
            return Array.isArray(value) ? value[0] : value;
        };

        const productTypes = getArray('filter.p.product_type').map(toSlug).filter(Boolean);
        const colors = getArray('filter.p.m.pa_color').map(toSlug).filter(Boolean);
        const materials = getArray('filter.p.m.pa_material').map(toSlug).filter(Boolean);
        const styles = getArray('filter.p.m.pa_style').map(toSlug).filter(Boolean);
        const occasions = getArray('filter.p.m.pa_occasion').map(toSlug).filter(Boolean);
        const features = getArray('filter.p.m.pa_feature').map(toSlug).filter(Boolean);

        const priceGte = getSingle('filter.v.price.gte');
        const priceLte = getSingle('filter.v.price.lte');
        const sortBy = String(getSingle('sort_by') || 'best-selling');

        const whereParts = [];
        const params = [];

        if (productTypes.length > 0) {
            const placeholders = productTypes.map(() => '?').join(', ');
            whereParts.push(`AND p.product_url IN (${placeholders})`);
            params.push(...productTypes);
        }

        const addAttrFilter = (taxonomy, values) => {
            if (!values || values.length === 0) return;
            const placeholders = values.map(() => '?').join(', ');
            whereParts.push(`
                AND EXISTS (
                    SELECT 1
                    FROM tbl_attributes_lookup al
                    JOIN tbl_attributes a ON a.attr_id = al.attr_id
                    WHERE al.taxonomy = ?
                      AND a.attr_slug IN (${placeholders})
                      AND al.product_or_parent_id IN (
                          SELECT ID FROM tbl_products
                          WHERE ID = p.ID
                             OR (parent_id = p.ID AND product_type = 'product_variation')
                      )
                )
            `);
            params.push(taxonomy, ...values);
        };

        addAttrFilter('pa_color', colors);
        addAttrFilter('pa_material', materials);
        addAttrFilter('pa_style', styles);
        addAttrFilter('pa_occasion', occasions);
        addAttrFilter('pa_feature', features);

        const havingParts = [];
        if (priceGte !== undefined && priceGte !== '') {
            havingParts.push('price_max >= ?');
            params.push(Number(priceGte));
        }
        if (priceLte !== undefined && priceLte !== '') {
            havingParts.push('price_min <= ?');
            params.push(Number(priceLte));
        }
        const extraHaving = havingParts.join(' AND ');

        let orderBy = 'p.menu_order ASC';
        if (sortBy === 'best-selling') orderBy = 'total_sales DESC, p.menu_order ASC';
        if (sortBy === 'price-ascending') orderBy = 'price_min ASC, p.menu_order ASC';
        if (sortBy === 'price-descending') orderBy = 'price_min DESC, p.menu_order ASC';
        if (sortBy === 'title-ascending') orderBy = 'p.product_title ASC';

        const extraWhere = whereParts.length ? `\n          ${whereParts.join('\n          ')}` : '';

        const products = await withRetry(() =>
            queryProductList(extraWhere, orderBy, req.query.limit || null, params, extraHaving)
        );
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

//  GET /store/api/products/featured 
// Top-selling products  used by NewArrivals section.
// Query params: ?limit=N  (default 4)
const getFeaturedProducts = async (req, res) => {
    try {
        const limit = req.query.limit || 4;
        const products = await withRetry(() => queryProductList('', 'total_sales DESC, p.menu_order ASC', limit));
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getFeaturedProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

//  GET /store/api/products/on-sale 
// Products that have at least one variation with a sale price set.
// Query params: ?limit=N
const getOnSaleProducts = async (req, res) => {
    try {
        const products = await withRetry(() => queryProductList(
            `AND EXISTS (
                SELECT 1 FROM tbl_productmeta pm
                JOIN tbl_products v ON v.ID = pm.product_id
                WHERE v.parent_id = p.ID
                  AND v.product_type = 'product_variation'
                  AND pm.meta_key = '_sale_price'
                  AND pm.meta_value != ''
            )`,
            'p.menu_order ASC',
            req.query.limit || null
        ));
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getOnSaleProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

//  GET /store/api/products/:id 
// Single product with full description, all variations, colors and sizes.
const getProduct = async (req, res) => {
    const { id } = req.params;

    try {
        // Parent product
        const [[product]] = await withRetry(() => db.query(`
            SELECT
                p.ID,
                p.product_title       AS title,
                p.product_url         AS slug,
                p.product_content     AS description,
                p.product_short_desc  AS short_description,
                p.product_date_added  AS date_added,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_thumbnail_id' ORDER BY meta_id DESC LIMIT 1) AS thumbnail_id,
                (
                    SELECT mm.meta_value
                    FROM tbl_productmeta pm
                    JOIN tbl_media m2 ON m2.media_id = CAST(pm.meta_value AS UNSIGNED)
                    JOIN tbl_mediameta mm ON mm.media_id = m2.media_id
                                         AND mm.meta_key = '_wp_attached_file'
                    WHERE pm.product_id = p.ID AND pm.meta_key = '_thumbnail_id'
                    ORDER BY pm.meta_id DESC
                    LIMIT 1
                )                     AS thumbnail_url,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_product_image_gallery' LIMIT 1) AS gallery_ids,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_sku' LIMIT 1) AS sku,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_stock_status' LIMIT 1) AS stock_status,
                (SELECT CAST(meta_value AS UNSIGNED) FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = 'total_sales' LIMIT 1) AS total_sales,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_price' LIMIT 1) AS price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_regular_price' LIMIT 1) AS regular_price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_sale_price' LIMIT 1) AS sale_price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_yoast_wpseo_title' LIMIT 1) AS seo_title,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_yoast_wpseo_metadesc' LIMIT 1) AS seo_description,
                (SELECT CAST(meta_value AS DECIMAL(3,2)) FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_wc_average_rating' LIMIT 1) AS avg_rating,
                (SELECT CAST(meta_value AS UNSIGNED) FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_wc_review_count' LIMIT 1) AS review_count
            FROM tbl_products p
            WHERE p.ID = ?
              AND p.product_type   = 'product'
              AND p.product_status = 'publish'
        `, [id]));

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // All variations with price, sale price, color, size, stock, sku, thumbnail
        const [variations] = await withRetry(() => db.query(`
            SELECT
                v.ID,
                v.product_title       AS title,
                v.menu_order,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_price'            LIMIT 1) AS price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_regular_price'    LIMIT 1) AS regular_price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_sale_price'       LIMIT 1) AS sale_price,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = 'attribute_pa_color' LIMIT 1) AS color,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = 'attribute_pa_size'  LIMIT 1) AS size,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_stock_status'     LIMIT 1) AS stock_status,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_stock'            LIMIT 1) AS stock_qty,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_thumbnail_id'     LIMIT 1) AS thumbnail_id,
                (
                    SELECT mm.meta_value
                    FROM tbl_productmeta pm
                    JOIN tbl_media m2 ON m2.media_id = CAST(pm.meta_value AS UNSIGNED)
                    JOIN tbl_mediameta mm ON mm.media_id = m2.media_id
                                         AND mm.meta_key = '_wp_attached_file'
                    WHERE pm.product_id = v.ID AND pm.meta_key = '_thumbnail_id'
                    LIMIT 1
                ) AS thumbnail_url,
                (SELECT meta_value FROM tbl_productmeta WHERE product_id = v.ID AND meta_key = '_sku'              LIMIT 1) AS sku
            FROM tbl_products v
            WHERE v.parent_id = ? AND v.product_type = 'product_variation'
            ORDER BY v.menu_order ASC
        `, [id]));

        // Fetch all images for each variation (for full gallery switch on color select)
        const variationIds = variations.map(v => v.ID);
        const variationImages = {};
        if (variationIds.length) {
            const [varImgRows] = await withRetry(() => db.query(
                `SELECT m.parent_id AS variation_id, mm.meta_value AS file_path
                 FROM tbl_media m
                 JOIN tbl_mediameta mm ON mm.media_id = m.media_id
                                      AND mm.meta_key = '_wp_attached_file'
                 WHERE m.parent_id IN (${variationIds.map(() => '?').join(',')})
                 ORDER BY m.parent_id, m.media_id ASC`,
                variationIds
            ));
            for (const row of varImgRows) {
                if (!variationImages[row.variation_id]) variationImages[row.variation_id] = [];
                variationImages[row.variation_id].push(row.file_path);
            }
        }
        // Attach image_urls array to each variation
        for (const v of variations) {
            v.image_urls = variationImages[v.ID] || [];
        }

        // Unique colors available for this product (with in-stock flag)
        const [colors] = await withRetry(() => db.query(`
            SELECT DISTINCT
                a.attr_id,
                a.attr_name,
                a.attr_slug,
                MAX(al.in_stock) AS in_stock
            FROM tbl_attributes_lookup al
            JOIN tbl_attributes a ON a.attr_id = al.attr_id
            WHERE al.product_or_parent_id = ? AND al.taxonomy = 'pa_color'
            GROUP BY a.attr_id
            ORDER BY a.attr_name ASC
        `, [id]));

        // Unique sizes available for this product (with in-stock flag)
        const [sizes] = await withRetry(() => db.query(`
            SELECT DISTINCT
                a.attr_id,
                a.attr_name,
                a.attr_slug,
                MAX(al.in_stock) AS in_stock
            FROM tbl_attributes_lookup al
            JOIN tbl_attributes a ON a.attr_id = al.attr_id
            WHERE al.product_or_parent_id = ? AND al.taxonomy = 'pa_size'
            GROUP BY a.attr_id
            ORDER BY a.attr_name ASC
        `, [id]));

        // Price range  include parent price (simple products) + variation prices
        const prices = [
            ...(product.price ? [parseFloat(product.price)] : []),
            ...variations.map(v => parseFloat(v.price)).filter(p => !isNaN(p))
        ].filter(p => !isNaN(p) && p > 0);

        const price_min = prices.length ? Math.min(...prices) : null;
        const price_max = prices.length ? Math.max(...prices) : null;

        // gallery_urls = all parent_id images EXCEPT the _thumbnail_id one
        // The featured image (thumbnail_url) is shown separately on the product page
        const [allMediaRows] = await withRetry(() => db.query(
            `SELECT m.media_id, mm.meta_value AS file_path,
                    CASE WHEN m.media_id = ? THEN 1 ELSE 0 END AS is_thumbnail
             FROM tbl_media m
             JOIN tbl_mediameta mm ON mm.media_id = m.media_id
                                  AND mm.meta_key = '_wp_attached_file'
             WHERE m.parent_id = ?
             ORDER BY is_thumbnail DESC, m.media_id ASC`,
            [product.thumbnail_id ? Number(product.thumbnail_id) : 0, id]
        ));
        const gallery_urls = allMediaRows
            .filter(r => r.file_path)
            .map(r => ({ file_path: r.file_path, is_thumbnail: r.is_thumbnail === 1 }));

        res.json({
            success: true,
            data: {
                ...product,
                price_min,
                price_max,
                gallery_urls,
                variations,
                attributes: { colors, sizes }
            }
        });
    } catch (err) {
        console.error('getProduct error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

//  GET /store/api/attributes/colors 
// All distinct color attributes used across published products.
const getColors = async (req, res) => {
    try {
        const [rows] = await withRetry(() => db.query(`
            SELECT
                MIN(a.attr_id) AS attr_id,
                a.attr_name,
                MIN(a.attr_slug) AS attr_slug
            FROM tbl_attributes a
            JOIN tbl_attributes_lookup al ON al.attr_id = a.attr_id
            JOIN tbl_products p ON p.ID = al.product_or_parent_id
            WHERE al.taxonomy = 'pa_color'
              AND p.product_status = 'publish'
            GROUP BY a.attr_name
            ORDER BY a.attr_name ASC
        `));
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getColors error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/attributes/:taxonomy
// Returns distinct attributes for the given taxonomy (pa_color, pa_material, pa_style, pa_occasion, pa_feature)
const getAttributesByTaxonomy = async (req, res) => {
    const raw = String(req.params.taxonomy ?? '').toLowerCase().trim();
    const taxonomy = raw.startsWith('pa_') ? raw : `pa_${raw}`;

    if (!ATTRIBUTE_TAXONOMIES.has(taxonomy)) {
        return res.status(400).json({ success: false, message: 'Unsupported taxonomy' });
    }

    try {
        const [rows] = await withRetry(() => db.query(`
            SELECT
                MIN(a.attr_id) AS attr_id,
                a.attr_name,
                MIN(a.attr_slug) AS attr_slug
            FROM tbl_attributes a
            JOIN tbl_attributes_lookup al ON al.attr_id = a.attr_id
            JOIN tbl_products p ON p.ID = al.product_or_parent_id
            WHERE al.taxonomy = ?
              AND p.product_status = 'publish'
            GROUP BY a.attr_name
            ORDER BY a.attr_name ASC
        `, [taxonomy]));
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getAttributesByTaxonomy error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};
// GET /store/api/attributes/all
// Returns ALL taxonomies that have at least one attribute linked to a published product.
// Each entry: { taxonomy, label, options: [{ attr_id, attr_name, attr_slug }] }
// Adding a new taxonomy to tbl_attributes_lookup automatically shows it here.
const getAllAttributeGroups = async (req, res) => {
    try {
        const [rows] = await withRetry(() => db.query(`
            SELECT
                al.taxonomy,
                MIN(a.attr_id)   AS attr_id,
                a.attr_name,
                MIN(a.attr_slug) AS attr_slug
            FROM tbl_attributes a
            JOIN tbl_attributes_lookup al ON al.attr_id = a.attr_id
            JOIN tbl_products p ON p.ID = al.product_or_parent_id
            WHERE p.product_status = 'publish'
            GROUP BY al.taxonomy, a.attr_name
            ORDER BY al.taxonomy ASC, a.attr_name ASC
        `));

        // Group by taxonomy
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.taxonomy]) {
                grouped[row.taxonomy] = {
                    taxonomy: row.taxonomy,
                    label: TAXONOMY_LABELS[row.taxonomy]
                        || row.taxonomy.replace(/^pa_/, '').replace(/-/g, ' ')
                            .replace(/\b\w/g, c => c.toUpperCase()),
                    options: [],
                };
            }
            grouped[row.taxonomy].options.push({
                attr_id:   row.attr_id,
                attr_name: row.attr_name,
                attr_slug: row.attr_slug,
            });
        }

        res.json({ success: true, data: Object.values(grouped) });
    } catch (err) {
        console.error('getAllAttributeGroups error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/products/slug/:slug
const getProductBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const [[product]] = await withRetry(() => db.query(`
            SELECT p.ID FROM tbl_products p
            WHERE p.product_url = ? AND p.product_type = 'product' AND p.product_status = 'publish'
            LIMIT 1
        `, [slug]));
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        req.params.id = String(product.ID);
        return getProduct(req, res);
    } catch (err) {
        console.error('getProductBySlug error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/blogs
const getBlogs = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
        const limitClause = Number.isFinite(limit) ? 'LIMIT ?' : '';
        const params = Number.isFinite(limit) ? [limit] : [];
        const [rows] = await withRetry(() => db.query(`
            SELECT post_slug, post_title, post_content, post_short_desc, post_date
            FROM tbl_posts
            WHERE post_type = 'post' AND post_status = 'publish'
            ORDER BY post_date DESC
            ${limitClause}
        `, params));
        const data = rows.map((row, idx) => normalizePost(row, idx));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error('getBlogs error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/blogs/slug/:slug
const getBlogBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const [[row]] = await withRetry(() => db.query(`
            SELECT post_slug, post_title, post_content, post_short_desc, post_date
            FROM tbl_posts
            WHERE post_type = 'post' AND post_status = 'publish' AND post_slug = ?
            LIMIT 1
        `, [slug]));
        if (!row) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, data: normalizePost(row, 0) });
    } catch (err) {
        console.error('getBlogBySlug error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/pages
const getPages = async (_req, res) => {
    try {
        const [rows] = await withRetry(() => db.query(`
            SELECT post_slug, post_title, post_content, post_short_desc, post_date
            FROM tbl_posts
            WHERE post_type = 'page' AND post_status = 'publish'
            ORDER BY post_date DESC
        `));
        const data = rows.map((row) => normalizePage(row));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error('getPages error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

// GET /store/api/pages/slug/:slug
const getPageBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const [[row]] = await withRetry(() => db.query(`
            SELECT post_slug, post_title, post_content, post_short_desc, post_date
            FROM tbl_posts
            WHERE post_type = 'page' AND post_status = 'publish' AND post_slug = ?
            LIMIT 1
        `, [slug]));
        if (!row) return res.status(404).json({ success: false, message: 'Page not found' });
        res.json({ success: true, data: normalizePage(row) });
    } catch (err) {
        console.error('getPageBySlug error:', err);
        res.status(500).json({ success: false, message: 'Server error', ...(NODE_ENV !== 'production' ? { error: err.message || String(err), code: err.code || null } : {}) });
    }
};

module.exports = {
    getProducts,
    getFeaturedProducts,
    getOnSaleProducts,
    getProduct,
    getProductBySlug,
    getColors,
    getAttributesByTaxonomy,
    getAllAttributeGroups,
    getBlogs,
    getBlogBySlug,
    getPages,
    getPageBySlug,
};
