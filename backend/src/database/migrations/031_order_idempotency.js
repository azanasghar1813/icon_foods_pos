export default {
  version: '031',
  name: 'order_idempotency',
  up: (db) => {
    // Check if idempotency_key column exists in orders table
    const columns = db.prepare("PRAGMA table_info(orders)").all();
    const hasIdempotencyKey = columns.some(col => col.name === 'idempotency_key');

    if (!hasIdempotencyKey) {
      console.log('Adding idempotency_key to orders table...');
      db.exec("ALTER TABLE orders ADD COLUMN idempotency_key TEXT;");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;");
    }
  },
  down: (db) => {
    console.log('Skipping down migration for idempotency_key in orders table.');
  }
};
