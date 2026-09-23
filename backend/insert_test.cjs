const db = require('better-sqlite3')('./storage/database/pos.db');
try {
  db.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('SYSTEM_ROLE', 'System Role', 'System')").run();
  console.log('roles done');
  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('SYSTEM_USER', 'SYSTEM_USER', 'dummy', 'System', 'User', 1, 'SYSTEM_ROLE')").run();
  console.log('users done');
  db.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('SYSTEM_SHIFT', 'SYSTEM_USER', 0, 'OPEN')").run();
  console.log('sessions done');
} catch (e) {
  console.error(e);
}
