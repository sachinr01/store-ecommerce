const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaController = require('../controllers/mediaController');

// ── Generic uploads storage ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();
    cb(null, Date.now() + '-' + base + ext);
  }
});

const upload = multer({ storage });

// ── Banner uploads storage (public/uploads/banners/) ─────────────────────────
const BANNER_DIR = path.join(__dirname, '../public/uploads/banners');
if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true });

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BANNER_DIR);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();
    cb(null, Date.now() + '-' + base + ext);
  }
});

const bannerUpload = multer({ storage: bannerStorage });

// ── Media library page
router.get('/media/library', mediaController.getMediaLibraryPage);

// ── JSON: paginated image list
router.get('/media', mediaController.getMedia);

// ── Delete single or bulk (JSON body: { urls: [...] })
router.post('/media/delete', mediaController.deleteMedia);

// ── UPLOAD BANNERS (saves to public/uploads/banners/)
router.post('/media/upload/banners', bannerUpload.array('files'), async (req, res) => {
  try {
    const uploaded = req.files.map(file => ({
      url: '/uploads/banners/' + file.filename,
      filename: file.filename,
      original: file.originalname,
    }));
    res.json({ success: true, files: uploaded });
  } catch (err) {
    console.error('Banner Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPLOAD MEDIA (generic — saves to public/uploads/)
router.post('/media/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;

    const uploaded = files.map(file => ({
      url: '/uploads/' + file.filename,
      filename: file.filename,
      original: file.originalname
    }));

    res.json({
      success: true,
      files: uploaded
    });

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;