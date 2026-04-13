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

// Initialize the users table if it does not exist
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('Database: users table ready');
  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure MariaDB is running and .env is configured correctly.');
  }
}

module.exports = { pool, initDatabase };
