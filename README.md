# Senior Citizen Management System (SCMS) - Barangay San Gabriel
*  Adamson University
*  Computer Science - 2nd Year 2nd Semester (SY 2025-2026)
*  Information Management (SQL) Course

This is a project that our group created to help aid in encoding Senior Citizens information and storing it in a database. Specifically developed for Barangay San Gabriel, the system transitions manual, paper-based logbooks into a centralized digital platform to improve administrative efficiency. It features automated age calculation, comprehensive benefit distribution tracking, and instant report generation for municipal coordination. Additionally, the application prioritizes data privacy by implementing strict role-based access control (RBAC) and secure OTP authentication for authorized barangay personnel.

## Key Features

*   **Digital Profiling:** Securely store personal data, emergency contacts, and scanned copies of OSCA IDs. Includes automatic age calculation based on birthdates.
*   **Automated Reporting:** Instantly generate clean, printable lists filtering "Active" versus "Deceased" members for DSWD and municipal reporting.
*   **Dashboard Alerts:** Automated dashboard notifications alerting barangay officials of upcoming senior citizen birthdays.
*   **Robust Security:** Features Role-Based Access Control (Admin and Staff privileges), JWT authentication, and an email-based One-Time Password (OTP) flow for secure password recovery and changes.

## Tech Stack

**Frontend:**
*   HTML5 / CSS3 / Vanilla JavaScript
*   Bootstrap 5 (Responsive UI framework)
*   FontAwesome (Icons)

**Backend:**
*   Node.js with Express.js
*   JSON Web Tokens (JWT) for secure session management
*   Bcrypt.js for password and PIN hashing
*   Nodemailer (for OTP email dispatch)

**Database:**
*   SQL Database
