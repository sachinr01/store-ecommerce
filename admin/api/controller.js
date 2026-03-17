const db = require('../config/db');

// ─── shared product list query builder ───────────────────────────────────────
async function queryProductList(extraWhere = '', orderBy = 'p.menu_order ASC', limit = null) {
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';
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
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_thumbnail_id'  LIMIT 1) AS thumbnail_id,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_product_image_gallery' LIMIT 1) AS gallery_ids,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_sku'           LIMIT 1) AS sku,
            (SELECT meta_value FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = '_stock_status'  LIMIT 1) AS stock_status,
            (SELECT CAST(meta_value AS UNSIGNED) FROM tbl_productmeta WHERE product_id = p.ID AND meta_key = 'total_sales' LIMIT 1) AS total_sales
        FROM tbl_products p
        WHERE p.product_type   = 'product'
          AND p.product_status = 'publish'
          AND (p.parent_id = 0 OR p.parent_id IS NULL)
          ${extraWhere}
        ORDER BY ${orderBy}
        ${limitClause}
    `);
    return rows;
}

// ─── GET /store/api/products ──────────────────────────────────────────────────
// All published parent products ordered by menu_order.
// Query params: ?limit=N
const getProducts = async (req, res) => {
    try {
        const products = await queryProductList('', 'p.menu_order ASC', req.query.limit || null);
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── GET /store/api/products/featured ────────────────────────────────────────
// Top-selling products — used by NewArrivals section.
// Query params: ?limit=N  (default 4)
const getFeaturedProducts = async (req, res) => {
    try {
        const limit = req.query.limit || 4;
        const products = await queryProductList(
            '',
            'total_sales DESC, p.menu_order ASC',
            limit
        );
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getFeaturedProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── GET /store/api/products/on-sale ─────────────────────────────────────────
// Products that have at least one variation with a sale price set.
// Query params: ?limit=N
const getOnSaleProducts = async (req, res) => {
    try {
        const products = await queryProductList(
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
        );
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        console.error('getOnSaleProducts error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── GET /store/api/products/:id ─────────────────────────────────────────────
// Single product with full description, all variations, colors and sizes.
const getProduct = async (req, res) => {
    const { id } = req.params;

    try {
        // Parent product
        const [[product]] = await db.query(`
            SELECT
                p.ID,
                p.product_title       AS title,
                p.product_url         AS slug,
                p.product_content     AS description,
                p.product_short_desc  AS short_description,
                p.product_date_added  AS date_added,
                thumb.meta_value      AS thumbnail_id,
                gallery.meta_value    AS gallery_ids,
                sku.meta_value        AS sku,
                stock.meta_value      AS stock_status,
                CAST(sales.meta_value AS UNSIGNED) AS total_sales,
                price_direct.meta_value       AS price,
                reg_price_direct.meta_value   AS regular_price,
                sale_price_direct.meta_value  AS sale_price,
                seo_title.meta_value  AS seo_title,
                seo_desc.meta_value   AS seo_description,
                CAST(avg_rating.meta_value AS DECIMAL(3,2)) AS avg_rating,
                CAST(review_count.meta_value AS UNSIGNED)   AS review_count
            FROM tbl_products p
            LEFT JOIN tbl_productmeta thumb
                ON thumb.product_id = p.ID AND thumb.meta_key = '_thumbnail_id'
            LEFT JOIN tbl_productmeta gallery
                ON gallery.product_id = p.ID AND gallery.meta_key = '_product_image_gallery'
            LEFT JOIN tbl_productmeta sku
                ON sku.product_id = p.ID AND sku.meta_key = '_sku'
            LEFT JOIN tbl_productmeta stock
                ON stock.product_id = p.ID AND stock.meta_key = '_stock_status'
            LEFT JOIN tbl_productmeta sales
                ON sales.product_id = p.ID AND sales.meta_key = 'total_sales'
            LEFT JOIN tbl_productmeta price_direct
                ON price_direct.product_id = p.ID AND price_direct.meta_key = '_price'
            LEFT JOIN tbl_productmeta reg_price_direct
                ON reg_price_direct.product_id = p.ID AND reg_price_direct.meta_key = '_regular_price'
            LEFT JOIN tbl_productmeta sale_price_direct
                ON sale_price_direct.product_id = p.ID AND sale_price_direct.meta_key = '_sale_price'
            LEFT JOIN tbl_productmeta seo_title
                ON seo_title.product_id = p.ID AND seo_title.meta_key = '_yoast_wpseo_title'
            LEFT JOIN tbl_productmeta seo_desc
                ON seo_desc.product_id = p.ID AND seo_desc.meta_key = '_yoast_wpseo_metadesc'
            LEFT JOIN tbl_productmeta avg_rating
                ON avg_rating.product_id = p.ID AND avg_rating.meta_key = '_wc_average_rating'
            LEFT JOIN tbl_productmeta review_count
                ON review_count.product_id = p.ID AND review_count.meta_key = '_wc_review_count'
            WHERE p.ID = ?
              AND p.product_type   = 'product'
              AND p.product_status = 'publish'
        `, [id]);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // All variations with price, sale price, color, size, stock, sku, thumbnail
        const [variations] = await db.query(`
            SELECT
                v.ID,
                v.product_title       AS title,
                v.menu_order,
                pm_price.meta_value   AS price,
                pm_reg.meta_value     AS regular_price,
                pm_sale.meta_value    AS sale_price,
                pm_color.meta_value   AS color,
                pm_size.meta_value    AS size,
                pm_stock.meta_value   AS stock_status,
                pm_qty.meta_value     AS stock_qty,
                pm_thumb.meta_value   AS thumbnail_id,
                pm_sku.meta_value     AS sku
            FROM tbl_products v
            LEFT JOIN tbl_productmeta pm_price
                ON pm_price.product_id = v.ID AND pm_price.meta_key = '_price'
            LEFT JOIN tbl_productmeta pm_reg
                ON pm_reg.product_id = v.ID AND pm_reg.meta_key = '_regular_price'
            LEFT JOIN tbl_productmeta pm_sale
                ON pm_sale.product_id = v.ID AND pm_sale.meta_key = '_sale_price'
            LEFT JOIN tbl_productmeta pm_color
                ON pm_color.product_id = v.ID AND pm_color.meta_key = 'attribute_pa_color'
            LEFT JOIN tbl_productmeta pm_size
                ON pm_size.product_id = v.ID AND pm_size.meta_key = 'attribute_pa_size'
            LEFT JOIN tbl_productmeta pm_stock
                ON pm_stock.product_id = v.ID AND pm_stock.meta_key = '_stock_status'
            LEFT JOIN tbl_productmeta pm_qty
                ON pm_qty.product_id = v.ID AND pm_qty.meta_key = '_stock'
            LEFT JOIN tbl_productmeta pm_thumb
                ON pm_thumb.product_id = v.ID AND pm_thumb.meta_key = '_thumbnail_id'
            LEFT JOIN tbl_productmeta pm_sku
                ON pm_sku.product_id = v.ID AND pm_sku.meta_key = '_sku'
            WHERE v.parent_id = ? AND v.product_type = 'product_variation'
            ORDER BY v.menu_order ASC
        `, [id]);

        // Unique colors available for this product (with in-stock flag)
        const [colors] = await db.query(`
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
        `, [id]);

        // Unique sizes available for this product (with in-stock flag)
        const [sizes] = await db.query(`
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
        `, [id]);

        // Price range — include parent price (simple products) + variation prices
        const prices = [
            ...(product.price ? [parseFloat(product.price)] : []),
            ...variations.map(v => parseFloat(v.price)).filter(p => !isNaN(p))
        ].filter(p => !isNaN(p) && p > 0);

        const price_min = prices.length ? Math.min(...prices) : null;
        const price_max = prices.length ? Math.max(...prices) : null;

        res.json({
            success: true,
            data: {
                ...product,
                price_min,
                price_max,
                variations,
                attributes: { colors, sizes }
            }
        });
    } catch (err) {
        console.error('getProduct error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getProducts, getFeaturedProducts, getOnSaleProducts, getProduct };
