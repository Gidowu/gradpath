const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'You must be logged in' });
  next();
}

// GET /api/match/advisors — list all advisors (students browse)
router.get('/advisors', requireAuth, async (req, res) => {
  try {
    const [advisors] = await pool.query(
      'SELECT id, name, email FROM users WHERE role = ? ORDER BY name ASC',
      ['advisor']
    );
    res.json({ ok: true, data: { advisors } });
  } catch (err) {
    console.error('List advisors error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/match/requests — advisor sees incoming pending requests; student sees all their sent requests
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const { userId, userRole } = req.session;
    let rows;
    if (userRole === 'advisor' || userRole === 'admin') {
      [rows] = await pool.query(
        `SELECT r.*, u.name AS student_name, u.email AS student_email
         FROM advisor_match_requests r
         JOIN users u ON r.student_id = u.id
         WHERE r.advisor_id = ? AND r.status = 'pending'
         ORDER BY r.created_at DESC`,
        [userId]
      );
    } else {
      [rows] = await pool.query(
        `SELECT r.*, u.name AS advisor_name, u.email AS advisor_email
         FROM advisor_match_requests r
         JOIN users u ON r.advisor_id = u.id
         WHERE r.student_id = ?
         ORDER BY r.created_at DESC`,
        [userId]
      );
    }
    res.json({ ok: true, data: { requests: rows } });
  } catch (err) {
    console.error('Get match requests error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/match/request — student sends a match request to an advisor
router.post('/request', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'student') {
    return res.status(403).json({ ok: false, error: 'Only students can send match requests' });
  }
  const { advisorId } = req.body;
  if (!advisorId) return res.status(400).json({ ok: false, error: 'advisorId is required' });

  try {
    const studentId = req.session.userId;
    const [advisor] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [advisorId, 'advisor']);
    if (advisor.length === 0) return res.status(404).json({ ok: false, error: 'Advisor not found' });

    const [existing] = await pool.query(
      'SELECT id, status FROM advisor_match_requests WHERE student_id = ? AND advisor_id = ?',
      [studentId, advisorId]
    );
    if (existing.length > 0) {
      if (existing[0].status === 'pending') {
        return res.status(400).json({ ok: false, error: 'You already sent a request to this advisor' });
      }
      if (existing[0].status === 'accepted') {
        return res.status(400).json({ ok: false, error: 'You are already matched with this advisor' });
      }
      // Rejected — allow re-request
      await pool.query('UPDATE advisor_match_requests SET status = ? WHERE id = ?', ['pending', existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO advisor_match_requests (student_id, advisor_id) VALUES (?, ?)',
        [studentId, advisorId]
      );
    }
    res.json({ ok: true, data: { message: 'Request sent' } });
  } catch (err) {
    console.error('Send match request error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/match/requests/:id/accept — advisor accepts; sets advisor_id on student
router.put('/requests/:id/accept', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'advisor' && req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Advisor access required' });
  }
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM advisor_match_requests WHERE id = ? AND advisor_id = ?',
      [id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Request not found' });

    const request = rows[0];
    await pool.query('UPDATE users SET advisor_id = ? WHERE id = ?', [req.session.userId, request.student_id]);
    await pool.query('UPDATE advisor_match_requests SET status = ? WHERE id = ?', ['accepted', id]);
    // Auto-reject any other pending requests from this student
    await pool.query(
      `UPDATE advisor_match_requests SET status = 'rejected'
       WHERE student_id = ? AND id != ? AND status = 'pending'`,
      [request.student_id, id]
    );
    res.json({ ok: true, data: { message: 'Student accepted' } });
  } catch (err) {
    console.error('Accept match error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/match/requests/:id/reject — advisor declines a request
router.put('/requests/:id/reject', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'advisor' && req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Advisor access required' });
  }
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM advisor_match_requests WHERE id = ? AND advisor_id = ?',
      [id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Request not found' });

    await pool.query('UPDATE advisor_match_requests SET status = ? WHERE id = ?', ['rejected', id]);
    res.json({ ok: true, data: { message: 'Request declined' } });
  } catch (err) {
    console.error('Reject match error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/match/requests/:id — student withdraws a pending request
router.delete('/requests/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id FROM advisor_match_requests WHERE id = ? AND student_id = ? AND status = 'pending'`,
      [id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Request not found' });

    await pool.query('DELETE FROM advisor_match_requests WHERE id = ?', [id]);
    res.json({ ok: true, data: { message: 'Request withdrawn' } });
  } catch (err) {
    console.error('Withdraw request error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
