// Load environment variables
require('dotenv').config(); 

// Use 'require' instead of 'import' to match your server.js
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

// Initialize the Supabase connection
const sql = postgres(connectionString);

console.log('✅ Connected to PostgreSQL Database');

// Use 'module.exports' instead of 'export default'
module.exports = sql;