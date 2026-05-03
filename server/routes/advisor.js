const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

function requireAdvisor(req, res, next) {
  if (req.session.userRole !== 'advisor' && req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Advisor access required' });
  }
  next();
}

// GET /api/advisor/students — list students assigned to this advisor
router.get('/students', requireAuth, requireAdvisor, async (req, res) => {
  try {
    const advisorId = req.session.userId;
    const whereClause = req.session.userRole === 'admin' ? '' : 'WHERE u.advisor_id = ?';
    const params = req.session.userRole === 'admin' ? [] : [advisorId];
    const [students] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role,
        COUNT(a.id) AS app_count,
        SUM(CASE WHEN a.status = 'Accepted' THEN 1 ELSE 0 END) AS accepted_count,
        SUM(CASE WHEN a.status = 'Applied' THEN 1 ELSE 0 END) AS applied_count,
        SUM(CASE WHEN a.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN a.status = 'Waitlisted' THEN 1 ELSE 0 END) AS waitlisted_count,
        SUM(CASE WHEN a.status = 'Researching' THEN 1 ELSE 0 END) AS researching_count
       FROM users u
       LEFT JOIN gradpath_applications a ON a.user_id = u.id
       ${whereClause}
       GROUP BY u.id
       HAVING u.role = 'student'`,
      params
    );
    res.json({ ok: true, data: { students } });
  } catch (err) {
    console.error('Advisor students error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/advisor/students/:studentId/applications — view student's apps (read-only)
router.get('/students/:studentId/applications', requireAuth, requireAdvisor, async (req, res) => {
  const { studentId } = req.params;
  try {
    if (req.session.userRole !== 'admin') {
      const [check] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND advisor_id = ?',
        [studentId, req.session.userId]
      );
      if (check.length === 0) {
        return res.status(403).json({ ok: false, error: 'This student is not assigned to you' });
      }
    }
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS user_name, u.email AS user_email
       FROM gradpath_applications a
       JOIN users u ON a.user_id = u.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
      [studentId]
    );
    res.json({ ok: true, data: { applications: rows } });
  } catch (err) {
    console.error('Advisor student apps error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/advisor/students/:studentId/deadlines — view student's deadlines (read-only)
router.get('/students/:studentId/deadlines', requireAuth, requireAdvisor, async (req, res) => {
  const { studentId } = req.params;
  try {
    if (req.session.userRole !== 'admin') {
      const [check] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND advisor_id = ?',
        [studentId, req.session.userId]
      );
      if (check.length === 0) {
        return res.status(403).json({ ok: false, error: 'This student is not assigned to you' });
      }
    }
    const [rows] = await pool.query(
      `SELECT d.*, a.school_name, a.program_name
       FROM gradpath_deadlines d
       JOIN gradpath_applications a ON d.application_id = a.id
       WHERE a.user_id = ?
       ORDER BY d.due_date ASC`,
      [studentId]
    );
    res.json({ ok: true, data: { deadlines: rows } });
  } catch (err) {
    console.error('Advisor student deadlines error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
