const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

// GET /api/messages/:channelId — get messages for a channel (paginated)
router.get('/:channelId', requireAuth, async (req, res) => {
  const { channelId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before; // message id for pagination
  try {
    let query = `
      SELECT m.*, u.name AS author_name, u.role AS author_role, u.avatar_url
      FROM gradpath_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
    `;
    const params = [channelId];
    if (before) {
      query += ' AND m.id < ?';
      params.push(before);
    }
    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(query, params);
    res.json({ ok: true, data: { messages: rows.reverse() } }); // reverse so oldest first
  } catch (err) {
    console.error('Messages list error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading messages' });
  }
});

// POST /api/messages — send a message
router.post('/', requireAuth, async (req, res) => {
  const { channel_id, content } = req.body;
  if (!channel_id) return res.status(400).json({ ok: false, error: 'Channel ID is required' });
  if (!content || !content.trim()) return res.status(400).json({ ok: false, error: 'Message content is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO gradpath_messages (channel_id, user_id, content) VALUES (?, ?, ?)',
      [channel_id, req.session.userId, content.trim()]
    );
    const [rows] = await pool.query(`
      SELECT m.*, u.name AS author_name, u.role AS author_role, u.avatar_url
      FROM gradpath_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);
    res.json({ ok: true, data: { message: rows[0] } });
  } catch (err) {
    console.error('Message send error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error sending message' });
  }
});

// DELETE /api/messages/:id — delete own message or admin
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM gradpath_messages WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Message not found' });
    if (rows[0].user_id !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Not authorized' });
    }
    await pool.query('DELETE FROM gradpath_messages WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Message deleted' });
  } catch (err) {
    console.error('Message delete error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error deleting message' });
  }
});

module.exports = router;
