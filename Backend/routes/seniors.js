// ============================================
// routes/seniors.js
// GET    /api/seniors            — list (search + filter)
// GET    /api/seniors/stats      — total & active counts
// GET    /api/seniors/:id        — single senior
// POST   /api/seniors            — register new senior
// PATCH  /api/seniors/:id/status — change active/inactive
// DELETE /api/seniors/:id        — delete permanently
// ============================================
const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db'); // Your existing DB connection

// NEW: Add these 3 lines for the bulk upload
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Set up Multer to temporarily save the uploaded file
const csvUpload = multer({ dest: process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/temp/' });
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');
const path   = require('path');

// ============================================
// GET /api/seniors/stats
// ============================================
router.get('/stats', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request().query(`
            SELECT
                COUNT(*)                                     AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
            FROM seniors
        `);

        return res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/seniors  — list with optional search & status filter
// Query params: ?search=&status=
// ============================================
router.get('/', auth, async (req, res) => {
    try {
        const { search = '', status = '' } = req.query;
        const pool = await getPool();

        const request = pool.request();
        let where = 'WHERE 1=1';

        if (search) {
            request.input('search', sql.NVarChar, `%${search}%`);
            where += ` AND (full_name LIKE @search OR osca_id LIKE @search OR address LIKE @search)`;
        }
        if (status && status !== 'all') {
            request.input('status', sql.NVarChar, status);
            where += ` AND status = @status`;
        }

        // Calculate age from birthday using MSSQL DATEDIFF
        const result = await request.query(`
            SELECT
                id, osca_id, full_name, birthday,
                DATEDIFF(YEAR, birthday, GETDATE())
                    - CASE WHEN (MONTH(birthday) > MONTH(GETDATE()))
                            OR (MONTH(birthday) = MONTH(GETDATE()) AND DAY(birthday) > DAY(GETDATE()))
                       THEN 1 ELSE 0 END   AS age,
                address, contact_number, guardian_name, guardian_contact,
                profile_photo, status, created_at
            FROM seniors
            ${where}
            ORDER BY full_name ASC
        `);

        return res.json({ success: true, data: result.recordset });

    } catch (err) {
        console.error('List seniors error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// GET /api/seniors/:id
// ============================================
router.get('/:id', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`
                SELECT
                    id, osca_id, full_name, birthday,
                    DATEDIFF(YEAR, birthday, GETDATE())
                        - CASE WHEN (MONTH(birthday) > MONTH(GETDATE()))
                                OR (MONTH(birthday) = MONTH(GETDATE()) AND DAY(birthday) > DAY(GETDATE()))
                           THEN 1 ELSE 0 END AS age,
                    address, contact_number, guardian_name, guardian_contact,
                    profile_photo, status, created_at
                FROM seniors WHERE id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Senior not found.' });
        }

        return res.json({ success: true, data: result.recordset[0] });

    } catch (err) {
        console.error('Get senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/seniors  — register new senior
// Form fields + optional profile_photo file
// ============================================
router.post('/', auth, upload.single('profile_photo'), async (req, res) => {
    try {
        const {
            osca_id, first_name, last_name,
            birthday, address, contact_number,
            guardian_name, guardian_contact
        } = req.body;

        if (!osca_id || !first_name || !last_name || !birthday || !address) {
            return res.status(400).json({ success: false, message: 'Required fields...' });
        }

        // Validate OSCA ID format (digits and hyphens only)
        if (!/^[0-9\-]+$/.test(osca_id)) {
            return res.status(400).json({ success: false, message: 'OSCA ID must contain only digits and hyphens.' });
        }

        const full_name   = `${first_name.trim()} ${last_name.trim()}`;
        const profile_photo = req.file ? `/uploads/${req.file.filename}` : null;

        const pool = await getPool();

        // Check duplicate OSCA ID
        const dup = await pool.request()
            .input('osca_id', sql.NVarChar, osca_id)
            .query(`SELECT id FROM seniors WHERE osca_id = @osca_id`);

        if (dup.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'OSCA ID already exists.' });
        }

        await pool.request()
            .input('osca_id',          sql.NVarChar, osca_id.trim())
            .input('full_name',        sql.NVarChar, full_name)
            .input('birthday',         sql.Date,     birthday)
            .input('address',          sql.NVarChar, address.trim())
            .input('contact_number',   sql.NVarChar, contact_number   || null)
            .input('guardian_name',    sql.NVarChar, guardian_name    || null)
            .input('guardian_contact', sql.NVarChar, guardian_contact || null)
            .input('profile_photo',    sql.NVarChar, profile_photo)
            .query(`
                INSERT INTO seniors
                    (osca_id, full_name, birthday, address, contact_number, guardian_name, guardian_contact, profile_photo)
                VALUES
                    (@osca_id, @full_name, @birthday, @address, @contact_number, @guardian_name, @guardian_contact, @profile_photo)
            `);

        return res.status(201).json({ success: true, message: 'Senior registered successfully.' });

    } catch (err) {
        console.error('Register senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// PATCH /api/seniors/:id/status
// Body: { status: 'active' | 'inactive' }
// ============================================
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'deceased'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be active or deceased.' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('status', sql.NVarChar, status)
            .input('id',     sql.Int,      parseInt(req.params.id))
            .query(`UPDATE seniors SET status = @status, updated_at = GETDATE()
                    WHERE id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Senior not found.' });
        }

        return res.json({ success: true, message: 'Senior status upd ated.' });

    } catch (err) {
        console.error('Update senior status error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// DELETE /api/seniors/:id
// ============================================
router.delete('/:id', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query(`DELETE FROM seniors WHERE id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Senior not found.' });
        }

        return res.json({ success: true, message: 'Senior deleted permanently.' });

    } catch (err) {
        console.error('Delete senior error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});
// ==========================================
// BULK UPLOAD SENIORS (CSV)
// ==========================================
router.post('/bulk-upload', auth, csvUpload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const results = [];
    const errors = [];
    let rowNumber = 1;

    // Read the CSV file
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            rowNumber++; 
            
            // 1. Validate Required Fields (Marked as "Not Null" in your DBeaver)
            if (!data.OscaID || !data.FullName || !data.Birthday || !data.Address) {
                errors.push(`Row ${rowNumber}: Missing required fields (OscaID, FullName, Birthday, or Address).`);
                return; // Skip this row
            }

            // 2. Format the data to match your database columns
            const newSenior = {
                osca_id: data.OscaID.trim(),
                full_name: data.FullName.trim(),
                birthday: data.Birthday.trim(), // Expecting YYYY-MM-DD format in CSV
                address: data.Address.trim(),
                contact_number: data.ContactNumber ? data.ContactNumber.trim() : null,
                guardian_name: data.GuardianName ? data.GuardianName.trim() : null,
                guardian_contact: data.GuardianContact ? data.GuardianContact.trim() : null,
                status: 'Active' // Default required status
            };

            results.push(newSenior);
        })
        .on('end', async () => {
            // Delete the temp file from server
            fs.unlinkSync(req.file.path); 

            // 3. Save to your Docker MS SQL Database
            try {
                if (results.length > 0) {
                    const pool = await getPool();
                    
                    for (const senior of results) {
                        await pool.request()
                            .input('osca_id', sql.NVarChar(50), senior.osca_id)
                            .input('full_name', sql.NVarChar(150), senior.full_name)
                            .input('birthday', sql.Date, senior.birthday)
                            .input('address', sql.NVarChar(sql.MAX), senior.address)
                            .input('contact_number', sql.NVarChar(20), senior.contact_number)
                            .input('guardian_name', sql.NVarChar(150), senior.guardian_name)
                            .input('guardian_contact', sql.NVarChar(20), senior.guardian_contact)
                            .input('status', sql.NVarChar(10), senior.status)
                            .query(`
                                INSERT INTO Seniors (
                                    osca_id, 
                                    full_name, 
                                    birthday, 
                                    address, 
                                    contact_number, 
                                    guardian_name, 
                                    guardian_contact, 
                                    status
                                )
                                VALUES (
                                    @osca_id, 
                                    @full_name, 
                                    @birthday, 
                                    @address, 
                                    @contact_number, 
                                    @guardian_name, 
                                    @guardian_contact, 
                                    @status
                                )
                            `);
                    }
                    console.log(`Successfully batch-saved ${results.length} records.`);
                }

                res.json({
                    success: true,
                    message: `Upload complete! Saved ${results.length} seniors.`,
                    errors: errors 
                });

            } catch (dbError) {
                console.error("Database Error during bulk upload:", dbError);
                res.status(500).json({ success: false, message: 'Database failed to save the records.' });
            }
        });
});
module.exports = router;
