export default {
  version: '030',
  name: 'add_payment_idempotency',
  up: (db) => {
    // Check if column exists first to be idempotent
    const tableInfo = db.prepare('PRAGMA table_info(order_payments)').all();
    const hasIdempotencyKey = tableInfo.some(col => col.name === 'idempotency_key');

    if (!hasIdempotencyKey) {
      db.exec(`
        ALTER TABLE order_payments 
        ADD COLUMN idempotency_key TEXT;
      `);
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_idempotency 
        ON order_payments(idempotency_key) 
        WHERE idempotency_key IS NOT NULL;
      `);
    }
  }
};
