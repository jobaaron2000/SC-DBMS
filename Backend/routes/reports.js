const router = require('express').Router();
const { getPool } = require('../db');
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', auth, async (req, res) => {
    try {
        const { search = '' } = req.query;
        const pool = await getPool();
        
        // FIXED: Removed the INNER JOIN for the users table
        let query = `
            SELECT r.id, s.full_name AS senior_name, s.osca_id, r.benefit, r.description, r.remarks, r.proof_url,
                TO_CHAR(r.received_at, 'MM/DD/YYYY') AS date,
                TO_CHAR(r.received_at, 'HH12:MI:SS AM') AS time,
                r.received_at, r.given_by, r.created_at
            FROM reports r
            INNER JOIN seniors s ON s.id = r.senior_id
        `;
        
        let params = [];
        if (search) {
            query += ` WHERE s.full_name ILIKE $1 OR r.benefit ILIKE $1`;
            params.push(`%${search}%`);
        }
        
        query += ` ORDER BY r.received_at DESC`;

        const result = await pool.query(query, params);
        return res.json({ success: true, data: result.rows });

    } catch (err) {
        console.error('List reports error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        // FIXED: Removed the INNER JOIN for the users table here too
        const result = await pool.query(`
            SELECT r.id, s.full_name AS senior_name, s.osca_id, r.benefit, r.description, r.remarks, r.proof_url,
                r.received_at, r.given_by, r.created_at
            FROM reports r
            INNER JOIN seniors s ON s.id = r.senior_id
            WHERE r.id = $1
        `, [parseInt(req.params.id)]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Get report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/', auth, upload.single('proof_photo'), async (req, res) => {
    try {
        const { senior_id, benefit, description, received_at, remarks, given_by} = req.body;
        if (!senior_id || !benefit || !received_at) {
            return res.status(400).json({ success: false, message: 'Required: senior_id, benefit, received_at.' });
        }

        const proof_url = req.file ? `/uploads/${req.file.filename}` : null;
        const pool = await getPool();

        const seniorCheck = await pool.query(`SELECT id FROM seniors WHERE id = $1`, [parseInt(senior_id)]);
        if (seniorCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Senior not found.' });
        }

        await pool.query(`
                INSERT INTO reports (senior_id, benefit, description, received_at, given_by, remarks, proof_url)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                parseInt(senior_id), 
                benefit.trim(), 
                description || null, 
                new Date(received_at), 
                given_by ? given_by.trim() : 'Unknown', 
                remarks || null, 
                proof_url
            ]);

        return res.status(201).json({ success: true, message: 'Report saved successfully.' });
    } catch (err) {
        console.error('Create report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`DELETE FROM reports WHERE id = $1`, [parseInt(req.params.id)]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }
        return res.json({ success: true, message: 'Report deleted successfully.' });
    } catch (err) {
        console.error('Delete report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;