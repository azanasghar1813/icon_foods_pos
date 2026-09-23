const db = require('better-sqlite3')('./storage/database/pos.db'); 
console.log('roles:', db.prepare("SELECT * FROM roles WHERE id='SYSTEM_ROLE'").get()); 
console.log('users:', db.prepare("SELECT * FROM users WHERE id='SYSTEM_USER'").get()); 
console.log('sessions:', db.prepare("SELECT * FROM cashier_sessions WHERE id='SYSTEM_SHIFT'").get());
