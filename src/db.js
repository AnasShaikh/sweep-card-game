// src/db.js - Database connection and utilities
import pkg from 'pg';
const { Pool } = pkg;

// Database connection pool
const pool = new Pool({
  user: 'seep_user',
  host: 'localhost',
  database: 'seep_game',
  password: 'seep_password',
  port: 5432,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Export the pool for use in other files
export default pool;