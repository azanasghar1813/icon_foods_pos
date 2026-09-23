export default {
  version: '014',
  name: 'payment_engine',
  disableForeignKeys: true,

  up: (db) => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Rebuild order_payments with full enterprise schema
    //    The legacy table only had: id, order_id, shift_id, cashier_user_id,
    //    payment_method, amount, status, transaction_reference, notes, created_at
    // ─────────────────────────────────────────────────────────────────────────
    if (tables.includes('order_payments') && !tables.includes('_old_order_payments')) {
      db.exec('ALTER TABLE order_payments RENAME TO _old_order_payments');
    }

    db.exec(`
      -- Enterprise Order Payments Table
      CREATE TABLE IF NOT EXISTS order_payments (
        id                    TEXT PRIMARY KEY,
        order_id              TEXT NOT NULL,
        shift_id              TEXT NOT NULL,
        cashier_user_id       TEXT NOT NULL,
        business_date         TEXT NOT NULL,
        payment_method        TEXT NOT NULL,         -- CASH | CARD | JAZZCASH | EASYPAISA | BANK_TRANSFER | OTHER
        payment_method_label  TEXT,                  -- Human-readable snapshot (e.g. "Cash", "JazzCash")
        amount                REAL NOT NULL,         -- Amount applied to the order
        amount_received       REAL NOT NULL DEFAULT 0, -- Cash tendered (= amount for non-cash)
        change_returned       REAL NOT NULL DEFAULT 0, -- Change given back (cash only)
        transaction_reference TEXT,                  -- Card last-4 / reference number / cheque no
        approval_code         TEXT,                  -- Future: gateway approval code
        gateway_response      TEXT,                  -- Future: raw JSON from gateway
        notes                 TEXT,
        status                TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED | VOIDED | PENDING
        voided_at             DATETIME,
        void_reason           TEXT,
        voided_by_user_id     TEXT,
        sync_status           TEXT NOT NULL DEFAULT 'PENDING',
        synced_at             DATETIME,
        created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    // Migrate old payment rows if they exist
    if (tables.includes('_old_order_payments')) {
      db.exec(`
        INSERT INTO order_payments (
          id, order_id, shift_id, cashier_user_id, business_date, payment_method,
          amount, amount_received, change_returned, transaction_reference, notes,
          status, created_at
        )
        SELECT
          id,
          order_id,
          COALESCE(shift_id, 'MIGRATED'),
          COALESCE(cashier_user_id, 'MIGRATED'),
          COALESCE(
            (SELECT business_date FROM orders WHERE orders.id = _old_order_payments.order_id),
            strftime('%Y-%m-%d', _old_order_payments.created_at)
          ),
          UPPER(COALESCE(payment_method, 'CASH')),
          COALESCE(amount, 0),
          COALESCE(amount, 0),   -- amount_received mirrors amount for migrated rows
          0,                     -- change_returned unknown for migrated rows
          transaction_reference,
          notes,
          COALESCE(status, 'COMPLETED'),
          COALESCE(created_at, CURRENT_TIMESTAMP)
        FROM _old_order_payments
        WHERE id NOT IN (SELECT id FROM order_payments)
      `);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Create payment_receipts table — immutable receipt payloads
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id                TEXT PRIMARY KEY,
        payment_id        TEXT NOT NULL UNIQUE,
        order_id          TEXT NOT NULL,
        receipt_number    TEXT NOT NULL,
        payload           TEXT NOT NULL,   -- JSON blob: full receipt data
        generated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        printed_at        DATETIME,
        print_count       INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (payment_id) REFERENCES order_payments(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id)   REFERENCES orders(id)         ON DELETE CASCADE
      );
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Performance indexes
    // ─────────────────────────────────────────────────────────────────────────
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_order_payments_order_id     ON order_payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_payments_business_date ON order_payments(business_date);
      CREATE INDEX IF NOT EXISTS idx_order_payments_status       ON order_payments(status);
      CREATE INDEX IF NOT EXISTS idx_order_payments_method       ON order_payments(payment_method);
      CREATE INDEX IF NOT EXISTS idx_payment_receipts_order_id  ON payment_receipts(order_id);
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Seed default payment methods (idempotent — only inserts missing codes)
    // ─────────────────────────────────────────────────────────────────────────
    const defaultMethods = [
      { code: 'CASH',          name: 'Cash',          is_active: 1, display_order: 1, requires_reference: 0, requires_approval: 0 },
      { code: 'CARD',          name: 'Card',          is_active: 1, display_order: 2, requires_reference: 1, requires_approval: 0 },
      { code: 'JAZZCASH',      name: 'JazzCash',      is_active: 1, display_order: 3, requires_reference: 1, requires_approval: 0 },
      { code: 'EASYPAISA',     name: 'EasyPaisa',     is_active: 1, display_order: 4, requires_reference: 1, requires_approval: 0 },
      { code: 'BANK_TRANSFER', name: 'Bank Transfer', is_active: 1, display_order: 5, requires_reference: 1, requires_approval: 0 },
      { code: 'OTHER',         name: 'Other',         is_active: 1, display_order: 6, requires_reference: 0, requires_approval: 0 },
    ];

    // Check if payment_methods has the extra columns; add them if not
    const pmCols = db.prepare("PRAGMA table_info(payment_methods)").all().map(c => c.name);

    if (!pmCols.includes('requires_reference')) {
      db.exec('ALTER TABLE payment_methods ADD COLUMN requires_reference INTEGER NOT NULL DEFAULT 0');
    }
    if (!pmCols.includes('requires_approval')) {
      db.exec('ALTER TABLE payment_methods ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0');
    }
    if (!pmCols.includes('quick_cash_buttons')) {
      // JSON array of quick-cash button amounts, e.g. [500, 1000, 2000, 5000]
      db.exec("ALTER TABLE payment_methods ADD COLUMN quick_cash_buttons TEXT DEFAULT NULL");
    }
    if (!pmCols.includes('icon')) {
      db.exec("ALTER TABLE payment_methods ADD COLUMN icon TEXT DEFAULT NULL");
    }

    const insertMethod = db.prepare(`
      INSERT OR IGNORE INTO payment_methods (code, name, is_active, display_order, requires_reference, requires_approval)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const m of defaultMethods) {
      insertMethod.run(m.code, m.name, m.is_active, m.display_order, m.requires_reference, m.requires_approval);
    }

    // Seed default quick-cash buttons for CASH method
    db.exec(`
      UPDATE payment_methods
      SET quick_cash_buttons = '[500, 1000, 2000, 5000]'
      WHERE code = 'CASH' AND quick_cash_buttons IS NULL
    `);
  }
};
