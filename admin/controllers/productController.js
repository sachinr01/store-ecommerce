const db = require("../config/db");
const dd = require("../helpers/dd");
const path = require("path");
const fs = require("fs");
const { exit } = require("process");

// ─── HELPER: Load all attribute types with their values ──────────────────────
const getAttributeTypes = async (productId) => {
  if (productId) {
    // Get only taxonomies used by this product
    const [usedTaxonomies] = await db.query(
      `SELECT DISTINCT taxonomy FROM tbl_attributes_lookup WHERE product_or_parent_id = ?`,
      [productId],
    );

    if (!usedTaxonomies.length) {
      return [];
    }

    // 'pa_color' → 'color', 'pa_size' → 'size'
    const typeNames = usedTaxonomies.map(function (row) {
      return row.taxonomy.replace("pa_", "");
    });

    const ph = typeNames
      .map(function () {
        return "?";
      })
      .join(",");

    const [types] = await db.query(
      `SELECT * FROM tbl_attribute_type
       WHERE attribute_type_name IN (` +
        ph +
        `)
       ORDER BY attribute_type_order ASC`,
      typeNames,
    );

    // Load values for each type
    for (const type of types) {
      const taxonomy = "pa_" + type.attribute_type_name;

      // Get attr_ids from lookup for this product + taxonomy
      const [lookupAttrRows] = await db.query(
        `SELECT DISTINCT attr_id FROM tbl_attributes_lookup
         WHERE product_or_parent_id = ? AND taxonomy = ?
         ORDER BY attr_id ASC`,
        [productId, taxonomy],
      );

      if (!lookupAttrRows.length) {
        type.values = [];
        continue;
      }

      const attrIds = lookupAttrRows.map(function (r) {
        return r.attr_id;
      });
      const attrPh = attrIds
        .map(function () {
          return "?";
        })
        .join(",");

      // Get attr name + slug for those IDs
      const [values] = await db.query(
        `SELECT a.attr_id, a.attr_name, a.attr_slug, am.meta_value AS sort_order
         FROM tbl_attributes a
         LEFT JOIN tbl_attributemeta am ON am.attr_id = a.attr_id
           AND am.meta_key = ?
         WHERE a.attr_id IN (` +
          attrPh +
          `)
         ORDER BY CAST(am.meta_value AS UNSIGNED) ASC`,
        [`order_pa_${type.attribute_type_name}`, ...attrIds],
      );

      type.values = values; // ← set values on type
    }
    // ← return AFTER the loop, not inside it
    return types;
  } else {
    // No productId = Add page, return ALL attribute types with ALL values
    const [types] = await db.query(
      `SELECT * FROM tbl_attribute_type ORDER BY attribute_type_order ASC`,
    );

    for (const type of types) {
      const [values] = await db.query(
        `SELECT a.attr_id, a.attr_name, a.attr_slug, am.meta_value AS sort_order
         FROM tbl_attributes a
         LEFT JOIN tbl_attributemeta am ON am.attr_id = a.attr_id
           AND am.meta_key = ?
         WHERE am.meta_key = ?
         ORDER BY CAST(am.meta_value AS UNSIGNED) ASC`,
        [
          `order_pa_${type.attribute_type_name}`,
          `order_pa_${type.attribute_type_name}`,
        ],
      );
      type.values = values;
    }

    return types;
  }
};

// ─── HELPER: Upsert productmeta ───────────────────────────────────────────────
const upsertMeta = async (productId, key, value) => {
  await db.query(
    `
        INSERT INTO tbl_productmeta (product_id, meta_key, meta_value)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)
    `,
    [productId, key, value],
  );
};

// ─── LIST PRODUCTS ────────────────────────────────────────────────────────────
const showProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || null;
    const type = req.query.type || null;

    let where = "WHERE p.parent_id = 0";
    const params = [];
    if (status) {
      where += " AND p.product_status = ?";
      params.push(status);
    }
    if (type) {
      where += " AND p.product_type = ?";
      params.push(type);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM tbl_products p ${where}`,
      params,
    );

    const [products] = await db.query(
      `
            SELECT p.*,
                MAX(CASE WHEN pm.meta_key = '_regular_price' THEN pm.meta_value END) AS regular_price,
                MAX(CASE WHEN pm.meta_key = '_sale_price'    THEN pm.meta_value END) AS sale_price,
                MAX(CASE WHEN pm.meta_key = '_sku'           THEN pm.meta_value END) AS sku,
                MAX(CASE WHEN pm.meta_key = '_stock'         THEN pm.meta_value END) AS stock,
                MAX(CASE WHEN pm.meta_key = '_stock_status'  THEN pm.meta_value END) AS stock_status,
                MAX(CASE WHEN pm.meta_key = '_thumbnail_url' THEN pm.meta_value END) AS thumbnail
            FROM tbl_products p
            LEFT JOIN tbl_productmeta pm ON pm.product_id = p.ID
            ${where}
            GROUP BY p.ID
            ORDER BY p.product_date_added DESC
            LIMIT ? OFFSET ?
        `,
      [...params, limit, offset],
    );

    res.render("products/index", {
      title: "Products",
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total,
      limit,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error("Products Error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
};

// ─── SHOW ADD FORM ────────────────────────────────────────────────────────────
const showAddProduct = async (req, res) => {
  try {
    const attributeTypes = await getAttributeTypes();

    res.render("products/add", {
      title: "Add Product",
      product: false,
      variations: [],
      attributeTypes,
      selectedAttributes: {},
      errors: null,
    });
  } catch (err) {
    console.error("Add Product Error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
};

// ─── STORE NEW PRODUCT ────────────────────────────────────────────────────────
const storeProduct = async (req, res) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const body      = req.body;
    const authorId  = req.session.admin.id;

    const slug = body.product_url ||
      (body.product_title || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const guid = Date.now() + "-" + Math.random().toString(36).substr(2, 9);

    // ═══════════════════════════════════════════════════════
    // STEP 1: INSERT MAIN PRODUCT
    // ═══════════════════════════════════════════════════════
    const [result] = await conn.query(
      `INSERT INTO tbl_products
         (author_id, parent_id, product_url, product_title, product_content,
          product_short_desc, product_status, product_type, product_password, guid, menu_order,
          product_date_added, product_date_modified)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, '', ?, ?, NOW(), NOW())`,
      [
        authorId,
        slug,
        body.product_title,
        body.product_content     || "",
        body.product_short_desc  || "",
        body.product_status      || "draft",
        body.product_type        || "product",
        guid,
        body.menu_order          || 0,
      ]
    );
    const productId = result.insertId;

    // ═══════════════════════════════════════════════════════
    // STEP 2: INSERT MAIN PRODUCT META
    // ═══════════════════════════════════════════════════════
    const insertMeta = async (pid, key, value) => {
      await conn.query(
        "INSERT INTO tbl_productmeta (product_id, meta_key, meta_value) VALUES (?, ?, ?)",
        [pid, key, value || ""]
      );
    };

    await insertMeta(productId, "_sku",                   body.sku);
    await insertMeta(productId, "_regular_price",         body.regular_price);
    await insertMeta(productId, "_sale_price",            body.sale_price);
    await insertMeta(productId, "_sale_price_dates_from", body.sale_price_dates_from);
    await insertMeta(productId, "_sale_price_dates_to",   body.sale_price_dates_to);
    await insertMeta(productId, "_price",                 body.sale_price || body.regular_price);
    await insertMeta(productId, "_stock",                 body.stock      || "0");
    await insertMeta(productId, "_stock_status",          body.stock_status || "instock");
    await insertMeta(productId, "_manage_stock",          body.manage_stock ? "yes" : "no");
    await insertMeta(productId, "_backorders",            body.backorders || "no");
    await insertMeta(productId, "_weight",                body.weight);
    await insertMeta(productId, "_length",                body.length);
    await insertMeta(productId, "_width",                 body.width);
    await insertMeta(productId, "_virtual",               body.is_virtual      ? "yes" : "no");
    await insertMeta(productId, "_downloadable",          body.is_downloadable ? "yes" : "no");

    // ═══════════════════════════════════════════════════════
    // STEP 3: MAIN FEATURED IMAGE
    // field: main_image
    // save to tbl_media + tbl_mediameta, store media_id in _thumbnail_id
    // ═══════════════════════════════════════════════════════
    if (req.files) {
      const mainImageFile = req.files.find(function(f) {
        return f.fieldname === "main_image";
      });

      if (mainImageFile) {
        const savedPath = "products/" + mainImageFile.filename;

        const [mediaRes] = await conn.query(
          `INSERT INTO tbl_media
             (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
           VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
          [authorId, productId, mainImageFile.originalname, mainImageFile.mimetype]
        );
        const mediaId = mediaRes.insertId;

        await conn.query(
          "INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)",
          [mediaId, savedPath]
        );

        await insertMeta(productId, "_thumbnail_id", mediaId);
      }

      // ═══════════════════════════════════════════════════════
      // STEP 4: MAIN PRODUCT GALLERY IMAGES
      // field: gallery_images[]
      // ═══════════════════════════════════════════════════════
      const galleryFiles = req.files.filter(function(f) {
        return f.fieldname === "gallery_images[]";
      });

      for (const file of galleryFiles) {
        const savedPath = "products/" + file.filename;

        const [mediaRes] = await conn.query(
          `INSERT INTO tbl_media
             (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
           VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
          [authorId, productId, file.originalname, file.mimetype]
        );
        const mediaId = mediaRes.insertId;

        await conn.query(
          "INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)",
          [mediaId, savedPath]
        );
      }
    }

    // ═══════════════════════════════════════════════════════
    // STEP 5: ATTRIBUTES
    // selected_attr_type[]   = attribute_type_id
    // selected_attr_values[] = comma-separated attr_ids
    // attr_for_variation[]   = "1" if used for variations
    // ═══════════════════════════════════════════════════════
    const attrTypeIds   = [].concat(body.selected_attr_type   || []);
    const attrValuesCsv = [].concat(body.selected_attr_values || []);
    const attrForVar    = [].concat(body.attr_for_variation    || []);

    for (let i = 0; i < attrTypeIds.length; i++) {
      const typeId      = attrTypeIds[i];
      const isVariation = attrForVar.includes("1") ? 1 : 0;
      const valueIds    = (attrValuesCsv[i] || "")
        .split(",").map(v => v.trim()).filter(Boolean);

      if (!valueIds.length) continue;

      const [[attrType]] = await conn.query(
        "SELECT attribute_type_name FROM tbl_attribute_type WHERE attribute_type_id = ?",
        [typeId]
      );
      if (!attrType) continue;

      const taxonomy = "pa_" + attrType.attribute_type_name;

      // Save attribute slugs on main product meta
      const [attrRows] = await conn.query(
        `SELECT attr_id, attr_slug FROM tbl_attributes WHERE attr_id IN (${valueIds.map(() => "?").join(",")})`,
        valueIds
      );
      await insertMeta(productId, "attribute_" + taxonomy, attrRows.map(a => a.attr_slug).join("|"));

      // Insert into lookup
      for (const attrRow of attrRows) {
        await conn.query(
          `INSERT IGNORE INTO tbl_attributes_lookup
             (product_id, product_or_parent_id, taxonomy, attr_id, is_variation_attribute, in_stock)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [productId, productId, taxonomy, attrRow.attr_id, isVariation]
        );
      }
    }

    // ═══════════════════════════════════════════════════════
    // STEP 6: VARIATIONS
    // var_attr_combo[] = "pa_color:white,pa_size:xl"
    // var_attr_ids[]   = "93,119"
    // ═══════════════════════════════════════════════════════
    const combos      = [].concat(body.var_attr_combo    || []);
    const varSkus     = [].concat(body.var_sku           || []);
    const varPrices   = [].concat(body.var_regular_price || []);
    const varSales    = [].concat(body.var_sale_price    || []);
    const varStocks   = [].concat(body.var_stock         || []);
    const varStatuses = [].concat(body.var_stock_status  || []);
    const varWeights  = [].concat(body.var_weight        || []);
    const varDescs    = [].concat(body.var_description   || []);
    const varAttrIds  = [].concat(body.var_attr_ids      || []);

    if (body.product_type === "product_variation" && combos.length) {
      for (let i = 0; i < combos.length; i++) {
        const combo   = combos[i];
        const inStock = varStatuses[i] === "instock" ? 1 : 0;

        // Build label: "pa_color:white,pa_size:xl" → "White / Xl"
        const label = combo.split(",").map(function(part) {
          var val = (part.split(":")[1] || "").trim();
          return val.charAt(0).toUpperCase() + val.slice(1);
        }).join(" / ");

        const varGuid = Date.now() + "-var-" + i + "-" + Math.random().toString(36).substr(2, 5);

        const [varResult] = await conn.query(
          `INSERT INTO tbl_products
             (author_id, parent_id, product_url, product_title, product_short_desc,
              product_status, product_type, guid, menu_order,
              product_date_added, product_date_modified)
           VALUES (?, ?, ?, ?, ?, 'publish', 'product_variation', ?, ?, NOW(), NOW())`,
          [
            authorId,
            productId,
            slug + "-var-" + (i + 1),
            body.product_title + " - " + label,
            combo,
            varGuid,
            i,
          ]
        );
        const varId = varResult.insertId;

        // Variation meta
        await insertMeta(varId, "_sku",                   varSkus[i]    || "");
        await insertMeta(varId, "_regular_price",         varPrices[i]  || "");
        await insertMeta(varId, "_sale_price",            varSales[i]   || "");
        await insertMeta(varId, "_price",                 varSales[i]   || varPrices[i] || "");
        await insertMeta(varId, "_stock",                 varStocks[i]  || "0");
        await insertMeta(varId, "_stock_status",          varStatuses[i]|| "instock");
        await insertMeta(varId, "_weight",                varWeights[i] || "");
        await insertMeta(varId, "_variation_description", varDescs[i]   || "");

        // Attribute meta: "pa_color:white,pa_size:xl"
        const comboParts = combo.split(",");
        for (const part of comboParts) {
          const colonIdx = part.indexOf(":");
          if (colonIdx === -1) continue;
          const taxKey = part.substring(0, colonIdx).trim(); // "pa_color"
          const taxVal = part.substring(colonIdx + 1).trim(); // "white"
          await insertMeta(varId, "attribute_" + taxKey, taxVal);
        }

        // Variation lookup
        const attrIdList = (varAttrIds[i] || "")
          .split(",").map(v => v.trim()).filter(Boolean);

        for (const attrId of attrIdList) {
          const [amRows] = await conn.query(
            "SELECT meta_key FROM tbl_attributemeta WHERE attr_id = ? AND meta_key LIKE 'order_pa_%' LIMIT 1",
            [attrId]
          );
          if (!amRows.length) continue;
          const taxonomy = amRows[0].meta_key.replace("order_", "");

          await conn.query(
            `INSERT IGNORE INTO tbl_attributes_lookup
               (product_id, product_or_parent_id, taxonomy, attr_id, is_variation_attribute, in_stock)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [varId, productId, taxonomy, attrId, inStock]
          );
        }

        // Variation main image — field: var_image_{varId}
        // Note: for new products, varId is newly generated so field uses index
        // field sent as: var_image_new_{i} for new products
        if (req.files) {
          // Try by new index first (add page), then by varId (if somehow known)
          const varImageFile = req.files.find(function(f) {
            return f.fieldname === "var_image_new_" + i ||
                   f.fieldname === "var_image_" + varId;
          });

          if (varImageFile) {
            const savedPath = "products/" + varImageFile.filename;

            const [mediaRes] = await conn.query(
              `INSERT INTO tbl_media
                 (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
               VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
              [authorId, varId, varImageFile.originalname, varImageFile.mimetype]
            );
            const mediaId = mediaRes.insertId;

            await conn.query(
              "INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)",
              [mediaId, savedPath]
            );

            await insertMeta(varId, "_thumbnail_id", mediaId);
          }

          // Variation gallery — field: var_gallery_new_{i}[]
          const varGalleryFiles = req.files.filter(function(f) {
            return f.fieldname === "var_gallery_new_" + i + "[]" ||
                   f.fieldname === "var_gallery_" + varId + "[]";
          });

          for (const file of varGalleryFiles) {
            const savedPath = "products/" + file.filename;

            const [mediaRes] = await conn.query(
              `INSERT INTO tbl_media
                 (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
               VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
              [authorId, varId, file.originalname, file.mimetype]
            );
            const mediaId = mediaRes.insertId;

            await conn.query(
              "INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)",
              [mediaId, savedPath]
            );
          }
        }
      }
    }

    await conn.commit();
    res.redirect("/store/admin/products?success=Product added successfully");

  } catch (err) {
    await conn.rollback();
    console.error("Store Product Error:", err.message, err.stack);
    res.redirect(
      "/store/admin/products/add?error=" + encodeURIComponent(err.message)
    );
  } finally {
    conn.release();
  }
};

const showEditProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // ═══════════════════════════════════════════════════════
    // STEP 1: Get main product
    // ═══════════════════════════════════════════════════════
    const [[product]] = await db.query(
      "SELECT * FROM tbl_products WHERE ID = ?",
      [id],
    );

    if (!product) {
      return res.redirect("/store/admin/products?error=Product not found");
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Get main product meta
    // Attach fields to product object so EJS uses p.sku, p.regular_price etc.
    // ═══════════════════════════════════════════════════════
    const [mainMetaRows] = await db.query(
      "SELECT meta_key, meta_value FROM tbl_productmeta WHERE product_id = ?",
      [id],
    );

    const mainMeta = {};
    mainMetaRows.forEach(function (row) {
      mainMeta[row.meta_key] = row.meta_value;
    });

    product.sku = mainMeta["_sku"] || "";
    product.regular_price =
      mainMeta["_regular_price"] || mainMeta["_price"] || "";
    product.sale_price = mainMeta["_sale_price"] || "";
    product.stock = mainMeta["_stock"] || "";
    product.stock_status = mainMeta["_stock_status"] || "instock";
    product.weight = mainMeta["_weight"] || "";
    product.length = mainMeta["_length"] || "";
    product.width = mainMeta["_width"] || "";
    product.backorders = mainMeta["_backorders"] || "no";

    // ── Main product thumbnail ──────────────────────────────
    // _thumbnail_id = media_id of the featured image
    product.thumbnail = "";
    product.thumbnailId = mainMeta["_thumbnail_id"] || "";

    if (product.thumbnailId) {
      const [[thumbMedia]] = await db.query(
        `SELECT mm.meta_value AS file_path
         FROM tbl_media m
         LEFT JOIN tbl_mediameta mm ON mm.media_id = m.media_id AND mm.meta_key = '_wp_attached_file'
         WHERE m.media_id = ?`,
        [product.thumbnailId],
      );
      if (thumbMedia && thumbMedia.file_path) {
        product.thumbnail = "/uploads/" + thumbMedia.file_path;
      }
    }

    // ── Main product gallery images ─────────────────────────
    // All images in tbl_media where parent_id = product id
    // except the featured image (thumbnail_id)
    const [galleryRows] = await db.query(
      `SELECT m.media_id, mm.meta_value AS file_path
       FROM tbl_media m
       LEFT JOIN tbl_mediameta mm ON mm.media_id = m.media_id AND mm.meta_key = '_wp_attached_file'
       WHERE m.parent_id = ? AND m.media_type = 'product_image'
       ORDER BY m.media_id ASC`,
      [id],
    );
    product.gallery = galleryRows
      .filter(function (r) {
        return (
          r.file_path && String(r.media_id) !== String(product.thumbnailId)
        );
      })
      .map(function (r) {
        return { media_id: r.media_id, url: "/uploads/" + r.file_path };
      });

    // ═══════════════════════════════════════════════════════
    // STEP 3: Get all variation products + their meta
    //
    // Each variation gets these fields attached:
    //   v.sku, v.regular_price, v.sale_price, v.stock, v.stock_status
    //   v.weight, v.manage_stock, v.downloadable, v.virtual, v.enabled
    //   v.variation_description, v.thumbnail_url
    //   v.attr_meta  = { attribute_pa_color: 'white-ocean-camo', attribute_pa_size: '3xl' }
    //   v.combo      = "pa_color:white-ocean-camo,pa_size:3xl"
    //   v.attr_ids   = "116,142"  (from tbl_attributes_lookup)
    // ═══════════════════════════════════════════════════════
    const [variationProducts] = await db.query(
      "SELECT * FROM tbl_products WHERE parent_id = ? ORDER BY menu_order ASC",
      [id],
    );

    const variations = [];

    for (const v of variationProducts) {
      // Load all meta for this variation
      const [varMetaRows] = await db.query(
        "SELECT meta_key, meta_value FROM tbl_productmeta WHERE product_id = ?",
        [v.ID],
      );

      const vm = {};
      varMetaRows.forEach(function (row) {
        vm[row.meta_key] = row.meta_value;
      });

      // Attach price / stock / sku fields
      v.sku = vm["_sku"] || "";
      v.regular_price = vm["_regular_price"] || vm["_price"] || "";
      v.sale_price = vm["_sale_price"] || "";
      v.stock = vm["_stock"] || "0";
      v.stock_status = vm["_stock_status"] || "instock";
      v.weight = vm["_weight"] || "";
      v.manage_stock = vm["_manage_stock"] || "no";
      v.downloadable = vm["_downloadable"] || "no";
      v.virtual = vm["_virtual"] || "no";
      v.enabled = vm["_variation_is_active"] || "yes";
      v.variation_description = vm["_variation_description"] || "";
      // ── Variation thumbnail URL from tbl_media ──────────
      v.thumbnail_url = "";
      v.thumbnailId = vm["_thumbnail_id"] || "";
      v.gallery = [];

      // Build attr_meta from meta keys starting with "attribute_pa_"
      // Result: { attribute_pa_color: 'white-ocean-camo', attribute_pa_size: '3xl' }
      v.attr_meta = {};
      varMetaRows
        .filter(function (row) {
          return row.meta_key.startsWith("attribute_pa_");
        })
        .sort(function (a, b) {
          return a.meta_key.localeCompare(b.meta_key);
        })
        .forEach(function (row) {
          v.attr_meta[row.meta_key] = row.meta_value;
        });

      // Build combo string for hidden form field
      // Result: "pa_color:white-ocean-camo,pa_size:3xl"
      v.combo = Object.entries(v.attr_meta)
        .map(function (entry) {
          return entry[0].replace("attribute_", "") + ":" + entry[1];
        })
        .join(",");

      // Get attr_ids from tbl_attributes_lookup for this variation
      const [vLookupRows] = await db.query(
        "SELECT DISTINCT attr_id FROM tbl_attributes_lookup WHERE product_id = ? ORDER BY attr_id ASC",
        [v.ID],
      );
      v.attr_ids = vLookupRows
        .map(function (r) {
          return r.attr_id;
        })
        .join(",");

      // Fallback: if lookup empty, resolve attr_ids from slugs
      if (!vLookupRows.length && Object.keys(v.attr_meta).length) {
        const slugs = Object.values(v.attr_meta).filter(Boolean);
        if (slugs.length) {
          const ph = slugs
            .map(function () {
              return "?";
            })
            .join(",");
          const [slugRows] = await db.query(
            "SELECT attr_id FROM tbl_attributes WHERE attr_slug IN (" +
              ph +
              ")",
            slugs,
          );
          v.attr_ids = slugRows
            .map(function (r) {
              return r.attr_id;
            })
            .join(",");
        }
      }

      // ── Variation thumbnail URL from tbl_media ──────────────
      if (v.thumbnailId) {
        const [[vThumb]] = await db.query(
          `SELECT mm.meta_value AS file_path
           FROM tbl_media m
           LEFT JOIN tbl_mediameta mm ON mm.media_id = m.media_id AND mm.meta_key = '_wp_attached_file'
           WHERE m.media_id = ?`,
          [v.thumbnailId],
        );
        if (vThumb && vThumb.file_path) {
          v.thumbnail_url = "/uploads/" + vThumb.file_path;
        }
      }

      // ── Variation gallery images ─────────────────────────────
      const [vGalleryRows] = await db.query(
        `SELECT m.media_id, mm.meta_value AS file_path
         FROM tbl_media m
         LEFT JOIN tbl_mediameta mm ON mm.media_id = m.media_id AND mm.meta_key = '_wp_attached_file'
         WHERE m.parent_id = ? AND m.media_type = 'product_image'
         ORDER BY m.media_id ASC`,
        [v.ID],
      );
      v.gallery = vGalleryRows
        .filter(function (r) {
          return r.file_path && String(r.media_id) !== String(v.thumbnailId);
        })
        .map(function (r) {
          return { media_id: r.media_id, url: "/uploads/" + r.file_path };
        });

      variations.push(v);
    }

    // ═══════════════════════════════════════════════════════
    // STEP 4: Build selectedAttributes from tbl_attributes_lookup
    //
    // This is the ONLY source we need — your screenshot confirms
    // tbl_attributes_lookup has all correct data:
    //   product_or_parent_id = 6684
    //   pa_color → attr_ids 93, 116, 125
    //   pa_size  → attr_ids 119, 120, 141, 142
    //
    // Result:
    // {
    //   pa_color: { value_ids: ['93','116','125'], is_variation: 1 },
    //   pa_size:  { value_ids: ['119','120','141','142'], is_variation: 1 }
    // }
    // ═══════════════════════════════════════════════════════
    const selectedAttributes = {};

    const [lookupRows] = await db.query(
      `SELECT DISTINCT taxonomy, attr_id, is_variation_attribute
       FROM tbl_attributes_lookup
       WHERE product_or_parent_id = ?
       ORDER BY taxonomy, attr_id`,
      [id],
    );

    for (const row of lookupRows) {
      if (!selectedAttributes[row.taxonomy]) {
        selectedAttributes[row.taxonomy] = {
          value_ids: [],
          is_variation: row.is_variation_attribute,
        };
      }
      selectedAttributes[row.taxonomy].value_ids.push(String(row.attr_id));
    }

    // ═══════════════════════════════════════════════════════
    // STEP 5: Get attribute types with all their values
    // Used to build the tag boxes and dropdowns in EJS
    // ═══════════════════════════════════════════════════════
    const attributeTypes = await getAttributeTypes();

    // ═══════════════════════════════════════════════════════
    // STEP 6: Render
    // ═══════════════════════════════════════════════════════
    res.render("products/add", {
      title: "Edit Product",
      product, // main product + meta fields
      variations, // variations with attr_meta, combo, attr_ids
      attributeTypes, // all types + values for dropdowns
      selectedAttributes, // { pa_color: { value_ids: [...], is_variation: 1 } }
      errors: null,
    });
  } catch (err) {
    console.error("showEditProduct error:", err.message);
    res.status(500).send("Server Error: " + err.message);
  }
};

const updateProduct = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const body = req.body;

    await conn.beginTransaction();

    // ═══════════════════════════════════════════════════════
    // HELPER: upsert meta
    // ═══════════════════════════════════════════════════════
    const updateMeta = async (pid, key, value) => {
      await conn.query(
        `INSERT INTO tbl_productmeta (product_id, meta_key, meta_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
        [pid, key, value || ""],
      );
    };

    // ═══════════════════════════════════════════════════════
    // STEP 1: UPDATE MAIN PRODUCT
    // using correct column names from tbl_products
    // ═══════════════════════════════════════════════════════
    const slug =
      body.product_url ||
      (body.product_title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Check if this product has variations
    const [varCheck] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM tbl_products WHERE parent_id = ?",
      [id],
    );
    const hasVariations = varCheck[0].cnt > 0;

    // product_type: if has variations → 'product_variation', else use form value
    const productType = "product";

    await conn.query(
      `UPDATE tbl_products SET
         product_title = ?,
         product_url = ?,
         product_content = ?,
         product_short_desc = ?,
         product_status = ?,
         product_type = ?,
         menu_order = ?,
         product_date_modified = NOW()
       WHERE ID = ?`,
      [
        body.product_title,
        slug,
        body.product_content || "",
        body.product_short_desc || "",
        body.product_status || "draft",
        productType,
        body.menu_order || 0,
        id,
      ],
    );

    // ═══════════════════════════════════════════════════════
    // STEP 2: UPDATE MAIN PRODUCT META
    // ═══════════════════════════════════════════════════════
    await updateMeta(id, "_sku", body.sku);
    await updateMeta(id, "_regular_price", body.regular_price);
    await updateMeta(id, "_sale_price", body.sale_price);
    await updateMeta(id, "_sale_price_dates_from", body.sale_price_dates_from);
    await updateMeta(id, "_sale_price_dates_to", body.sale_price_dates_to);
    await updateMeta(id, "_price", body.sale_price || body.regular_price);
    await updateMeta(id, "_stock", body.stock);
    await updateMeta(id, "_stock_status", body.stock_status || "instock");

    // ═══════════════════════════════════════════════════════
    // STEP 3: MAIN IMAGE
    // file field name: "main_image"
    // save original filename to tbl_media + tbl_mediameta
    // ═══════════════════════════════════════════════════════
    if (req.files) {
      const mainImageFile = req.files.find(function (f) {
        return f.fieldname === "main_image";
      });

      if (mainImageFile) {
        // Save original filename
        const originalName = mainImageFile.originalname;
        const savedPath = "products/" + mainImageFile.filename;

        const [mediaRes] = await conn.query(
          `INSERT INTO tbl_media
             (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
           VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
          [req.session.admin.id, id, originalName, mainImageFile.mimetype],
        );
        const mediaId = mediaRes.insertId;

        await conn.query(
          `INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
          [mediaId, savedPath],
        );

        await updateMeta(id, "_thumbnail_id", mediaId);
      }
    }

    // ═══════════════════════════════════════════════════════
    // STEP 4: PRODUCT GALLERY IMAGES
    // file field name: "gallery_images[]"
    // ═══════════════════════════════════════════════════════
    if (req.files) {
      const galleryFiles = req.files.filter(function (f) {
        return f.fieldname === "gallery_images[]";
      });

      for (const file of galleryFiles) {
        const savedPath = "products/" + file.filename;

        const [mediaRes] = await conn.query(
          `INSERT INTO tbl_media
             (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
           VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
          [req.session.admin.id, id, file.originalname, file.mimetype],
        );
        const mediaId = mediaRes.insertId;

        await conn.query(
          `INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
          [mediaId, savedPath],
        );
      }
    }

    // ═══════════════════════════════════════════════════════
    // STEP 5: ATTRIBUTES
    // selected_attr_type[]   = attribute_type_id (e.g. "1")
    // selected_attr_values[] = comma-separated attr_ids (e.g. "93,116,125")
    // attr_for_variation[]   = "1" if used for variations (only checked ones sent)
    //
    // Strategy: delete existing lookup for this parent, re-insert
    // ═══════════════════════════════════════════════════════
    await conn.query(
      `DELETE FROM tbl_attributes_lookup WHERE product_or_parent_id = ? AND product_id = ?`,
      [id, id],
    );

    const attrTypeIds = [].concat(body.selected_attr_type || []);
    const attrValuesCsv = [].concat(body.selected_attr_values || []);
    const attrForVar = [].concat(body.attr_for_variation || []);

    for (let i = 0; i < attrTypeIds.length; i++) {
      const typeId = attrTypeIds[i];
      const isVariation = attrForVar.includes("1") ? 1 : 0;
      const valueIds = (attrValuesCsv[i] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      if (!valueIds.length) continue;

      // Get taxonomy name from type id
      const [[attrType]] = await conn.query(
        "SELECT attribute_type_name FROM tbl_attribute_type WHERE attribute_type_id = ?",
        [typeId],
      );
      if (!attrType) continue;

      const taxonomy = "pa_" + attrType.attribute_type_name;

      for (const attrId of valueIds) {
        await conn.query(
          `INSERT IGNORE INTO tbl_attributes_lookup
             (product_id, product_or_parent_id, taxonomy, attr_id, is_variation_attribute, in_stock)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [id, id, taxonomy, attrId, isVariation],
        );
      }

      // Update attribute meta on main product
      const [attrRows] = await conn.query(
        `SELECT attr_slug FROM tbl_attributes WHERE attr_id IN (${valueIds.map(() => "?").join(",")})`,
        valueIds,
      );
      await updateMeta(
        id,
        "attribute_" + taxonomy,
        attrRows.map((r) => r.attr_slug).join("|"),
      );
    }

    // ═══════════════════════════════════════════════════════
    // STEP 6: VARIATIONS
    // var_product_id[] = existing variation ID (update) or empty (insert)
    // var_attr_combo[] = "pa_color:white,pa_size:xl"
    // var_attr_ids[]   = "93,119"
    // ═══════════════════════════════════════════════════════
    const combos = [].concat(body.var_attr_combo || []);
    const existingIds = [].concat(body.var_product_id || []);
    const varSkus = [].concat(body.var_sku || []);
    const varPrices = [].concat(body.var_regular_price || []);
    const varSalePrices = [].concat(body.var_sale_price || []);
    const varStocks = [].concat(body.var_stock || []);
    const varStatuses = [].concat(body.var_stock_status || []);
    const varWeights = [].concat(body.var_weight || []);
    const varDescs = [].concat(body.var_description || []);
    const varAttrIds = [].concat(body.var_attr_ids || []);

    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      const existVid = existingIds[i];
      let vid;

      if (existVid && existVid !== "" && existVid !== "0") {
        // ── UPDATE existing variation ──────────────────────────
        vid = existVid;

        // Build label from combo: "pa_color:white,pa_size:xl" → "White / Xl"
        const label = combo
          .split(",")
          .map(function (part) {
            var val = part.split(":")[1] || "";
            return val.charAt(0).toUpperCase() + val.slice(1);
          })
          .join(" / ");

        await conn.query(
          `UPDATE tbl_products SET
             product_title = ?,
             product_short_desc = ?,
             product_date_modified = NOW()
           WHERE ID = ?`,
          [body.product_title + " - " + label, combo, vid],
        );
      } else {
        // ── INSERT new variation ───────────────────────────────
        const label = combo
          .split(",")
          .map(function (part) {
            var val = part.split(":")[1] || "";
            return val.charAt(0).toUpperCase() + val.slice(1);
          })
          .join(" / ");

        const [ins] = await conn.query(
          `INSERT INTO tbl_products
             (author_id, parent_id, product_url, product_title, product_short_desc,
              product_status, product_type, product_date_added, product_date_modified, menu_order)
           VALUES (?, ?, ?, ?, ?, 'publish', 'product_variation', NOW(), NOW(), ?)`,
          [
            req.session.admin.id,
            id,
            slug + "-var-" + (i + 1),
            body.product_title + " - " + label,
            combo,
            i,
          ],
        );
        vid = ins.insertId;
      }

      // ── Variation meta ───────────────────────────────────────
      await updateMeta(vid, "_sku", varSkus[i] || "");
      await updateMeta(vid, "_regular_price", varPrices[i] || "");
      await updateMeta(vid, "_sale_price", varSalePrices[i] || "");
      await updateMeta(vid, "_price", varSalePrices[i] || varPrices[i] || "");
      await updateMeta(vid, "_stock", varStocks[i] || "0");
      await updateMeta(vid, "_stock_status", varStatuses[i] || "instock");
      await updateMeta(vid, "_variation_description", varDescs[i] || "");

      // ── Attribute meta on variation ─────────────────────────
      // combo = "pa_color:white,pa_size:xl"
      const comboParts = combo.split(",");
      for (const part of comboParts) {
        const colonIdx = part.indexOf(":");
        if (colonIdx === -1) continue;
        const taxKey = part.substring(0, colonIdx).trim(); // "pa_color"
        const taxVal = part.substring(colonIdx + 1).trim(); // "white"
        await updateMeta(vid, "attribute_" + taxKey, taxVal);
      }

      // ── Variation lookup ────────────────────────────────────
      // Delete old entries for this variation, re-insert
      await conn.query(
        "DELETE FROM tbl_attributes_lookup WHERE product_id = ?",
        [vid],
      );

      const attrIdList = (varAttrIds[i] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const attrId of attrIdList) {
        // Get taxonomy from tbl_attributemeta
        const [amRows] = await conn.query(
          "SELECT meta_key FROM tbl_attributemeta WHERE attr_id = ? AND meta_key LIKE 'order_pa_%' LIMIT 1",
          [attrId],
        );
        if (!amRows.length) continue;
        const taxonomy = amRows[0].meta_key.replace("order_", ""); // "pa_color"
        const inStock = varStatuses[i] === "instock" ? 1 : 0;

        await conn.query(
          `INSERT IGNORE INTO tbl_attributes_lookup
             (product_id, product_or_parent_id, taxonomy, attr_id, is_variation_attribute, in_stock)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [vid, id, taxonomy, attrId, inStock],
        );
      }

      // ── Variation main image ────────────────────────────────
      // field name: var_image_{variation_ID}
      if (req.files) {
        const varImageFile = req.files.find(function (f) {
          return f.fieldname === "var_image_" + vid;
        });

        if (varImageFile) {
          const savedPath = "products/" + varImageFile.filename;

          const [mediaRes] = await conn.query(
            `INSERT INTO tbl_media
               (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
             VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
            [
              req.session.admin.id,
              vid,
              varImageFile.originalname,
              varImageFile.mimetype,
            ],
          );
          const mediaId = mediaRes.insertId;

          await conn.query(
            `INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
            [mediaId, savedPath],
          );

          await updateMeta(vid, "_thumbnail_id", mediaId);
        }

        // ── Variation gallery images ──────────────────────────
        // field name: var_gallery_{variation_ID}[]
        const varGalleryFiles = req.files.filter(function (f) {
          return f.fieldname === "var_gallery_" + vid + "[]";
        });

        for (const file of varGalleryFiles) {
          const savedPath = "products/" + file.filename;

          const [mediaRes] = await conn.query(
            `INSERT INTO tbl_media
               (author_id, parent_id, media_title, media_status, media_type, media_mime_type, date_added, date_modified)
             VALUES (?, ?, ?, 'inherit', 'product_image', ?, NOW(), NOW())`,
            [req.session.admin.id, vid, file.originalname, file.mimetype],
          );
          const mediaId = mediaRes.insertId;

          await conn.query(
            `INSERT INTO tbl_mediameta (media_id, meta_key, meta_value) VALUES (?, '_wp_attached_file', ?)`,
            [mediaId, savedPath],
          );
        }
      }
    }

    await conn.commit();
    res.redirect("/store/admin/products?success=Product updated successfully");
  } catch (err) {
    await conn.rollback();
    console.error("Update Product Error:", err.message, err.stack);
    res.redirect(
      `/store/admin/products/edit/${req.params.id}?error=` +
        encodeURIComponent(err.message),
    );
  } finally {
    conn.release();
  }
};

// ─── DELETE PRODUCT ───────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "DELETE FROM tbl_attributes_lookup WHERE product_or_parent_id = ?",
      [id],
    );
    await db.query("DELETE FROM tbl_products WHERE parent_id = ?", [id]);
    await db.query("DELETE FROM tbl_products WHERE ID = ?", [id]);
    res.redirect("/store/admin/products?success=Product deleted successfully");
  } catch (err) {
    console.error("Delete Product Error:", err.message);
    res.redirect(
      "/store/admin/products?error=" + encodeURIComponent(err.message),
    );
  }
};

// ─── API: Attribute values by type (AJAX) ────────────────────────────────────
const getAttributeValues = async (req, res) => {
  try {
    const { typeId } = req.params;
    const [[attrType]] = await db.query(
      "SELECT * FROM tbl_attribute_type WHERE attribute_type_id = ?",
      [typeId],
    );
    if (!attrType) return res.json({ success: false, values: [] });

    const [values] = await db.query(
      `
            SELECT a.attr_id, a.attr_name, a.attr_slug
            FROM tbl_attributes a
            INNER JOIN tbl_attributemeta am ON am.attr_id = a.attr_id
            WHERE am.meta_key = ?
            ORDER BY CAST(am.meta_value AS UNSIGNED) ASC
        `,
      [`order_pa_${attrType.attribute_type_name}`],
    );

    res.json({ success: true, type: attrType, values });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

module.exports = {
  showProducts,
  showAddProduct,
  storeProduct,
  showEditProduct,
  updateProduct,
  deleteProduct,
  getAttributeValues,
};
