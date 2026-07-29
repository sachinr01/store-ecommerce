const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const mediaController = require('../controllers/mediaController');

// STORAGE CONFIG
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

// ── Media library page
router.get('/media/library', mediaController.getMediaLibraryPage);

// ── JSON: paginated image list
router.get('/media', mediaController.getMedia);

// ── Delete single or bulk (JSON body: { urls: [...] })
router.post('/media/delete', mediaController.deleteMedia);

// ✅ UPLOAD MEDIA
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