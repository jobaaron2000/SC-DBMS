const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL (Supabase) Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Supabase connections
    }
});

// Test the connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error acquiring client', err.stack);
    } else {
        console.log('✅ Connected to PostgreSQL (Supabase) Database');
        release();
    }
});

async function getPool() {
    return pool;
}

// Note: We no longer need to export 'sql', just the pool!
module.exports = { getPool };