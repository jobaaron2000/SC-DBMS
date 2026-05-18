// ============================================
// routes/users.js
// GET  /api/users          — all users (admin only)
// GET  /api/users/me       — logged-in user profile
// PATCH /api/users/:id/status  — enable / disable user
// PATCH /api/users/:id/remarks — update short remarks
// ============================================
const router = require('express').Router();
const { getPool, sql } = require('../db');
const auth   = require('../middleware/auth');

// ============================================
// GET /api/users/me
// ============================================
router.get('/me', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query(`SELECT id, full_name, email, position, status, created_at
                    FROM users WHERE id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error('Get /me error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/users  — all users
// ============================================
router.get('/', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .query(`SELECT id, full_name, email, position, status, remarks, created_at
                    FROM users
                    ORDER BY created_at ASC`);

        return res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('Get users error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PATCH /api/users/:id/status
// Body: { status: 'active' | 'inactive' }
// ============================================
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const userId     = parseInt(req.params.id);

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
        }

        // Prevent self-disable
        if (userId === req.user.id) {
            return res.status(403).json({ success: false, message: 'You cannot change your own status.' });
        }

        const pool = await getPool();

        // Prevent disabling the Head Admin account (position = 'Head Admin')
        const check = await pool.request()
            .input('id', sql.Int, userId)
            .query(`SELECT position FROM users WHERE id = @id`);

        if (check.recordset[0]?.position === 'Head Admin') {
            return res.status(403).json({ success: false, message: 'Cannot disable the Head Admin account.' });
        }

        await pool.request()
            .input('status', sql.NVarChar, status)
            .input('id',     sql.Int,      userId)
            .query(`UPDATE users SET status = @status, updated_at = GETDATE() WHERE id = @id`);

        return res.json({ success: true, message: `User ${status === 'active' ? 'enabled' : 'disabled'} successfully.` });

    } catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PATCH /api/users/:id/remarks
// Body: { remarks: 'text' }
// ============================================
router.patch('/:id/remarks', auth, async (req, res) => {
    try {
        const { remarks } = req.body;
        const userId      = parseInt(req.params.id);

        const pool = await getPool();
        await pool.request()
            .input('remarks', sql.NVarChar, remarks || '')
            .input('id',      sql.Int,      userId)
            .query(`UPDATE users SET remarks = @remarks, updated_at = GETDATE() WHERE id = @id`);

        return res.json({ success: true, message: 'Remarks updated.' });

    } catch (err) {
        console.error('Update remarks error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
