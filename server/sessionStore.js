const session = require('express-session');

class MySQLSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  get(sid, callback) {
    this.pool.query(
      'SELECT data FROM gradpath_sessions WHERE sid = ? AND expiresAt > NOW()',
      [sid]
    ).then(([rows]) => {
      if (rows.length === 0) {
        return callback(null, null);
      }
      try {
        const data = JSON.parse(rows[0].data);
        callback(null, data);
      } catch (err) {
        callback(err);
      }
    }).catch(callback);
  }

  set(sid, sessionData, callback) {
    const data = JSON.stringify(sessionData);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    this.pool.query(
      'INSERT INTO gradpath_sessions (sid, data, expiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?, expiresAt = ?',
      [sid, data, expiresAt, data, expiresAt]
    ).then(() => {
      callback();
    }).catch(callback);
  }

  destroy(sid, callback) {
    this.pool.query(
      'DELETE FROM gradpath_sessions WHERE sid = ?',
      [sid]
    ).then(() => {
      callback();
    }).catch(callback);
  }

  clear(callback) {
    this.pool.query(
      'DELETE FROM gradpath_sessions'
    ).then(() => {
      callback();
    }).catch(callback);
  }
}

module.exports = MySQLSessionStore;
