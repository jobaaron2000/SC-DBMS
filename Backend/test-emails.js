const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: 'your-email@gmail.com',  // Send to yourself
    subject: 'Test OTP Email',
    text: 'If you see this, email is working!'
};

transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
        console.log('ERROR:', err.message);
    } else {
        console.log('SUCCESS! Email sent:', info.response);
    }
    process.exit();
});