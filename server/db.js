const mysql = require('mysql2/promise');

// Create a connection pool to MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gradpath',
  waitForConnections: true,
  connectionLimit: 10
});

// Verify database connection
async function initDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Database: connected successfully');
  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure MariaDB is running and .env is configured correctly.');
  }
}

module.exports = { pool, initDatabase };