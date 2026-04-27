import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // Applications state
  const [applications, setApplications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    school_name: '',
    program_name: '',
    program_type: 'MS',
    fit_level: 'Match',
    status: 'Researching',
    app_deadline: '',
    decision_date: '',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const defaultForm = {
    school_name: '', program_name: '', program_type: 'MS', fit_level: 'Match',
    status: 'Researching', app_deadline: '', decision_date: '', notes: ''
  };

  // Parse { ok, data, error, details } response
  function parseFieldErrors(details) {
    const map = {};
    if (Array.isArray(details)) {
      details.forEach(d => { if (d.field) map[d.field] = d.message; });
    }
    return map;
  }

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data && data.data.user) setUser(data.data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadApplications();
  }, [user]);

  const loadApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setApplications(data.data.applications);
      }
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const switchPage = (p) => {
    setPage(p); setError(''); setFieldErrors({});
    setName(''); setEmail(''); setPassword(''); setShowPassword(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); setFieldErrors({});
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (data.ok) {
        setUser(data.data.user);
      } else {
        setError(data.error || 'Registration failed');
        if (data.details) setFieldErrors(parseFieldErrors(data.details));
      }
    } catch { setError('Could not connect to server'); }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(''); setFieldErrors({});
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.ok) {
        setUser(data.data.user);
      } else {
        setError(data.error || 'Login failed');
        if (data.details) setFieldErrors(parseFieldErrors(data.details));
      }
    } catch { setError('Could not connect to server'); }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setApplications([]);
      setEmail(''); setPassword(''); setName('');
      setError(''); setFieldErrors({});
      setPage('signin');
    } catch (err) { console.error('Logout failed:', err); }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setFormErrors({});
    setShowForm(true);
  };

  const openEditForm = (app) => {
    setEditingId(app.id);
    setFormData({
      school_name: app.school_name || '',
      program_name: app.program_name || '',
      program_type: app.program_type || 'MS',
      fit_level: app.fit_level || 'Match',
      status: app.status || 'Researching',
      app_deadline: app.app_deadline ? app.app_deadline.slice(0, 10) : '',
      decision_date: app.decision_date ? app.decision_date.slice(0, 10) : '',
      notes: app.notes || ''
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const url = editingId ? `/api/applications/${editingId}` : '/api/applications';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData(defaultForm);
        loadApplications();
      } else {
        if (data.details) setFormErrors(parseFieldErrors(data.details));
      }
    } catch (err) { console.error('Submit failed:', err); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/applications/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.ok) loadApplications();
    } catch (err) { console.error('Status change failed:', err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this application?')) return;
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) loadApplications();
    } catch (err) { console.error('Delete failed:', err); }
  };

  const statusBadge = (status) => {
    const colors = {
      Researching: 'secondary', Applied: 'primary',
      Accepted: 'success', Rejected: 'danger', Waitlisted: 'warning'
    };
    return `badge bg-${colors[status] || 'secondary'}`;
  };

  const fitBadge = (fit) => {
    const colors = { Safety: 'success', Match: 'info', Reach: 'warning' };
    return `badge bg-${colors[fit] || 'secondary'} bg-opacity-75`;
  };

  const roleBadge = user && user.role === 'admin'
    ? <span className="badge bg-danger ms-2">Admin</span>
    : <span className="badge bg-info ms-2">Student</span>;

  // Helper for field error display
  const fieldErr = (map, field) => map[field]
    ? <div className="text-danger small mt-1"><i className="bi bi-exclamation-circle me-1"></i>{map[field]}</div>
    : null;

  if (loading) {
    return (
      <div className="gp-loading">
        <div className="spinner-border text-light" role="status"></div>
      </div>
    );
  }

  return (
    <>
      <nav className="gp-navbar navbar navbar-dark py-3">
        <div className="container">
          <a className="navbar-brand gp-brand text-white" href="/">
            <i className="bi bi-mortarboard-fill me-2"></i>GradPath
          </a>
          {user && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-white gp-user-badge d-none d-sm-inline-flex align-items-center gap-2">
                <i className="bi bi-person-circle"></i>{user.name}{roleBadge}
              </span>
              <button onClick={handleLogout} className="btn btn-outline-light btn-sm rounded-pill px-3">
                <i className="bi bi-box-arrow-right me-1"></i>Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="gp-hero">
        {user ? (
          /* ===== DASHBOARD ===== */
          <div className="container py-4" style={{ maxWidth: '1100px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-0 text-white">
                  {user.role === 'admin' ? 'All Applications (Admin)' : 'Your Applications'}
                </h2>
                <p className="text-white-50 mb-0">
                  {user.role === 'admin'
                    ? 'Viewing all users\' applications'
                    : 'Track and manage your graduate school journey'}
                </p>
              </div>
              <button className="btn btn-light rounded-pill px-4 shadow-sm" onClick={() => showForm ? setShowForm(false) : openAddForm()}>
                <i className="bi bi-plus-circle me-2"></i>
                {showForm ? 'Cancel' : 'Add Application'}
              </button>
            </div>

            {/* ===== ADD / EDIT FORM ===== */}
            {showForm && (
              <div className="card gp-welcome-card mb-4">
                <div className="gp-card-accent"></div>
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-3" style={{ color: '#1a3c6e' }}>
                    <i className={`bi ${editingId ? 'bi-pencil-square' : 'bi-plus-square'} me-2`}></i>
                    {editingId ? 'Edit Application' : 'New Application'}
                  </h5>
                  <form onSubmit={handleSubmitApplication}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">School Name *</label>
                        <input type="text" className={`form-control gp-form-control ${formErrors.school_name ? 'is-invalid' : ''}`}
                          value={formData.school_name}
                          onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                          placeholder="Harvard University" />
                        {fieldErr(formErrors, 'school_name')}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Program Name *</label>
                        <input type="text" className={`form-control gp-form-control ${formErrors.program_name ? 'is-invalid' : ''}`}
                          value={formData.program_name}
                          onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                          placeholder="Computer Science" />
                        {fieldErr(formErrors, 'program_name')}
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Degree Type</label>
                        <select className={`form-select gp-form-control ${formErrors.program_type ? 'is-invalid' : ''}`}
                          value={formData.program_type}
                          onChange={(e) => setFormData({ ...formData, program_type: e.target.value })}>
                          <option value="MS">MS</option>
                          <option value="PhD">PhD</option>
                          <option value="MBA">MBA</option>
                          <option value="Other">Other</option>
                        </select>
                        {fieldErr(formErrors, 'program_type')}
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Fit Level</label>
                        <select className={`form-select gp-form-control ${formErrors.fit_level ? 'is-invalid' : ''}`}
                          value={formData.fit_level}
                          onChange={(e) => setFormData({ ...formData, fit_level: e.target.value })}>
                          <option value="Safety">Safety</option>
                          <option value="Match">Match</option>
                          <option value="Reach">Reach</option>
                        </select>
                        {fieldErr(formErrors, 'fit_level')}
                      </div>
                      {editingId && (
                        <div className="col-md-4">
                          <label className="form-label fw-semibold">Status</label>
                          <select className={`form-select gp-form-control ${formErrors.status ? 'is-invalid' : ''}`}
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                            <option value="Researching">Researching</option>
                            <option value="Applied">Applied</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Waitlisted">Waitlisted</option>
                          </select>
                          {fieldErr(formErrors, 'status')}
                        </div>
                      )}
                      <div className={editingId ? 'col-md-6' : 'col-md-4'}>
                        <label className="form-label fw-semibold">Application Deadline</label>
                        <input type="date" className={`form-control gp-form-control ${formErrors.app_deadline ? 'is-invalid' : ''}`}
                          value={formData.app_deadline}
                          onChange={(e) => setFormData({ ...formData, app_deadline: e.target.value })} />
                        {fieldErr(formErrors, 'app_deadline')}
                      </div>
                      <div className={editingId ? 'col-md-6' : 'col-md-4'}>
                        <label className="form-label fw-semibold">Decision Date</label>
                        <input type="date" className={`form-control gp-form-control ${formErrors.decision_date ? 'is-invalid' : ''}`}
                          value={formData.decision_date}
                          onChange={(e) => setFormData({ ...formData, decision_date: e.target.value })} />
                        {fieldErr(formErrors, 'decision_date')}
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Notes</label>
                        <textarea className="form-control gp-form-control" rows="2"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="GRE required, letters of rec due by..."></textarea>
                      </div>
                      <div className="col-12">
                        <button type="submit" className="btn btn-primary gp-btn-login text-white">
                          <i className={`bi ${editingId ? 'bi-save' : 'bi-check-circle'} me-2`}></i>
                          {editingId ? 'Save Changes' : 'Save Application'}
                        </button>
                        {editingId && (
                          <button type="button" className="btn btn-outline-secondary ms-2 rounded-pill"
                            onClick={() => { setShowForm(false); setEditingId(null); setFormData(defaultForm); }}>
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ===== APPLICATION LIST ===== */}
            {applications.length === 0 ? (
              <div className="card gp-welcome-card text-center p-5">
                <div className="py-4">
                  <i className="bi bi-inbox text-muted" style={{ fontSize: '3rem' }}></i>
                  <h4 className="mt-3" style={{ color: '#1a3c6e' }}>No applications yet</h4>
                  <p className="text-muted">Click "Add Application" to get started</p>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {applications.map(app => (
                  <div key={app.id} className="col-md-6 col-lg-4">
                    <div className="card gp-welcome-card h-100">
                      <div className="gp-card-accent"></div>
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <h6 className="fw-bold mb-1" style={{ color: '#1a3c6e' }}>{app.school_name}</h6>
                            <p className="text-muted small mb-1">{app.program_name} ({app.program_type})</p>
                          </div>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-link text-primary p-0 me-2" onClick={() => openEditForm(app)}
                              title="Edit">
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleDelete(app.id)}
                              title="Delete">
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>

                        <div className="d-flex gap-2 mb-2">
                          <span className={statusBadge(app.status)}>{app.status}</span>
                          <span className={fitBadge(app.fit_level)}>{app.fit_level}</span>
                        </div>

                        {/* Admin: show who owns this application */}
                        {user.role === 'admin' && app.user_name && (
                          <p className="small mb-1">
                            <i className="bi bi-person me-1 text-muted"></i>
                            <span className="text-muted">{app.user_name} ({app.user_email})</span>
                          </p>
                        )}

                        {app.app_deadline && (
                          <p className="small text-muted mb-1">
                            <i className="bi bi-calendar-event me-1"></i>
                            Deadline: {new Date(app.app_deadline).toLocaleDateString()}
                          </p>
                        )}
                        {app.decision_date && (
                          <p className="small text-muted mb-1">
                            <i className="bi bi-calendar-check me-1"></i>
                            Decision: {new Date(app.decision_date).toLocaleDateString()}
                          </p>
                        )}
                        {app.notes && (
                          <p className="small text-muted mb-2 fst-italic">"{app.notes}"</p>
                        )}

                        <label className="small text-muted mb-1">Update Status:</label>
                        <select className="form-select form-select-sm" value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}>
                          <option value="Researching">Researching</option>
                          <option value="Applied">Applied</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Waitlisted">Waitlisted</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : page === 'signup' ? (
          /* ===== SIGN UP ===== */
          <div>
            <div className="gp-login-card card">
              <div className="gp-card-accent"></div>
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="gp-icon-circle mb-3">
                    <i className="bi bi-person-plus-fill text-white" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h3 className="fw-bold" style={{ color: '#1a3c6e' }}>Create Account</h3>
                  <p className="text-muted mb-0">Start tracking your grad school applications</p>
                </div>
                <form onSubmit={handleSignUp}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">Full Name</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text"><i className="bi bi-person"></i></span>
                      <input type="text" className={`form-control gp-form-control with-icon ${fieldErrors.name ? 'is-invalid' : ''}`}
                        value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
                    </div>
                    {fieldErr(fieldErrors, 'name')}
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">Email Address</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text"><i className="bi bi-envelope"></i></span>
                      <input type="email" className={`form-control gp-form-control with-icon ${fieldErrors.email ? 'is-invalid' : ''}`}
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kenyon.edu" />
                    </div>
                    {fieldErr(fieldErrors, 'email')}
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold text-dark">Password</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text"><i className="bi bi-lock"></i></span>
                      <input type={showPassword ? 'text' : 'password'} className={`form-control gp-form-control with-icon ${fieldErrors.password ? 'is-invalid' : ''}`}
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" minLength={4} />
                      <button type="button" className="input-group-text gp-input-icon"
                        style={{ borderLeft: 'none', borderRight: '2px solid #e2e8f0', borderRadius: '0 10px 10px 0', cursor: 'pointer' }}
                        onClick={() => setShowPassword(!showPassword)}>
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    {fieldErr(fieldErrors, 'password')}
                  </div>
                  {error && <div className="alert alert-danger py-2 rounded-3"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}
                  <button type="submit" className="btn btn-primary gp-btn-login w-100 text-white">
                    <i className="bi bi-person-check me-2"></i>Create Account
                  </button>
                </form>
                <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                    Already have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchPage('signin'); }} className="fw-semibold text-decoration-none" style={{ color: '#2e86c1' }}>Sign In</a>
                  </p>
                </div>
              </div>
            </div>
          </div>

        ) : (
          /* ===== SIGN IN ===== */
          <div>
            <div className="gp-login-card card">
              <div className="gp-card-accent"></div>
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="gp-icon-circle mb-3">
                    <i className="bi bi-mortarboard-fill text-white" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h3 className="fw-bold" style={{ color: '#1a3c6e' }}>Welcome Back</h3>
                  <p className="text-muted mb-0">Sign in to continue your journey</p>
                </div>
                <form onSubmit={handleSignIn}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">Email Address</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text"><i className="bi bi-envelope"></i></span>
                      <input type="email" className={`form-control gp-form-control with-icon ${fieldErrors.email ? 'is-invalid' : ''}`}
                        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kenyon.edu" />
                    </div>
                    {fieldErr(fieldErrors, 'email')}
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold text-dark">Password</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text"><i className="bi bi-lock"></i></span>
                      <input type={showPassword ? 'text' : 'password'} className={`form-control gp-form-control with-icon ${fieldErrors.password ? 'is-invalid' : ''}`}
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
                      <button type="button" className="input-group-text gp-input-icon"
                        style={{ borderLeft: 'none', borderRight: '2px solid #e2e8f0', borderRadius: '0 10px 10px 0', cursor: 'pointer' }}
                        onClick={() => setShowPassword(!showPassword)}>
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    {fieldErr(fieldErrors, 'password')}
                  </div>
                  {error && <div className="alert alert-danger py-2 rounded-3"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}
                  <button type="submit" className="btn btn-primary gp-btn-login w-100 text-white">
                    <i className="bi bi-arrow-right-circle me-2"></i>Sign In
                  </button>
                </form>
                <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                    Don't have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchPage('signup'); }} className="fw-semibold text-decoration-none" style={{ color: '#2e86c1' }}>Sign Up</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="gp-footer">
        GradPath &copy; 2026 &middot; Kenyon College
      </footer>
    </>
  );
}

export default App;