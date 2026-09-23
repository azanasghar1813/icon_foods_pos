export default {
  version: '003',
  name: 'auth_sessions',

  up: (db) => {
    // 1. Create user_sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_id TEXT NOT NULL UNIQUE, -- The JWT ID (jti)
        device_info TEXT, -- e.g., 'Terminal 1', 'Admin PC'
        login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        logout_time DATETIME,
        status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'REVOKED'
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
    `);

    // 2. Expand users table for security features
    db.exec(`
      ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    `);
    
    db.exec(`
      ALTER TABLE users ADD COLUMN locked_until DATETIME;
    `);

    db.exec(`
      ALTER TABLE users ADD COLUMN force_pin_change INTEGER NOT NULL DEFAULT 0;
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 003_auth_sessions.');
  }
};
