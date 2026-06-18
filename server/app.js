require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const applicationsRoutes = require('./routes/applications');
const deadlinesRoutes = require('./routes/deadlines');
const commentsRoutes = require('./routes/comments');
const channelsRoutes = require('./routes/channels');
const messagesRoutes = require('./routes/messages');
const documentsRoutes = require('./routes/documents');
const checklistsRoutes = require('./routes/checklists');

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

// Deadline CRUD routes
app.use('/api/deadlines', deadlinesRoutes);

// Comment routes
app.use('/api/comments', commentsRoutes);

// Chat channels & messages
app.use('/api/channels', channelsRoutes);
app.use('/api/messages', messagesRoutes);

// Documents & peer review
app.use('/api/documents', documentsRoutes);

// Per-school checklists
app.use('/api/checklists', checklistsRoutes);

// GET /api/me — Return current logged-in user (checks session)
app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  try {
    const [rows] = await pool.query('SELECT id, name, email, role, bio, field_of_study, avatar_url FROM users WHERE id = ?', [
      req.session.userId
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'User not found' });
    }

    const user = rows[0];
    // Keep role in session for middleware checks
    req.session.userRole = user.role || 'student';

    res.json({ ok: true, data: { user } });
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ========== ADVISOR ROUTES ==========

// GET /api/advisor/students — list students assigned to this advisor
app.get('/api/advisor/students', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (req.session.userRole !== 'advisor' && req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Advisor access required' });
  }

  try {
    let students;
    if (req.session.userRole === 'admin') {
      // Admin sees all students
      [students] = await pool.query(
        `SELECT u.id, u.name, u.email,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id) AS total_apps,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Applied') AS applied_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Accepted') AS accepted_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Rejected') AS rejected_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Waitlisted') AS waitlisted_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Researching') AS researching_count
         FROM users u WHERE u.role = 'student' ORDER BY u.name`
      );
    } else {
      // Advisor sees only assigned students
      [students] = await pool.query(
        `SELECT u.id, u.name, u.email,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id) AS total_apps,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Applied') AS applied_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Accepted') AS accepted_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Rejected') AS rejected_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Waitlisted') AS waitlisted_count,
         (SELECT COUNT(*) FROM gradpath_applications WHERE user_id = u.id AND status = 'Researching') AS researching_count
         FROM users u WHERE u.role = 'student' AND u.advisor_id = ? ORDER BY u.name`,
        [req.session.userId]
      );
    }
    res.json({ ok: true, data: { students } });
  } catch (err) {
    console.error('Advisor students error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading students' });
  }
});

// GET /api/advisor/students/:id — get a student's applications (read-only)
app.get('/api/advisor/students/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (req.session.userRole !== 'advisor' && req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Advisor access required' });
  }

  const studentId = req.params.id;
  try {
    // Get student info
    const [userRows] = await pool.query('SELECT id, name, email FROM users WHERE id = ? AND role = ?', [studentId, 'student']);
    if (userRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Student not found' });
    }

    // Get their applications
    const [apps] = await pool.query(
      'SELECT * FROM gradpath_applications WHERE user_id = ? ORDER BY created_at DESC',
      [studentId]
    );

    // Get their deadlines
    const [deadlines] = await pool.query(
      `SELECT d.*, a.school_name, a.program_name
       FROM gradpath_deadlines d
       JOIN gradpath_applications a ON d.application_id = a.id
       WHERE a.user_id = ?
       ORDER BY d.due_date ASC`,
      [studentId]
    );

    res.json({
      ok: true,
      data: {
        student: userRows[0],
        applications: apps,
        deadlines: deadlines
      }
    });
  } catch (err) {
    console.error('Advisor student detail error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading student data' });
  }
});

// ========== ADMIN ROUTES ==========

// GET /api/admin/users — list all users (admin only)
app.get('/api/admin/users', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, role, advisor_id FROM users ORDER BY role, name'
    );
    res.json({ ok: true, data: { users } });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading users' });
  }
});

// GET /api/advisors — list all advisors (for dropdowns)
app.get('/api/advisors', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  try {
    const [advisors] = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'advisor' ORDER BY name"
    );
    res.json({ ok: true, data: { advisors } });
  } catch (err) {
    console.error('Advisors list error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading advisors' });
  }
});

// PUT /api/admin/assign-advisor — admin assigns advisor to student
app.put('/api/admin/assign-advisor', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  const { studentId, advisorId } = req.body;
  if (!studentId) {
    return res.status(400).json({ ok: false, error: 'Student ID is required' });
  }

  try {
    await pool.query('UPDATE users SET advisor_id = ? WHERE id = ? AND role = ?', [
      advisorId || null,
      studentId,
      'student'
    ]);
    res.json({ ok: true, message: 'Advisor assigned successfully' });
  } catch (err) {
    console.error('Assign advisor error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error assigning advisor' });
  }
});

// PUT /api/profile — update user profile
app.put('/api/profile', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  const { name, bio, field_of_study, avatar_url } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name = COALESCE(?, name), bio = ?, field_of_study = ?, avatar_url = ? WHERE id = ?',
      [name || null, bio || null, field_of_study || null, avatar_url || null, req.session.userId]
    );
    const [rows] = await pool.query('SELECT id, name, email, role, bio, field_of_study, avatar_url FROM users WHERE id = ?', [req.session.userId]);
    res.json({ ok: true, data: { user: rows[0] }, message: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error updating profile' });
  }
});

// GET /api/users/search?q=email — search users (for peer review invites)
app.get('/api/users/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  const q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ ok: false, error: 'Search query too short' });
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, field_of_study FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10',
      [`%${q}%`, `%${q}%`, req.session.userId]
    );
    res.json({ ok: true, data: { users: rows } });
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/stats — dashboard analytics
app.get('/api/stats', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  try {
    const userId = req.session.userId;
    const [apps] = await pool.query('SELECT status, COUNT(*) as count FROM gradpath_applications WHERE user_id = ? GROUP BY status', [userId]);
    const [totalApps] = await pool.query('SELECT COUNT(*) as total FROM gradpath_applications WHERE user_id = ?', [userId]);
    const [totalDeadlines] = await pool.query(
      'SELECT COUNT(*) as total FROM gradpath_deadlines d JOIN gradpath_applications a ON d.application_id = a.id WHERE a.user_id = ?', [userId]
    );
    const [completedDeadlines] = await pool.query(
      'SELECT COUNT(*) as total FROM gradpath_deadlines d JOIN gradpath_applications a ON d.application_id = a.id WHERE a.user_id = ? AND d.is_completed = 1', [userId]
    );
    const [upcomingDeadlines] = await pool.query(
      `SELECT d.*, a.school_name, a.program_name FROM gradpath_deadlines d
       JOIN gradpath_applications a ON d.application_id = a.id
       WHERE a.user_id = ? AND d.is_completed = 0 AND d.due_date >= CURDATE()
       ORDER BY d.due_date ASC LIMIT 5`, [userId]
    );
    const [docCount] = await pool.query('SELECT COUNT(*) as total FROM gradpath_documents WHERE user_id = ?', [userId]);
    const [pendingReviews] = await pool.query(
      "SELECT COUNT(*) as total FROM gradpath_doc_reviews WHERE reviewer_id = ? AND status != 'completed'", [userId]
    );

    res.json({
      ok: true,
      data: {
        statusBreakdown: apps,
        totalApplications: totalApps[0].total,
        totalDeadlines: totalDeadlines[0].total,
        completedDeadlines: completedDeadlines[0].total,
        upcomingDeadlines,
        documentCount: docCount[0].total,
        pendingReviews: pendingReviews[0].total
      }
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading stats' });
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

// Serve built React app from ../client/dist
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// SPA fallback — return index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

module.exports = app;
