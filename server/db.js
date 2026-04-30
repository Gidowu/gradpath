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

// Verify database connection and ensure role column exists
async function initDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Database: connected successfully');

    // Ensure role column exists on users table (safe to run multiple times)
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN role ENUM('student','admin') NOT NULL DEFAULT 'student'
      `);
      console.log('Database: added role column to users table');
    } catch (e) {
      // Column already exists — that's fine
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('Database: role column check -', e.message);
      }
    }
    // Ensure deadlines table exists (3rd table for final project)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_deadlines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          application_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          due_date DATE NOT NULL,
          reminder_date DATE DEFAULT NULL,
          is_completed TINYINT(1) NOT NULL DEFAULT 0,
          notes TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES gradpath_applications(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_deadlines table ready');
    } catch (e) {
      console.error('Database: deadlines table error -', e.message);
    }

  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure MariaDB is running and .env is configured correctly.');
  }
}

module.exports = { pool, initDatabase };