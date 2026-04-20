const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const router = express.Router();

// Simple password hashing (good enough for class project)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /auth/register — Create a new account
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Field-level validation
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
    const [result] = await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
      [email.trim(), name.trim(), hashed, 'student']
    );

    const user = { id: result.insertId, email: email.trim(), name: name.trim(), role: 'student' };
    req.session.userId = user.id;

    res.json({ ok: true, data: { user }, message: 'Account created successfully' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during registration' });
  }
});

// POST /auth/login — Sign in with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Field-level validation
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