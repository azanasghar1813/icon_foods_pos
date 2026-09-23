export default {
  version: '017',
  name: 'order_history_engine',
  disableForeignKeys: true,

  up: (db) => {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Order Audit Trail — structured audit log per order
    //    Separate from order_timeline (which is operational state machine events).
    //    audit_trail captures WHO changed WHAT with old/new values for compliance.
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_audit_trail (
        id                  TEXT PRIMARY KEY,
        order_id            TEXT NOT NULL,
        user_id             TEXT,
        action              TEXT NOT NULL,          -- ORDER_REOPENED, ORDER_CANCELLED, REPRINT, AUDIT_VIEWED, etc.
        entity_type         TEXT NOT NULL DEFAULT 'ORDER',
        entity_id           TEXT,
        old_value           TEXT,                   -- JSON snapshot of previous state
        new_value           TEXT,                   -- JSON snapshot of new state
        reason              TEXT,
        device_id           TEXT,
        branch_id           TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
        permission_override INTEGER NOT NULL DEFAULT 0,
        ip_address          TEXT,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Order Search Index — denormalized text blob for fast FTS
    //    Rebuilt via trigger on every order mutation.
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_search_index (
        order_id       TEXT PRIMARY KEY,
        search_text    TEXT NOT NULL DEFAULT '',    -- concatenated searchable fields
        order_number   TEXT,
        cashier_name   TEXT,
        customer_name  TEXT,
        table_label    TEXT,
        phone          TEXT,
        notes          TEXT,
        product_names  TEXT,                        -- space-separated item names
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FTS5 Virtual Table for enterprise-grade text search
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS order_search_fts
      USING fts5(
        order_id UNINDEXED,
        search_text,
        content='order_search_index',
        content_rowid='rowid'
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Performance indexes for history queries
    //    These are composite indexes covering all major filter combinations.
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      -- Primary history list query patterns
      CREATE INDEX IF NOT EXISTS idx_orders_history_date_state
        ON orders(business_date DESC, lifecycle_state, branch_id);

      CREATE INDEX IF NOT EXISTS idx_orders_history_cashier_date
        ON orders(cashier_user_id, business_date DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_history_payment_state
        ON orders(payment_state, business_date DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_history_type_date
        ON orders(order_type, business_date DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_history_grand_total
        ON orders(grand_total, business_date DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_history_customer_date
        ON orders(customer_id, business_date DESC) WHERE customer_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_orders_history_table_date
        ON orders(table_id, business_date DESC) WHERE table_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_orders_history_completed_at
        ON orders(completed_at DESC) WHERE completed_at IS NOT NULL;

      -- Audit trail indexes
      CREATE INDEX IF NOT EXISTS idx_audit_trail_order
        ON order_audit_trail(order_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_trail_user
        ON order_audit_trail(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_trail_action
        ON order_audit_trail(action, created_at DESC);

      -- Search index
      CREATE INDEX IF NOT EXISTS idx_search_index_updated
        ON order_search_index(updated_at);
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Seed existing orders into search_index (catch-up population)
    // ─────────────────────────────────────────────────────────────────────────
    const existingOrders = db.prepare(
      "SELECT id, order_number, cashier_user_id, notes FROM orders LIMIT 10000"
    ).all();

    const insertSearch = db.prepare(`
      INSERT OR REPLACE INTO order_search_index
        (order_id, search_text, order_number, notes, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const o of existingOrders) {
      const searchText = [
        o.order_number || '',
        o.notes || ''
      ].join(' ').trim();

      insertSearch.run(o.id, searchText, o.order_number, o.notes || '');
    }

    // Seed FTS from index
    db.exec(`
      INSERT OR REPLACE INTO order_search_fts(order_id, search_text)
      SELECT order_id, search_text FROM order_search_index;
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 017_order_history_engine.');
  }
};
