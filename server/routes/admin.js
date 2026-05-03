const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const router = express.Router();

function hashPassword(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  next();
}

// GET /api/admin/users — list all users with advisor assignments
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.advisor_id,
        adv.name AS advisor_name,
        (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id) AS app_count
       FROM users u
       LEFT JOIN users adv ON u.advisor_id = adv.id
       ORDER BY u.role, u.name`
    );
    res.json({ ok: true, data: { users } });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/admin/users/:userId/advisor — assign or remove advisor for a student
router.put('/users/:userId/advisor', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { advisorId } = req.body;
  try {
    const advisorIdValue = advisorId || null;
    if (advisorIdValue) {
      const [adv] = await pool.query(
        "SELECT id FROM users WHERE id = ? AND role = 'advisor'",
        [advisorIdValue]
      );
      if (adv.length === 0) {
        return res.status(400).json({ ok: false, error: 'Invalid advisor ID' });
      }
    }
    await pool.query('UPDATE users SET advisor_id = ? WHERE id = ?', [advisorIdValue, userId]);
    res.json({ ok: true, message: 'Advisor assigned' });
  } catch (err) {
    console.error('Assign advisor error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/users — create a student or advisor account
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  const validRoles = ['student', 'advisor'];
  const assignedRole = validRoles.includes(role) ? role : 'student';

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Name, email, and password are required' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' });
    }
    const hashed = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
      [email.trim(), name.trim(), hashed, assignedRole]
    );
    res.json({ ok: true, data: { id: result.insertId }, message: 'User created' });
  } catch (err) {
    console.error('Admin create user error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/admin/users/:userId — remove a student account
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query("SELECT role FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    if (rows[0].role === 'admin') {
      return res.status(403).json({ ok: false, error: 'Cannot delete admin accounts' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ ok: true, message: 'User removed' });
  } catch (err) {
    console.error('Admin delete user error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
