// ============================================
// server.js — SCMS Express Server
// ============================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes    = require('./routes/auth');
const usersRoutes   = require('./routes/users');
const seniorsRoutes = require('./routes/seniors');
const reportsRoutes = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: '*',   // tighten in production (e.g. your frontend domain)
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (proof photos, profile photos)
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// ============================================
// ROUTES
// ============================================
app.use('/api/auth',    authRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/seniors', seniorsRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'SCMS API is running.', timestamp: new Date() });
});

// 404 fallback
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 SCMS Server running at http://localhost:${PORT}`);
    console.log(`📁 Uploads served at  http://localhost:${PORT}/uploads`);
});
// Keep your existing app.listen for local testing, 
// but add a check so it doesn't crash on Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// THIS IS THE CRITICAL LINE FOR VERCEL
export default app; 
// (Note: If you reverted to CommonJS instead of ES Modules earlier, use: module.exports = app;)