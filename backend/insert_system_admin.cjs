const db = require('better-sqlite3')('./storage/database/pos.db');
try {
  db.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('admin_role', 'Admin Role', 'System Admin')").run();
  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('system_admin', 'system_admin', 'dummy', 'System', 'Admin', 1, 'admin_role')").run();
  db.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('dummy_session', 'system_admin', 0, 'OPEN')").run();
  
  // also update the active cart in DB if there is one? 
  // No, the foreign key fails during orders insertion, because cashier_user_id doesn't exist.
  // By adding 'system_admin' to users, the insertion will succeed!
  
  console.log("system_admin inserted.");
} catch(e) {
  console.error(e);
}
