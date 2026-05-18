// Load environment variables first
import 'dotenv/config'; 
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

// The postgres package automatically connects and handles connection pooling for you
const sql = postgres(connectionString);

console.log('✅ Connected to PostgreSQL Database');

// Export it for use in your other files
export default sql;