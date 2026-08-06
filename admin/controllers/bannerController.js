const db = require('../config/db');

// List all banners
const index = async (req, res) => {
  try {
    const [banners] = await db.query(
      'SELECT * FROM tbl_banners WHERE type != ? ORDER BY sort_order ASC, id DESC',
      ['Collection']
    );
    res.render('appearance/banners/index', {
      title: 'Banners',
      banners,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('bannerController.index:', err.message);
    res.status(500).send('Server Error');
  }
};

// Show add form
const addForm = async (req, res) => {
  try {
    res.render('appearance/banners/form', {
      title: 'Add Banner',
      banner: null,
      error: null,
    });
  } catch (err) {
    console.error('bannerController.addForm:', err.message);
    res.render('appearance/banners/form', {
      title: 'Add Banner',
      banner: null,
      error: err.message,
    });
  }
};

// Store new banner
const store = async (req, res) => {
  try {
    const { title, type, link_url, image_url, sort_order, is_active } = req.body;
    
    if (!image_url) {
      return res.render('appearance/banners/form', {
        title: 'Add Banner',
        banner: req.body,
        error: 'Please select a banner image.',
      });
    }
    
    await db.query(
      `INSERT INTO tbl_banners (title, type, link_url, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title, 
        type || 'banner', 
        link_url, 
        image_url, 
        parseInt(sort_order) || 0, 
        is_active === '1' ? 1 : 0
      ]
    );
    res.redirect('/admin/appearance/banners');
  } catch (err) {
    console.error('bannerController.store:', err.message);
    res.render('appearance/banners/form', {
      title: 'Add Banner',
      banner: req.body,
      error: err.message,
    });
  }
};

// Show edit form
const editForm = async (req, res) => {
  try {
    const [[banner]] = await db.query('SELECT * FROM tbl_banners WHERE id = ?', [req.params.id]);
    if (!banner) return res.redirect('/admin/appearance/banners?error=Banner not found');
    
    res.render('appearance/banners/form', {
      title: 'Edit Banner',
      banner,
      error: null,
    });
  } catch (err) {
    console.error('bannerController.editForm:', err.message);
    res.redirect('/admin/appearance/banners?error=' + encodeURIComponent(err.message));
  }
};

// Update banner
const update = async (req, res) => {
  try {
    const { title, type, link_url, image_url, sort_order, is_active } = req.body;
    
    if (!image_url) {
      const [[banner]] = await db.query('SELECT * FROM tbl_banners WHERE id = ?', [req.params.id]);
      return res.render('appearance/banners/form', {
        title: 'Edit Banner',
        banner: { ...banner, ...req.body },
        error: 'Please select a banner image.',
      });
    }
    
    await db.query(
      `UPDATE tbl_banners SET title=?, type=?, link_url=?, image_url=?, sort_order=?, is_active=? WHERE id=?`,
      [
        title, 
        type || 'banner', 
        link_url, 
        image_url, 
        parseInt(sort_order) || 0, 
        is_active === '1' ? 1 : 0,
        req.params.id
      ]
    );
    res.redirect('/admin/appearance/banners?success=Banner updated successfully');
  } catch (err) {
    console.error('bannerController.update:', err.message);
    res.redirect('/admin/appearance/banners?error=' + encodeURIComponent(err.message));
  }
};

// Delete banner
const destroy = async (req, res) => {
  try {
    await db.query('DELETE FROM tbl_banners WHERE id = ?', [req.params.id]);
    res.redirect('/admin/appearance/banners?success=Banner deleted');
  } catch (err) {
    console.error('bannerController.destroy:', err.message);
    res.redirect('/admin/appearance/banners?error=' + encodeURIComponent(err.message));
  }
};

// Toggle status (AJAX)
const toggleStatus = async (req, res) => {
  try {
    const [[banner]] = await db.query('SELECT is_active FROM tbl_banners WHERE id = ?', [req.params.id]);
    if (!banner) return res.status(404).json({ success: false });
    const next = banner.is_active ? 0 : 1;
    await db.query('UPDATE tbl_banners SET is_active = ? WHERE id = ?', [next, req.params.id]);
    res.json({ success: true, is_active: next });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reorder (AJAX) — body: { order: [{id, sort_order}, ...] }
const reorder = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false });
    for (const item of order) {
      await db.query('UPDATE tbl_banners SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { index, addForm, store, editForm, update, destroy, toggleStatus, reorder };

