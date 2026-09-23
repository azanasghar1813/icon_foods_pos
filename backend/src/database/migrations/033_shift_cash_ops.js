export default {
  version: '033',
  name: 'shift_cash_ops',
  up: (db) => {
    const hasColumn = (tableName, columnName) => {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
      return cols.includes(columnName);
    };

    if (!hasColumn('cashier_sessions', 'actual_cash')) {
      db.exec(`ALTER TABLE cashier_sessions ADD COLUMN actual_cash REAL;`);
    }
    if (!hasColumn('cashier_sessions', 'expected_cash')) {
      db.exec(`ALTER TABLE cashier_sessions ADD COLUMN expected_cash REAL;`);
    }
    if (!hasColumn('cashier_sessions', 'difference')) {
      db.exec(`ALTER TABLE cashier_sessions ADD COLUMN difference REAL;`);
    }
    if (!hasColumn('cashier_sessions', 'notes')) {
      db.exec(`ALTER TABLE cashier_sessions ADD COLUMN notes TEXT;`);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS cash_drops (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        destination TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES cashier_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS paid_outs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        amount REAL NOT NULL,
        purpose TEXT,
        approved_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES cashier_sessions(id) ON DELETE CASCADE
      );
    `);
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS cash_drops;`);
    db.exec(`DROP TABLE IF EXISTS paid_outs;`);
  }
};
