const db = require("../config/db");

// Newsletter Listing
exports.index = async (req, res) => {
  try {

    const [subscribers] = await db.query(`
      SELECT *
      FROM tbl_newsletter_subscribers
      ORDER BY id DESC
    `);

    const [countRows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM tbl_newsletter_subscribers
    `);

    res.render('newsletter/index', {
      subscribers,
      total: countRows[0].total,
      error: null
    });

  } catch (err) {
    console.error(err);

    res.render('newsletter/index', {
      subscribers: [],
      total: 0,
      error: err.message
    });
  }
};


// Delete Subscriber
exports.deleteSubscriber = async (req, res) => {
  try {

    await db.query(
      'DELETE FROM tbl_newsletter_subscribers WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Subscriber deleted successfully'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};