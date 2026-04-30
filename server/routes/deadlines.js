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

function isAdmin(req) {
    return req.session.userRole === 'admin';
}

// ========== ROUTES ==========

// GET /api/deadlines — list deadlines for the logged-in user (joined with application info)
// Admin sees all deadlines; students see only deadlines for their own applications
router.get('/', requireAuth, async (req, res) => {
    try {
        let rows;
        if (isAdmin(req)) {
            [rows] = await pool.query(
                `SELECT d.*, a.school_name, a.program_name, u.name AS user_name
         FROM gradpath_deadlines d
         JOIN gradpath_applications a ON d.application_id = a.id
         JOIN users u ON a.user_id = u.id
         ORDER BY d.due_date ASC`
            );
        } else {
            [rows] = await pool.query(
                `SELECT d.*, a.school_name, a.program_name
         FROM gradpath_deadlines d
         JOIN gradpath_applications a ON d.application_id = a.id
         WHERE a.user_id = ?
         ORDER BY d.due_date ASC`,
                [req.session.userId]
            );
        }
        res.json({ ok: true, data: { deadlines: rows } });
    } catch (err) {
        console.error('Deadlines list error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error loading deadlines' });
    }
});

// POST /api/deadlines — create a new deadline
router.post('/', requireAuth, async (req, res) => {
    const { application_id, title, due_date, reminder_date, notes } = req.body;

    // Validate required fields
    const errors = [];
    if (!application_id) errors.push({ field: 'application_id', message: 'Application is required' });
    if (!title || !title.trim()) errors.push({ field: 'title', message: 'Title is required' });
    if (!due_date) errors.push({ field: 'due_date', message: 'Due date is required' });

    if (errors.length > 0) {
        return res.status(400).json({ ok: false, error: 'Validation failed', details: errors });
    }

    // Verify the application belongs to this user (or user is admin)
    try {
        let query, params;
        if (isAdmin(req)) {
            query = 'SELECT id FROM gradpath_applications WHERE id = ?';
            params = [application_id];
        } else {
            query = 'SELECT id FROM gradpath_applications WHERE id = ? AND user_id = ?';
            params = [application_id, req.session.userId];
        }
        const [appRows] = await pool.query(query, params);
        if (appRows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }

        const [result] = await pool.query(
            `INSERT INTO gradpath_deadlines (application_id, title, due_date, reminder_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
            [application_id, title.trim(), due_date, reminder_date || null, notes || null]
        );

        const [rows] = await pool.query(
            `SELECT d.*, a.school_name, a.program_name
       FROM gradpath_deadlines d
       JOIN gradpath_applications a ON d.application_id = a.id
       WHERE d.id = ?`,
            [result.insertId]
        );

        res.json({ ok: true, data: { deadline: rows[0] }, message: 'Deadline created' });
    } catch (err) {
        console.error('Deadline create error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error creating deadline' });
    }
});

// PUT /api/deadlines/:id — update a deadline
router.put('/:id', requireAuth, async (req, res) => {
    const deadlineId = req.params.id;
    const { title, due_date, reminder_date, notes } = req.body;

    const errors = [];
    if (!title || !title.trim()) errors.push({ field: 'title', message: 'Title is required' });
    if (!due_date) errors.push({ field: 'due_date', message: 'Due date is required' });

    if (errors.length > 0) {
        return res.status(400).json({ ok: false, error: 'Validation failed', details: errors });
    }

    try {
        // Check ownership
        let query, params;
        if (isAdmin(req)) {
            query = 'SELECT d.id FROM gradpath_deadlines d WHERE d.id = ?';
            params = [deadlineId];
        } else {
            query = `SELECT d.id FROM gradpath_deadlines d
               JOIN gradpath_applications a ON d.application_id = a.id
               WHERE d.id = ? AND a.user_id = ?`;
            params = [deadlineId, req.session.userId];
        }
        const [existing] = await pool.query(query, params);
        if (existing.length === 0) {
            return res.status(404).json({ ok: false, error: 'Deadline not found' });
        }

        await pool.query(
            `UPDATE gradpath_deadlines SET title = ?, due_date = ?, reminder_date = ?, notes = ? WHERE id = ?`,
            [title.trim(), due_date, reminder_date || null, notes || null, deadlineId]
        );

        const [rows] = await pool.query(
            `SELECT d.*, a.school_name, a.program_name
       FROM gradpath_deadlines d
       JOIN gradpath_applications a ON d.application_id = a.id
       WHERE d.id = ?`,
            [deadlineId]
        );

        res.json({ ok: true, data: { deadline: rows[0] }, message: 'Deadline updated' });
    } catch (err) {
        console.error('Deadline update error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error updating deadline' });
    }
});

// PUT /api/deadlines/:id/complete — toggle completion status
router.put('/:id/complete', requireAuth, async (req, res) => {
    const deadlineId = req.params.id;

    try {
        let query, params;
        if (isAdmin(req)) {
            query = 'SELECT d.* FROM gradpath_deadlines d WHERE d.id = ?';
            params = [deadlineId];
        } else {
            query = `SELECT d.* FROM gradpath_deadlines d
               JOIN gradpath_applications a ON d.application_id = a.id
               WHERE d.id = ? AND a.user_id = ?`;
            params = [deadlineId, req.session.userId];
        }
        const [rows] = await pool.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Deadline not found' });
        }

        const newStatus = rows[0].is_completed ? 0 : 1;
        await pool.query('UPDATE gradpath_deadlines SET is_completed = ? WHERE id = ?', [newStatus, deadlineId]);

        res.json({ ok: true, data: { is_completed: newStatus }, message: newStatus ? 'Marked complete' : 'Marked incomplete' });
    } catch (err) {
        console.error('Deadline complete toggle error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error toggling deadline' });
    }
});

// DELETE /api/deadlines/:id — delete a deadline
router.delete('/:id', requireAuth, async (req, res) => {
    const deadlineId = req.params.id;

    try {
        // Check ownership first
        let checkQuery, checkParams;
        if (isAdmin(req)) {
            checkQuery = 'SELECT d.id FROM gradpath_deadlines d WHERE d.id = ?';
            checkParams = [deadlineId];
        } else {
            checkQuery = `SELECT d.id FROM gradpath_deadlines d
                    JOIN gradpath_applications a ON d.application_id = a.id
                    WHERE d.id = ? AND a.user_id = ?`;
            checkParams = [deadlineId, req.session.userId];
        }
        const [rows] = await pool.query(checkQuery, checkParams);
        if (rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Deadline not found' });
        }

        await pool.query('DELETE FROM gradpath_deadlines WHERE id = ?', [deadlineId]);
        res.json({ ok: true, message: 'Deadline deleted' });
    } catch (err) {
        console.error('Deadline delete error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error deleting deadline' });
    }
});

module.exports = router;