const db = require('../config/db');

// List all collection banners (main panels and sliders)
const index = async (req, res) => {
  try {
    const [collections] = await db.query(`
      SELECT 
        b.*,
        p.title as parent_title
      FROM tbl_banners b
      LEFT JOIN tbl_banners p ON b.parent_id = p.id
      WHERE b.type = 'collection'
      ORDER BY 
        CASE WHEN b.panel_type = 'main' OR b.panel_type IS NULL THEN 0 ELSE 1 END,
        b.sort_order ASC, 
        b.id DESC
    `);

    // Group by main panels with their sliders
    const grouped = [];
    const mainPanels = collections.filter(c => !c.panel_type || c.panel_type === 'main');
    
    mainPanels.forEach(main => {
      const sliders = collections.filter(c => c.panel_type === 'slider' && c.parent_id === main.id);
      grouped.push({
        main,
        sliders
      });
    });

    // Orphaned sliders (no parent)
    const orphans = collections.filter(c => c.panel_type === 'slider' && !c.parent_id);

    res.render('appearance/collections/index', {
      title: 'Our Collection',
      grouped,
      orphans,
      admin: req.session.admin,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('collectionController.index:', err.message);
    res.status(500).send('Server Error');
  }
};

// Show add form
const addForm = async (req, res) => {
  try {
    const type = req.query.type || 'main'; // main or slider
    
    // Fetch existing main panels for parent selection
    const [mainPanels] = await db.query(
      "SELECT id, title, layout_position FROM tbl_banners WHERE type='collection' AND (panel_type='main' OR panel_type IS NULL) ORDER BY sort_order ASC"
    );
    
    // Fetch product categories with images
    const [categories] = await db.query(
      "SELECT category_id, category_name, category_slug, category_image FROM tbl_products_category WHERE category_image IS NOT NULL AND category_image != '' ORDER BY category_name ASC"
    );
    
    res.render('appearance/collections/form', {
      title: type === 'slider' ? 'Add Slider Item' : 'Add Main Panel',
      collection: null,
      mainPanels,
      categories,
      formType: type,
      admin: req.session.admin,
      error: null,
    });
  } catch (err) {
    console.error('collectionController.addForm:', err.message);
    res.render('appearance/collections/form', {
      title: 'Add Collection',
      collection: null,
      mainPanels: [],
      categories: [],
      formType: 'main',
      admin: req.session.admin,
      error: err.message,
    });
  }
};

// Store new collection
const store = async (req, res) => {
  try {
    const { title, link_url, image_url, sort_order, is_active, layout_position, panel_type, parent_id } = req.body;
    
    const [mainPanels] = await db.query(
      "SELECT id, title, layout_position FROM tbl_banners WHERE type='collection' AND (panel_type='main' OR panel_type IS NULL) ORDER BY sort_order ASC"
    );
    const [categories] = await db.query(
      "SELECT category_id, category_name, category_slug, category_image FROM tbl_products_category WHERE category_image IS NOT NULL AND category_image != '' ORDER BY category_name ASC"
    );
    
    if (!image_url) {
      return res.render('appearance/collections/form', {
        title: panel_type === 'slider' ? 'Add Slider Item' : 'Add Main Panel',
        collection: req.body,
        mainPanels,
        categories,
        formType: panel_type || 'main',
        admin: req.session.admin,
        error: 'Please select an image.',
      });
    }
    
    await db.query(
      `INSERT INTO tbl_banners (title, type, link_url, image_url, sort_order, is_active, layout_position, panel_type, parent_id)
       VALUES (?, 'collection', ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, 
        link_url, 
        image_url, 
        parseInt(sort_order) || 0, 
        is_active === '1' ? 1 : 0,
        layout_position || null,
        panel_type || 'main',
        parent_id ? parseInt(parent_id) : null
      ]
    );
    res.redirect('/admin/appearance/collections?success=Collection added successfully');
  } catch (err) {
    console.error('collectionController.store:', err.message);
    const [mainPanels] = await db.query(
      "SELECT id, title, layout_position FROM tbl_banners WHERE type='collection' AND (panel_type='main' OR panel_type IS NULL) ORDER BY sort_order ASC"
    );
    const [categories] = await db.query(
      "SELECT category_id, category_name, category_slug, category_image FROM tbl_products_category WHERE category_image IS NOT NULL AND category_image != '' ORDER BY category_name ASC"
    );
    res.render('appearance/collections/form', {
      title: 'Add Collection',
      collection: req.body,
      mainPanels,
      categories,
      formType: req.body.panel_type || 'main',
      admin: req.session.admin,
      error: err.message,
    });
  }
};

// Show edit form
const editForm = async (req, res) => {
  try {
    const [[collection]] = await db.query('SELECT * FROM tbl_banners WHERE id = ? AND type = "collection"', [req.params.id]);
    if (!collection) return res.redirect('/admin/appearance/collections?error=Collection not found');
    
    const [mainPanels] = await db.query(
      "SELECT id, title, layout_position FROM tbl_banners WHERE type='collection' AND (panel_type='main' OR panel_type IS NULL) AND id != ? ORDER BY sort_order ASC",
      [req.params.id]
    );
    
    const [categories] = await db.query(
      "SELECT category_id, category_name, category_slug, category_image FROM tbl_products_category WHERE category_image IS NOT NULL AND category_image != '' ORDER BY category_name ASC"
    );
    
    res.render('appearance/collections/form', {
      title: collection.panel_type === 'slider' ? 'Edit Slider Item' : 'Edit Main Panel',
      collection,
      mainPanels,
      categories,
      formType: collection.panel_type || 'main',
      admin: req.session.admin,
      error: null,
    });
  } catch (err) {
    console.error('collectionController.editForm:', err.message);
    res.redirect('/admin/appearance/collections?error=' + encodeURIComponent(err.message));
  }
};

// Update collection
const update = async (req, res) => {
  try {
    const { title, link_url, image_url, sort_order, is_active, layout_position, panel_type, parent_id } = req.body;
    
    const [mainPanels] = await db.query(
      "SELECT id, title, layout_position FROM tbl_banners WHERE type='collection' AND (panel_type='main' OR panel_type IS NULL) AND id != ? ORDER BY sort_order ASC",
      [req.params.id]
    );
    const [categories] = await db.query(
      "SELECT category_id, category_name, category_slug, category_image FROM tbl_products_category WHERE category_image IS NOT NULL AND category_image != '' ORDER BY category_name ASC"
    );
    
    if (!image_url) {
      const [[collection]] = await db.query('SELECT * FROM tbl_banners WHERE id = ?', [req.params.id]);
      return res.render('appearance/collections/form', {
        title: panel_type === 'slider' ? 'Edit Slider Item' : 'Edit Main Panel',
        collection: { ...collection, ...req.body },
        mainPanels,
        categories,
        formType: panel_type || 'main',
        admin: req.session.admin,
        error: 'Please select an image.',
      });
    }
    
    await db.query(
      `UPDATE tbl_banners SET title=?, link_url=?, image_url=?, sort_order=?, is_active=?, layout_position=?, panel_type=?, parent_id=? WHERE id=?`,
      [
        title, 
        link_url, 
        image_url, 
        parseInt(sort_order) || 0, 
        is_active === '1' ? 1 : 0,
        layout_position || null,
        panel_type || 'main',
        parent_id ? parseInt(parent_id) : null,
        req.params.id
      ]
    );
    res.redirect('/admin/appearance/collections?success=Collection updated successfully');
  } catch (err) {
    console.error('collectionController.update:', err.message);
    res.redirect('/admin/appearance/collections?error=' + encodeURIComponent(err.message));
  }
};

// Delete collection
const destroy = async (req, res) => {
  try {
    // Check if this is a main panel with sliders
    const [sliders] = await db.query('SELECT COUNT(*) as count FROM tbl_banners WHERE parent_id = ?', [req.params.id]);
    
    if (sliders[0].count > 0) {
      return res.redirect('/admin/appearance/collections?error=Cannot delete main panel with slider items. Delete sliders first.');
    }
    
    await db.query('DELETE FROM tbl_banners WHERE id = ?', [req.params.id]);
    res.redirect('/admin/appearance/collections');
  } catch (err) {
    console.error('collectionController.destroy:', err.message);
    res.redirect('/admin/appearance/collections?error=' + encodeURIComponent(err.message));
  }
};

// Toggle status (AJAX)
const toggleStatus = async (req, res) => {
  try {
    const [[collection]] = await db.query('SELECT is_active FROM tbl_banners WHERE id = ?', [req.params.id]);
    if (!collection) return res.status(404).json({ success: false });
    const next = collection.is_active ? 0 : 1;
    await db.query('UPDATE tbl_banners SET is_active = ? WHERE id = ?', [next, req.params.id]);
    res.json({ success: true, is_active: next });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { index, addForm, store, editForm, update, destroy, toggleStatus };
