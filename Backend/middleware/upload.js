// ============================================
// middleware/upload.js — Multer file handler
// ============================================
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config();

// 1. Check if we are running on Vercel (Production)
const isProduction = process.env.NODE_ENV === 'production';

// 2. If on Vercel, route uploads to the allowed '/tmp' folder. 
// If on your local computer, use the normal 'uploads' folder.
const uploadDir = isProduction 
    ? '/tmp' 
    : path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

// 3. Only create the folder if we are on your local computer. 
// Vercel's /tmp folder already exists, so we don't need to create it!
if (!isProduction && !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename:    (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, unique + path.extname(file.originalname));
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext     = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime    = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

module.exports = upload;