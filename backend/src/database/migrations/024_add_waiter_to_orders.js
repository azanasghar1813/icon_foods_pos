export default {
  version: '024',
  name: 'add_waiter_to_orders',
  up: (db) => {
    // Add waiter_id
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN waiter_id TEXT REFERENCES users(id) ON DELETE SET NULL`).run();
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration 24 error (waiter_id):', e);
      }
    }

    // Add waiter_name_snapshot
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN waiter_name_snapshot TEXT`).run();
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration 24 error (waiter_name_snapshot):', e);
      }
    }

    // Create Index
    try {
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id)`).run();
    } catch (e) {
      console.error('Migration 24 error (idx_orders_waiter):', e);
    }
  }
};
