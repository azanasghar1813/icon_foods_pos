export default {
  version: '015',
  name: 'kitchen_workflow',

  up: (db) => {
    const addColumn = (sql) => {
      try {
        db.exec(sql);
      } catch (error) {
        if (!String(error.message).includes('duplicate column name')) {
          throw error;
        }
      }
    };

    addColumn(`ALTER TABLE order_items ADD COLUMN kitchen_started_at DATETIME;`);
    addColumn(`ALTER TABLE order_items ADD COLUMN kitchen_ready_at DATETIME;`);
    addColumn(`ALTER TABLE order_items ADD COLUMN kitchen_served_at DATETIME;`);
    addColumn(`ALTER TABLE order_items ADD COLUMN kitchen_completed_at DATETIME;`);
    addColumn(`ALTER TABLE order_items ADD COLUMN kitchen_cancelled_at DATETIME;`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_state ON order_items(kitchen_state, kitchen_station_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_orders_kitchen_state ON orders(lifecycle_state, payment_state, branch_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_order_metadata_priority ON order_metadata(order_id, meta_key);
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 015_kitchen_workflow.');
  }
};
