export const lookupsSchema = `
  -- Payment Methods
  CREATE TABLE IF NOT EXISTS payment_methods (
    code TEXT PRIMARY KEY, -- 'CASH', 'CARD', 'JAZZCASH'
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Order Statuses
  CREATE TABLE IF NOT EXISTS order_statuses (
    code TEXT PRIMARY KEY, -- 'PENDING', 'COMPLETED', etc.
    name TEXT NOT NULL,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0, -- Prevents deletion of core statuses
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Kitchen Statuses
  CREATE TABLE IF NOT EXISTS kitchen_statuses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Shift Statuses
  CREATE TABLE IF NOT EXISTS shift_statuses (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;
