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

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const hashed = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email, name, hashed]
    );

    const user = { id: result.insertId, email, name };
    req.session.userId = user.id;

    res.json({ message: 'Account created successfully', user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /auth/login — Sign in with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email. Please sign up first.' });
    }

    const user = rows[0];
    const hashed = hashPassword(password);

    if (user.password_hash !== hashed) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    req.session.userId = user.id;

    res.json({
      message: 'Logged in successfully',
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;