const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

// GET /api/checklists/:applicationId — get checklist for an application
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM gradpath_checklists WHERE application_id = ? ORDER BY item_type, item_name',
      [req.params.applicationId]
    );
    res.json({ ok: true, data: { checklist: rows } });
  } catch (err) {
    console.error('Checklist load error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading checklist' });
  }
});

// POST /api/checklists — add checklist item
router.post('/', requireAuth, async (req, res) => {
  const { application_id, item_name, item_type, due_date, notes, recommender_name, recommender_email } = req.body;
  if (!application_id) return res.status(400).json({ ok: false, error: 'Application ID is required' });
  if (!item_name || !item_name.trim()) return res.status(400).json({ ok: false, error: 'Item name is required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO gradpath_checklists (application_id, item_name, item_type, due_date, notes, recommender_name, recommender_email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [application_id, item_name.trim(), item_type || 'other', due_date || null, notes || null, recommender_name || null, recommender_email || null]
    );
    const [rows] = await pool.query('SELECT * FROM gradpath_checklists WHERE id = ?', [result.insertId]);
    res.json({ ok: true, data: { item: rows[0] }, message: 'Checklist item added' });
  } catch (err) {
    console.error('Checklist create error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error adding checklist item' });
  }
});

// PUT /api/checklists/:id — update checklist item
router.put('/:id', requireAuth, async (req, res) => {
  const { item_name, item_type, is_completed, due_date, notes, recommender_name, recommender_email, recommender_status } = req.body;
  try {
    const [items] = await pool.query('SELECT * FROM gradpath_checklists WHERE id = ?', [req.params.id]);
    if (items.length === 0) return res.status(404).json({ ok: false, error: 'Item not found' });

    await pool.query(
      `UPDATE gradpath_checklists SET item_name = ?, item_type = ?, is_completed = ?, due_date = ?, notes = ?,
       recommender_name = ?, recommender_email = ?, recommender_status = ? WHERE id = ?`,
      [
        item_name || items[0].item_name,
        item_type || items[0].item_type,
        is_completed !== undefined ? is_completed : items[0].is_completed,
        due_date !== undefined ? due_date : items[0].due_date,
        notes !== undefined ? notes : items[0].notes,
        recommender_name !== undefined ? recommender_name : items[0].recommender_name,
        recommender_email !== undefined ? recommender_email : items[0].recommender_email,
        recommender_status !== undefined ? recommender_status : items[0].recommender_status,
        req.params.id
      ]
    );
    const [updated] = await pool.query('SELECT * FROM gradpath_checklists WHERE id = ?', [req.params.id]);
    res.json({ ok: true, data: { item: updated[0] }, message: 'Item updated' });
  } catch (err) {
    console.error('Checklist update error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error updating item' });
  }
});

// PUT /api/checklists/:id/toggle — toggle completion
router.put('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const [items] = await pool.query('SELECT * FROM gradpath_checklists WHERE id = ?', [req.params.id]);
    if (items.length === 0) return res.status(404).json({ ok: false, error: 'Item not found' });
    await pool.query('UPDATE gradpath_checklists SET is_completed = ? WHERE id = ?', [items[0].is_completed ? 0 : 1, req.params.id]);
    res.json({ ok: true, message: 'Toggled' });
  } catch (err) {
    console.error('Checklist toggle error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/checklists/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM gradpath_checklists WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Deleted' });
  } catch (err) {
    console.error('Checklist delete error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/checklists/:applicationId/generate — auto-generate standard checklist
router.post('/:applicationId/generate', requireAuth, async (req, res) => {
  const defaultItems = [
    { item_name: 'Statement of Purpose', item_type: 'sop' },
    { item_name: 'CV / Resume', item_type: 'cv' },
    { item_name: 'Official Transcript', item_type: 'transcript' },
    { item_name: 'GRE Scores', item_type: 'gre' },
    { item_name: 'TOEFL / IELTS Scores', item_type: 'toefl' },
    { item_name: 'Writing Sample', item_type: 'writing_sample' },
    { item_name: 'Recommendation Letter #1', item_type: 'rec_letter' },
    { item_name: 'Recommendation Letter #2', item_type: 'rec_letter' },
    { item_name: 'Recommendation Letter #3', item_type: 'rec_letter' },
    { item_name: 'Application Fee', item_type: 'fee' },
  ];
  try {
    for (const item of defaultItems) {
      await pool.query(
        'INSERT INTO gradpath_checklists (application_id, item_name, item_type) VALUES (?, ?, ?)',
        [req.params.applicationId, item.item_name, item.item_type]
      );
    }
    const [rows] = await pool.query(
      'SELECT * FROM gradpath_checklists WHERE application_id = ? ORDER BY item_type, item_name',
      [req.params.applicationId]
    );
    res.json({ ok: true, data: { checklist: rows }, message: 'Standard checklist generated' });
  } catch (err) {
    console.error('Generate checklist error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error generating checklist' });
  }
});

module.exports = router;
