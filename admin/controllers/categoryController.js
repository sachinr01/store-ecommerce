const db = require("../config/db");

// GET ALL CATEGORIES
exports.index = async (req, res) => {
  // primari key is category_id
  const [rows] = await db.query(
    "SELECT * FROM tbl_products_category ORDER BY category_id  DESC",
  );

  res.render("category/index", {
    title: "Categories",
    categories: rows,
    admin: req.session.admin,
    success: req.query.success || null,
    error: req.query.error || null,
  });
};

// ADD CATEGORY
exports.store = async (req, res) => {
  const { category_name, category_slug, parent_id, category_desc, category_image } = req.body;

  const finalSlug =
    category_slug ||
    category_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  await db.query(
    `INSERT INTO tbl_products_category (category_name, category_slug, parent_id, category_desc, category_image)
     VALUES (?, ?, ?, ?, ?)`,
    [category_name, finalSlug, parent_id || 0, category_desc || "", category_image || null],
  );

  res.redirect(
    "/admin/products/categories?success=Category added successfully",
  );
};

// UPDATE CATEGORY
exports.update = async (req, res) => {
  const { id } = req.params;
  const { category_name, category_slug, parent_id, category_desc, category_image } = req.body;

  const finalSlug =
    category_slug ||
    category_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  await db.query(
    `UPDATE tbl_products_category 
     SET category_name=?, category_slug=?, parent_id=?, category_desc=?, category_image=?
     WHERE category_id=?`,
    [category_name, finalSlug, parent_id || 0, category_desc || "", category_image || null, id],
  );

  res.redirect(
    "/admin/products/categories?success=Category updated successfully",
  );
};

// DELETE CATEGORY
exports.delete = async (req, res) => {
  const { id } = req.params;

  await db.query("DELETE FROM tbl_products_category WHERE category_id=?", [id]);

  res.redirect(
    "/admin/products/categories?success=Category deleted successfully",
  );
};

// TOGGLE SHOW IN HOME (AJAX)
exports.toggleHome = async (req, res) => {
  try {
    const { id } = req.params;
    const [[cat]] = await db.query(
      "SELECT show_in_home FROM tbl_products_category WHERE category_id=?", [id]
    );
    if (!cat) return res.status(404).json({ success: false });
    const next = cat.show_in_home ? 0 : 1;
    await db.query(
      "UPDATE tbl_products_category SET show_in_home=? WHERE category_id=?", [next, id]
    );
    res.json({ success: true, show_in_home: next });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
