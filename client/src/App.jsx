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
  const [serverStatus, setServerStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch(() => setServerStatus({ status: 'error', database: 'error' }));
  }, []);

  const switchPage = (p) => {
    setPage(p);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getInitial = (n) => n ? n.charAt(0).toUpperCase() : '?';

  if (loading) {
    return (
      <div className="gp-loading">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ===== NAVBAR ===== */}
      <nav className="gp-navbar navbar navbar-dark py-3">
        <div className="container">
          <a className="navbar-brand gp-brand text-white" href="/">
            <i className="bi bi-mortarboard-fill me-2"></i>GradPath
          </a>
          {user && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-white gp-user-badge d-none d-sm-inline-flex align-items-center gap-2">
                <i className="bi bi-person-circle"></i>
                {user.name}
              </span>
              <button onClick={handleLogout} className="btn btn-outline-light btn-sm rounded-pill px-3">
                <i className="bi bi-box-arrow-right me-1"></i>Log Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <div className="gp-hero">
        {user ? (
          /* ===== LOGGED-IN ===== */
          <div className="gp-welcome-card card p-4 p-md-5">
            <div className="gp-card-accent"></div>
            <div className="text-center pt-3">
              <div className="gp-avatar-circle mb-3">
                {getInitial(user.name)}
              </div>
              <h2 className="fw-bold mb-1" style={{ color: '#1a3c6e' }}>
                Welcome back, {user.name}!
              </h2>
              <p className="text-muted mb-4">{user.email}</p>

              <div className="gp-status-pill bg-success bg-opacity-10 text-success mx-auto mb-4">
                <i className="bi bi-shield-fill-check"></i>
                Session active — refresh to verify persistence
              </div>

              <div className="row g-3 mt-2">
                <div className="col-6">
                  <div className="gp-stat-card">
                    <i className="bi bi-server text-primary d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Server</div>
                    <span className={`badge mt-1 ${serverStatus?.status === 'running' ? 'bg-success' : 'bg-danger'}`}>
                      {serverStatus?.status || 'unknown'}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="gp-stat-card">
                    <i className="bi bi-database text-primary d-block mb-1" style={{ fontSize: '1.3rem' }}></i>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Database</div>
                    <span className={`badge mt-1 ${serverStatus?.database === 'connected' ? 'bg-success' : 'bg-danger'}`}>
                      {serverStatus?.database || 'unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
                    <label htmlFor="name" className="form-label fw-semibold text-dark">Full Name</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text">
                        <i className="bi bi-person"></i>
                      </span>
                      <input
                        id="name"
                        type="text"
                        className="form-control gp-form-control with-icon"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="signupEmail" className="form-label fw-semibold text-dark">Email Address</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        id="signupEmail"
                        type="email"
                        className="form-control gp-form-control with-icon"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@kenyon.edu"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="signupPassword" className="form-label fw-semibold text-dark">Password</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        id="signupPassword"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control gp-form-control with-icon"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                        minLength={4}
                      />
                      <button
                        type="button"
                        className="input-group-text gp-input-icon"
                        style={{ borderLeft: 'none', borderRight: '2px solid #e2e8f0', borderRadius: '0 10px 10px 0', cursor: 'pointer' }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2 rounded-3" role="alert">
                      <i className="bi bi-exclamation-circle me-2"></i>{error}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary gp-btn-login w-100 text-white">
                    <i className="bi bi-person-check me-2"></i>Create Account
                  </button>
                </form>

                <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                    Already have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchPage('signin'); }} className="fw-semibold text-decoration-none" style={{ color: '#2e86c1' }}>
                      Sign In
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="gp-features">
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Track applications to multiple schools
              </div>
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Manage deadlines and statuses
              </div>
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Get advisor feedback on your progress
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
                    <label htmlFor="loginEmail" className="form-label fw-semibold text-dark">Email Address</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        id="loginEmail"
                        type="email"
                        className="form-control gp-form-control with-icon"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@kenyon.edu"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="loginPassword" className="form-label fw-semibold text-dark">Password</label>
                    <div className="input-group">
                      <span className="gp-input-icon input-group-text">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        id="loginPassword"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control gp-form-control with-icon"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        className="input-group-text gp-input-icon"
                        style={{ borderLeft: 'none', borderRight: '2px solid #e2e8f0', borderRadius: '0 10px 10px 0', cursor: 'pointer' }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2 rounded-3" role="alert">
                      <i className="bi bi-exclamation-circle me-2"></i>{error}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary gp-btn-login w-100 text-white">
                    <i className="bi bi-arrow-right-circle me-2"></i>Sign In
                  </button>
                </form>

                <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                    Don't have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); switchPage('signup'); }} className="fw-semibold text-decoration-none" style={{ color: '#2e86c1' }}>
                      Sign Up
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="gp-features">
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Track applications to multiple schools
              </div>
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Manage deadlines and statuses
              </div>
              <div className="gp-feature-item">
                <div className="gp-feature-icon"><i className="bi bi-check2 text-white"></i></div>
                Get advisor feedback on your progress
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="gp-footer">
        GradPath &copy; 2026 Godwin &middot; Kenyon College
      </footer>
    </>
  );
}

export default App;