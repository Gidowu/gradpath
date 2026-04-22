require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const applicationsRoutes = require('./routes/applications');

const app = express();

// ========== MIDDLEWARE ==========

// Parse JSON request bodies
app.use(express.json());

// Session middleware — server-side session with cookie
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'gradpath-dev-secret-change-me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // set true if behind HTTPS
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
);

// ========== API ROUTES ==========

// Auth routes (register, login, logout)
app.use('/auth', authRoutes);

// Application CRUD routes
app.use('/api/applications', applicationsRoutes);

// GET /api/me — Return current logged-in user (checks session)
app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    try {
        const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [
            req.session.userId
        ]);

        if (rows.length === 0) {
            return res.status(401).json({ ok: false, error: 'User not found' });
        }

        const user = rows[0];
        req.session.userRole = user.role || 'student';

        res.json({ ok: true, data: { user } });
    } catch (err) {
        console.error('Error fetching user:', err.message);
        res.status(500).json({ ok: false, error: 'Server error' });
    }
});

// GET /api/hello — Basic scaffold test route
app.get('/api/hello', (req, res) => {
    res.json({ ok: true, data: { message: 'Hello from GradPath API!' } });
});

// GET /api/status — Server and DB status
app.get('/api/status', async (req, res) => {
    let dbStatus = 'disconnected';
    try {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
    } catch (err) {
        dbStatus = 'error';
    }
    res.json({ ok: true, data: { status: 'running', database: dbStatus } });
});

// ========== SERVE REACT FRONTEND ==========

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

module.exports = app;