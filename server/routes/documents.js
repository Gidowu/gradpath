const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ ok: false, error: 'You must be logged in' });
  }
  next();
}

// GET /api/documents — list user's documents
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, a.school_name, a.program_name,
        (SELECT COUNT(*) FROM gradpath_doc_reviews WHERE document_id = d.id) AS review_count,
        (SELECT COUNT(*) FROM gradpath_doc_reviews WHERE document_id = d.id AND status = 'completed') AS completed_reviews
      FROM gradpath_documents d
      LEFT JOIN gradpath_applications a ON d.application_id = a.id
      WHERE d.user_id = ?
      ORDER BY d.updated_at DESC
    `, [req.session.userId]);
    res.json({ ok: true, data: { documents: rows } });
  } catch (err) {
    console.error('Documents list error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading documents' });
  }
});

// GET /api/documents/reviews/pending — get documents I need to review
// NOTE: This MUST be above /:id to prevent Express matching "reviews" as an id param
router.get('/reviews/pending', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, d.title, d.doc_type, d.status AS doc_status, u.name AS author_name, u.email AS author_email
      FROM gradpath_doc_reviews r
      JOIN gradpath_documents d ON r.document_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE r.reviewer_id = ?
      ORDER BY r.status ASC, r.created_at DESC
    `, [req.session.userId]);
    res.json({ ok: true, data: { reviews: rows } });
  } catch (err) {
    console.error('Pending reviews error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading reviews' });
  }
});

// GET /api/documents/:id — get a single document with reviews
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [docs] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ?', [req.params.id]);
    if (docs.length === 0) return res.status(404).json({ ok: false, error: 'Document not found' });

    const doc = docs[0];
    // Allow access if owner, reviewer, or admin
    const [reviews] = await pool.query(`
      SELECT r.*, u.name AS reviewer_name, u.email AS reviewer_email
      FROM gradpath_doc_reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.document_id = ?
      ORDER BY r.created_at DESC
    `, [doc.id]);

    const isOwner = doc.user_id === req.session.userId;
    const isReviewer = reviews.some(r => r.reviewer_id === req.session.userId);
    const isAdmin = req.session.userRole === 'admin';

    if (!isOwner && !isReviewer && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'Not authorized to view this document' });
    }

    // Get review comments
    const reviewIds = reviews.map(r => r.id);
    let reviewComments = [];
    if (reviewIds.length > 0) {
      const [comments] = await pool.query(`
        SELECT rc.*, u.name AS author_name
        FROM gradpath_review_comments rc
        JOIN users u ON rc.user_id = u.id
        WHERE rc.review_id IN (?)
        ORDER BY rc.created_at ASC
      `, [reviewIds]);
      reviewComments = comments;
    }

    res.json({ ok: true, data: { document: doc, reviews, reviewComments } });
  } catch (err) {
    console.error('Document get error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error loading document' });
  }
});

// POST /api/documents — create a document
router.post('/', requireAuth, async (req, res) => {
  const { title, doc_type, content, application_id } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ ok: false, error: 'Title is required' });
  if (!content || !content.trim()) return res.status(400).json({ ok: false, error: 'Content is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO gradpath_documents (user_id, application_id, title, doc_type, content) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, application_id || null, title.trim(), doc_type || 'other', content.trim()]
    );
    const [rows] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ?', [result.insertId]);
    res.json({ ok: true, data: { document: rows[0] }, message: 'Document created' });
  } catch (err) {
    console.error('Document create error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error creating document' });
  }
});

// PUT /api/documents/:id — update a document
router.put('/:id', requireAuth, async (req, res) => {
  const { title, doc_type, content, application_id, status } = req.body;
  try {
    const [docs] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    if (docs.length === 0) return res.status(404).json({ ok: false, error: 'Document not found' });

    await pool.query(
      'UPDATE gradpath_documents SET title = ?, doc_type = ?, content = ?, application_id = ?, status = ?, version = version + 1 WHERE id = ?',
      [title || docs[0].title, doc_type || docs[0].doc_type, content || docs[0].content, application_id !== undefined ? application_id : docs[0].application_id, status || docs[0].status, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ?', [req.params.id]);
    res.json({ ok: true, data: { document: updated[0] }, message: 'Document updated' });
  } catch (err) {
    console.error('Document update error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error updating document' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [docs] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ?', [req.params.id]);
    if (docs.length === 0) return res.status(404).json({ ok: false, error: 'Document not found' });
    if (docs[0].user_id !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Not authorized' });
    }
    await pool.query('DELETE FROM gradpath_documents WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Document deleted' });
  } catch (err) {
    console.error('Document delete error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error deleting document' });
  }
});

// POST /api/documents/:id/request-review — invite a user to review
router.post('/:id/request-review', requireAuth, async (req, res) => {
  const { reviewer_email } = req.body;
  if (!reviewer_email) return res.status(400).json({ ok: false, error: 'Reviewer email is required' });

  try {
    const [docs] = await pool.query('SELECT * FROM gradpath_documents WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    if (docs.length === 0) return res.status(404).json({ ok: false, error: 'Document not found' });

    const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [reviewer_email]);
    if (users.length === 0) return res.status(404).json({ ok: false, error: 'User not found. They must have a GradPath account.' });

    if (users[0].id === req.session.userId) return res.status(400).json({ ok: false, error: 'You cannot review your own document' });

    // Check if already invited
    const [existing] = await pool.query(
      'SELECT id FROM gradpath_doc_reviews WHERE document_id = ? AND reviewer_id = ?',
      [req.params.id, users[0].id]
    );
    if (existing.length > 0) return res.status(400).json({ ok: false, error: 'This user has already been invited to review' });

    const [result] = await pool.query(
      'INSERT INTO gradpath_doc_reviews (document_id, reviewer_id) VALUES (?, ?)',
      [req.params.id, users[0].id]
    );
    res.json({ ok: true, data: { review_id: result.insertId, reviewer: users[0] }, message: 'Review request sent' });
  } catch (err) {
    console.error('Request review error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error requesting review' });
  }
});

// PUT /api/documents/reviews/:reviewId — submit review feedback
router.put('/reviews/:reviewId', requireAuth, async (req, res) => {
  const { overall_feedback, rating, status } = req.body;
  try {
    const [reviews] = await pool.query('SELECT * FROM gradpath_doc_reviews WHERE id = ? AND reviewer_id = ?', [req.params.reviewId, req.session.userId]);
    if (reviews.length === 0) return res.status(404).json({ ok: false, error: 'Review not found' });

    await pool.query(
      'UPDATE gradpath_doc_reviews SET overall_feedback = ?, rating = ?, status = ? WHERE id = ?',
      [overall_feedback || reviews[0].overall_feedback, rating || reviews[0].rating, status || 'completed', req.params.reviewId]
    );
    res.json({ ok: true, message: 'Review submitted' });
  } catch (err) {
    console.error('Submit review error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error submitting review' });
  }
});

// POST /api/documents/reviews/:reviewId/comments — add inline comment
router.post('/reviews/:reviewId/comments', requireAuth, async (req, res) => {
  const { content, paragraph_index } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ ok: false, error: 'Comment is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO gradpath_review_comments (review_id, user_id, content, paragraph_index) VALUES (?, ?, ?, ?)',
      [req.params.reviewId, req.session.userId, content.trim(), paragraph_index || null]
    );
    const [rows] = await pool.query(`
      SELECT rc.*, u.name AS author_name
      FROM gradpath_review_comments rc
      JOIN users u ON rc.user_id = u.id
      WHERE rc.id = ?
    `, [result.insertId]);
    res.json({ ok: true, data: { comment: rows[0] } });
  } catch (err) {
    console.error('Review comment error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error posting comment' });
  }
});

module.exports = router;
