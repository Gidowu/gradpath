const mysql = require('mysql2/promise');

// Create a connection pool to MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
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

    // Ensure role column exists with advisor support
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN role ENUM('student','advisor','admin') NOT NULL DEFAULT 'student'
      `);
      console.log('Database: added role column to users table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        // Column exists — upgrade ENUM to include advisor
        try {
          await pool.query(`
            ALTER TABLE users MODIFY COLUMN role ENUM('student','advisor','admin') NOT NULL DEFAULT 'student'
          `);
          console.log('Database: updated role enum to include advisor');
        } catch (e2) {
          // Already up to date
        }
      } else {
        console.log('Database: role column check -', e.message);
      }
    }

    // Ensure advisor_id column exists on users
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN advisor_id INT DEFAULT NULL
      `);
      console.log('Database: added advisor_id column to users table');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('Database: advisor_id column check -', e.message);
      }
    }

    // Ensure deadlines table exists
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

    // Ensure comments table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          application_id INT NOT NULL,
          user_id INT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES gradpath_applications(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_comments table ready');
    } catch (e) {
      console.error('Database: comments table error -', e.message);
    }

    // Ensure advisor_match_requests table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS advisor_match_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          advisor_id INT NOT NULL,
          status ENUM('pending','accepted','rejected') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_match (student_id, advisor_id)
        )
      `);
      console.log('Database: advisor_match_requests table ready');
    } catch (e) {
      console.error('Database: match requests table error -', e.message);
    }

  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure MariaDB is running and .env is configured correctly.');
  }
}

module.exports = { pool, initDatabase };