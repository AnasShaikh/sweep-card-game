// src/db.js - Database connection and utilities
import pkg from 'pg';
const { Pool } = pkg;

const localConfig = {
  user: 'seep_user',
  host: 'localhost',
  database: 'seep_game',
  password: 'seep_password',
  port: 5432,
};

const productionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : null;

// Database connection pool
const pool = new Pool(productionConfig || localConfig);

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Export the pool for use in other files
export default pool;
