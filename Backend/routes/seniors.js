// ============================================
// routes/seniors.js (Lean PostgreSQL Version)
// ============================================
const router = require('express').Router();
const { getPool } = require('../db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');

const csvUpload = multer({ dest: process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/temp/' });

function calculateAge(dateString) {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

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

// UPDATED ROUTE TO HANDLE GENDER FILTER & DYNAMIC AGE
router.get('/', auth, async (req, res) => {
    try {
        const { search = '', status = '', gender = '' } = req.query;
        const pool = await getPool();

        let query = `
            SELECT id, osca_id, full_name, gender, date_of_birth, age, status, created_at 
            FROM seniors WHERE 1=1
        `;
        let params = [];
        let paramIdx = 1;

        if (search) {
            query += ` AND (full_name ILIKE $${paramIdx} OR osca_id::TEXT ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }
        if (status && status !== 'all') {
            query += ` AND status = $${paramIdx}`;
            params.push(status.toLowerCase());
            paramIdx++;
        }
        if (gender && gender !== 'all') {
            query += ` AND gender ILIKE $${paramIdx}`;
            params.push(gender);
            paramIdx++;
        }
        query += ` ORDER BY full_name ASC`;

        const result = await pool.query(query, params);

        // --- NEW: Calculate exact age on the fly based on today's date ---
        const dynamicallyAgedSeniors = result.rows.map(senior => {
            if (senior.date_of_birth) {
                senior.age = calculateAge(senior.date_of_birth);
            }
            return senior;
        });

        return res.json({ success: true, data: dynamicallyAgedSeniors });

    } catch (err) {
        console.error('List seniors error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// UPDATED ROUTE TO HANDLE SINGLE PROFILE FETCH DYNAMIC AGE
router.get('/:id', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`
            SELECT id, osca_id, full_name, gender, date_of_birth, age, status, created_at 
            FROM seniors WHERE id = $1
        `, [parseInt(req.params.id)]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Senior not found.' });
        
        const senior = result.rows[0];

        // --- NEW: Calculate exact age on the fly ---
        if (senior.date_of_birth) {
            senior.age = calculateAge(senior.date_of_birth);
        }

        return res.json({ success: true, data: senior });
    } catch (err) {
        console.error('Get senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { osca_id, full_name, gender, date_of_birth, age } = req.body;

        if (!osca_id || !full_name || !gender || !date_of_birth) {
            return res.status(400).json({ success: false, message: 'Required fields missing.' });
        }
        
        if (!/^[0-9\-]+$/.test(osca_id)) {
            return res.status(400).json({ success: false, message: 'OSCA ID must contain only digits and hyphens.' });
        }

        const pool = await getPool();
        const dup = await pool.query(`SELECT id FROM seniors WHERE osca_id = $1`, [osca_id]);
        if (dup.rows.length > 0) return res.status(409).json({ success: false, message: 'OSCA ID already exists.' });

        await pool.query(`
            INSERT INTO seniors (osca_id, full_name, gender, date_of_birth, age, status)
            VALUES ($1, $2, $3, $4, $5, 'active')
        `, [osca_id.trim(), full_name.trim(), gender, date_of_birth, age]);

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
        const result = await pool.query(`UPDATE seniors SET status = $1 WHERE id = $2`, [status, parseInt(req.params.id)]);

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
        .pipe(csv({
            mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]/g, '')
        }))
        .on('data', (data) => {
            rowNumber++; 
            
            const norm = {};
            for (let key in data) {
                const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                norm[cleanKey] = data[key];
            }

            const oscaId = norm.oscaid || norm.id;
            const fullName = norm.fullname || norm.name;
            const dob = norm.dateofbirth || norm.dob || norm.birthday;
            const gender = norm.gender || norm.sex;
            const ageStr = norm.age;

            if (!oscaId || !fullName || !dob || !gender) {
                errors.push(`Row ${rowNumber}: Missing required fields.`);
                return;
            }
            
            const calculatedAge = ageStr ? parseInt(ageStr.trim()) : calculateAge(dob);

            results.push({
                osca_id: oscaId.trim(),
                full_name: fullName.trim(),
                gender: gender.trim(),
                date_of_birth: dob.trim(),
                age: calculatedAge,
                status: 'active'
            });
        })
        .on('end', async () => {
            fs.unlinkSync(req.file.path); 
            try {
                if (results.length > 0) {
                    const pool = await getPool();
                    for (const senior of results) {
                        await pool.query(`
                            INSERT INTO seniors (osca_id, full_name, gender, date_of_birth, age, status)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            ON CONFLICT (osca_id) DO NOTHING
                        `, [senior.osca_id, senior.full_name, senior.gender, senior.date_of_birth, senior.age, senior.status]);
                    }
                }
                res.json({ success: true, message: `Upload complete! Processed ${results.length} records.`, errors: errors });
            } catch (dbError) {
                console.error("Database Error:", dbError);
                res.status(500).json({ success: false, message: 'Database failed to save the records.' });
            }
        });
});

module.exports = router;