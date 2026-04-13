import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState(null);

  // On page load, check if user is already logged in (session persistence)
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch server status
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch(() => setServerStatus({ status: 'error', database: 'error' }));
  }, []);

  // Handle login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email })
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        setName('');
        setEmail('');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>GradPath</h1>
        <p className="subtitle">Graduate School Application Tracker</p>
      </header>

      {user ? (
        /* ===== LOGGED-IN STATE ===== */
        <div className="card">
          <h2>Welcome, {user.name}!</h2>
          <p className="email">{user.email}</p>
          <p className="session-note">
            Session is active. Refresh the page to verify persistence.
          </p>
          <button onClick={handleLogout} className="btn btn-logout">
            Log Out
          </button>
        </div>
      ) : (
        /* ===== LOGGED-OUT STATE — LOGIN FORM ===== */
        <div className="card">
          <h2>Sign In</h2>
          <p>Enter your name and email to get started.</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn btn-login">
              Log In
            </button>
          </form>
        </div>
      )}

      {/* Server status indicator */}
      {serverStatus && (
        <div className="status-bar">
          Server: {serverStatus.status || 'unknown'} | DB:{' '}
          {serverStatus.database || 'unknown'}
        </div>
      )}
    </div>
  );
}

export default App;
