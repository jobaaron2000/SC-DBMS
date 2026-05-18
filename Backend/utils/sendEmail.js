// ============================================
// utils/sendEmail.js
// Send emails using Nodemailer
// ============================================
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter with Gmail or your email service
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,      // Your email address
        pass: process.env.EMAIL_PASSWORD   // Your email password or app password
    }
});

/**
 * Send email function
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text message
 * @param {string} html - Optional HTML message
 */
async function sendEmail(to, subject, text, html) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            text,
            html: html || text
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

module.exports = sendEmail;
