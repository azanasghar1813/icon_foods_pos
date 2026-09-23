export const operationsSchema = `
  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_number TEXT UNIQUE, -- Business Identifier
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    is_vip INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Dining Tables
  CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    table_number TEXT NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'RESERVED'
    zone TEXT, -- e.g., 'Main Floor', 'Patio'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Cashier Sessions (Shift Tracking)
  CREATE TABLE IF NOT EXISTS cashier_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    terminal_id TEXT, -- Ties to application_settings terminal config
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_float REAL NOT NULL,
    closing_balance REAL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON cashier_sessions(user_id);

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

  -- Inventory Logs
  CREATE TABLE IF NOT EXISTS inventory_logs (
    id TEXT PRIMARY KEY,
    inventory_item_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    quantity_changed REAL NOT NULL,
    new_quantity REAL NOT NULL,
    reference_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
  );

  -- Expenses
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    recorded_by TEXT,
    expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON inventory_logs(inventory_item_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
`;
