const sql = require('mssql');
require('dotenv').config();

const config = {
    // 1. Read from .env instead of hardcoding 'localhost'
    server:   process.env.DB_SERVER   || 'localhost', 
    port:     parseInt(process.env.DB_PORT) || 1433, // Added explicit port mapping
    database: process.env.DB_NAME     || 'SeniorCitizen_db',
    user:     process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
        // 2. REMOVED instanceName: 'SQLEXPRESS' since Docker uses the default instance
        encrypt:                false,
        trustServerCertificate: true,
        enableArithAbort:       true,
    },
    pool: {
        max:               10,
        min:               0,
        idleTimeoutMillis: 30000,
    },
};

let pool;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(config);
        console.log('✅ Connected to MS SQL Server:', process.env.DB_NAME);
    }
    return pool;
}

module.exports = { getPool, sql };