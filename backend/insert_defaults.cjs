const db = require('better-sqlite3')('./storage/database/pos.db');
try {
  db.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('SYSTEM_ROLE', 'System Role', 'System')").run();
  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('DEFAULT_USER', 'DEFAULT_USER', 'dummy', 'Default', 'User', 1, 'SYSTEM_ROLE')").run();
  db.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('DEFAULT_SESSION', 'DEFAULT_USER', 0, 'OPEN')").run();
  console.log("DEFAULT_USER and DEFAULT_SESSION inserted.");
} catch(e) {
  console.error(e);
}
