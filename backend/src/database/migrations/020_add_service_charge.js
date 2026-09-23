export default {
  version: '020',
  name: 'add_service_charge_to_orders',
  
  up: (db) => {
    const hasColumn = (tableName, columnName) => {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
      return cols.includes(columnName);
    };

    if (!hasColumn('orders', 'service_charge')) {
      db.exec(`
        ALTER TABLE orders ADD COLUMN service_charge REAL NOT NULL DEFAULT 0;
      `);
    }
  },

  down: (db) => {
    // SQLite doesn't support dropping columns easily before version 3.35.0,
    // but newer versions support ALTER TABLE ... DROP COLUMN.
    // Assuming newer sqlite or leaving empty if not strictly needed.
    // We'll provide it for completeness assuming modern sqlite.
    try {
      db.exec(`
        ALTER TABLE orders DROP COLUMN service_charge;
      `);
    } catch (e) {
      console.log("Could not drop service_charge column on downgrade (likely older SQLite).");
    }
  }
};
