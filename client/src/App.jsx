import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('student');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // Navigation
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Applications state
  const [applications, setApplications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    school_name: '', program_name: '', program_type: 'PhD', fit_level: 'Match',
    status: 'Researching', app_deadline: '', decision_date: '', notes: '',
    funding_type: '', stipend_amount: '', gre_required: '', faculty_contact: '',
    faculty_email: '', program_url: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Deadlines state
  const [deadlines, setDeadlines] = useState([]);
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);
  const [editingDeadlineId, setEditingDeadlineId] = useState(null);
  const [deadlineFormData, setDeadlineFormData] = useState({
    application_id: '', title: '', due_date: '', reminder_date: '', notes: ''
  });
  const [deadlineFormErrors, setDeadlineFormErrors] = useState({});

  // Dashboard stats
  const [stats, setStats] = useState(null);

  // Chat state
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const chatEndRef = useRef(null);

  // Documents & peer review state
  const [documents, setDocuments] = useState([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docFormData, setDocFormData] = useState({ title: '', doc_type: 'sop', content: '', application_id: '' });
  const [activeDoc, setActiveDoc] = useState(null);
  const [docDetail, setDocDetail] = useState(null);
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Checklist state
  const [checklists, setChecklists] = useState({});
  const [showChecklistForm, setShowChecklistForm] = useState(null);
  const [checklistFormData, setChecklistFormData] = useState({
    item_name: '', item_type: 'other', due_date: '', notes: '', recommender_name: '', recommender_email: ''
  });

  // Advisor state
  const [advisorStudents, setAdvisorStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentApps, setStudentApps] = useState([]);
  const [studentDeadlines, setStudentDeadlines] = useState([]);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState('');
  const [activeCommentApp, setActiveCommentApp] = useState(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState([]);
  const [allAdvisors, setAllAdvisors] = useState([]);

  // AI Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // ===== HELPERS =====
  function parseFieldErrors(details) {
    const map = {};
    if (Array.isArray(details)) details.forEach(d => { if (d.field) map[d.field] = d.message; });
    return map;
  }
  const fieldErr = (map, field) => map[field] ? <div className="gp-field-error">{map[field]}</div> : null;

  const statusColors = {
    Researching: '#6b7280', Applied: '#3b82f6', Accepted: '#10b981', Rejected: '#ef4444', Waitlisted: '#f59e0b'
  };
  const fitColors = { Safety: '#10b981', Match: '#3b82f6', Reach: '#f59e0b' };

  const deadlineUrgency = (dueDateStr, isCompleted) => {
    if (isCompleted) return 'completed';
    const days = Math.ceil((new Date(dueDateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'overdue';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'soon';
    return 'normal';
  };

  // ===== DATA LOADING =====
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.data?.user) setUser(data.data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'advisor') {
      loadAdvisorStudents();
    } else {
      loadApplications();
      loadDeadlines();
      loadStats();
      loadDocuments();
      loadPendingReviews();
    }
    if (user.role === 'admin') {
      loadAdminUsers();
      loadAllAdvisors();
      loadApplications();
      loadDeadlines();
      loadStats();
      loadDocuments();
      loadPendingReviews();
    }
    loadChannels();
  }, [user]);

  useEffect(() => {
    if (activeChannel) loadMessages(activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-refresh messages every 5s when on chat page
  useEffect(() => {
    if (activePage !== 'chat' || !activeChannel) return;
    const interval = setInterval(() => loadMessages(activeChannel), 5000);
    return () => clearInterval(interval);
  }, [activePage, activeChannel]);

  // Apply dark mode
  useEffect(() => {
    document.body.classList.toggle('gp-dark', darkMode);
  }, [darkMode]);

  const loadApplications = async () => {
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) { setApplications(data.data.applications); return data.data.applications; }
    } catch (err) { console.error('Load failed:', err); }
    return [];
  };

  const loadDeadlines = async () => {
    try {
      const res = await fetch('/api/deadlines', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setDeadlines(data.data.deadlines);
    } catch (err) { console.error('Load deadlines failed:', err); }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/stats', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setStats(data.data);
    } catch (err) { console.error('Load stats failed:', err); }
  };

  const loadChannels = async () => {
    try {
      const res = await fetch('/api/channels', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setChannels(data.data.channels);
        if (!activeChannel && data.data.channels.length > 0) setActiveChannel(data.data.channels[0].id);
      }
    } catch (err) { console.error('Load channels failed:', err); }
  };

  const loadMessages = async (channelId) => {
    try {
      const res = await fetch(`/api/messages/${channelId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setMessages(data.data.messages);
    } catch (err) { console.error('Load messages failed:', err); }
  };

  const loadDocuments = async () => {
    try {
      const res = await fetch('/api/documents', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setDocuments(data.data.documents);
    } catch (err) { console.error('Load documents failed:', err); }
  };

  const loadDocDetail = async (docId) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setDocDetail(data.data);
    } catch (err) { console.error('Load doc detail failed:', err); }
  };

  const loadPendingReviews = async () => {
    try {
      const res = await fetch('/api/documents/reviews/pending', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setPendingReviews(data.data.reviews);
    } catch (err) { console.error('Load pending reviews failed:', err); }
  };

  const loadChecklist = async (appId) => {
    try {
      const res = await fetch(`/api/checklists/${appId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setChecklists(prev => ({ ...prev, [appId]: data.data.checklist }));
    } catch (err) { console.error('Load checklist failed:', err); }
  };

  const loadAdvisorStudents = async () => {
    try {
      const res = await fetch('/api/advisor/students', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setAdvisorStudents(data.data.students);
    } catch (err) { console.error('Load students failed:', err); }
  };

  const loadAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setAdminUsers(data.data.users);
    } catch (err) { console.error('Load admin users failed:', err); }
  };

  const loadAllAdvisors = async () => {
    try {
      const res = await fetch('/api/advisors', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setAllAdvisors(data.data.advisors);
    } catch (err) { console.error('Load advisors failed:', err); }
  };

  const loadComments = async (applicationId) => {
    try {
      const res = await fetch(`/api/comments/${applicationId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) setComments(prev => ({ ...prev, [applicationId]: data.data.comments }));
    } catch (err) { console.error('Load comments failed:', err); }
  };

  // ===== AUTH HANDLERS =====
  const handleSignUp = async (e) => {
    e.preventDefault(); setError(''); setFieldErrors({});
    try {
      const res = await fetch('/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name, email, password, role: selectedRole })
      });
      const data = await res.json();
      if (data.ok) setUser(data.data.user);
      else { setError(data.error || 'Registration failed'); if (data.details) setFieldErrors(parseFieldErrors(data.details)); }
    } catch { setError('Could not connect to server'); }
  };

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(''); setFieldErrors({});
    try {
      const res = await fetch('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.ok) setUser(data.data.user);
      else { setError(data.error || 'Login failed'); if (data.details) setFieldErrors(parseFieldErrors(data.details)); }
    } catch { setError('Could not connect to server'); }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null); setApplications([]); setDeadlines([]); setStats(null);
      setChannels([]); setMessages([]); setDocuments([]); setActiveChannel(null);
      setAdvisorStudents([]); setSelectedStudent(null); setActivePage('dashboard');
      setAuthPage('signin'); setError('');
    } catch (err) { console.error('Logout failed:', err); }
  };

  // ===== APPLICATION HANDLERS =====
  const defaultForm = {
    school_name: '', program_name: '', program_type: 'PhD', fit_level: 'Match',
    status: 'Researching', app_deadline: '', decision_date: '', notes: '',
    funding_type: '', stipend_amount: '', gre_required: '', faculty_contact: '',
    faculty_email: '', program_url: ''
  };

  const openAddForm = () => { setEditingId(null); setFormData(defaultForm); setFormErrors({}); setShowForm(true); };
  const openEditForm = (app) => {
    setEditingId(app.id);
    setFormData({
      school_name: app.school_name || '', program_name: app.program_name || '',
      program_type: app.program_type || 'PhD', fit_level: app.fit_level || 'Match',
      status: app.status || 'Researching',
      app_deadline: app.app_deadline ? app.app_deadline.slice(0, 10) : '',
      decision_date: app.decision_date ? app.decision_date.slice(0, 10) : '',
      notes: app.notes || '', funding_type: app.funding_type || '',
      stipend_amount: app.stipend_amount || '', gre_required: app.gre_required ?? '',
      faculty_contact: app.faculty_contact || '', faculty_email: app.faculty_email || '',
      program_url: app.program_url || ''
    });
    setFormErrors({}); setShowForm(true);
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault(); setFormErrors({});
    const url = editingId ? `/api/applications/${editingId}` : '/api/applications';
    try {
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.ok) { setShowForm(false); setEditingId(null); setFormData(defaultForm); loadApplications(); loadStats(); }
      else if (data.details) setFormErrors(parseFieldErrors(data.details));
    } catch (err) { console.error('Submit failed:', err); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await fetch(`/api/applications/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ status: newStatus })
      });
      loadApplications(); loadStats();
    } catch (err) { console.error('Status change failed:', err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this application and all its data?')) return;
    try {
      await fetch(`/api/applications/${id}`, { method: 'DELETE', credentials: 'include' });
      loadApplications(); loadStats();
    } catch (err) { console.error('Delete failed:', err); }
  };

  // ===== DEADLINE HANDLERS =====
  const defaultDeadlineForm = { application_id: '', title: '', due_date: '', reminder_date: '', notes: '' };

  const handleSubmitDeadline = async (e) => {
    e.preventDefault(); setDeadlineFormErrors({});
    const url = editingDeadlineId ? `/api/deadlines/${editingDeadlineId}` : '/api/deadlines';
    try {
      const res = await fetch(url, {
        method: editingDeadlineId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(deadlineFormData)
      });
      const data = await res.json();
      if (data.ok) { setShowDeadlineForm(false); setEditingDeadlineId(null); setDeadlineFormData(defaultDeadlineForm); loadDeadlines(); loadStats(); }
      else if (data.details) setDeadlineFormErrors(parseFieldErrors(data.details));
    } catch (err) { console.error('Deadline submit failed:', err); }
  };

  const handleToggleDeadline = async (id) => {
    try { await fetch(`/api/deadlines/${id}/complete`, { method: 'PUT', credentials: 'include' }); loadDeadlines(); loadStats(); }
    catch (err) { console.error('Toggle deadline failed:', err); }
  };

  const handleDeleteDeadline = async (id) => {
    if (!confirm('Delete this deadline?')) return;
    try { await fetch(`/api/deadlines/${id}`, { method: 'DELETE', credentials: 'include' }); loadDeadlines(); loadStats(); }
    catch (err) { console.error('Delete deadline failed:', err); }
  };

  // ===== CHAT HANDLERS =====
  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChannel) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ channel_id: activeChannel, content: messageText })
      });
      const data = await res.json();
      if (data.ok) { setMessageText(''); loadMessages(activeChannel); }
    } catch (err) { console.error('Send message failed:', err); }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const res = await fetch('/api/channels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: newChannelName, description: newChannelDesc })
      });
      const data = await res.json();
      if (data.ok) { setShowNewChannel(false); setNewChannelName(''); setNewChannelDesc(''); loadChannels(); }
    } catch (err) { console.error('Create channel failed:', err); }
  };

  // ===== DOCUMENT HANDLERS =====
  const handleCreateDoc = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(docFormData)
      });
      const data = await res.json();
      if (data.ok) { setShowDocForm(false); setDocFormData({ title: '', doc_type: 'sop', content: '', application_id: '' }); loadDocuments(); }
    } catch (err) { console.error('Create doc failed:', err); }
  };

  const handleRequestReview = async (docId) => {
    if (!reviewerEmail.trim()) return;
    try {
      const res = await fetch(`/api/documents/${docId}/request-review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ reviewer_email: reviewerEmail })
      });
      const data = await res.json();
      if (data.ok) { setReviewerEmail(''); loadDocDetail(docId); alert('Review request sent!'); }
      else alert(data.error);
    } catch (err) { console.error('Request review failed:', err); }
  };

  const handleSubmitReview = async (reviewId) => {
    try {
      await fetch(`/api/documents/reviews/${reviewId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ overall_feedback: reviewFeedback, status: 'completed', rating: 5 })
      });
      setReviewFeedback(''); loadPendingReviews();
      if (activeDoc) loadDocDetail(activeDoc);
      alert('Review submitted!');
    } catch (err) { console.error('Submit review failed:', err); }
  };

  // ===== CHECKLIST HANDLERS =====
  const handleGenerateChecklist = async (appId) => {
    try {
      await fetch(`/api/checklists/${appId}/generate`, { method: 'POST', credentials: 'include' });
      loadChecklist(appId);
    } catch (err) { console.error('Generate checklist failed:', err); }
  };

  const handleToggleChecklistItem = async (itemId, appId) => {
    try {
      await fetch(`/api/checklists/${itemId}/toggle`, { method: 'PUT', credentials: 'include' });
      loadChecklist(appId);
    } catch (err) { console.error('Toggle checklist failed:', err); }
  };

  const handleAddChecklistItem = async (appId) => {
    try {
      await fetch('/api/checklists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...checklistFormData, application_id: appId })
      });
      setShowChecklistForm(null);
      setChecklistFormData({ item_name: '', item_type: 'other', due_date: '', notes: '', recommender_name: '', recommender_email: '' });
      loadChecklist(appId);
    } catch (err) { console.error('Add checklist item failed:', err); }
  };

  // ===== ADVISOR HANDLERS =====
  const viewStudent = async (studentId) => {
    try {
      const res = await fetch(`/api/advisor/students/${studentId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setSelectedStudent(data.data.student); setStudentApps(data.data.applications); setStudentDeadlines(data.data.deadlines);
        for (const app of data.data.applications) loadComments(app.id);
      }
    } catch (err) { console.error('Load student detail failed:', err); }
  };

  const handlePostComment = async (applicationId) => {
    if (!commentText.trim()) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ application_id: applicationId, content: commentText })
      });
      const data = await res.json();
      if (data.ok) { setCommentText(''); setActiveCommentApp(null); loadComments(applicationId); }
    } catch (err) { console.error('Post comment failed:', err); }
  };

  const handleAssignAdvisor = async (studentId, advisorId) => {
    try {
      await fetch('/api/admin/assign-advisor', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ studentId, advisorId: advisorId || null })
      });
      loadAdminUsers();
    } catch (err) { console.error('Assign advisor failed:', err); }
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="gp-loading-screen">
        <div className="gp-loading-spinner"></div>
        <div className="gp-loading-text">GradPath</div>
      </div>
    );
  }

  // ===== AUTH SCREENS =====
  if (!user) {
    return (
      <div className="gp-auth-container">
        <div className="gp-auth-left">
          <div className="gp-auth-brand">
            <div className="gp-logo">GP</div>
            <h1>GradPath</h1>
            <p>Your PhD application command center. Track schools, collaborate with peers, and land your dream program.</p>
          </div>
          <div className="gp-auth-features">
            <div className="gp-auth-feature"><span className="gp-feature-icon">&#x1F393;</span> Track applications across programs</div>
            <div className="gp-auth-feature"><span className="gp-feature-icon">&#x1F4AC;</span> Chat with fellow applicants</div>
            <div className="gp-auth-feature"><span className="gp-feature-icon">&#x1F4DD;</span> Peer review SOPs and documents</div>
            <div className="gp-auth-feature"><span className="gp-feature-icon">&#x1F50D;</span> AI-powered school research</div>
          </div>
        </div>
        <div className="gp-auth-right">
          <div className="gp-auth-card">
            <h2>{authPage === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="gp-auth-subtitle">{authPage === 'signin' ? 'Sign in to continue' : 'Join the PhD community'}</p>

            {error && <div className="gp-error-banner">{error}</div>}

            <form onSubmit={authPage === 'signin' ? handleSignIn : handleSignUp}>
              {authPage === 'signup' && (
                <>
                  <div className="gp-form-group">
                    <label>Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className={fieldErrors.name ? 'gp-input-error' : ''} />
                    {fieldErr(fieldErrors, 'name')}
                  </div>
                  <div className="gp-form-group">
                    <label>I am a...</label>
                    <div className="gp-role-selector">
                      <button type="button" className={`gp-role-btn ${selectedRole === 'student' ? 'active' : ''}`} onClick={() => setSelectedRole('student')}>
                        <span className="gp-role-icon">&#x1F393;</span> Student
                      </button>
                      <button type="button" className={`gp-role-btn ${selectedRole === 'advisor' ? 'active' : ''}`} onClick={() => setSelectedRole('advisor')}>
                        <span className="gp-role-icon">&#x1F4DA;</span> Advisor
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="gp-form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={fieldErrors.email ? 'gp-input-error' : ''} />
                {fieldErr(fieldErrors, 'email')}
              </div>
              <div className="gp-form-group">
                <label>Password</label>
                <div className="gp-password-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className={fieldErrors.password ? 'gp-input-error' : ''} />
                  <button type="button" className="gp-password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
                {fieldErr(fieldErrors, 'password')}
              </div>
              <button type="submit" className="gp-btn-primary gp-btn-full">{authPage === 'signin' ? 'Sign In' : 'Create Account'}</button>
            </form>

            <div className="gp-auth-switch">
              {authPage === 'signin' ? (
                <p>Don't have an account? <button onClick={() => { setAuthPage('signup'); setError(''); setFieldErrors({}); }}>Sign Up</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => { setAuthPage('signin'); setError(''); setFieldErrors({}); }}>Sign In</button></p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== NAV ITEMS =====
  const navItems = user.role === 'advisor' ? [
    { id: 'advisor', label: 'Students', icon: '&#x1F465;' },
    { id: 'chat', label: 'Chat', icon: '&#x1F4AC;' },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: '&#x1F4CA;' },
    { id: 'schools', label: 'My Schools', icon: '&#x1F3EB;' },
    { id: 'timeline', label: 'Timeline', icon: '&#x1F4C5;' },
    { id: 'documents', label: 'Documents', icon: '&#x1F4DD;' },
    { id: 'chat', label: 'Chat', icon: '&#x1F4AC;' },
    ...(user.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: '&#x2699;&#xFE0F;' }] : []),
  ];

  // ===== MAIN LAYOUT =====
  return (
    <div className={`gp-app ${darkMode ? 'gp-dark' : ''}`}>
      {/* Sidebar */}
      <aside className={`gp-sidebar ${sidebarOpen ? '' : 'gp-sidebar-collapsed'}`}>
        <div className="gp-sidebar-header">
          <div className="gp-sidebar-logo" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span className="gp-logo-sm">GP</span>
            {sidebarOpen && <span className="gp-logo-text">GradPath</span>}
          </div>
        </div>
        <nav className="gp-sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`gp-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}>
              <span className="gp-nav-icon" dangerouslySetInnerHTML={{ __html: item.icon }}></span>
              {sidebarOpen && <span className="gp-nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="gp-sidebar-footer">
          <button className="gp-nav-item" onClick={() => setDarkMode(!darkMode)}>
            <span className="gp-nav-icon">{darkMode ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span className="gp-nav-label">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <div className="gp-user-info" onClick={handleLogout}>
            <div className="gp-avatar">{user.name?.charAt(0).toUpperCase()}</div>
            {sidebarOpen && (
              <div className="gp-user-details">
                <div className="gp-user-name">{user.name}</div>
                <div className="gp-user-role">{user.role} &middot; Sign out</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="gp-main">
        <header className="gp-topbar">
          <button className="gp-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>&#9776;</button>
          <h1 className="gp-page-title">{navItems.find(n => n.id === activePage)?.label || 'GradPath'}</h1>
          <div className="gp-topbar-right">
            {pendingReviews.length > 0 && (
              <button className="gp-notif-btn" onClick={() => setActivePage('documents')}>
                {pendingReviews.length} review{pendingReviews.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </header>

        <div className="gp-content">

          {/* ===== DASHBOARD ===== */}
          {activePage === 'dashboard' && (
            <div className="gp-dashboard">
              <div className="gp-stats-grid">
                <div className="gp-stat-card">
                  <div className="gp-stat-number">{stats?.totalApplications || 0}</div>
                  <div className="gp-stat-label">Applications</div>
                </div>
                <div className="gp-stat-card gp-stat-accent">
                  <div className="gp-stat-number">{stats?.statusBreakdown?.find(s => s.status === 'Accepted')?.count || 0}</div>
                  <div className="gp-stat-label">Accepted</div>
                </div>
                <div className="gp-stat-card">
                  <div className="gp-stat-number">{stats?.completedDeadlines || 0}/{stats?.totalDeadlines || 0}</div>
                  <div className="gp-stat-label">Deadlines Done</div>
                </div>
                <div className="gp-stat-card">
                  <div className="gp-stat-number">{stats?.documentCount || 0}</div>
                  <div className="gp-stat-label">Documents</div>
                </div>
              </div>

              {/* Status breakdown */}
              {stats?.statusBreakdown?.length > 0 && (
                <div className="gp-card gp-mb">
                  <h3 className="gp-card-title">Application Status</h3>
                  <div className="gp-status-bars">
                    {stats.statusBreakdown.map(s => (
                      <div key={s.status} className="gp-status-bar-row">
                        <span className="gp-status-label" style={{ color: statusColors[s.status] }}>{s.status}</span>
                        <div className="gp-status-bar-track">
                          <div className="gp-status-bar-fill" style={{ width: `${(s.count / stats.totalApplications) * 100}%`, background: statusColors[s.status] }}></div>
                        </div>
                        <span className="gp-status-count">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming deadlines */}
              {stats?.upcomingDeadlines?.length > 0 && (
                <div className="gp-card gp-mb">
                  <h3 className="gp-card-title">Upcoming Deadlines</h3>
                  {stats.upcomingDeadlines.map(dl => {
                    const days = Math.ceil((new Date(dl.due_date) - new Date()) / (1000*60*60*24));
                    return (
                      <div key={dl.id} className="gp-deadline-row">
                        <div className="gp-deadline-info">
                          <div className="gp-deadline-title">{dl.title}</div>
                          <div className="gp-deadline-school">{dl.school_name} &middot; {dl.program_name}</div>
                        </div>
                        <div className={`gp-deadline-badge ${days <= 3 ? 'urgent' : days <= 7 ? 'soon' : ''}`}>
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending reviews notification */}
              {pendingReviews.length > 0 && (
                <div className="gp-card gp-card-highlight gp-mb">
                  <h3 className="gp-card-title">Peer Reviews Waiting</h3>
                  <p>{pendingReviews.length} document{pendingReviews.length > 1 ? 's' : ''} need{pendingReviews.length === 1 ? 's' : ''} your review</p>
                  <button className="gp-btn-primary" onClick={() => setActivePage('documents')}>Review Now</button>
                </div>
              )}

              {applications.length === 0 && (
                <div className="gp-card gp-empty-state">
                  <div className="gp-empty-icon">&#x1F680;</div>
                  <h3>Start your PhD journey</h3>
                  <p>Add your first school to begin tracking applications</p>
                  <button className="gp-btn-primary" onClick={() => { setActivePage('schools'); setTimeout(openAddForm, 100); }}>Add School</button>
                </div>
              )}
            </div>
          )}

          {/* ===== MY SCHOOLS ===== */}
          {activePage === 'schools' && (
            <div className="gp-schools">
              <div className="gp-page-actions">
                <button className="gp-btn-primary" onClick={openAddForm}>+ Add School</button>
              </div>

              {/* Application Form Modal */}
              {showForm && (
                <div className="gp-modal-overlay" onClick={() => setShowForm(false)}>
                  <div className="gp-modal" onClick={e => e.stopPropagation()}>
                    <div className="gp-modal-header">
                      <h3>{editingId ? 'Edit Application' : 'Add New School'}</h3>
                      <button className="gp-modal-close" onClick={() => setShowForm(false)}>&times;</button>
                    </div>
                    <form onSubmit={handleSubmitApplication} className="gp-modal-body">
                      <div className="gp-form-row">
                        <div className="gp-form-group">
                          <label>School Name *</label>
                          <input value={formData.school_name} onChange={e => setFormData({...formData, school_name: e.target.value})} placeholder="e.g. MIT" />
                          {fieldErr(formErrors, 'school_name')}
                        </div>
                        <div className="gp-form-group">
                          <label>Program Name *</label>
                          <input value={formData.program_name} onChange={e => setFormData({...formData, program_name: e.target.value})} placeholder="e.g. Computer Science" />
                          {fieldErr(formErrors, 'program_name')}
                        </div>
                      </div>
                      <div className="gp-form-row">
                        <div className="gp-form-group">
                          <label>Degree Type</label>
                          <select value={formData.program_type} onChange={e => setFormData({...formData, program_type: e.target.value})}>
                            <option value="PhD">PhD</option><option value="MS">MS</option><option value="MBA">MBA</option><option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="gp-form-group">
                          <label>Fit Level</label>
                          <select value={formData.fit_level} onChange={e => setFormData({...formData, fit_level: e.target.value})}>
                            <option value="Safety">Safety</option><option value="Match">Match</option><option value="Reach">Reach</option>
                          </select>
                        </div>
                        <div className="gp-form-group">
                          <label>Status</label>
                          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                            <option>Researching</option><option>Applied</option><option>Accepted</option><option>Rejected</option><option>Waitlisted</option>
                          </select>
                        </div>
                      </div>
                      <div className="gp-form-row">
                        <div className="gp-form-group"><label>Application Deadline</label><input type="date" value={formData.app_deadline} onChange={e => setFormData({...formData, app_deadline: e.target.value})} /></div>
                        <div className="gp-form-group"><label>Decision Date</label><input type="date" value={formData.decision_date} onChange={e => setFormData({...formData, decision_date: e.target.value})} /></div>
                      </div>

                      <h4 className="gp-form-section-title">PhD Details</h4>
                      <div className="gp-form-row">
                        <div className="gp-form-group"><label>Funding Type</label><input value={formData.funding_type} onChange={e => setFormData({...formData, funding_type: e.target.value})} placeholder="e.g. TA, RA, Fellowship" /></div>
                        <div className="gp-form-group"><label>Stipend ($/yr)</label><input type="number" value={formData.stipend_amount} onChange={e => setFormData({...formData, stipend_amount: e.target.value})} placeholder="e.g. 35000" /></div>
                        <div className="gp-form-group"><label>GRE Required?</label>
                          <select value={formData.gre_required} onChange={e => setFormData({...formData, gre_required: e.target.value})}>
                            <option value="">Unknown</option><option value="1">Yes</option><option value="0">No / Waived</option>
                          </select>
                        </div>
                      </div>
                      <div className="gp-form-row">
                        <div className="gp-form-group"><label>Faculty Contact</label><input value={formData.faculty_contact} onChange={e => setFormData({...formData, faculty_contact: e.target.value})} placeholder="Prof. name" /></div>
                        <div className="gp-form-group"><label>Faculty Email</label><input value={formData.faculty_email} onChange={e => setFormData({...formData, faculty_email: e.target.value})} placeholder="professor@school.edu" /></div>
                      </div>
                      <div className="gp-form-group"><label>Program URL</label><input value={formData.program_url} onChange={e => setFormData({...formData, program_url: e.target.value})} placeholder="https://..." /></div>
                      <div className="gp-form-group"><label>Notes</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} placeholder="Any additional notes..."></textarea></div>
                      <div className="gp-modal-footer"><button type="button" className="gp-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="gp-btn-primary">{editingId ? 'Save Changes' : 'Add School'}</button></div>
                    </form>
                  </div>
                </div>
              )}

              {/* School Cards */}
              {applications.length === 0 ? (
                <div className="gp-card gp-empty-state"><div className="gp-empty-icon">&#x1F3EB;</div><h3>No schools yet</h3><p>Start by adding the PhD programs you're interested in</p></div>
              ) : (
                <div className="gp-school-grid">
                  {applications.map(app => (
                    <div key={app.id} className="gp-school-card">
                      <div className="gp-school-card-header">
                        <div>
                          <h3 className="gp-school-name">{app.school_name}</h3>
                          <p className="gp-school-program">{app.program_name} &middot; {app.program_type}</p>
                        </div>
                        <div className="gp-school-actions">
                          <button className="gp-btn-icon" onClick={() => openEditForm(app)} title="Edit">&#9998;</button>
                          <button className="gp-btn-icon gp-btn-danger" onClick={() => handleDelete(app.id)} title="Delete">&#x1F5D1;</button>
                        </div>
                      </div>
                      <div className="gp-school-card-body">
                        <div className="gp-school-badges">
                          <span className="gp-badge" style={{ background: statusColors[app.status] + '20', color: statusColors[app.status] }}>{app.status}</span>
                          <span className="gp-badge" style={{ background: fitColors[app.fit_level] + '20', color: fitColors[app.fit_level] }}>{app.fit_level}</span>
                          {app.gre_required === 0 && <span className="gp-badge gp-badge-success">No GRE</span>}
                        </div>

                        <select className="gp-status-select" value={app.status} onChange={e => handleStatusChange(app.id, e.target.value)}>
                          <option>Researching</option><option>Applied</option><option>Accepted</option><option>Rejected</option><option>Waitlisted</option>
                        </select>

                        {(app.app_deadline || app.decision_date) && (
                          <div className="gp-school-dates">
                            {app.app_deadline && <div className="gp-date-item"><span className="gp-date-label">Deadline</span><span>{new Date(app.app_deadline).toLocaleDateString()}</span></div>}
                            {app.decision_date && <div className="gp-date-item"><span className="gp-date-label">Decision</span><span>{new Date(app.decision_date).toLocaleDateString()}</span></div>}
                          </div>
                        )}

                        {(app.funding_type || app.stipend_amount) && (
                          <div className="gp-school-funding">
                            {app.funding_type && <span>{app.funding_type}</span>}
                            {app.stipend_amount && <span className="gp-stipend">${Number(app.stipend_amount).toLocaleString()}/yr</span>}
                          </div>
                        )}

                        {app.faculty_contact && <div className="gp-school-faculty">Faculty: {app.faculty_contact} {app.faculty_email && <a href={`mailto:${app.faculty_email}`}>&#x2709;</a>}</div>}
                        {app.program_url && <div className="gp-school-link"><a href={app.program_url} target="_blank" rel="noopener noreferrer">Program Website &#x2197;</a></div>}
                        {app.notes && <div className="gp-school-notes">{app.notes}</div>}

                        {/* Comments from advisor */}
                        {comments[app.id]?.length > 0 && (
                          <div className="gp-advisor-comments">
                            <div className="gp-section-title">Advisor Feedback</div>
                            {comments[app.id].map(c => (
                              <div key={c.id} className="gp-comment">
                                <div className="gp-comment-header"><strong>{c.author_name}</strong> <span className="gp-comment-badge">{c.author_role}</span> <span className="gp-comment-date">{new Date(c.created_at).toLocaleDateString()}</span></div>
                                <div className="gp-comment-body">{c.content}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Checklist */}
                        <div className="gp-checklist-section">
                          <div className="gp-section-title" style={{ cursor: 'pointer' }} onClick={() => { if (!checklists[app.id]) loadChecklist(app.id); }}>
                            Document Checklist {checklists[app.id] ? `(${checklists[app.id].filter(i=>i.is_completed).length}/${checklists[app.id].length})` : '(click to load)'}
                          </div>
                          {checklists[app.id] && (
                            <>
                              {checklists[app.id].length === 0 ? (
                                <button className="gp-btn-sm" onClick={() => handleGenerateChecklist(app.id)}>Generate Standard Checklist</button>
                              ) : (
                                <div className="gp-checklist-items">
                                  {checklists[app.id].map(item => (
                                    <div key={item.id} className={`gp-checklist-item ${item.is_completed ? 'completed' : ''}`}>
                                      <input type="checkbox" checked={!!item.is_completed} onChange={() => handleToggleChecklistItem(item.id, app.id)} />
                                      <span className="gp-checklist-name">{item.item_name}</span>
                                      <span className="gp-checklist-type">{item.item_type}</span>
                                      {item.recommender_name && <span className="gp-checklist-rec">({item.recommender_name} - {item.recommender_status || 'not asked'})</span>}
                                    </div>
                                  ))}
                                  <button className="gp-btn-sm gp-mt-sm" onClick={() => setShowChecklistForm(app.id)}>+ Add Item</button>
                                  {showChecklistForm === app.id && (
                                    <div className="gp-checklist-form">
                                      <input placeholder="Item name" value={checklistFormData.item_name} onChange={e => setChecklistFormData({...checklistFormData, item_name: e.target.value})} />
                                      <select value={checklistFormData.item_type} onChange={e => setChecklistFormData({...checklistFormData, item_type: e.target.value})}>
                                        <option value="sop">SOP</option><option value="cv">CV</option><option value="transcript">Transcript</option><option value="gre">GRE</option><option value="toefl">TOEFL</option><option value="writing_sample">Writing Sample</option><option value="rec_letter">Rec Letter</option><option value="fee">Fee</option><option value="other">Other</option>
                                      </select>
                                      <button className="gp-btn-sm gp-btn-primary" onClick={() => handleAddChecklistItem(app.id)}>Add</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== TIMELINE ===== */}
          {activePage === 'timeline' && (
            <div className="gp-timeline-page">
              <div className="gp-page-actions">
                <button className="gp-btn-primary" onClick={() => {
                  setEditingDeadlineId(null);
                  setDeadlineFormData({ ...defaultDeadlineForm, application_id: applications.length > 0 ? String(applications[0].id) : '' });
                  setDeadlineFormErrors({}); setShowDeadlineForm(true);
                }}>+ Add Deadline</button>
              </div>

              {showDeadlineForm && (
                <div className="gp-modal-overlay" onClick={() => setShowDeadlineForm(false)}>
                  <div className="gp-modal gp-modal-sm" onClick={e => e.stopPropagation()}>
                    <div className="gp-modal-header"><h3>{editingDeadlineId ? 'Edit Deadline' : 'Add Deadline'}</h3><button className="gp-modal-close" onClick={() => setShowDeadlineForm(false)}>&times;</button></div>
                    <form onSubmit={handleSubmitDeadline} className="gp-modal-body">
                      <div className="gp-form-group"><label>Application</label>
                        <select value={deadlineFormData.application_id} onChange={e => setDeadlineFormData({...deadlineFormData, application_id: e.target.value})}>
                          <option value="">Select...</option>
                          {applications.map(a => <option key={a.id} value={a.id}>{a.school_name} - {a.program_name}</option>)}
                        </select>
                      </div>
                      <div className="gp-form-group"><label>Title</label><input value={deadlineFormData.title} onChange={e => setDeadlineFormData({...deadlineFormData, title: e.target.value})} placeholder="e.g. Submit SOP" /></div>
                      <div className="gp-form-row">
                        <div className="gp-form-group"><label>Due Date</label><input type="date" value={deadlineFormData.due_date} onChange={e => setDeadlineFormData({...deadlineFormData, due_date: e.target.value})} /></div>
                        <div className="gp-form-group"><label>Reminder</label><input type="date" value={deadlineFormData.reminder_date} onChange={e => setDeadlineFormData({...deadlineFormData, reminder_date: e.target.value})} /></div>
                      </div>
                      <div className="gp-form-group"><label>Notes</label><textarea value={deadlineFormData.notes} onChange={e => setDeadlineFormData({...deadlineFormData, notes: e.target.value})} rows={2}></textarea></div>
                      <div className="gp-modal-footer"><button type="button" className="gp-btn-secondary" onClick={() => setShowDeadlineForm(false)}>Cancel</button><button type="submit" className="gp-btn-primary">{editingDeadlineId ? 'Save' : 'Add Deadline'}</button></div>
                    </form>
                  </div>
                </div>
              )}

              {deadlines.length === 0 ? (
                <div className="gp-card gp-empty-state"><div className="gp-empty-icon">&#x1F4C5;</div><h3>No deadlines yet</h3><p>Add deadlines to track your application milestones</p></div>
              ) : (
                <div className="gp-timeline">
                  {[...deadlines].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(dl => {
                    const urg = deadlineUrgency(dl.due_date, dl.is_completed);
                    const days = Math.ceil((new Date(dl.due_date) - new Date()) / (1000*60*60*24));
                    const app = applications.find(a => a.id === dl.application_id);
                    return (
                      <div key={dl.id} className={`gp-timeline-item ${urg}`}>
                        <div className="gp-timeline-dot"></div>
                        <div className="gp-timeline-content">
                          <div className="gp-timeline-header">
                            <h4 className={dl.is_completed ? 'completed' : ''}>{dl.title}</h4>
                            <span className={`gp-deadline-badge ${urg}`}>
                              {dl.is_completed ? 'Done' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                            </span>
                          </div>
                          {app && <div className="gp-timeline-school">{app.school_name} &middot; {app.program_name}</div>}
                          <div className="gp-timeline-date">{new Date(dl.due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                          {dl.notes && <div className="gp-timeline-notes">{dl.notes}</div>}
                          <div className="gp-timeline-actions">
                            <button className="gp-btn-sm" onClick={() => handleToggleDeadline(dl.id)}>{dl.is_completed ? 'Undo' : 'Complete'}</button>
                            <button className="gp-btn-sm" onClick={() => {
                              setEditingDeadlineId(dl.id);
                              setDeadlineFormData({ application_id: String(dl.application_id), title: dl.title, due_date: dl.due_date?.slice(0,10) || '', reminder_date: dl.reminder_date?.slice(0,10) || '', notes: dl.notes || '' });
                              setShowDeadlineForm(true);
                            }}>Edit</button>
                            <button className="gp-btn-sm gp-btn-danger" onClick={() => handleDeleteDeadline(dl.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== DOCUMENTS & PEER REVIEW ===== */}
          {activePage === 'documents' && (
            <div className="gp-documents-page">
              <div className="gp-page-actions">
                <button className="gp-btn-primary" onClick={() => setShowDocForm(true)}>+ New Document</button>
              </div>

              {showDocForm && (
                <div className="gp-modal-overlay" onClick={() => setShowDocForm(false)}>
                  <div className="gp-modal" onClick={e => e.stopPropagation()}>
                    <div className="gp-modal-header"><h3>New Document</h3><button className="gp-modal-close" onClick={() => setShowDocForm(false)}>&times;</button></div>
                    <form onSubmit={handleCreateDoc} className="gp-modal-body">
                      <div className="gp-form-row">
                        <div className="gp-form-group"><label>Title</label><input value={docFormData.title} onChange={e => setDocFormData({...docFormData, title: e.target.value})} placeholder="e.g. MIT SOP Draft" /></div>
                        <div className="gp-form-group"><label>Type</label>
                          <select value={docFormData.doc_type} onChange={e => setDocFormData({...docFormData, doc_type: e.target.value})}>
                            <option value="sop">Statement of Purpose</option><option value="cv">CV / Resume</option><option value="writing_sample">Writing Sample</option><option value="recommendation">Recommendation</option><option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="gp-form-group"><label>Link to Application (optional)</label>
                        <select value={docFormData.application_id} onChange={e => setDocFormData({...docFormData, application_id: e.target.value})}>
                          <option value="">None</option>
                          {applications.map(a => <option key={a.id} value={a.id}>{a.school_name} - {a.program_name}</option>)}
                        </select>
                      </div>
                      <div className="gp-form-group"><label>Content</label><textarea value={docFormData.content} onChange={e => setDocFormData({...docFormData, content: e.target.value})} rows={10} placeholder="Paste or write your document here..."></textarea></div>
                      <div className="gp-modal-footer"><button type="button" className="gp-btn-secondary" onClick={() => setShowDocForm(false)}>Cancel</button><button type="submit" className="gp-btn-primary">Create Document</button></div>
                    </form>
                  </div>
                </div>
              )}

              {/* Pending reviews for me */}
              {pendingReviews.length > 0 && (
                <div className="gp-card gp-card-highlight gp-mb">
                  <h3 className="gp-card-title">Documents to Review</h3>
                  {pendingReviews.map(r => (
                    <div key={r.id} className="gp-review-request">
                      <div className="gp-review-info">
                        <strong>{r.title}</strong> ({r.doc_type}) by {r.author_name}
                        <span className={`gp-badge gp-badge-${r.status === 'completed' ? 'success' : 'warning'}`}>{r.status}</span>
                      </div>
                      {r.status !== 'completed' && (
                        <div className="gp-review-actions">
                          <button className="gp-btn-sm gp-btn-primary" onClick={() => { setActiveDoc(r.document_id); loadDocDetail(r.document_id); }}>Open & Review</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Document detail view */}
              {activeDoc && docDetail && (
                <div className="gp-modal-overlay" onClick={() => { setActiveDoc(null); setDocDetail(null); }}>
                  <div className="gp-modal gp-modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="gp-modal-header">
                      <h3>{docDetail.document.title}</h3>
                      <button className="gp-modal-close" onClick={() => { setActiveDoc(null); setDocDetail(null); }}>&times;</button>
                    </div>
                    <div className="gp-modal-body gp-doc-detail">
                      <div className="gp-doc-meta">
                        <span className="gp-badge">{docDetail.document.doc_type}</span>
                        <span className="gp-badge">v{docDetail.document.version}</span>
                        <span className="gp-badge gp-badge-{docDetail.document.status === 'final' ? 'success' : 'warning'}">{docDetail.document.status}</span>
                      </div>
                      <div className="gp-doc-content">{docDetail.document.content}</div>

                      {/* Invite reviewer */}
                      {docDetail.document.user_id === user.id && (
                        <div className="gp-invite-reviewer">
                          <h4>Invite a Peer Reviewer</h4>
                          <div className="gp-form-row">
                            <input value={reviewerEmail} onChange={e => setReviewerEmail(e.target.value)} placeholder="Enter their email address" style={{flex:1}} />
                            <button className="gp-btn-primary" onClick={() => handleRequestReview(activeDoc)}>Send Invite</button>
                          </div>
                        </div>
                      )}

                      {/* Reviews */}
                      {docDetail.reviews?.length > 0 && (
                        <div className="gp-reviews-section">
                          <h4>Reviews ({docDetail.reviews.length})</h4>
                          {docDetail.reviews.map(r => (
                            <div key={r.id} className="gp-review-card">
                              <div className="gp-review-header">
                                <strong>{r.reviewer_name}</strong>
                                <span className={`gp-badge gp-badge-${r.status === 'completed' ? 'success' : 'warning'}`}>{r.status}</span>
                              </div>
                              {r.overall_feedback && <div className="gp-review-feedback">{r.overall_feedback}</div>}
                              {r.status !== 'completed' && r.reviewer_id === user.id && (
                                <div className="gp-submit-review">
                                  <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} placeholder="Write your feedback..." rows={3}></textarea>
                                  <button className="gp-btn-primary gp-mt-sm" onClick={() => handleSubmitReview(r.id)}>Submit Review</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* My documents list */}
              <div className="gp-doc-grid">
                {documents.length === 0 ? (
                  <div className="gp-card gp-empty-state"><div className="gp-empty-icon">&#x1F4DD;</div><h3>No documents yet</h3><p>Create your first SOP, CV, or writing sample and invite peers to review</p></div>
                ) : documents.map(doc => (
                  <div key={doc.id} className="gp-doc-card" onClick={() => { setActiveDoc(doc.id); loadDocDetail(doc.id); }}>
                    <div className="gp-doc-card-icon">{doc.doc_type === 'sop' ? '📝' : doc.doc_type === 'cv' ? '📋' : '📄'}</div>
                    <h4>{doc.title}</h4>
                    <div className="gp-doc-card-meta">
                      <span className="gp-badge">{doc.doc_type}</span>
                      <span className="gp-badge">v{doc.version}</span>
                      {doc.review_count > 0 && <span className="gp-badge">{doc.completed_reviews}/{doc.review_count} reviews</span>}
                    </div>
                    {doc.school_name && <div className="gp-doc-card-school">{doc.school_name}</div>}
                    <div className="gp-doc-card-date">Updated {new Date(doc.updated_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== CHAT ===== */}
          {activePage === 'chat' && (
            <div className="gp-chat-page">
              <div className="gp-chat-sidebar">
                <div className="gp-chat-sidebar-header">
                  <h3>Channels</h3>
                  <button className="gp-btn-icon" onClick={() => setShowNewChannel(true)}>+</button>
                </div>
                {showNewChannel && (
                  <div className="gp-new-channel">
                    <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="channel-name" />
                    <input value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="Description (optional)" />
                    <div className="gp-new-channel-actions">
                      <button className="gp-btn-sm" onClick={() => setShowNewChannel(false)}>Cancel</button>
                      <button className="gp-btn-sm gp-btn-primary" onClick={handleCreateChannel}>Create</button>
                    </div>
                  </div>
                )}
                {channels.map(ch => (
                  <button key={ch.id} className={`gp-channel-item ${activeChannel === ch.id ? 'active' : ''}`} onClick={() => setActiveChannel(ch.id)}>
                    <span className="gp-channel-hash">#</span>
                    <span className="gp-channel-name">{ch.name}</span>
                    {ch.message_count > 0 && <span className="gp-channel-count">{ch.message_count}</span>}
                  </button>
                ))}
              </div>
              <div className="gp-chat-main">
                <div className="gp-chat-header">
                  <h3>#{channels.find(c => c.id === activeChannel)?.name || 'general'}</h3>
                  <p>{channels.find(c => c.id === activeChannel)?.description || ''}</p>
                </div>
                <div className="gp-chat-messages">
                  {messages.map(msg => (
                    <div key={msg.id} className={`gp-message ${msg.user_id === user.id ? 'own' : ''}`}>
                      <div className="gp-message-avatar">{msg.author_name?.charAt(0).toUpperCase()}</div>
                      <div className="gp-message-content">
                        <div className="gp-message-header">
                          <span className="gp-message-author">{msg.author_name}</span>
                          <span className="gp-message-role">{msg.author_role}</span>
                          <span className="gp-message-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <div className="gp-message-text">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef}></div>
                </div>
                <div className="gp-chat-input">
                  <input value={messageText} onChange={e => setMessageText(e.target.value)}
                    placeholder={`Message #${channels.find(c => c.id === activeChannel)?.name || 'general'}...`}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                  <button className="gp-btn-primary" onClick={handleSendMessage}>Send</button>
                </div>
              </div>
            </div>
          )}

          {/* ===== ADVISOR DASHBOARD ===== */}
          {activePage === 'advisor' && user.role === 'advisor' && (
            <div className="gp-advisor-page">
              {selectedStudent ? (
                <div>
                  <button className="gp-btn-secondary gp-mb" onClick={() => { setSelectedStudent(null); setStudentApps([]); setStudentDeadlines([]); setComments({}); }}>
                    &larr; Back to Students
                  </button>
                  <h2>{selectedStudent.name}'s Applications</h2>
                  <p className="gp-text-muted">{selectedStudent.email} &middot; {studentApps.length} applications</p>

                  <div className="gp-school-grid">
                    {studentApps.map(app => (
                      <div key={app.id} className="gp-school-card">
                        <div className="gp-school-card-header">
                          <div><h3 className="gp-school-name">{app.school_name}</h3><p className="gp-school-program">{app.program_name} ({app.program_type})</p></div>
                        </div>
                        <div className="gp-school-card-body">
                          <div className="gp-school-badges">
                            <span className="gp-badge" style={{ background: statusColors[app.status] + '20', color: statusColors[app.status] }}>{app.status}</span>
                            <span className="gp-badge" style={{ background: fitColors[app.fit_level] + '20', color: fitColors[app.fit_level] }}>{app.fit_level}</span>
                          </div>
                          {app.notes && <div className="gp-school-notes">{app.notes}</div>}

                          <div className="gp-advisor-comments">
                            <div className="gp-section-title">Comments ({(comments[app.id] || []).length})
                              <button className="gp-btn-sm" onClick={() => setActiveCommentApp(activeCommentApp === app.id ? null : app.id)}>
                                {activeCommentApp === app.id ? 'Close' : 'Add'}
                              </button>
                            </div>
                            {(comments[app.id] || []).map(c => (
                              <div key={c.id} className="gp-comment">
                                <div className="gp-comment-header"><strong>{c.author_name}</strong> <span className="gp-comment-date">{new Date(c.created_at).toLocaleDateString()}</span></div>
                                <div className="gp-comment-body">{c.content}</div>
                              </div>
                            ))}
                            {activeCommentApp === app.id && (
                              <div className="gp-comment-form">
                                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Leave feedback..." rows={2}></textarea>
                                <button className="gp-btn-primary gp-btn-sm" onClick={() => handlePostComment(app.id)}>Post</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2>Your Students</h2>
                  {advisorStudents.length === 0 ? (
                    <div className="gp-card gp-empty-state"><div className="gp-empty-icon">&#x1F465;</div><h3>No students assigned yet</h3></div>
                  ) : (
                    <div className="gp-school-grid">
                      {advisorStudents.map(s => (
                        <div key={s.id} className="gp-school-card" style={{cursor:'pointer'}} onClick={() => viewStudent(s.id)}>
                          <div className="gp-school-card-header">
                            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                              <div className="gp-avatar-lg">{s.name?.charAt(0).toUpperCase()}</div>
                              <div><h3 className="gp-school-name">{s.name}</h3><p className="gp-school-program">{s.email}</p></div>
                            </div>
                          </div>
                          <div className="gp-school-card-body">
                            <div className="gp-school-badges">
                              <span className="gp-badge">{s.total_apps} apps</span>
                              {s.accepted_count > 0 && <span className="gp-badge gp-badge-success">{s.accepted_count} accepted</span>}
                              {s.applied_count > 0 && <span className="gp-badge" style={{background:'#3b82f620',color:'#3b82f6'}}>{s.applied_count} applied</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== ADMIN ===== */}
          {activePage === 'admin' && user.role === 'admin' && (
            <div className="gp-admin-page">
              <h2>User Management</h2>
              <div className="gp-admin-table-wrap">
                <table className="gp-admin-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Advisor</th></tr></thead>
                  <tbody>
                    {adminUsers.map(u => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td><span className="gp-badge">{u.role}</span></td>
                        <td>
                          {u.role === 'student' && (
                            <select value={u.advisor_id || ''} onChange={e => handleAssignAdvisor(u.id, e.target.value)}>
                              <option value="">None</option>
                              {allAdvisors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
