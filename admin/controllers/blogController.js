const db = require("../config/db");

// ─── LIST BLOGS ─────────────────────────────
exports.index = async (req, res) => {
  try {
   const [rows] = await db.query(`
  SELECT * FROM tbl_posts
  WHERE post_type IN ('post', 'page')
  ORDER BY ID DESC
`);

    res.render("blogs/index", {
      title: "Blogs",
      blogs: rows,
      currentRoute: "/store/admin/blogs",
    });
  } catch (err) {
    console.error(err);
    res.send(err.message);
  }
};

// ─── SHOW ADD / EDIT ────────────────────────
exports.showForm = async (req, res) => {
  try {
    const id = req.params.id;

    const [categories] = await db.query("SELECT * FROM tbl_posts_category");

    let blog = null;
    let selectedCategoryIds = [];

    if (id) {
      const [[row]] = await db.query("SELECT * FROM tbl_posts WHERE ID=?", [
        id,
      ]);
      blog = row;

      // Get selected categories for this blog
      const [categoryLinks] = await db.query(
        "SELECT category_id FROM tbl_posts_category_link WHERE post_id = ?",
        [id]
      );
      selectedCategoryIds = categoryLinks.map(link => link.category_id);
    }

    res.render("blogs/add", {
      title: id ? "Edit Blog" : "Add Blog",
      isEdit: !!id,
      blog: blog || {},
      allCategories: categories,
      selectedCategoryIds: selectedCategoryIds,
      currentRoute: "/store/admin/blogs",
      errors: null,
    });
  } catch (err) {
    console.error(err);
    res.send(err.message);
  }
};

// ─── STORE ────────────────────────────────
exports.store = async (req, res) => {
  try {
    const b = req.body;

    const slug =
      b.post_slug ||
      (b.post_title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const result = await db.query(
      `INSERT INTO tbl_posts
      (user_id,parent_id,post_slug,post_title,post_content,post_short_desc,post_status,post_type,post_date,post_modified,menu_order)
      VALUES (?,?,?,?,?,?,?,?, ?, NOW(), ?)`,
      [
        req.session.admin.id,
        0,
        slug,
        b.post_title,
        b.post_content,
        b.post_short_desc,
        b.post_status || "draft",
        b.post_type || "post",
        b.post_date || new Date(),
        b.menu_order || 0,
      ],
    );

    const blogId = result[0].insertId;
    const categories = [].concat(b.categories || []);


    for (let catId of categories) {
      try {
        await db.query(
          `INSERT INTO tbl_posts_category_link (post_id, category_id) VALUES (?, ?)`,
          [blogId, catId],
        );
      } catch (catErr) {
        console.error(`Error linking category ${catId}:`, catErr.message);
      }
    }

    res.redirect("/store/admin/blogs");
  } catch (err) {
    console.error(err);
    res.send(err.message);
  }
};

// ─── UPDATE ───────────────────────────────
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;

    await db.query(
      `UPDATE tbl_posts SET
        post_title=?,
        post_slug=?,
        post_content=?,
        post_short_desc=?,
        post_status=?,
        post_type=?,
        post_date=?,
        post_modified=NOW(),
        menu_order=?
      WHERE ID=?`,
      [
        b.post_title,
        b.post_slug,
        b.post_content,
        b.post_short_desc,
        b.post_status,
        b.post_type || "post",
        b.post_date,
        b.menu_order || 0,
        id,
      ],
    );

    await db.query(`DELETE FROM tbl_posts_category_link WHERE post_id = ?`, [
      id,
    ]);

    const categories = [].concat(b.categories || []);


    for (let catId of categories) {
      try {
        await db.query(
          `INSERT INTO tbl_posts_category_link (post_id, category_id) VALUES (?, ?)`,
          [id, catId],
        );
      } catch (catErr) {
        console.error(`Error linking category ${catId}:`, catErr.message);
      }
    }

    res.redirect("/store/admin/blogs");
  } catch (err) {
    console.error(err);
    res.send(err.message);
  }
};

// ─── DELETE ───────────────────────────────
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    
    // Delete category links first
    await db.query("DELETE FROM tbl_posts_category_link WHERE post_id = ?", [id]);
    
    // Then delete the post
    await db.query("DELETE FROM tbl_posts WHERE ID=?", [id]);
    
    res.redirect("/store/admin/blogs");
  } catch (err) {
    console.error(err);
    res.send(err.message);
  }
};
