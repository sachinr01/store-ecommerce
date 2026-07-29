const fs = require("fs");
const path = require("path");

const PUBLIC_DIR   = path.join(__dirname, "../public");
const UPLOADS_DIR  = path.join(PUBLIC_DIR, "uploads");

// Allowed image extensions
const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];

// Recursively collect images under uploads/, return URL starting with /uploads/
function getImages(dir, baseUrl = "/uploads") {
  let results = [];

  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return results;
  }

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    let stat;
    try { stat = fs.statSync(fullPath); } catch { return; }

    if (stat.isDirectory()) {
      results = results.concat(getImages(fullPath, baseUrl + "/" + file));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (allowedExt.includes(ext)) {
        results.push({ url: baseUrl + "/" + file, mtime: stat.mtimeMs });
      }
    }
  });

  return results;
}

const PAGE_SIZE = 30;

// GET MEDIA — ?page=1 (1-based), 30 per page, newest first
exports.getMedia = (_req, res) => {
  try {
    const page  = Math.max(1, parseInt(_req.query.page, 10) || 1);

    const all = getImages(UPLOADS_DIR);

    // Newest first
    all.sort((a, b) => b.mtime - a.mtime);

    const total      = all.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset     = (page - 1) * PAGE_SIZE;
    const images     = all.slice(offset, offset + PAGE_SIZE).map(({ url }) => ({ url }));

    res.json({ images, total, page, totalPages });
  } catch (err) {
    console.error("Media Error:", err);
    res.json({ images: [], total: 0, page: 1, totalPages: 1 });
  }
};

// ── GET MEDIA PAGE VIEW ────────────────────────────────────────────────────
exports.getMediaLibraryPage = (req, res) => {
  res.render('media/library');
};

// ── DELETE MEDIA (single or bulk) ─────────────────────────────────────────
// POST /admin/media/delete  { urls: ["/uploads/foo.jpg", ...] }
exports.deleteMedia = (req, res) => {
  try {
    let { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, message: "No URLs provided." });
    }

    const deleted  = [];
    const failed   = [];

    for (const url of urls) {
      // Security: only allow deleting files under /uploads/
      const normalised = url.replace(/^\/+/, "");
      if (!normalised.startsWith("uploads/")) {
        failed.push({ url, reason: "Path not allowed" });
        continue;
      }

      const ext = path.extname(normalised).toLowerCase();
      if (!allowedExt.includes(ext)) {
        failed.push({ url, reason: "File type not allowed" });
        continue;
      }

      const fullPath = path.join(PUBLIC_DIR, normalised);

      // Resolve and verify still inside UPLOADS_DIR (prevent path traversal)
      const resolved = path.resolve(fullPath);
      if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
        failed.push({ url, reason: "Path traversal detected" });
        continue;
      }

      if (!fs.existsSync(fullPath)) {
        failed.push({ url, reason: "File not found" });
        continue;
      }

      fs.unlinkSync(fullPath);
      deleted.push(url);
    }

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files were deleted.",
        failed,
      });
    }

    return res.json({
      success: true,
      deleted: deleted.length,
      deletedUrls: deleted,
      ...(failed.length ? { failed } : {}),
    });

  } catch (err) {
    console.error("Delete Media Error:", err);
    return res.status(500).json({ success: false, message: "Server error during delete." });
  }
};
