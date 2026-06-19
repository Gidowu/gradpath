const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const router = express.Router();

// Simple password hashing (good enough for class project)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate a 6-digit verification code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Ensure verification_codes table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        expires_at TIMESTAMP NOT NULL,
        verified TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.log('Verification table check:', e.message);
  }
})();

// POST /auth/register — Generate verification code
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  const details = [];
  if (!name || name.trim().length === 0) {
    details.push({ field: 'name', message: 'Name is required' });
  } else if (name.trim().length < 2) {
    details.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  if (!email || email.trim().length === 0) {
    details.push({ field: 'email', message: 'Email is required' });
  } else if (!email.includes('@') || !email.includes('.')) {
    details.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (!password) {
    details.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 4) {
    details.push({ field: 'password', message: 'Password must be at least 4 characters' });
  }

  if (details.length > 0) {
    return res.status(400).json({ ok: false, error: 'Validation failed', details });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'An account with this email already exists',
        details: [{ field: 'email', message: 'This email is already registered. Please sign in.' }]
      });
    }

    const hashed = hashPassword(password);
    const validRoles = ['student', 'advisor'];
    const selectedRole = (req.body.role && validRoles.includes(req.body.role)) ? req.body.role : 'student';
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous codes for this email
    await pool.query('DELETE FROM verification_codes WHERE email = ?', [email.trim()]);

    // Store the pending registration with code
    await pool.query(
      'INSERT INTO verification_codes (email, code, name, password_hash, role, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [email.trim(), code, name.trim(), hashed, selectedRole, expiresAt]
    );

    // Return the code in the response (placeholder — swap for real email later)
    res.json({
      ok: true,
      data: { needsVerification: true, email: email.trim(), code },
      message: 'Verification code generated'
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during registration' });
  }
});

// POST /auth/verify — Verify the 6-digit code and create the account
router.post('/verify', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ ok: false, error: 'Email and verification code are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1',
      [email.trim(), code.trim()]
    );

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'Invalid verification code. Please check and try again.' });
    }

    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ ok: false, error: 'Verification code has expired. Please sign up again.' });
    }

    // Mark code as verified
    await pool.query('UPDATE verification_codes SET verified = 1 WHERE id = ?', [record.id]);

    // Check if user already exists
    const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (existingUser.length > 0) {
      return res.status(409).json({ ok: false, error: 'Account already exists. Please sign in.' });
    }

    // Create the actual user account
    const [result] = await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
      [record.email, record.name, record.password_hash, record.role]
    );

    const user = { id: result.insertId, email: record.email, name: record.name, role: record.role };
    req.session.userId = user.id;
    req.session.userRole = record.role;

    // Clean up used codes
    await pool.query('DELETE FROM verification_codes WHERE email = ?', [email.trim()]);

    res.json({ ok: true, data: { user }, message: 'Email verified! Account created successfully.' });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during verification' });
  }
});

// POST /auth/resend-code — Generate a new code
router.post('/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: 'Email is required' });

  try {
    const [pending] = await pool.query(
      'SELECT * FROM verification_codes WHERE email = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1',
      [email.trim()]
    );

    if (pending.length === 0) {
      return res.status(400).json({ ok: false, error: 'No pending registration found. Please sign up first.' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE verification_codes SET code = ?, expires_at = ? WHERE id = ?',
      [code, expiresAt, pending[0].id]
    );

    res.json({ ok: true, data: { code }, message: 'New verification code generated' });
  } catch (err) {
    console.error('Resend code error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to generate new code' });
  }
});

// POST /auth/login — Sign in with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const details = [];
  if (!email || email.trim().length === 0) {
    details.push({ field: 'email', message: 'Email is required' });
  }
  if (!password) {
    details.push({ field: 'password', message: 'Password is required' });
  }

  if (details.length > 0) {
    return res.status(400).json({ ok: false, error: 'Validation failed', details });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'No account found with this email',
        details: [{ field: 'email', message: 'No account found. Please sign up first.' }]
      });
    }

    const user = rows[0];
    const hashed = hashPassword(password);

    if (user.password_hash !== hashed) {
      return res.status(401).json({
        ok: false,
        error: 'Incorrect password',
        details: [{ field: 'password', message: 'Incorrect password. Please try again.' }]
      });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role || 'student';

    res.json({
      ok: true,
      data: { user: { id: user.id, name: user.name, email: user.email, role: user.role || 'student' } },
      message: 'Logged in successfully'
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during login' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ ok: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true, message: 'Logged out successfully' });
  });
});

module.exports = router;
