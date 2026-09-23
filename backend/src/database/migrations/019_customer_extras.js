export default {
  version: '019',
  name: 'customer_extras',

  up: (db) => {
    try {
      db.exec(`ALTER TABLE customers ADD COLUMN is_vip INTEGER DEFAULT 0;`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) throw e;
    }
    
    try {
      db.exec(`ALTER TABLE customers ADD COLUMN notes TEXT;`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) throw e;
    }
  },

  down: (db) => {
    // SQLite doesn't easily support dropping columns without recreating the table.
    // However, for newer SQLite versions ALTER TABLE DROP COLUMN is supported.
    try {
      db.exec(`
        ALTER TABLE customers DROP COLUMN is_vip;
        ALTER TABLE customers DROP COLUMN notes;
      `);
    } catch (e) {
      console.warn("Could not drop columns in down migration (requires SQLite 3.35.0+)");
    }
  }
};
