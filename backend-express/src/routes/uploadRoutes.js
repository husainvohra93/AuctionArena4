const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');

const { storage } = require('../config/cloudinaryConfig');

const upload = multer({ storage });

// POST /api/upload/image
router.post('/image', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ detail: 'No file uploaded' });
    // Cloudinary returns the full URL in req.file.path
    res.json({ url: req.file.path, filename: req.file.filename });
});

module.exports = router;
