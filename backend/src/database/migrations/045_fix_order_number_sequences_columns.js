// backend/src/database/migrations/045_fix_order_number_sequences_columns.js
export default {
  version: '045',
  name: 'fix_order_number_sequences_columns',
  
  up: (db) => {
    const cols = db.prepare(`PRAGMA table_info(order_number_sequences)`).all().map(c => c.name);

    if (cols.includes('date_key')) {
      console.log('[Migration] order_number_sequences already has date_key — nothing to do.');
      return;
    }

    console.log('[Migration] Rebuilding order_number_sequences with date_key column...');

    const hadBusinessDate = cols.includes('business_date');

    db.exec(`ALTER TABLE order_number_sequences RENAME TO order_number_sequences_old;`);

    db.exec(`
      CREATE TABLE order_number_sequences (
        branch_id TEXT NOT NULL,
        date_key TEXT NOT NULL,
        prefix TEXT NOT NULL,
        last_sequence INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (branch_id, date_key, prefix)
      );
    `);

    if (hadBusinessDate) {
      const oldRows = db.prepare(`SELECT * FROM order_number_sequences_old`).all();
      const insert = db.prepare(`
        INSERT OR IGNORE INTO order_number_sequences (branch_id, date_key, prefix, last_sequence)
        VALUES (?, ?, ?, ?)
      `);
      for (const row of oldRows) {
        insert.run(row.branch_id, row.business_date, row.prefix, row.last_sequence);
      }
      console.log(`[Migration] Migrated ${oldRows.length} sequence rows to date_key column.`);
    }

    db.exec(`DROP TABLE order_number_sequences_old;`);
  },

  down: (db) => {
    // Not reversible — sequence counters are ephemeral and get rebuilt
    // automatically from the orders table's own order_number values.
  }
};
