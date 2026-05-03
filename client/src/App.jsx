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
  const [signupRole, setSignupRole] = useState('student');

  // Tab state: 'applications' | 'deadlines' | 'users' (admin only)
  const [activeTab, setActiveTab] = useState('applications');

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

  // Deadlines state
  const [deadlines, setDeadlines] = useState([]);
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [deadlineFormData, setDeadlineFormData] = useState({
    application_id: '',
    title: '',
    due_date: '',
    reminder_date: '',
    notes: ''
  });
  const [deadlineFormErrors, setDeadlineFormErrors] = useState({});

  // Advisor system state
  const [advisorStudents, setAdvisorStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentApps, setStudentApps] = useState([]);
  const [studentDeadlines, setStudentDeadlines] = useState([]);

  // Comments state
  const [commentsMap, setCommentsMap] = useState({});
  const [commentingOnApp, setCommentingOnApp] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Admin user management state
  const [allUsers, setAllUsers] = useState([]);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addUserData, setAddUserData] = useState({ name: '', email: '', password: '', role: 'student' });
  const [addUserError, setAddUserError] = useState('');

  const defaultDeadlineForm = {
    application_id: '', title: '', due_date: '', reminder_date: '', notes: ''
  };

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
    if (user) {
      if (user.role === 'advisor') {
        loadAdvisorStudents();
      } else {
        loadApplications();
        loadDeadlines();
        if (user.role === 'admin') loadAllUsers();
      }
    }
  }, [user]);

  // ===== COMMENTS =====

  const loadAllComments = async (apps) => {
    if (!apps || apps.length === 0) return;
    const results = await Promise.all(
      apps.map(app =>
        fetch(`/api/comments/${app.id}`, { credentials: 'include' })
          .then(r => r.json())
          .then(d => ({ appId: app.id, comments: d.ok && d.data?.comments ? d.data.comments : [] }))
          .catch(() => ({ appId: app.id, comments: [] }))
      )
    );
    const map = {};
    results.forEach(({ appId, comments }) => { map[appId] = comments; });
    setCommentsMap(prev => ({ ...prev, ...map }));
  };

  const handlePostComment = async (appId) => {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ application_id: appId, content: newCommentText.trim() })
      });
      const data = await res.json();
      if (data.ok) {
        setCommentingOnApp(null);
        setNewCommentText('');
        const res2 = await fetch(`/api/comments/${appId}`, { credentials: 'include' });
        const data2 = await res2.json();
        if (data2.ok) {
          setCommentsMap(prev => ({ ...prev, [appId]: data2.data?.comments || [] }));
        }
      }
    } catch (err) { console.error('Post comment failed:', err); }
  };

  const handleDeleteComment = async (commentId, appId) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setCommentsMap(prev => ({
          ...prev,
          [appId]: (prev[appId] || []).filter(c => c.id !== commentId)
        }));
      }
    } catch (err) { console.error('Delete comment failed:', err); }
  };

  // ===== APPLICATIONS =====

  const loadApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        const apps = data.data.applications;
        setApplications(apps);
        loadAllComments(apps);
      }
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const loadDeadlines = async () => {
    try {
      const res = await fetch('/api/deadlines', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setDeadlines(data.data.deadlines);
      }
    } catch (err) {
      console.error('Load deadlines failed:', err);
    }
  };

  // ===== ADVISOR =====

  const loadAdvisorStudents = async () => {
    try {
      const res = await fetch('/api/advisor/students', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.data?.students) setAdvisorStudents(data.data.students);
    } catch (err) { console.error('Load advisor students failed:', err); }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    setCommentingOnApp(null);
    setNewCommentText('');
    try {
      const [appsRes, dlsRes] = await Promise.all([
        fetch(`/api/advisor/students/${student.id}/applications`, { credentials: 'include' }),
        fetch(`/api/advisor/students/${student.id}/deadlines`, { credentials: 'include' })
      ]);
      const [appsData, dlsData] = await Promise.all([appsRes.json(), dlsRes.json()]);
      if (appsData.ok && appsData.data?.applications) {
        setStudentApps(appsData.data.applications);
        loadAllComments(appsData.data.applications);
      }
      if (dlsData.ok && dlsData.data?.deadlines) setStudentDeadlines(dlsData.data.deadlines);
    } catch (err) { console.error('Load student data failed:', err); }
  };

  // ===== ADMIN =====

  const loadAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.data?.users) setAllUsers(data.data.users);
    } catch (err) { console.error('Load all users failed:', err); }
  };

  const handleAssignAdvisor = async (userId, advisorId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/advisor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ advisorId: advisorId ? parseInt(advisorId) : null })
      });
      const data = await res.json();
      if (data.ok) loadAllUsers();
    } catch (err) { console.error('Assign advisor failed:', err); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Remove this user? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) loadAllUsers();
      else alert(data.error || 'Failed to remove user');
    } catch (err) { console.error('Delete user failed:', err); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(addUserData)
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddUserForm(false);
        setAddUserData({ name: '', email: '', password: '', role: 'student' });
        loadAllUsers();
      } else {
        setAddUserError(data.error || 'Failed to create user');
      }
    } catch (err) { setAddUserError('Could not connect to server'); }
  };

  // ===== DEADLINES =====

  const openAddDeadline = () => {
    setEditingDeadlineId(null);
    setDeadlineFormData({ ...defaultDeadlineForm, application_id: applications.length > 0 ? String(applications[0].id) : '' });
    setDeadlineFormErrors({});
    setShowDeadlineForm(true);
  };

  const openEditDeadline = (dl) => {
    setEditingDeadlineId(dl.id);
    setDeadlineFormData({
      application_id: String(dl.application_id),
      title: dl.title || '',
      due_date: dl.due_date ? dl.due_date.slice(0, 10) : '',
      reminder_date: dl.reminder_date ? dl.reminder_date.slice(0, 10) : '',
      notes: dl.notes || ''
    });
    setDeadlineFormErrors({});
    setShowDeadlineForm(true);
  };

  const handleSubmitDeadline = async (e) => {
    e.preventDefault();
    setDeadlineFormErrors({});
    const url = editingDeadlineId ? `/api/deadlines/${editingDeadlineId}` : '/api/deadlines';
    const method = editingDeadlineId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(deadlineFormData)
      });
      const data = await res.json();
      if (data.ok) {
        setShowDeadlineForm(false);
        setEditingDeadlineId(null);
        setDeadlineFormData(defaultDeadlineForm);
        loadDeadlines();
      } else {
        if (data.details) setDeadlineFormErrors(parseFieldErrors(data.details));
      }
    } catch (err) { console.error('Deadline submit failed:', err); }
  };

  const handleToggleDeadline = async (id) => {
    try {
      const res = await fetch(`/api/deadlines/${id}/complete`, { method: 'PUT', credentials: 'include' });
      const data = await res.json();
      if (data.ok) loadDeadlines();
    } catch (err) { console.error('Toggle deadline failed:', err); }
  };

  const handleDeleteDeadline = async (id) => {
    if (!confirm('Delete this deadline?')) return;
    try {
      const res = await fetch(`/api/deadlines/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) loadDeadlines();
    } catch (err) { console.error('Delete deadline failed:', err); }
  };

  const deadlineUrgency = (dueDateStr, isCompleted) => {
    if (isCompleted) return 'success';
    const now = new Date();
    const due = new Date(dueDateStr);
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'danger';
    if (daysLeft <= 3) return 'warning';
    if (daysLeft <= 7) return 'info';
    return 'secondary';
  };

  // ===== AUTH =====

  const switchPage = (p) => {
    setPage(p); setError(''); setFieldErrors({});
    setName(''); setEmail(''); setPassword(''); setShowPassword(false); setSignupRole('student');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); setFieldErrors({});
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, role: signupRole })
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
      setDeadlines([]);
      setAdvisorStudents([]);
      setSelectedStudentId(null);
      setSelectedStudent(null);
      setStudentApps([]);
      setStudentDeadlines([]);
      setCommentsMap({});
      setAllUsers([]);
      setEmail(''); setPassword(''); setName('');
      setError(''); setFieldErrors({});
      setActiveTab('applications');
      setPage('signin');
    } catch (err) { console.error('Logout failed:', err); }
  };

  // ===== APPLICATION FORM =====

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

  // ===== HELPERS =====

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
    : user && user.role === 'advisor'
    ? <span className="badge bg-warning ms-2">Advisor</span>
    : <span className="badge bg-info ms-2">Student</span>;

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

  // ===== ADVISOR DASHBOARD =====

  const renderAdvisorDashboard = () => (
    <div className="container py-4" style={{ maxWidth: '1100px' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="fw-bold mb-0 text-white">Advisor Dashboard</h2>
          <p className="text-white-50 mb-0">
            {selectedStudentId ? `Viewing ${selectedStudent?.name}'s applications` : 'Manage your student roster'}
          </p>
        </div>
        {selectedStudentId && (
          <button
            className="btn btn-outline-light rounded-pill px-4"
            onClick={() => { setSelectedStudentId(null); setSelectedStudent(null); setStudentApps([]); setStudentDeadlines([]); setCommentingOnApp(null); }}>
            <i className="bi bi-arrow-left me-2"></i>Back to Roster
          </button>
        )}
      </div>

      {selectedStudentId ? (
        <>
          {studentApps.length === 0 ? (
            <div className="card gp-welcome-card text-center p-5">
              <div className="py-4">
                <i className="bi bi-inbox text-muted" style={{ fontSize: '3rem' }}></i>
                <h4 className="mt-3" style={{ color: '#1a3c6e' }}>No applications yet</h4>
                <p className="text-muted">This student has not added any applications</p>
              </div>
            </div>
          ) : (
            <div className="row g-3">
              {studentApps.map(app => (
                <div key={app.id} className="col-md-6 col-lg-4">
                  <div className="card gp-welcome-card h-100">
                    <div className="gp-card-accent"></div>
                    <div className="card-body p-3">
                      <h6 className="fw-bold mb-1" style={{ color: '#1a3c6e' }}>{app.school_name}</h6>
                      <p className="text-muted small mb-1">{app.program_name} ({app.program_type})</p>
                      <div className="d-flex gap-2 mb-2">
                        <span className={statusBadge(app.status)}>{app.status}</span>
                        <span className={fitBadge(app.fit_level)}>{app.fit_level}</span>
                      </div>
                      {app.app_deadline && (
                        <p className="small text-muted mb-1">
                          <i className="bi bi-calendar-event me-1"></i>
                          Deadline: {new Date(app.app_deadline).toLocaleDateString()}
                        </p>
                      )}
                      {app.notes && (
                        <p className="small text-muted mb-2 fst-italic">"{app.notes}"</p>
                      )}

                      {/* Comments section */}
                      <div className="mt-2 pt-2 border-top">
                        <small className="fw-semibold text-muted">
                          <i className="bi bi-chat-quote me-1"></i>Feedback
                        </small>
                        {(commentsMap[app.id] || []).map(c => (
                          <div key={c.id} className="small p-2 mt-1 bg-light rounded">
                            <div className="d-flex justify-content-between">
                              <span className="text-muted fw-semibold">{c.author_name}</span>
                              <button
                                className="btn btn-sm btn-link text-danger p-0"
                                style={{ fontSize: '0.7rem' }}
                                onClick={() => handleDeleteComment(c.id, app.id)}>
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                            <div>{c.content}</div>
                          </div>
                        ))}

                        {commentingOnApp === app.id ? (
                          <div className="mt-2 d-flex gap-2">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Add feedback..."
                              value={newCommentText}
                              onChange={e => setNewCommentText(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handlePostComment(app.id)}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => handlePostComment(app.id)}>Post</button>
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => { setCommentingOnApp(null); setNewCommentText(''); }}>✕</button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-primary mt-2"
                            onClick={() => { setCommentingOnApp(app.id); setNewCommentText(''); }}>
                            <i className="bi bi-plus me-1"></i>Add Feedback
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Student's deadlines summary */}
          {studentDeadlines.length > 0 && (
            <div className="mt-4">
              <h5 className="text-white mb-3"><i className="bi bi-alarm me-2"></i>Deadlines</h5>
              <div className="row g-2">
                {studentDeadlines.map(dl => (
                  <div key={dl.id} className="col-md-4">
                    <div className={`card gp-welcome-card ${dl.is_completed ? 'opacity-75' : ''}`}>
                      <div className="card-body p-2 d-flex justify-content-between align-items-center">
                        <div>
                          <div className="small fw-semibold" style={{ color: '#1a3c6e' }}>{dl.title}</div>
                          <div className="small text-muted">{dl.school_name} · {new Date(dl.due_date).toLocaleDateString()}</div>
                        </div>
                        <span className={`badge bg-${deadlineUrgency(dl.due_date, dl.is_completed)}`}>
                          {dl.is_completed ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        advisorStudents.length === 0 ? (
          <div className="card gp-welcome-card text-center p-5">
            <div className="py-4">
              <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
              <h4 className="mt-3" style={{ color: '#1a3c6e' }}>No students assigned</h4>
              <p className="text-muted">Ask an admin to assign students to your account</p>
            </div>
          </div>
        ) : (
          <div className="row g-3">
            {advisorStudents.map(student => (
              <div key={student.id} className="col-md-6 col-lg-4">
                <div
                  className="card gp-welcome-card h-100"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelectStudent(student)}>
                  <div className="gp-card-accent"></div>
                  <div className="card-body p-3">
                    <h6 className="fw-bold mb-1" style={{ color: '#1a3c6e' }}>
                      <i className="bi bi-person-circle me-2"></i>{student.name}
                    </h6>
                    <p className="text-muted small mb-2">{student.email}</p>
                    <div className="d-flex gap-1 flex-wrap">
                      <span className="badge bg-secondary">{student.app_count || 0} apps</span>
                      {student.accepted_count > 0 && <span className="badge bg-success">{student.accepted_count} accepted</span>}
                      {student.applied_count > 0 && <span className="badge bg-primary">{student.applied_count} applied</span>}
                      {student.waitlisted_count > 0 && <span className="badge bg-warning">{student.waitlisted_count} waitlisted</span>}
                      {student.rejected_count > 0 && <span className="badge bg-danger">{student.rejected_count} rejected</span>}
                      {student.researching_count > 0 && <span className="badge bg-secondary">{student.researching_count} researching</span>}
                    </div>
                    <div className="mt-2 text-muted small">
                      <i className="bi bi-arrow-right me-1"></i>Click to view applications
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );

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
          user.role === 'advisor' ? renderAdvisorDashboard() : (

            /* ===== STUDENT / ADMIN DASHBOARD ===== */
            <div className="container py-4" style={{ maxWidth: '1100px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h2 className="fw-bold mb-0 text-white">
                    {user.role === 'admin' ? 'Admin Dashboard' : 'Your Dashboard'}
                  </h2>
                  <p className="text-white-50 mb-0">
                    {user.role === 'admin'
                      ? 'Viewing all users\' data'
                      : 'Track and manage your graduate school journey'}
                  </p>
                </div>
                {activeTab === 'applications' ? (
                  <button className="btn btn-light rounded-pill px-4 shadow-sm" onClick={() => showForm ? setShowForm(false) : openAddForm()}>
                    <i className="bi bi-plus-circle me-2"></i>
                    {showForm ? 'Cancel' : 'Add Application'}
                  </button>
                ) : activeTab === 'deadlines' ? (
                  <button className="btn btn-light rounded-pill px-4 shadow-sm" onClick={() => showDeadlineForm ? setShowDeadlineForm(false) : openAddDeadline()}>
                    <i className="bi bi-plus-circle me-2"></i>
                    {showDeadlineForm ? 'Cancel' : 'Add Deadline'}
                  </button>
                ) : null}
              </div>

              {/* ===== TAB NAVIGATION ===== */}
              <ul className="nav nav-pills mb-4">
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === 'applications' ? 'active' : 'text-white'}`}
                    style={activeTab === 'applications' ? { backgroundColor: '#fff', color: '#1a3c6e' } : {}}
                    onClick={() => { setActiveTab('applications'); setShowDeadlineForm(false); }}>
                    <i className="bi bi-mortarboard me-1"></i>Applications
                    <span className="badge bg-secondary ms-2">{applications.length}</span>
                  </button>
                </li>
                <li className="nav-item ms-2">
                  <button className={`nav-link ${activeTab === 'deadlines' ? 'active' : 'text-white'}`}
                    style={activeTab === 'deadlines' ? { backgroundColor: '#fff', color: '#1a3c6e' } : {}}
                    onClick={() => { setActiveTab('deadlines'); setShowForm(false); }}>
                    <i className="bi bi-alarm me-1"></i>Deadlines
                    <span className="badge bg-secondary ms-2">{deadlines.filter(d => !d.is_completed).length}</span>
                  </button>
                </li>
                {user.role === 'admin' && (
                  <li className="nav-item ms-2">
                    <button className={`nav-link ${activeTab === 'users' ? 'active' : 'text-white'}`}
                      style={activeTab === 'users' ? { backgroundColor: '#fff', color: '#1a3c6e' } : {}}
                      onClick={() => { setActiveTab('users'); setShowForm(false); setShowDeadlineForm(false); }}>
                      <i className="bi bi-people me-1"></i>Manage Users
                    </button>
                  </li>
                )}
              </ul>

              {/* ===== APPLICATIONS TAB ===== */}
              {activeTab === 'applications' && (<>

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

                            {/* Advisor Feedback */}
                            {commentsMap[app.id] && commentsMap[app.id].length > 0 && (
                              <div className="mt-2 pt-2 border-top">
                                <small className="fw-semibold text-muted">
                                  <i className="bi bi-chat-quote me-1"></i>Advisor Feedback
                                </small>
                                {commentsMap[app.id].map(c => (
                                  <div key={c.id} className="small p-2 mt-1 bg-light rounded">
                                    <div className="text-muted">{c.author_name} · {new Date(c.created_at).toLocaleDateString()}</div>
                                    <div>{c.content}</div>
                                    {user.role === 'admin' && (
                                      <button
                                        className="btn btn-sm btn-link text-danger p-0 mt-1"
                                        style={{ fontSize: '0.7rem' }}
                                        onClick={() => handleDeleteComment(c.id, app.id)}>
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Admin comment posting */}
                            {user.role === 'admin' && (
                              <div className="mt-2">
                                {commentingOnApp === app.id ? (
                                  <div className="d-flex gap-2 mt-1">
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Add feedback..."
                                      value={newCommentText}
                                      onChange={e => setNewCommentText(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handlePostComment(app.id)}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={() => handlePostComment(app.id)}>Post</button>
                                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setCommentingOnApp(null); setNewCommentText(''); }}>✕</button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-outline-secondary mt-1"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => { setCommentingOnApp(app.id); setNewCommentText(''); }}>
                                    <i className="bi bi-chat me-1"></i>Add Comment
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </>)}

              {/* ===== DEADLINES TAB ===== */}
              {activeTab === 'deadlines' && (<>

                {showDeadlineForm && (
                  <div className="card gp-welcome-card mb-4">
                    <div className="gp-card-accent"></div>
                    <div className="card-body p-4">
                      <h5 className="fw-bold mb-3" style={{ color: '#1a3c6e' }}>
                        <i className={`bi ${editingDeadlineId ? 'bi-pencil-square' : 'bi-alarm'} me-2`}></i>
                        {editingDeadlineId ? 'Edit Deadline' : 'New Deadline'}
                      </h5>
                      <form onSubmit={handleSubmitDeadline}>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label fw-semibold">Application *</label>
                            <select className={`form-select gp-form-control ${deadlineFormErrors.application_id ? 'is-invalid' : ''}`}
                              value={deadlineFormData.application_id}
                              onChange={(e) => setDeadlineFormData({ ...deadlineFormData, application_id: e.target.value })}>
                              <option value="">Select an application...</option>
                              {applications.map(app => (
                                <option key={app.id} value={app.id}>{app.school_name} — {app.program_name}</option>
                              ))}
                            </select>
                            {fieldErr(deadlineFormErrors, 'application_id')}
                          </div>
                          <div className="col-md-6">
                            <label className="form-label fw-semibold">Title *</label>
                            <input type="text" className={`form-control gp-form-control ${deadlineFormErrors.title ? 'is-invalid' : ''}`}
                              value={deadlineFormData.title}
                              onChange={(e) => setDeadlineFormData({ ...deadlineFormData, title: e.target.value })}
                              placeholder="Submit transcript, Write SOP..." />
                            {fieldErr(deadlineFormErrors, 'title')}
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-semibold">Due Date *</label>
                            <input type="date" className={`form-control gp-form-control ${deadlineFormErrors.due_date ? 'is-invalid' : ''}`}
                              value={deadlineFormData.due_date}
                              onChange={(e) => setDeadlineFormData({ ...deadlineFormData, due_date: e.target.value })} />
                            {fieldErr(deadlineFormErrors, 'due_date')}
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-semibold">Reminder Date</label>
                            <input type="date" className="form-control gp-form-control"
                              value={deadlineFormData.reminder_date}
                              onChange={(e) => setDeadlineFormData({ ...deadlineFormData, reminder_date: e.target.value })} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-semibold">Notes</label>
                            <input type="text" className="form-control gp-form-control"
                              value={deadlineFormData.notes}
                              onChange={(e) => setDeadlineFormData({ ...deadlineFormData, notes: e.target.value })}
                              placeholder="Optional notes..." />
                          </div>
                          <div className="col-12">
                            <button type="submit" className="btn btn-primary gp-btn-login text-white">
                              <i className={`bi ${editingDeadlineId ? 'bi-save' : 'bi-check-circle'} me-2`}></i>
                              {editingDeadlineId ? 'Save Changes' : 'Save Deadline'}
                            </button>
                            {editingDeadlineId && (
                              <button type="button" className="btn btn-outline-secondary ms-2 rounded-pill"
                                onClick={() => { setShowDeadlineForm(false); setEditingDeadlineId(null); setDeadlineFormData(defaultDeadlineForm); }}>
                                Cancel Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {deadlines.length === 0 ? (
                  <div className="card gp-welcome-card text-center p-5">
                    <div className="py-4">
                      <i className="bi bi-alarm text-muted" style={{ fontSize: '3rem' }}></i>
                      <h4 className="mt-3" style={{ color: '#1a3c6e' }}>No deadlines yet</h4>
                      <p className="text-muted">Add a deadline to stay on top of your applications</p>
                    </div>
                  </div>
                ) : (
                  <div className="row g-3">
                    {deadlines.map(dl => (
                      <div key={dl.id} className="col-md-6 col-lg-4">
                        <div className={`card gp-welcome-card h-100 ${dl.is_completed ? 'opacity-75' : ''}`}>
                          <div className="gp-card-accent" style={
                            dl.is_completed ? { background: '#28a745' }
                              : deadlineUrgency(dl.due_date, dl.is_completed) === 'danger' ? { background: '#dc3545' }
                                : deadlineUrgency(dl.due_date, dl.is_completed) === 'warning' ? { background: '#ffc107' }
                                  : {}
                          }></div>
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div className="d-flex align-items-start gap-2">
                                <input type="checkbox" className="form-check-input mt-1" style={{ cursor: 'pointer' }}
                                  checked={!!dl.is_completed}
                                  onChange={() => handleToggleDeadline(dl.id)} />
                                <div>
                                  <h6 className={`fw-bold mb-1 ${dl.is_completed ? 'text-decoration-line-through text-muted' : ''}`} style={dl.is_completed ? {} : { color: '#1a3c6e' }}>
                                    {dl.title}
                                  </h6>
                                  <p className="text-muted small mb-0">
                                    <i className="bi bi-building me-1"></i>{dl.school_name} — {dl.program_name}
                                  </p>
                                </div>
                              </div>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-link text-primary p-0 me-2" onClick={() => openEditDeadline(dl)} title="Edit">
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleDeleteDeadline(dl.id)} title="Delete">
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </div>

                            <div className="d-flex gap-2 mb-2">
                              <span className={`badge bg-${deadlineUrgency(dl.due_date, dl.is_completed)}`}>
                                {dl.is_completed ? 'Completed' : (() => {
                                  const days = Math.ceil((new Date(dl.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                                  if (days < 0) return `${Math.abs(days)}d overdue`;
                                  if (days === 0) return 'Due today';
                                  if (days === 1) return 'Due tomorrow';
                                  return `${days}d left`;
                                })()}
                              </span>
                            </div>

                            <p className="small text-muted mb-1">
                              <i className="bi bi-calendar-event me-1"></i>
                              Due: {new Date(dl.due_date).toLocaleDateString()}
                            </p>
                            {dl.reminder_date && (
                              <p className="small text-muted mb-1">
                                <i className="bi bi-bell me-1"></i>
                                Reminder: {new Date(dl.reminder_date).toLocaleDateString()}
                              </p>
                            )}
                            {dl.notes && (
                              <p className="small text-muted mb-0 fst-italic">"{dl.notes}"</p>
                            )}
                            {user.role === 'admin' && dl.user_name && (
                              <p className="small mb-0 mt-1">
                                <i className="bi bi-person me-1 text-muted"></i>
                                <span className="text-muted">{dl.user_name}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </>)}

              {/* ===== MANAGE USERS TAB (admin only) ===== */}
              {activeTab === 'users' && user.role === 'admin' && (
                <div>
                  {/* Add User button + inline form */}
                  <div className="mb-3 d-flex justify-content-end">
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowAddUserForm(v => !v); setAddUserError(''); }}>
                      <i className={`bi ${showAddUserForm ? 'bi-x' : 'bi-person-plus'} me-1`}></i>
                      {showAddUserForm ? 'Cancel' : 'Add User'}
                    </button>
                  </div>
                  {showAddUserForm && (
                    <div className="card gp-welcome-card mb-3">
                      <div className="gp-card-accent"></div>
                      <div className="card-body">
                        <h6 className="fw-bold mb-3" style={{ color: '#1a3c6e' }}>Add New User</h6>
                        <form onSubmit={handleAddUser}>
                          <div className="row g-2">
                            <div className="col-md-3">
                              <input className="form-control form-control-sm" placeholder="Full name" value={addUserData.name}
                                onChange={e => setAddUserData(d => ({ ...d, name: e.target.value }))} required />
                            </div>
                            <div className="col-md-3">
                              <input type="email" className="form-control form-control-sm" placeholder="Email" value={addUserData.email}
                                onChange={e => setAddUserData(d => ({ ...d, email: e.target.value }))} required />
                            </div>
                            <div className="col-md-2">
                              <input type="password" className="form-control form-control-sm" placeholder="Password" value={addUserData.password}
                                onChange={e => setAddUserData(d => ({ ...d, password: e.target.value }))} required />
                            </div>
                            <div className="col-md-2">
                              <select className="form-select form-select-sm" value={addUserData.role}
                                onChange={e => setAddUserData(d => ({ ...d, role: e.target.value }))}>
                                <option value="student">Student</option>
                                <option value="advisor">Advisor</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <button type="submit" className="btn btn-success btn-sm w-100">Create</button>
                            </div>
                          </div>
                          {addUserError && <div className="alert alert-danger py-1 mt-2 small">{addUserError}</div>}
                        </form>
                      </div>
                    </div>
                  )}
                  {allUsers.length === 0 ? (
                    <div className="card gp-welcome-card text-center p-5">
                      <p className="text-muted">No users found</p>
                    </div>
                  ) : (
                    <div className="card gp-welcome-card">
                      <div className="gp-card-accent"></div>
                      <div className="card-body p-0">
                        <div className="table-responsive">
                          <table className="table table-hover mb-0">
                            <thead>
                              <tr style={{ color: '#1a3c6e' }}>
                                <th className="ps-3">Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Apps</th>
                                <th>Assign Advisor</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {allUsers.map(u => (
                                <tr key={u.id}>
                                  <td className="ps-3 fw-semibold">{u.name}</td>
                                  <td className="text-muted small">{u.email}</td>
                                  <td>
                                    <span className={`badge bg-${u.role === 'admin' ? 'danger' : u.role === 'advisor' ? 'warning' : 'info'}`}>
                                      {u.role}
                                    </span>
                                  </td>
                                  <td className="text-muted">{u.app_count || 0}</td>
                                  <td>
                                    {u.role === 'student' ? (
                                      <select
                                        className="form-select form-select-sm"
                                        style={{ width: 'auto', minWidth: '160px' }}
                                        value={u.advisor_id || ''}
                                        onChange={e => handleAssignAdvisor(u.id, e.target.value || null)}>
                                        <option value="">No advisor</option>
                                        {allUsers.filter(a => a.role === 'advisor').map(adv => (
                                          <option key={adv.id} value={adv.id}>{adv.name}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-muted small">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {u.role !== 'admin' && (
                                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>
                                        <i className="bi bi-trash"></i>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
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
                  <div className="mb-4">
                    <label className="form-label fw-semibold text-dark">Role</label>
                    <select className="form-select gp-form-control" value={signupRole} onChange={(e) => setSignupRole(e.target.value)}>
                      <option value="student">Student</option>
                      <option value="advisor">Advisor</option>
                    </select>
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
