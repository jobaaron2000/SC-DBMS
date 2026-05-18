// ============================================
// routes/reports.js
// GET    /api/reports         — list (with search)
// GET    /api/reports/:id     — single report detail
// POST   /api/reports         — create report + proof photo
// DELETE /api/reports/:id     — delete report
// ============================================
const router = require('express').Router();
const { getPool, sql } = require('../db');
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============================================
// GET /api/reports  — list all reports
// Query: ?search=
// ============================================
router.get('/', auth, async (req, res) => {
    try {
        const { search = '' } = req.query;
        const pool    = await getPool();
        const request = pool.request();

        let where = 'WHERE 1=1';
        if (search) {
            request.input('search', sql.NVarChar, `%${search}%`);
            where += ` AND (s.full_name LIKE @search OR r.benefit LIKE @search)`;
        }

        // Format date/time using MSSQL CONVERT
        const result = await request.query(`
            SELECT
                r.id,
                s.full_name    AS senior_name,
                s.osca_id,
                r.benefit,
                r.description,
                r.remarks,
                r.proof_url,
                CONVERT(VARCHAR, r.received_at, 101)    AS [date],
                CONVERT(VARCHAR, r.received_at, 108)    AS [time],
                r.received_at,
                u.full_name    AS given_by,
                r.created_at
            FROM reports r
            INNER JOIN seniors s ON s.id = r.senior_id
            INNER JOIN users   u ON u.id = r.given_by
            ${where}
            ORDER BY r.received_at DESC
        `);

        return res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('List reports error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/reports/:id  — single report detail
// ============================================
router.get('/:id', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`
                SELECT
                    r.id,
                    s.full_name    AS senior_name,
                    s.osca_id,
                    r.benefit,
                    r.description,
                    r.remarks,
                    r.proof_url,
                    r.received_at,
                    u.full_name    AS given_by,
                    r.created_at
                FROM reports r
                INNER JOIN seniors s ON s.id = r.senior_id
                INNER JOIN users   u ON u.id = r.given_by
                WHERE r.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }

        return res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error('Get report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/reports  — create new report
// Form fields + proof_photo file
// ============================================
router.post('/', auth, upload.single('proof_photo'), async (req, res) => {
    try {
        const { senior_id, benefit, description, received_at, remarks } = req.body;

        if (!senior_id || !benefit || !received_at) {
            return res.status(400).json({ success: false, message: 'Required: senior_id, benefit, received_at.' });
        }

        const proof_url = req.file ? `/uploads/${req.file.filename}` : null;

        const pool = await getPool();

        // Verify senior exists
        const seniorCheck = await pool.request()
            .input('senior_id', sql.Int, parseInt(senior_id))
            .query(`SELECT id FROM seniors WHERE id = @senior_id`);

        if (seniorCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Senior not found.' });
        }

        await pool.request()
            .input('senior_id',   sql.Int,      parseInt(senior_id))
            .input('benefit',     sql.NVarChar,  benefit.trim())
            .input('description', sql.NVarChar,  description || null)
            .input('received_at', sql.DateTime,  new Date(received_at))
            .input('given_by',    sql.Int,       req.user.id)
            .input('remarks',     sql.NVarChar,  remarks || null)
            .input('proof_url',   sql.NVarChar,  proof_url)
            .query(`
                INSERT INTO reports (senior_id, benefit, description, received_at, given_by, remarks, proof_url)
                VALUES (@senior_id, @benefit, @description, @received_at, @given_by, @remarks, @proof_url)
            `);

        return res.status(201).json({ success: true, message: 'Report saved successfully.' });

    } catch (err) {
        console.error('Create report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// DELETE /api/reports/:id
// ============================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`DELETE FROM reports WHERE id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }

        return res.json({ success: true, message: 'Report deleted successfully.' });

    } catch (err) {
        console.error('Delete report error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
