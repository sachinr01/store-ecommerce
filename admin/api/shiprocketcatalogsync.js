
const db = require("../config/db");
const { sendProductUpdateWebhook, sendCollectionUpdateWebhook } = require("./shiprocketWebhooks");

const toStr = (v) => (v == null ? "" : String(v).trim());

const SYNC_INTERVAL_MS = 2 * 60 * 1000;

// Meta key used to persist each product's last-synced fingerprint in
// tbl_productmeta, so a server restart doesn't forget sync history.
const FINGERPRINT_META_KEY = "_sr_synced_fingerprint";

let syncTimer = null;
let syncInFlight = false;

const fetchFingerprints = async () => {
  const [rows] = await db.query(`
    SELECT
      p.ID,
      (SELECT meta_value FROM tbl_productmeta
        WHERE product_id = p.ID AND meta_key = '_price'
          AND meta_value IS NOT NULL AND meta_value <> ''
        ORDER BY meta_id DESC LIMIT 1) AS price,
      (SELECT meta_value FROM tbl_productmeta
        WHERE product_id = p.ID AND meta_key = '_regular_price'
          AND meta_value IS NOT NULL AND meta_value <> ''
        ORDER BY meta_id DESC LIMIT 1) AS regular_price,
      (SELECT meta_value FROM tbl_productmeta
        WHERE product_id = p.ID AND meta_key = '_stock'
          AND meta_value IS NOT NULL AND meta_value <> ''
        ORDER BY meta_id DESC LIMIT 1) AS stock,
      (SELECT meta_value FROM tbl_productmeta
        WHERE product_id = p.ID AND meta_key = '${FINGERPRINT_META_KEY}'
        ORDER BY meta_id DESC LIMIT 1) AS synced_fingerprint
    FROM tbl_products p
    WHERE p.product_status = 'publish'
  `);

  return rows.map((r) => ({
    id: r.ID,
    fingerprint: `${toStr(r.price)}|${toStr(r.regular_price)}|${toStr(r.stock)}`,
    syncedFingerprint: r.synced_fingerprint, // null if never synced before
  }));
};

const persistFingerprint = async (productId, fingerprint) => {
  const [result] = await db.query(
    `UPDATE tbl_productmeta SET meta_value = ?
     WHERE product_id = ? AND meta_key = '${FINGERPRINT_META_KEY}'`,
    [fingerprint, productId],
  );
  if (!result.affectedRows) {
    await db.query(
      `INSERT INTO tbl_productmeta (product_id, meta_key, meta_value) VALUES (?, '${FINGERPRINT_META_KEY}', ?)`,
      [productId, fingerprint],
    );
  }
};

const SYNC_LOCK_KEY = "_sr_sync_lock";
const LOCK_TTL_MS = 60 * 1000; // stale lock older than this is considered abandoned

const acquireLock = async () => {
  const now = Date.now();
  const token = `${now}-${Math.random().toString(36).slice(2)}`;

  // Try to take over an existing (free/stale) lock row first.
  const [updateResult] = await db.query(
    `UPDATE tbl_productmeta
     SET meta_value = ?
     WHERE product_id = 0 AND meta_key = '${SYNC_LOCK_KEY}'
       AND (CAST(SUBSTRING_INDEX(meta_value, '-', 1) AS UNSIGNED) < ?)`,
    [token, now - LOCK_TTL_MS],
  );
  if (updateResult.affectedRows) return token;

  try {
    await db.query(
      `INSERT INTO tbl_productmeta (product_id, meta_key, meta_value) VALUES (0, '${SYNC_LOCK_KEY}', ?)`,
      [token],
    );
    return token;
  } catch {
    return null; // someone else holds it
  }
};

const releaseLock = async (token) => {
  try {
    await db.query(
      `DELETE FROM tbl_productmeta
       WHERE product_id = 0 AND meta_key = '${SYNC_LOCK_KEY}' AND meta_value = ?`,
      [token],
    );
  } catch (e) {
    console.error("[SR Catalog Sync] failed to release lock (will self-expire via TTL):", e.message);
  }
};

const runSyncTick = async () => {
  if (syncInFlight) return;
  syncInFlight = true;
  let lockToken = null;
  try {
    lockToken = await acquireLock();
    if (!lockToken) {
      // Another instance is already running this tick — skip, don't wait.
      return;
    }

    const current = await fetchFingerprints();
    const changed = current.filter((c) => c.syncedFingerprint !== c.fingerprint);

    if (!changed.length) return;

    console.log(
      `[SR Catalog Sync] ${changed.length} product(s) changed — pushing webhooks:`,
      changed.map((c) => c.id),
    );


    let succeeded = 0;
    let failed = 0;
    let firstError = null;

    for (const { id, fingerprint } of changed) {
      try {
        const result = await sendProductUpdateWebhook(id);
        if (result.success) {
          // Only persist on success — if the webhook failed, leave the old
          // fingerprint in place so we retry this product on the next tick
          // instead of silently giving up on it.
          await persistFingerprint(id, fingerprint);
          succeeded += 1;
        } else {
          failed += 1;
          if (!firstError) firstError = result.error;
          console.error(`[SR Catalog Sync] webhook failed for product ${id}:`, result.error);
        }
      } catch (e) {
        failed += 1;
        if (!firstError) firstError = e.message;
        console.error(`[SR Catalog Sync] webhook threw for product ${id}:`, e.message);
      }
    }


    if (failed > 0) {
      console.error(
        `[SR Catalog Sync] ⚠️  ${failed}/${changed.length} webhook(s) failed this tick — ` +
        `these will keep reappearing every ${SYNC_INTERVAL_MS / 1000}s until fixed. ` +
        `First error: ${typeof firstError === 'string' ? firstError : JSON.stringify(firstError)}`,
      );
      if (failed === changed.length) {
        console.error(
          `[SR Catalog Sync] ⚠️  ALL webhooks failed — check CHECKOUT_API_KEY / CHECKOUT_API_SECRET ` +
          `env vars on THIS process, and confirm this server can reach checkout-api.shiprocket.com.`,
        );
      }
    }
    if (succeeded > 0) {
      console.log(`[SR Catalog Sync] ✅ ${succeeded}/${changed.length} synced successfully this tick.`);
    }
  } catch (err) {
    console.error("[SR Catalog Sync] tick failed:", err.message);
  } finally {
    if (lockToken) await releaseLock(lockToken);
    syncInFlight = false;
  }
};

const startCatalogSync = () => {
  if (syncTimer) return; // already running

  const missingVars = [];
  if (!process.env.CHECKOUT_API_KEY) missingVars.push("CHECKOUT_API_KEY");
  if (!process.env.CHECKOUT_API_SECRET) missingVars.push("CHECKOUT_API_SECRET");

  if (missingVars.length) {
    console.error(
      `[SR Catalog Sync] ❌ NOT STARTING — missing env var(s): ${missingVars.join(", ")}. ` +
      `Every product webhook would fail silently until these are set, so the watcher is ` +
      `disabled rather than spinning forever and reprinting the full product list every tick. ` +
      `Set these in .env and restart.`,
    );
    return;
  }

  console.log(`[SR Catalog Sync] starting — checking for price/stock changes every ${SYNC_INTERVAL_MS / 1000}s`);
  // Run once immediately on boot, then on the interval.
  runSyncTick();
  syncTimer = setInterval(runSyncTick, SYNC_INTERVAL_MS);
  syncTimer.unref?.();
};

const stopCatalogSync = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

/**
 * Manual/instant path: if your separate admin tool CAN make an HTTP call
 * after saving a product, point it at a tiny route that calls this — it
 * pushes the webhook immediately instead of waiting for the next poll tick.
 * (See the optional route example in routes.js comments.)
 */
const triggerCatalogSyncNow = async (productId) => {
  const result = await sendProductUpdateWebhook(productId);
  if (result.success) {
    // Persist the fingerprint so the next poll tick doesn't re-send a
    // webhook for a change we just pushed manually.
    const [rows] = await db.query(
      `SELECT
         (SELECT meta_value FROM tbl_productmeta WHERE product_id = ? AND meta_key = '_price' ORDER BY meta_id DESC LIMIT 1) AS price,
         (SELECT meta_value FROM tbl_productmeta WHERE product_id = ? AND meta_key = '_regular_price' ORDER BY meta_id DESC LIMIT 1) AS regular_price,
         (SELECT meta_value FROM tbl_productmeta WHERE product_id = ? AND meta_key = '_stock' ORDER BY meta_id DESC LIMIT 1) AS stock`,
      [productId, productId, productId],
    );
    if (rows?.[0]) {
      const r = rows[0];
      await persistFingerprint(productId, `${toStr(r.price)}|${toStr(r.regular_price)}|${toStr(r.stock)}`);
    }
  }
  return result;
};

module.exports = {
  startCatalogSync,
  stopCatalogSync,
  triggerCatalogSyncNow,
  sendCollectionUpdateWebhook, // re-exported for convenience alongside the product sync
};