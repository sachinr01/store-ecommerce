const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "../public");

// Allowed image extensions
const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

// Recursive function — collects images with mtime for sorting
function getImages(dir, baseUrl = "") {
  let results = [];

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(
        getImages(fullPath, baseUrl + "/" + file)
      );
    } else {
      const ext = path.extname(file).toLowerCase();
      if (allowedExt.includes(ext)) {
        results.push({
          url: baseUrl + "/" + file,
          mtime: stat.mtimeMs
        });
      }
    }
  });

  return results;
}

const PAGE_SIZE = 30;

// GET MEDIA — supports ?page=1 (1-based), returns 30 images per page, newest first
exports.getMedia = (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = PAGE_SIZE;

    const all = getImages(PUBLIC_DIR, "");

    // Sort newest first, then strip mtime before sending
    all.sort((a, b) => b.mtime - a.mtime);

    const total      = all.length;
    const totalPages = Math.ceil(total / limit);
    const offset     = (page - 1) * limit;
    const images     = all.slice(offset, offset + limit).map(({ url }) => ({ url }));

    res.json({ images, total, page, totalPages });
  } catch (err) {
    console.error("Media Error:", err);
    res.json({ images: [], total: 0, page: 1, totalPages: 0 });
  }
};