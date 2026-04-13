require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { pool, initDatabase } = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4100;

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

// Auth routes (login, logout)
app.use('/auth', authRoutes);

// GET /api/me — Return current logged-in user (checks session)
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ user: null, message: 'Not authenticated' });
  }

  try {
    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [
      req.session.userId
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ user: null, message: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/hello — Basic scaffold test route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from GradPath API!' });
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
  res.json({ status: 'running', database: dbStatus });
});

// ========== SERVE REACT FRONTEND ==========

// Serve built React app from ../client/dist
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// SPA fallback — return index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// ========== START SERVER ==========

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`GradPath server running on http://localhost:${PORT}`);
    console.log(`Frontend served from ${clientDistPath}`);
  });
}

start();
