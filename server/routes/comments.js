const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// ========== MIDDLEWARE ==========

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

// ========== ROUTES ==========

// GET /api/comments/:applicationId — get comments for an application
router.get('/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM gradpath_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.application_id = ?
       ORDER BY c.created_at DESC`,
      [applicationId]
    );
    res.json({ ok: true, data: { comments: rows } });
  } catch (err) {
    console.error('Comments list error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading comments' });
  }
});

// POST /api/comments — create a comment (advisors and admins only)
router.post('/', requireAuth, async (req, res) => {
  const { application_id, content } = req.body;
  const userRole = req.session.userRole;

  // Only advisors and admins can post comments
  if (userRole !== 'advisor' && userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Only advisors and admins can post comments' });
  }

  // Validate
  if (!application_id) {
    return res.status(400).json({ ok: false, error: 'Application ID is required' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ ok: false, error: 'Comment content is required' });
  }

  try {
    // Verify application exists
    const [appRows] = await pool.query('SELECT id FROM gradpath_applications WHERE id = ?', [application_id]);
    if (appRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO gradpath_comments (application_id, user_id, content) VALUES (?, ?, ?)',
      [application_id, req.session.userId, content.trim()]
    );

    const [rows] = await pool.query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM gradpath_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );

    res.json({ ok: true, data: { comment: rows[0] }, message: 'Comment posted' });
  } catch (err) {
    console.error('Comment create error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error posting comment' });
  }
});

// DELETE /api/comments/:id — delete a comment (author or admin only)
router.delete('/:id', requireAuth, async (req, res) => {
  const commentId = req.params.id;
  try {
    const [rows] = await pool.query('SELECT * FROM gradpath_comments WHERE id = ?', [commentId]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Comment not found' });
    }
    // Only the author or admin can delete
    if (rows[0].user_id !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Not authorized to delete this comment' });
    }
    await pool.query('DELETE FROM gradpath_comments WHERE id = ?', [commentId]);
    res.json({ ok: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('Comment delete error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error deleting comment' });
  }
});

module.exports = router;