// ============================================
// routes/auth.js (PostgreSQL Version)
// ============================================
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getPool } = require('../db');
const auth    = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail'); 
require('dotenv').config();

function buildFullName(firstName, lastName, middleName, suffix) {
    let name = `${firstName.trim()}`;
    if (middleName && middleName.trim()) name += ` ${middleName.trim()}`;
    name += ` ${lastName.trim()}`;
    if (suffix && suffix.trim()) name += ` ${suffix.trim()}`;
    return name;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, middleName, suffix, email, password, position, masterPin } = req.body;

        if (!firstName || !lastName || !email || !password || !position) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.' });
        }

        let finalPosition = position;
        if (position.toLowerCase() === 'admin') finalPosition = 'Admin';
        if (position.toLowerCase() === 'user') finalPosition = 'User';
        if (position.toLowerCase() === 'head admin') finalPosition = 'Head Admin';

        if (!['Admin', 'Head Admin', 'User'].includes(finalPosition)) {
            return res.status(400).json({ success: false, message: `Invalid position: ${position}` });
        }

        const pool = await getPool();

        if (finalPosition === 'Admin' || finalPosition === 'Head Admin') {
            const existingAdmin = await pool.query(`SELECT id FROM users WHERE position = $1`, [finalPosition]);
            if (existingAdmin.rows.length > 0) {
                return res.status(409).json({ success: false, message: `An ${finalPosition} account already exists.` });
            }
        }

        const existingEmail = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (existingEmail.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email is already registered.' });
        }

        const full_name = buildFullName(firstName, lastName, middleName, suffix);
        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(`
            INSERT INTO users (full_name, email, password, position)
            VALUES ($1, $2, $3, $4)
        `, [full_name, email, passwordHash, finalPosition]);

        if (finalPosition === 'Admin' || finalPosition === 'Head Admin') {
            if (!masterPin || masterPin.length < 4) {
                return res.status(400).json({ success: false, message: 'Admin must set a Master PIN of at least 4 digits.' });
            }
            const pinHash = await bcrypt.hash(masterPin, 10);

            // PostgreSQL UPSERT (Insert or Update if exists)
            await pool.query(`
                INSERT INTO admin_settings (key, value) 
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE 
                SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            `, ['master_pin', pinHash]);
        }

        return res.status(201).json({ success: true, message: 'Account registered successfully.' });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const pool = await getPool();
        const result = await pool.query(`SELECT id, full_name, email, password, position, status FROM users WHERE email = $1`, [email]);

        const user = result.rows[0];
        if (!user) return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
        if (user.status === 'inactive') return res.status(403).json({ success: false, message: 'Your account has been disabled.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect email or password.' });

        const token = jwt.sign(
            { id: user.id, email: user.email, position: user.position, full_name: user.full_name },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.json({
            success: true,
            token,
            user: { id: user.id, fullName: user.full_name, email: user.email, position: user.position }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

router.post('/request-otp', auth, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]); 

        const user = result.rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.query(`
            UPDATE users SET otp_hash = $1, otp_expires_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
        `, [otpHash, expiresAt, req.user.id]);

        await sendEmail(user.email, 'Password Change OTP', `Your OTP is: ${otp}. Valid for 10 minutes.`);
        return res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (err) {
        console.error('Request OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/verify-landing-pin', async (req, res) => {
    try {
        const { pin } = req.body;
        if (pin === '0000') return res.json({ success: true, message: 'PIN verified.' });
        return res.status(401).json({ success: false, message: 'Incorrect PIN.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const pool = await getPool();
        const result = await pool.query(`SELECT id, full_name FROM users WHERE email = $1`, [email]);

        const user = result.rows[0];
        if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

        const resetToken = jwt.sign({ id: user.id, email, type: 'reset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log(`Password reset link for ${email}: http://localhost:3000/reset-password?token=${resetToken}`);

        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const pool = await getPool();
        const result = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);

        if (result.rows.length === 0) return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

        const otp = generateOTP();
        global.otpStore = global.otpStore || {};
        global.otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };
        console.log(`OTP for ${email}: ${otp}`);

        return res.json({ success: true, message: 'OTP sent to email.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/send-login-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        const otp = generateOTP();
        global.loginOtpStore = global.loginOtpStore || {};
        global.loginOtpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

        const emailSent = await sendEmail(email, 'SCMS Login OTP', `Your OTP is: ${otp}`, `<p>Your OTP Code: <b>${otp}</b></p>`);
        if (!emailSent) return res.status(500).json({ success: false, message: 'Failed to send OTP.' });

        return res.json({ success: true, message: 'OTP sent to email.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/verify-login-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

        const storedOtp = global.loginOtpStore?.[email];
        if (!storedOtp) return res.status(401).json({ success: false, message: 'OTP not found or expired.' });
        if (storedOtp.expiresAt < Date.now()) {
            delete global.loginOtpStore[email];
            return res.status(401).json({ success: false, message: 'OTP expired.' });
        }
        if (storedOtp.otp !== otp) return res.status(401).json({ success: false, message: 'Incorrect OTP.' });

        delete global.loginOtpStore[email];
        return res.json({ success: true, message: 'OTP verified.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

router.post('/verify-otp-and-change-password', auth, async (req, res) => {
    try {
        const { otp, newPassword } = req.body; 
        if (!otp || !newPassword) return res.status(400).json({ success: false, message: 'OTP and new password are required.' });

        const pool = await getPool();
        const result = await pool.query(`SELECT otp_hash, otp_expires_at FROM users WHERE id = $1`, [req.user.id]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) return res.status(401).json({ success: false, message: 'OTP expired.' });

        const otpMatch = await bcrypt.compare(otp, user.otp_hash);
        if (!otpMatch) return res.status(401).json({ success: false, message: 'Invalid OTP.' });

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await pool.query(`
            UPDATE users SET password = $1, otp_hash = NULL, otp_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [newPasswordHash, req.user.id]);

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('Verify OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;