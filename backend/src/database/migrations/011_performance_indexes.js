export default {
  version: '011',
  name: 'performance_indexes',
  up: (db) => {
    // Products indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_lifecycle_state ON products(lifecycle_state);
      CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(visibility);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    `);

    // Categories indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
      CREATE INDEX IF NOT EXISTS idx_categories_lifecycle_state ON categories(lifecycle_state);
      CREATE INDEX IF NOT EXISTS idx_categories_visibility ON categories(visibility);
    `);

    // Users & Roles indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Orders indexes - wrapped safely to accommodate enterprise order schema updates
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      `);
    } catch (e) {
      // Column 'status' or 'orders' table may be in enterprise format
    }

    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_orders_cashier_session_id ON orders(cashier_session_id);
      `);
    } catch (e) {
      // Column 'cashier_session_id' replaced by 'shift_id' in enterprise schema
    }
  },
  down: (db) => {
    db.exec(`
      DROP INDEX IF NOT EXISTS idx_products_category_id;
      DROP INDEX IF NOT EXISTS idx_products_lifecycle_state;
      DROP INDEX IF NOT EXISTS idx_products_visibility;
      DROP INDEX IF NOT EXISTS idx_products_status;
      
      DROP INDEX IF NOT EXISTS idx_categories_parent_id;
      DROP INDEX IF NOT EXISTS idx_categories_lifecycle_state;
      DROP INDEX IF NOT EXISTS idx_categories_visibility;

      DROP INDEX IF NOT EXISTS idx_users_role_id;
      DROP INDEX IF NOT EXISTS idx_users_email;

      DROP INDEX IF NOT EXISTS idx_orders_cashier_session_id;
      DROP INDEX IF NOT EXISTS idx_orders_status;
    `);
  }
};
