export default {
  version: '013',
  name: 'cart_cache',

  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cart_cache (
        session_id TEXT PRIMARY KEY,
        cashier_user_id TEXT NOT NULL,
        branch_id TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
        cart_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  down: (db) => {
    db.exec('DROP TABLE IF EXISTS cart_cache;');
  }
};
