export const settingsSchema = `
  -- Business Settings (Key-Value configuration)
  CREATE TABLE IF NOT EXISTS business_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Application Settings (Local terminal configuration)
  CREATE TABLE IF NOT EXISTS application_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Printers
  CREATE TABLE IF NOT EXISTS printers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'RECEIPT', 'KITCHEN', 'BAR'
    driver_type TEXT NOT NULL DEFAULT 'ESCPOS_LAN', -- 'ESCPOS_LAN', 'ESCPOS_BT', 'ESCPOS_USB', 'VIRTUAL'
    connection_string TEXT, -- IP:PORT, COM port, or USB name
    ip_address TEXT, -- legacy
    port INTEGER,    -- legacy
    is_active INTEGER NOT NULL DEFAULT 1,
    paper_width INTEGER DEFAULT 80,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;
