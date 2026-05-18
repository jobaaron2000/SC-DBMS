// ============================================
// routes/auth.js
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/request-otp
// POST /api/auth/verify-otp-and-change-password
// POST /api/auth/verify-pin
// ============================================
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getPool, sql } = require('../db');
const auth    = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail'); 
require('dotenv').config();

// ---- Helper: build full_name ----
function buildFullName(firstName, lastName, middleName, suffix) {
    let name = `${firstName.trim()}`;
    if (middleName && middleName.trim()) name += ` ${middleName.trim()}`;
    name += ` ${lastName.trim()}`;
    if (suffix && suffix.trim()) name += ` ${suffix.trim()}`;
    return name;
}

// ---- Helper: generate 6-digit OTP ----
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, middleName, suffix,
                email, password, position, masterPin } = req.body;

        if (!firstName || !lastName || !email || !password || !position) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
            });
        }

        // 1. Automatically capitalize the position so the Database accepts it!
        let finalPosition = position;
        if (position.toLowerCase() === 'admin') finalPosition = 'Admin';
        if (position.toLowerCase() === 'user') finalPosition = 'User';
        if (position.toLowerCase() === 'head admin') finalPosition = 'Head Admin';

        // Check against our newly updated database rules
        const validPositions = ['Admin', 'Head Admin', 'User'];
        if (!validPositions.includes(finalPosition)) {
            return res.status(400).json({ success: false, message: `Invalid position. You sent: ${position}` });
        }

        // 2. Get the Database Pool
        const pool = await getPool();

        // 3. Check if Admin already exists
        if (finalPosition === 'Admin' || finalPosition === 'Head Admin') {
            const existingAdmin = await pool.request()
                .input('pos', sql.NVarChar, finalPosition)
                .query(`SELECT id FROM users WHERE position = @pos`);
                
            if (existingAdmin.recordset.length > 0) {
                return res.status(409).json({ success: false, message: `An ${finalPosition} account already exists.` });
            }
        }

        // 4. Check duplicate email
        const existingEmail = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`SELECT id FROM users WHERE email = @email`);

        if (existingEmail.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'Email is already registered.' });
        }

        const full_name    = buildFullName(firstName, lastName, middleName, suffix);
        const passwordHash = await bcrypt.hash(password, 10);

        // 5. Insert user (Using finalPosition!)
        await pool.request()
            .input('full_name', sql.NVarChar, full_name)
            .input('email',     sql.NVarChar, email)
            .input('password',  sql.NVarChar, passwordHash)
            .input('position',  sql.NVarChar, finalPosition) // <-- Perfectly capitalized!
            .query(`INSERT INTO users (full_name, email, password, position)
                    VALUES (@full_name, @email, @password, @position)`);

        // 6. Save Master PIN if registering an Admin
        if (finalPosition === 'Admin' || finalPosition === 'Head Admin') {
            if (!masterPin || masterPin.length < 4) {
                return res.status(400).json({ success: false, message: 'Admin must set a Master PIN of at least 4 digits.' });
            }
            const pinHash = await bcrypt.hash(masterPin, 10);

            await pool.request()
                .input('key',   sql.NVarChar, 'master_pin')
                .input('value', sql.NVarChar, pinHash)
                .query(`
                    IF EXISTS (SELECT 1 FROM admin_settings WHERE [key] = @key)
                        UPDATE admin_settings SET [value] = @value, updated_at = GETDATE() WHERE [key] = @key
                    ELSE
                        INSERT INTO admin_settings ([key], [value]) VALUES (@key, @value)
                `);
        }

        return res.status(201).json({ success: true, message: 'Account registered successfully.' });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`SELECT id, full_name, email, password, position, status FROM users WHERE email = @email`);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ success: false, message: 'Your account has been disabled. Contact your Head Admin.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, position: user.position, full_name: user.full_name },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            success: true,
            token,
            user: {
                id:       user.id,
                fullName: user.full_name,
                email:    user.email,
                position: user.position, 
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// ============================================
// POST /api/auth/request-otp  (protected)
// ============================================
router.post('/request-otp', auth, async (req, res) => {
    try {
        const pool   = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query(`SELECT email FROM users WHERE id = @id`); 

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await pool.request()
            .input('user_id',   sql.Int,      req.user.id)
            .input('otp_hash',  sql.NVarChar, otpHash)
            .input('expires_at', sql.DateTime2, expiresAt)
            .query(`
                UPDATE users 
                SET otp_hash = @otp_hash, otp_expires_at = @expires_at, updated_at = GETDATE()
                WHERE id = @user_id
            `);

        await sendEmail(user.email, 'Password Change OTP', `Your OTP is: ${otp}. Valid for 10 minutes.`);

        return res.json({ success: true, message: 'OTP sent to your email.' });

    } catch (err) {
        console.error('Request OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/verify-pin
// ============================================
router.post('/verify-landing-pin', async (req, res) => {
    try {
        const { pin } = req.body;

        console.log(`PIN entered: ${pin}`);

        if (pin === '0000') {
            return res.json({ success: true, message: 'PIN verified.' });
        } else {
            return res.status(401).json({ success: false, message: `Incorrect PIN. You entered: ${pin}` });
        }

    } catch (err) {
        console.error('Verify landing PIN error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/forgot-password
// ============================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const pool   = await getPool(); // Fix: Added getPool() here
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`SELECT id, full_name FROM users WHERE email = @email`);

        const user = result.recordset[0];

        if (!user) {
            return res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
        }

        const resetToken = jwt.sign(
            { id: user.id, email, type: 'reset' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log(`Password reset link for ${email}: http://localhost:3000/reset-password?token=${resetToken}`);

        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/send-otp
// ============================================
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const pool   = await getPool();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`SELECT id FROM users WHERE email = @email`);

        if (result.recordset.length === 0) {
            return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        global.otpStore = global.otpStore || {};
        global.otpStore[email] = {
            otp: otp,
            expiresAt: Date.now() + 10 * 60 * 1000
        };

        console.log(`OTP for ${email}: ${otp}`);

        return res.json({ success: true, message: 'OTP sent to email.' });

    } catch (err) {
        console.error('Send OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/send-login-otp
// ============================================
router.post('/send-login-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const otp = generateOTP();

        global.loginOtpStore = global.loginOtpStore || {};
        global.loginOtpStore[email] = {
            otp: otp,
            expiresAt: Date.now() + 10 * 60 * 1000
        };

        const emailSent = await sendEmail(
            email,
            'SCMS Login OTP',
            `Your OTP code is: ${otp}`,
            `<h2>Your OTP Code</h2><p>Use this code to verify your login:</p><h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1><p>This code expires in 10 minutes.</p>`
        );

        if (!emailSent) {
            return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
        }

        console.log(`Login OTP for ${email}: ${otp}`);

        return res.json({ success: true, message: 'OTP sent to email.' });

    } catch (err) {
        console.error('Send login OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/verify-login-otp
// ============================================
router.post('/verify-login-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
        }

        const storedOtp = global.loginOtpStore?.[email];

        if (!storedOtp) {
            return res.status(401).json({ success: false, message: 'OTP not found or expired.' });
        }

        if (storedOtp.expiresAt < Date.now()) {
            delete global.loginOtpStore[email];
            return res.status(401).json({ success: false, message: 'OTP expired. Please request a new one.' });
        }

        if (storedOtp.otp !== otp) {
            return res.status(401).json({ success: false, message: 'Incorrect OTP.' });
        }

        delete global.loginOtpStore[email];

        return res.json({ success: true, message: 'OTP verified.' });

    } catch (err) {
        console.error('Verify login OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================
// POST /api/auth/verify-otp-and-change-password
// ============================================
router.post('/verify-otp-and-change-password', auth, async (req, res) => {
    try {
        const { otp, newPassword } = req.body; 

        if (!otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'OTP and new password are required.'
            });
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
            });
        }

        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query(`
                SELECT otp_hash, otp_expires_at
                FROM users
                WHERE id = @id
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
            return res.status(401).json({ success: false, message: 'OTP expired. Please request a new one.' });
        }

        const otpMatch = await bcrypt.compare(otp, user.otp_hash);

        if (!otpMatch) {
            return res.status(401).json({ success: false, message: 'Invalid OTP.' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input('id', sql.Int, req.user.id)
            .input('password', sql.NVarChar, newPasswordHash)
            .query(`
                UPDATE users
                SET password = @password,
                    otp_hash = NULL,
                    otp_expires_at = NULL,
                    updated_at = GETDATE()
                WHERE id = @id
            `);

        return res.json({ success: true, message: 'Password changed successfully.' });

    } catch (err) {
        console.error('Verify OTP and change password error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;