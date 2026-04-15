const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Middleware: require login
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'You must be logged in' });
    }
    next();
}

// GET /api/applications — list current user's applications
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM gradpath_applications WHERE user_id = ? ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json({ applications: rows });
    } catch (err) {
        console.error('List error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/applications — create a new application
router.post('/', requireAuth, async (req, res) => {
    const { school_name, program_name, program_type, fit_level, app_deadline, decision_date, notes } = req.body;

    if (!school_name || !program_name) {
        return res.status(400).json({ error: 'School name and program name are required' });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO gradpath_applications 
       (user_id, school_name, program_name, program_type, fit_level, app_deadline, decision_date, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                school_name,
                program_name,
                program_type || 'MS',
                fit_level || 'Match',
                app_deadline || null,
                decision_date || null,
                notes || null
            ]
        );

        const [rows] = await pool.query(
            'SELECT * FROM gradpath_applications WHERE id = ?',
            [result.insertId]
        );

        res.json({ application: rows[0] });
    } catch (err) {
        console.error('Create error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/applications/:id/status — update application status (state transition)
router.put('/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const appId = req.params.id;

    const validStatuses = ['Researching', 'Applied', 'Accepted', 'Rejected', 'Waitlisted'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        // Ownership check — user can only update their own applications
        const [rows] = await pool.query(
            'SELECT * FROM gradpath_applications WHERE id = ? AND user_id = ?',
            [appId, req.session.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        await pool.query(
            'UPDATE gradpath_applications SET status = ? WHERE id = ?',
            [status, appId]
        );

        res.json({ message: 'Status updated', status });
    } catch (err) {
        console.error('Update error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/applications/:id — delete an application
router.delete('/:id', requireAuth, async (req, res) => {
    const appId = req.params.id;

    try {
        const [result] = await pool.query(
            'DELETE FROM gradpath_applications WHERE id = ? AND user_id = ?',
            [appId, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json({ message: 'Application deleted' });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;