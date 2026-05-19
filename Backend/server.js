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
    origin: '*',   
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
// START SERVER & EXPORT
// ============================================

// Only listen to the port if we are NOT on Vercel (local testing)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 SCMS Server running at http://localhost:${PORT}`);
        console.log(`📁 Uploads served at  http://localhost:${PORT}/uploads`);
    });
}

// THIS IS THE CRITICAL LINE FOR VERCEL
module.exports = app;