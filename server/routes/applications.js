const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// ========== MIDDLEWARE ==========

// Require login
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ ok: false, error: 'You must be logged in' });
    }
    next();
}

// Check if user is admin
function isAdmin(req) {
    return req.session.userRole === 'admin';
}

// ========== VALIDATION ==========

const VALID_PROGRAM_TYPES = ['MS', 'PhD', 'MBA', 'Other'];
const VALID_FIT_LEVELS = ['Safety', 'Match', 'Reach'];
const VALID_STATUSES = ['Researching', 'Applied', 'Accepted', 'Rejected', 'Waitlisted'];

function validateApplication(body) {
    const details = [];
    const { school_name, program_name, program_type, fit_level, status, app_deadline, decision_date } = body;

    if (!school_name || school_name.trim().length === 0) {
        details.push({ field: 'school_name', message: 'School name is required' });
    } else if (school_name.trim().length > 200) {
        details.push({ field: 'school_name', message: 'School name must be under 200 characters' });
    }

    if (!program_name || program_name.trim().length === 0) {
        details.push({ field: 'program_name', message: 'Program name is required' });
    } else if (program_name.trim().length > 200) {
        details.push({ field: 'program_name', message: 'Program name must be under 200 characters' });
    }

    if (program_type && !VALID_PROGRAM_TYPES.includes(program_type)) {
        details.push({ field: 'program_type', message: `Degree type must be one of: ${VALID_PROGRAM_TYPES.join(', ')}` });
    }

    if (fit_level && !VALID_FIT_LEVELS.includes(fit_level)) {
        details.push({ field: 'fit_level', message: `Fit level must be one of: ${VALID_FIT_LEVELS.join(', ')}` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
        details.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (app_deadline && !dateRegex.test(app_deadline)) {
        details.push({ field: 'app_deadline', message: 'Application deadline must be a valid date (YYYY-MM-DD)' });
    }
    if (decision_date && !dateRegex.test(decision_date)) {
        details.push({ field: 'decision_date', message: 'Decision date must be a valid date (YYYY-MM-DD)' });
    }

    return details;
}

// ========== ROUTES ==========

// GET /api/applications — list applications
// Admin sees ALL applications; students see only their own
router.get('/', requireAuth, async (req, res) => {
    try {
        let rows;
        if (isAdmin(req)) {
            // Admin: see all applications with user info
            [rows] = await pool.query(
                `SELECT a.*, u.name AS user_name, u.email AS user_email
         FROM gradpath_applications a
         JOIN users u ON a.user_id = u.id
         ORDER BY a.created_at DESC`
            );
        } else {
            // Student: only their own
            [rows] = await pool.query(
                'SELECT * FROM gradpath_applications WHERE user_id = ? ORDER BY created_at DESC',
                [req.session.userId]
            );
        }
        res.json({ ok: true, data: { applications: rows } });
    } catch (err) {
        console.error('List error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error loading applications' });
    }
});

// POST /api/applications — create a new application
router.post('/', requireAuth, async (req, res) => {
    const details = validateApplication(req.body);
    if (details.length > 0) {
        return res.status(400).json({ ok: false, error: 'Validation failed', details });
    }

    const { school_name, program_name, program_type, fit_level, app_deadline, decision_date, notes } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO gradpath_applications
       (user_id, school_name, program_name, program_type, fit_level, app_deadline, decision_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                school_name.trim(),
                program_name.trim(),
                program_type || 'MS',
                fit_level || 'Match',
                app_deadline || null,
                decision_date || null,
                notes ? notes.trim() : null
            ]
        );

        const [rows] = await pool.query(
            'SELECT * FROM gradpath_applications WHERE id = ?',
            [result.insertId]
        );

        res.json({ ok: true, data: { application: rows[0] }, message: 'Application created' });
    } catch (err) {
        console.error('Create error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error creating application' });
    }
});

// PUT /api/applications/:id — update entire application
// Admin can edit any; student can only edit their own
router.put('/:id', requireAuth, async (req, res) => {
    const appId = req.params.id;

    try {
        let query, params;
        if (isAdmin(req)) {
            query = 'SELECT * FROM gradpath_applications WHERE id = ?';
            params = [appId];
        } else {
            query = 'SELECT * FROM gradpath_applications WHERE id = ? AND user_id = ?';
            params = [appId, req.session.userId];
        }
        const [existing] = await pool.query(query, params);
        if (existing.length === 0) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }

        const details = validateApplication(req.body);
        if (details.length > 0) {
            return res.status(400).json({ ok: false, error: 'Validation failed', details });
        }

        const { school_name, program_name, program_type, fit_level, status, app_deadline, decision_date, notes } = req.body;

        await pool.query(
            `UPDATE gradpath_applications SET
       school_name = ?, program_name = ?, program_type = ?, fit_level = ?,
       status = ?, app_deadline = ?, decision_date = ?, notes = ?
       WHERE id = ?`,
            [
                school_name.trim(),
                program_name.trim(),
                program_type || 'MS',
                fit_level || 'Match',
                status || 'Researching',
                app_deadline || null,
                decision_date || null,
                notes ? notes.trim() : null,
                appId
            ]
        );

        const [rows] = await pool.query('SELECT * FROM gradpath_applications WHERE id = ?', [appId]);
        res.json({ ok: true, data: { application: rows[0] }, message: 'Application updated' });
    } catch (err) {
        console.error('Update error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error updating application' });
    }
});

// PUT /api/applications/:id/status — quick status change
router.put('/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;
    const appId = req.params.id;

    if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
            ok: false,
            error: 'Validation failed',
            details: [{ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }]
        });
    }

    try {
        let query, params;
        if (isAdmin(req)) {
            query = 'SELECT * FROM gradpath_applications WHERE id = ?';
            params = [appId];
        } else {
            query = 'SELECT * FROM gradpath_applications WHERE id = ? AND user_id = ?';
            params = [appId, req.session.userId];
        }
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }

        await pool.query('UPDATE gradpath_applications SET status = ? WHERE id = ?', [status, appId]);

        res.json({ ok: true, data: { status }, message: 'Status updated' });
    } catch (err) {
        console.error('Status update error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error updating status' });
    }
});

// DELETE /api/applications/:id — delete an application
// Admin can delete any; student can only delete their own
router.delete('/:id', requireAuth, async (req, res) => {
    const appId = req.params.id;

    try {
        let query, params;
        if (isAdmin(req)) {
            query = 'DELETE FROM gradpath_applications WHERE id = ?';
            params = [appId];
        } else {
            query = 'DELETE FROM gradpath_applications WHERE id = ? AND user_id = ?';
            params = [appId, req.session.userId];
        }

        const [result] = await pool.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: 'Application not found' });
        }

        res.json({ ok: true, message: 'Application deleted' });
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ ok: false, error: 'Server error deleting application' });
    }
});

module.exports = router;