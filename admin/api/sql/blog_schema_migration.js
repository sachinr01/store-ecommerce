const db = require('../../config/db');

const toSlug = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const hasColumn = async (tableName, columnName) => {
  const [rows] = await db.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
};

const ensureColumns = async () => {
  if (!(await hasColumn('tbl_posts_category', 'category_slug'))) {
    await db.query(
      `ALTER TABLE tbl_posts_category ADD COLUMN category_slug VARCHAR(255) NULL AFTER category_name`
    );
  }

  if (!(await hasColumn('tbl_posts_category_link', 'is_primary_category'))) {
    await db.query(
      `ALTER TABLE tbl_posts_category_link ADD COLUMN is_primary_category TINYINT(1) NOT NULL DEFAULT 0 AFTER category_id`
    );
  }
};

const backfillCategorySlugs = async () => {
  const [rows] = await db.query(
    `SELECT category_id, category_name, category_slug FROM tbl_posts_category`
  );

  for (const row of rows) {
    const slug = toSlug(row.category_name);
    if (!slug) continue;
    if (String(row.category_slug || '').trim() === slug) continue;

    await db.query(
      `UPDATE tbl_posts_category SET category_slug = ? WHERE category_id = ?`,
      [slug, row.category_id]
    );
  }
};

const normalizePrimaryFlags = async () => {
  const [rows] = await db.query(
    `
      SELECT post_id, category_id, is_primary_category
      FROM tbl_posts_category_link
      ORDER BY post_id ASC, is_primary_category DESC, category_id ASC
    `
  );

  const byPost = new Map();
  for (const row of rows) {
    const postId = Number(row.post_id);
    const list = byPost.get(postId) || [];
    list.push({
      categoryId: Number(row.category_id),
      primary: Number(row.is_primary_category || 0) === 1,
    });
    byPost.set(postId, list);
  }

  for (const [postId, list] of byPost.entries()) {
    if (!list.length) continue;
    const primary = list.find((item) => item.primary) || list[0];
    await db.query(
      `
        UPDATE tbl_posts_category_link
        SET is_primary_category = CASE WHEN category_id = ? THEN 1 ELSE 0 END
        WHERE post_id = ?
      `,
      [primary.categoryId, postId]
    );
  }
};

const main = async () => {
  try {
    console.log('Starting blog schema migration...');
    await ensureColumns();
    await backfillCategorySlugs();
    await normalizePrimaryFlags();
    console.log('Blog schema migration completed successfully.');
  } catch (err) {
    console.error('Blog schema migration failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await db.end();
    } catch {
      // ignore close errors
    }
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  toSlug,
  hasColumn,
  ensureColumns,
  backfillCategorySlugs,
  normalizePrimaryFlags,
};
