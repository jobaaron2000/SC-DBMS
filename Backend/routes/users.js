const router = require('express').Router();
const { getPool } = require('../db');
const auth   = require('../middleware/auth');

router.get('/me', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(
            `SELECT id, full_name, email, position, status, created_at FROM users WHERE id = $1`, 
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Get /me error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(
            `SELECT id, full_name, email, position, status, remarks, created_at FROM users ORDER BY created_at ASC`
        );
        return res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Get users error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const userId = parseInt(req.params.id);

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
        }
        if (userId === req.user.id) {
            return res.status(403).json({ success: false, message: 'You cannot change your own status.' });
        }

        const pool = await getPool();
        const check = await pool.query(`SELECT position FROM users WHERE id = $1`, [userId]);

        if (check.rows[0]?.position === 'Head Admin') {
            return res.status(403).json({ success: false, message: 'Cannot disable the Head Admin account.' });
        }

        await pool.query(`UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [status, userId]);
        return res.json({ success: true, message: `User ${status === 'active' ? 'enabled' : 'disabled'} successfully.` });
    } catch (err) {
        console.error('Update status error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.patch('/:id/remarks', auth, async (req, res) => {
    try {
        const { remarks } = req.body;
        const userId = parseInt(req.params.id);

        const pool = await getPool();
        await pool.query(`UPDATE users SET remarks = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [remarks || '', userId]);

        return res.json({ success: true, message: 'Remarks updated.' });
    } catch (err) {
        console.error('Update remarks error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;