const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

// GET /api/channels — list all channels
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM gradpath_messages WHERE channel_id = c.id) AS message_count,
        (SELECT MAX(created_at) FROM gradpath_messages WHERE channel_id = c.id) AS last_message_at
      FROM gradpath_channels c
      JOIN users u ON c.created_by = u.id
      ORDER BY c.is_default DESC, c.name ASC
    `);
    res.json({ ok: true, data: { channels: rows } });
  } catch (err) {
    console.error('Channels list error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading channels' });
  }
});

// POST /api/channels — create a channel
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Channel name is required' });
  }
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  try {
    const [existing] = await pool.query('SELECT id FROM gradpath_channels WHERE name = ?', [cleanName]);
    if (existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'A channel with that name already exists' });
    }
    const [result] = await pool.query(
      'INSERT INTO gradpath_channels (name, description, created_by) VALUES (?, ?, ?)',
      [cleanName, description || null, req.session.userId]
    );
    const [rows] = await pool.query('SELECT * FROM gradpath_channels WHERE id = ?', [result.insertId]);
    res.json({ ok: true, data: { channel: rows[0] }, message: 'Channel created' });
  } catch (err) {
    console.error('Channel create error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error creating channel' });
  }
});

// DELETE /api/channels/:id — delete a channel (admin only, not default channels)
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM gradpath_channels WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Channel not found' });
    if (rows[0].is_default) return res.status(400).json({ ok: false, error: 'Cannot delete default channels' });
    await pool.query('DELETE FROM gradpath_channels WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Channel deleted' });
  } catch (err) {
    console.error('Channel delete error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error deleting channel' });
  }
});

module.exports = router;
