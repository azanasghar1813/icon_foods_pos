export default {
  version: '010',
  name: 'order_engine',

  up: (db) => {
    // SQLite doesn't strictly enforce ENUM constraints in TEXT, 
    // so we just add the missing columns for the Hold Engine.
    try {
      db.exec(`
        ALTER TABLE orders ADD COLUMN hold_name TEXT;
        ALTER TABLE orders ADD COLUMN held_at DATETIME;
      `);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
    }
  },

  down: (db) => {
    console.warn('Manual rollback required for 010_order_engine.');
  }
};
