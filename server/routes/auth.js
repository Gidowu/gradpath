const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// POST /auth/login — Log in with name and email
// If the email does not exist, create the user automatically
router.post('/login', async (req, res) => {
  const { name, email } = req.body;

  // Validate input
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Simple email format check
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if user exists by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    let user;

    if (rows.length > 0) {
      // Existing user — update name if changed
      user = rows[0];
      if (user.name !== name) {
        await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, user.id]);
        user.name = name;
      }
    } else {
      // New user — create automatically
      const [result] = await pool.query(
        'INSERT INTO users (email, name) VALUES (?, ?)',
        [email, name]
      );
      user = { id: result.insertId, email, name };
    }

    // Store user ID in session (server-side session)
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

// POST /auth/logout — Destroy session and log user out
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
