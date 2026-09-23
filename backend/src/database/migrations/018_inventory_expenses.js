export default {
  version: '018',
  name: 'inventory_expenses',

  up: (db) => {
    db.exec(`
      -- Inventory Items
      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        category TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        min_stock_level REAL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost REAL DEFAULT 0,
        last_restock_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Inventory Logs (Audit trail for stock changes)
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id TEXT PRIMARY KEY,
        inventory_item_id TEXT NOT NULL,
        user_id TEXT,
        action TEXT NOT NULL, -- 'ADD', 'REMOVE', 'ADJUST', 'SALE'
        quantity_changed REAL NOT NULL,
        new_quantity REAL NOT NULL,
        reference_id TEXT, -- e.g., Order ID or Purchase Order ID
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
      );

      -- Expenses
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL, -- 'Utilities', 'Payroll', 'Supplies', 'Maintenance', etc.
        amount REAL NOT NULL,
        description TEXT,
        recorded_by TEXT,
        expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON inventory_logs(inventory_item_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    `);
  },

  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS expenses;
      DROP TABLE IF EXISTS inventory_logs;
      DROP TABLE IF EXISTS inventory_items;
    `);
  }
};
