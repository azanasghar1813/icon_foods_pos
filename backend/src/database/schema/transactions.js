export const transactionsSchema = `
  -- Orders Master Table
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    business_date TEXT NOT NULL,
    branch_id TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
    cashier_user_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    customer_id TEXT,
    table_id TEXT,
    order_type TEXT NOT NULL DEFAULT 'DINE_IN',
    lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
    kitchen_state TEXT NOT NULL DEFAULT 'PENDING',
    payment_state TEXT NOT NULL DEFAULT 'UNPAID',
    delivery_state TEXT DEFAULT NULL,
    waiter_id TEXT,
    waiter_name_snapshot TEXT,
    rider_id TEXT,
    rider_name_snapshot TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL DEFAULT 0,
    discount_total REAL NOT NULL DEFAULT 0,
    tip_total REAL NOT NULL DEFAULT 0,
    delivery_fee REAL NOT NULL DEFAULT 0,
    service_charge REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    paid_total REAL NOT NULL DEFAULT 0,
    due_total REAL NOT NULL DEFAULT 0,
    hold_name TEXT,
    held_at DATETIME,
    notes TEXT,
    sync_status TEXT NOT NULL DEFAULT 'PENDING',
    synced_at DATETIME,
    sync_version INTEGER NOT NULL DEFAULT 1,
    sync_hash TEXT,
    idempotency_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    archived_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE SET NULL,
    FOREIGN KEY (shift_id) REFERENCES cashier_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Order Items Snapshot Table
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name_snapshot TEXT NOT NULL,
    product_code_snapshot TEXT,
    base_unit_price REAL NOT NULL DEFAULT 0,
    final_unit_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_name TEXT DEFAULT 'VAT',
    is_tax_inclusive INTEGER NOT NULL DEFAULT 0,
    kitchen_station_id TEXT,
    kitchen_station_name_snapshot TEXT,
    estimated_prep_minutes INTEGER DEFAULT 10,
    kitchen_state TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Item Variants Snapshot Table
  CREATE TABLE IF NOT EXISTS order_item_variants (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    variant_name_snapshot TEXT NOT NULL,
    variant_sku_snapshot TEXT,
    price_adjustment REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
  );

  -- Order Item Modifiers Snapshot Table
  CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL,
    modifier_id TEXT NOT NULL,
    group_id TEXT,
    group_name_snapshot TEXT,
    modifier_name_snapshot TEXT NOT NULL,
    price_adjustment REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
  );

  -- Order Item Addons Snapshot Table
  CREATE TABLE IF NOT EXISTS order_item_addons (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL,
    addon_id TEXT NOT NULL,
    addon_name_snapshot TEXT NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
  );

  -- Order Combo Components Snapshot Table
  CREATE TABLE IF NOT EXISTS order_combo_components (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL,
    component_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name_snapshot TEXT NOT NULL,
    variant_snapshot TEXT,
    price_adjustment REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
  );

  -- Order Timeline Table
  CREATE TABLE IF NOT EXISTS order_timeline (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    user_id TEXT,
    event_type TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT,
    description TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Payments Table
  CREATE TABLE IF NOT EXISTS order_payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    cashier_user_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    transaction_reference TEXT,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Metadata Key-Value Table
  CREATE TABLE IF NOT EXISTS order_metadata (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    meta_key TEXT NOT NULL,
    meta_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Tags Table
  CREATE TABLE IF NOT EXISTS order_tags (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    tag_color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Attachments Table
  CREATE TABLE IF NOT EXISTS order_attachments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  -- Order Number Sequences Table
  CREATE TABLE IF NOT EXISTS order_number_sequences (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
    business_date TEXT NOT NULL DEFAULT 'GLOBAL',
    prefix TEXT NOT NULL DEFAULT 'POS',
    last_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
  CREATE INDEX IF NOT EXISTS idx_orders_date_state ON orders(business_date, lifecycle_state);
  CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
  CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
  CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_history_completed_at
        ON orders(completed_at DESC) WHERE completed_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
  CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_item_variants_item ON order_item_variants(order_item_id);
  CREATE INDEX IF NOT EXISTS idx_item_modifiers_item ON order_item_modifiers(order_item_id);
  CREATE INDEX IF NOT EXISTS idx_item_addons_item ON order_item_addons(order_item_id);
  CREATE INDEX IF NOT EXISTS idx_combo_components_item ON order_combo_components(order_item_id);
  CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_idempotency ON order_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_order_metadata_order ON order_metadata(order_id, meta_key);
  CREATE INDEX IF NOT EXISTS idx_order_tags_order ON order_tags(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_order_num_seq_unique ON order_number_sequences(branch_id, business_date, prefix);
`;
