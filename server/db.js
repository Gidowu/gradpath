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

// Verify database connection and ensure all tables/columns exist
async function initDatabase() {
  try {
    await pool.query('SELECT 1');
    console.log('Database: connected successfully');

    // Ensure role column supports advisor (safe to run multiple times)
    try {
      await pool.query(`
        ALTER TABLE users MODIFY COLUMN role ENUM('student','admin','advisor') NOT NULL DEFAULT 'student'
      `);
      console.log('Database: role column updated to include advisor');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('Database: role column check -', e.message);
      }
    }

    // Ensure advisor_id column exists on users table
    try {
      await pool.query(`
        ALTER TABLE users ADD COLUMN advisor_id INT DEFAULT NULL
      `);
      console.log('Database: added advisor_id column to users table');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('Database: advisor_id check -', e.message);
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

    // ===== NEW TABLES FOR PHD PLATFORM =====

    // Add avatar_url and bio to users
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) DEFAULT NULL`);
      console.log('Database: added avatar_url to users');
    } catch (e) { /* column may already exist */ }
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL`);
      console.log('Database: added bio to users');
    } catch (e) { /* column may already exist */ }
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN field_of_study VARCHAR(255) DEFAULT NULL`);
      console.log('Database: added field_of_study to users');
    } catch (e) { /* column may already exist */ }

    // Add more fields to applications for PhD tracking
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN funding_type VARCHAR(100) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN stipend_amount DECIMAL(10,2) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN gre_required TINYINT(1) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN faculty_contact VARCHAR(255) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN faculty_email VARCHAR(255) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    try {
      await pool.query(`ALTER TABLE gradpath_applications ADD COLUMN program_url VARCHAR(500) DEFAULT NULL`);
    } catch (e) { /* may exist */ }
    console.log('Database: application PhD columns checked');

    // Chat channels table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_channels (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(500) DEFAULT NULL,
          created_by INT NOT NULL,
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_channels table ready');
    } catch (e) {
      console.error('Database: channels table error -', e.message);
    }

    // Chat messages table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          channel_id INT NOT NULL,
          user_id INT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (channel_id) REFERENCES gradpath_channels(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_messages table ready');
    } catch (e) {
      console.error('Database: messages table error -', e.message);
    }

    // Documents table (SOPs, CVs, writing samples, etc.)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_documents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          application_id INT DEFAULT NULL,
          title VARCHAR(255) NOT NULL,
          doc_type ENUM('sop','cv','writing_sample','transcript','recommendation','other') NOT NULL DEFAULT 'other',
          content LONGTEXT DEFAULT NULL,
          file_url VARCHAR(500) DEFAULT NULL,
          version INT NOT NULL DEFAULT 1,
          status ENUM('draft','review','final') NOT NULL DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (application_id) REFERENCES gradpath_applications(id) ON DELETE SET NULL
        )
      `);
      console.log('Database: gradpath_documents table ready');
    } catch (e) {
      console.error('Database: documents table error -', e.message);
    }

    // Document reviews (peer review system)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_doc_reviews (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NOT NULL,
          reviewer_id INT NOT NULL,
          status ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
          overall_feedback TEXT DEFAULT NULL,
          rating INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES gradpath_documents(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_doc_reviews table ready');
    } catch (e) {
      console.error('Database: doc_reviews table error -', e.message);
    }

    // Inline review comments (comments on specific parts of documents)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_review_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          review_id INT NOT NULL,
          user_id INT NOT NULL,
          content TEXT NOT NULL,
          paragraph_index INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (review_id) REFERENCES gradpath_doc_reviews(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_review_comments table ready');
    } catch (e) {
      console.error('Database: review_comments table error -', e.message);
    }

    // Per-school document checklist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gradpath_checklists (
          id INT AUTO_INCREMENT PRIMARY KEY,
          application_id INT NOT NULL,
          item_name VARCHAR(255) NOT NULL,
          item_type ENUM('sop','cv','transcript','gre','toefl','writing_sample','rec_letter','fee','other') NOT NULL DEFAULT 'other',
          is_completed TINYINT(1) NOT NULL DEFAULT 0,
          due_date DATE DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          recommender_name VARCHAR(255) DEFAULT NULL,
          recommender_email VARCHAR(255) DEFAULT NULL,
          recommender_status ENUM('not_asked','asked','submitted') DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES gradpath_applications(id) ON DELETE CASCADE
        )
      `);
      console.log('Database: gradpath_checklists table ready');
    } catch (e) {
      console.error('Database: checklists table error -', e.message);
    }

    // Seed default #general channel if none exist
    try {
      const [channels] = await pool.query('SELECT id FROM gradpath_channels LIMIT 1');
      if (channels.length === 0) {
        const [adminUser] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const seedUser = adminUser.length > 0 ? adminUser[0].id : 1;
        await pool.query(
          "INSERT INTO gradpath_channels (name, description, created_by, is_default) VALUES ('general', 'General discussion for all PhD applicants', ?, 1)",
          [seedUser]
        );
        await pool.query(
          "INSERT INTO gradpath_channels (name, description, created_by, is_default) VALUES ('sop-help', 'Get help with your Statement of Purpose', ?, 1)",
          [seedUser]
        );
        await pool.query(
          "INSERT INTO gradpath_channels (name, description, created_by, is_default) VALUES ('funding', 'Discuss funding, fellowships, and stipends', ?, 1)",
          [seedUser]
        );
        console.log('Database: seeded default chat channels');
      }
    } catch (e) {
      console.error('Database: channel seed error -', e.message);
    }

  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure MariaDB is running and .env is configured correctly.');
  }
}

module.exports = { pool, initDatabase };
