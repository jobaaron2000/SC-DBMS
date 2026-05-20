// ============================================
// routes/seniors.js (PostgreSQL Version)
// ============================================
const router = require('express').Router();
const { getPool } = require('../db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');
const path   = require('path');

const csvUpload = multer({ dest: process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/temp/' });

router.get('/stats', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`
            SELECT 
                COUNT(*) AS total, 
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active 
            FROM seniors
        `);
        return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const { search = '', status = '' } = req.query;
        const pool = await getPool();

        // PostgreSQL calculated age using EXTRACT
        let query = `
            SELECT id, osca_id, full_name, birthday, 
                   EXTRACT(YEAR FROM age(CURRENT_DATE, birthday::DATE)) AS age, 
                   address, contact_number, guardian_name, guardian_contact, 
                   profile_photo, status, created_at 
            FROM seniors WHERE 1=1
        `;
        let params = [];
        let paramIdx = 1;

        if (search) {
            query += ` AND (full_name ILIKE $${paramIdx} OR osca_id::TEXT ILIKE $${paramIdx} OR address ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }
        if (status && status !== 'all') {
            query += ` AND status = $${paramIdx}`;
            params.push(status.toLowerCase());
            paramIdx++;
        }
        query += ` ORDER BY full_name ASC`;

        const result = await pool.query(query, params);
        return res.json({ success: true, data: result.rows });

    } catch (err) {
        console.error('List seniors error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`
            SELECT id, osca_id, full_name, birthday, 
                   EXTRACT(YEAR FROM age(CURRENT_DATE, birthday::DATE)) AS age, 
                   address, contact_number, guardian_name, guardian_contact, 
                   profile_photo, status, created_at 
            FROM seniors WHERE id = $1
        `, [parseInt(req.params.id)]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Senior not found.' });
        return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Get senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/', auth, upload.single('profile_photo'), async (req, res) => {
    try {
        // 1. Changed first_name and last_name to full_name
        const { osca_id, full_name, birthday, address, contact_number, guardian_name, guardian_contact } = req.body;

        // 2. Updated validation to check for full_name
        if (!osca_id || !full_name || !birthday || !address) {
            return res.status(400).json({ success: false, message: 'Required fields missing.' });
        }
        
        if (!/^[0-9\-]+$/.test(osca_id)) {
            return res.status(400).json({ success: false, message: 'OSCA ID must contain only digits and hyphens.' });
        }

        const profile_photo = req.file ? `/uploads/${req.file.filename}` : null;
        const pool = await getPool();

        const dup = await pool.query(`SELECT id FROM seniors WHERE osca_id = $1`, [osca_id]);
        if (dup.rows.length > 0) return res.status(409).json({ success: false, message: 'OSCA ID already exists.' });

        // 3. Removed the string template since full_name is already combined
        await pool.query(`
            INSERT INTO seniors (osca_id, full_name, birthday, address, contact_number, guardian_name, guardian_contact, profile_photo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [osca_id.trim(), full_name.trim(), birthday, address.trim(), contact_number || null, guardian_name || null, guardian_contact || null, profile_photo]);

        return res.status(201).json({ success: true, message: 'Senior registered successfully.' });
    } catch (err) {
        console.error('Register senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'deceased'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or deceased.' });
        }

        const pool = await getPool();
        const result = await pool.query(`UPDATE seniors SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [status, parseInt(req.params.id)]);

        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Senior not found.' });
        return res.json({ success: true, message: 'Senior status updated.' });
    } catch (err) {
        console.error('Update senior status error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`DELETE FROM seniors WHERE id = $1`, [parseInt(req.params.id)]);

        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Senior not found.' });
        return res.json({ success: true, message: 'Senior deleted permanently.' });
    } catch (err) {
        console.error('Delete senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/bulk-upload', auth, csvUpload.single('csvFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const results = [];
    const errors = [];
    let rowNumber = 1;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            rowNumber++; 
            if (!data.OscaID || !data.FullName || !data.Birthday || !data.Address) {
                errors.push(`Row ${rowNumber}: Missing required fields.`);
                return;
            }
            results.push({
                osca_id: data.OscaID.trim(),
                full_name: data.FullName.trim(),
                birthday: data.Birthday.trim(),
                address: data.Address.trim(),
                contact_number: data.ContactNumber ? data.ContactNumber.trim() : null,
                guardian_name: data.GuardianName ? data.GuardianName.trim() : null,
                guardian_contact: data.GuardianContact ? data.GuardianContact.trim() : null,
                status: 'active'
            });
        })
        .on('end', async () => {
            fs.unlinkSync(req.file.path); 
            try {
                if (results.length > 0) {
                    const pool = await getPool();
                    for (const senior of results) {
                        // ON CONFLICT DO NOTHING prevents crashes if a duplicate is in the CSV
                        await pool.query(`
                            INSERT INTO seniors (osca_id, full_name, birthday, address, contact_number, guardian_name, guardian_contact, status)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            ON CONFLICT (osca_id) DO NOTHING
                        `, [senior.osca_id, senior.full_name, senior.birthday, senior.address, senior.contact_number, senior.guardian_name, senior.guardian_contact, senior.status]);
                    }
                }
                res.json({ success: true, message: `Upload complete! Processed ${results.length} records.`, errors: errors });
            } catch (dbError) {
                console.error("Database Error during bulk upload:", dbError);
                res.status(500).json({ success: false, message: 'Database failed to save the records.' });
            }
        });
});

module.exports = router;