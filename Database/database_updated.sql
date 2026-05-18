-- ============================================
-- DATABASE: Senior Citizen Monitoring System
-- MS SQL Server (T-SQL)
-- Run this in SSMS connected to your SQL Server
-- ============================================

USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SeniorCitizen_db')
BEGIN
    CREATE DATABASE SeniorCitizen_db;
    PRINT 'Database SeniorCitizen_db created.';
END
ELSE
    PRINT 'Database SeniorCitizen_db already exists. Skipping.';
GO

USE SeniorCitizen_db;
GO

-- ============================================
-- TABLE: users
-- Stores staff / admin accounts
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'users' AND type = 'U')
BEGIN
    CREATE TABLE users (
        id              INT             IDENTITY(1,1)   PRIMARY KEY,
        full_name       NVARCHAR(150)   NOT NULL,
        email           NVARCHAR(100)   NOT NULL,
        password        NVARCHAR(255)   NOT NULL,           -- bcrypt hash
        position        NVARCHAR(50)    NOT NULL,           -- 'Head Admin' | 'Admin'
        profile_picture NVARCHAR(255)   NULL,
        status          NVARCHAR(10)    NOT NULL DEFAULT 'active',
        remarks         NVARCHAR(MAX)   NULL,
        
        -- OTP Fields for password reset
        otp_hash        NVARCHAR(255)   NULL,               -- bcrypt hashed OTP
        otp_expires_at  DATETIME2       NULL,               -- OTP expiration time
        
        created_at      DATETIME2       NOT NULL DEFAULT SYSDATETIME(),
        updated_at      DATETIME2       NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_users_email   UNIQUE (email),
        CONSTRAINT CHK_users_status CHECK  (status IN ('active', 'inactive')),
        CONSTRAINT CHK_users_pos    CHECK (position IN ('Head Admin', 'Admin'))
    );
    PRINT 'Table users created.';
END
ELSE
BEGIN
    -- If table exists, check if OTP columns exist and add them if needed
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'otp_hash')
    BEGIN
        ALTER TABLE users ADD otp_hash NVARCHAR(255) NULL;
        ALTER TABLE users ADD otp_expires_at DATETIME2 NULL;
        PRINT 'OTP columns added to users table.';
    END
    ELSE
        PRINT 'Table users already exists with OTP columns.';
END
GO

-- ============================================
-- TABLE: admin_settings
-- Key-value store — used for master PIN etc.
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'admin_settings' AND type = 'U')
BEGIN
    CREATE TABLE admin_settings (
        [key]       NVARCHAR(100)   NOT NULL PRIMARY KEY,
        [value]     NVARCHAR(MAX)   NOT NULL,
        updated_at  DATETIME2       NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Table admin_settings created.';
END
ELSE
    PRINT 'Table admin_settings already exists. Skipping.';
GO

-- ============================================
-- TABLE: seniors
-- Masterlist of registered senior citizens
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'seniors' AND type = 'U')
BEGIN
    CREATE TABLE seniors (
        id               INT             IDENTITY(1,1)   PRIMARY KEY,
        osca_id          NVARCHAR(50)    NOT NULL,
        full_name        NVARCHAR(150)   NOT NULL,
        birthday         DATE            NOT NULL,
        address          NVARCHAR(MAX)   NOT NULL,
        contact_number   NVARCHAR(20)    NULL,
        guardian_name    NVARCHAR(150)   NULL,
        guardian_contact NVARCHAR(20)    NULL,
        profile_photo    NVARCHAR(255)   NULL,
        status           NVARCHAR(10)    NOT NULL DEFAULT 'active',
        created_at       DATETIME2       NOT NULL DEFAULT SYSDATETIME(),
        updated_at       DATETIME2       NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_seniors_osca_id   UNIQUE (osca_id),
        CONSTRAINT CHK_seniors_status   CHECK  (status IN ('active', 'inactive'))
    );
    PRINT 'Table seniors created.';
END
ELSE
    PRINT 'Table seniors already exists. Skipping.';
GO

-- ============================================
-- TABLE: reports
-- Benefits / aid records per senior
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'reports' AND type = 'U')
BEGIN
    CREATE TABLE reports (
        id          INT             IDENTITY(1,1)   PRIMARY KEY,
        senior_id   INT             NOT NULL,
        benefit     NVARCHAR(150)   NOT NULL,
        description NVARCHAR(MAX)   NULL,
        received_at DATETIME2       NOT NULL,
        given_by    INT             NOT NULL,           -- FK → users.id
        remarks     NVARCHAR(MAX)   NULL,
        proof_url   NVARCHAR(255)   NULL,
        created_at  DATETIME2       NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_reports_senior FOREIGN KEY (senior_id)
            REFERENCES seniors(id) ON DELETE CASCADE,

        CONSTRAINT FK_reports_user   FOREIGN KEY (given_by)
            REFERENCES users(id)   ON DELETE NO ACTION   -- prevent multi-cascade conflict
    );
    PRINT 'Table reports created.';
END
ELSE
    PRINT 'Table reports already exists. Skipping.';
GO

-- ============================================
-- INDEXES  (skip if already exist)
-- ============================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_seniors_full_name' AND object_id = OBJECT_ID('seniors'))
    CREATE NONCLUSTERED INDEX IDX_seniors_full_name   ON seniors (full_name);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_seniors_osca_id' AND object_id = OBJECT_ID('seniors'))
    CREATE NONCLUSTERED INDEX IDX_seniors_osca_id     ON seniors (osca_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_seniors_status' AND object_id = OBJECT_ID('seniors'))
    CREATE NONCLUSTERED INDEX IDX_seniors_status      ON seniors (status);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_reports_senior_id' AND object_id = OBJECT_ID('reports'))
    CREATE NONCLUSTERED INDEX IDX_reports_senior_id   ON reports (senior_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_reports_received_at' AND object_id = OBJECT_ID('reports'))
    CREATE NONCLUSTERED INDEX IDX_reports_received_at ON reports (received_at DESC);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_users_email' AND object_id = OBJECT_ID('users'))
    CREATE NONCLUSTERED INDEX IDX_users_email         ON users (email);
GO

PRINT '============================================';
PRINT 'SCMS Database setup complete.';
PRINT 'Tables: users, admin_settings, seniors, reports';
PRINT 'OTP fields added for password reset feature';
PRINT '============================================';
GO
