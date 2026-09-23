export default {
  version: '012',
  name: 'enterprise_order_foundation',
  disableForeignKeys: true,

  up: (db) => {
    const hasColumn = (tableName, columnName) => {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
      return cols.includes(columnName);
    };

    // 1. Drop existing legacy tables if present to avoid foreign key references pointing to renamed tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    if (tables.includes('orders') && !tables.includes('_old_orders')) {
      db.exec('ALTER TABLE orders RENAME TO _old_orders');
    }
    if (tables.includes('order_items') && !tables.includes('_old_order_items')) {
      db.exec('ALTER TABLE order_items RENAME TO _old_order_items');
    }
    if (tables.includes('order_item_modifiers') && !tables.includes('_old_order_item_modifiers')) {
      db.exec('ALTER TABLE order_item_modifiers RENAME TO _old_order_item_modifiers');
    }
    if (tables.includes('payments') && !tables.includes('_old_payments')) {
      db.exec('ALTER TABLE payments RENAME TO _old_payments');
    }

    // Drop legacy child tables if they exist with outdated foreign keys
    db.exec(`
      DROP TABLE IF EXISTS order_timeline;
      DROP TABLE IF EXISTS order_metadata;
      DROP TABLE IF EXISTS order_tags;
      DROP TABLE IF EXISTS order_attachments;
      DROP TABLE IF EXISTS order_item_variants;
      DROP TABLE IF EXISTS order_item_addons;
      DROP TABLE IF EXISTS order_combo_components;
    `);

    // 2. Create modern enterprise schema tables
    db.exec(`
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
        subtotal REAL NOT NULL DEFAULT 0,
        tax_total REAL NOT NULL DEFAULT 0,
        discount_total REAL NOT NULL DEFAULT 0,
        tip_total REAL NOT NULL DEFAULT 0,
        delivery_fee REAL NOT NULL DEFAULT 0,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        archived_at DATETIME,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE SET NULL,
        FOREIGN KEY (shift_id) REFERENCES cashier_sessions(id) ON DELETE RESTRICT,
        FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE RESTRICT
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

      -- Order Timeline / Audit Trail Table
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );

      -- Order Metadata Key-Value Store
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

      -- Business Order Sequence Generator Counter
      CREATE TABLE IF NOT EXISTS order_number_sequences (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL DEFAULT 'DEFAULT_BRANCH',
        business_date TEXT NOT NULL DEFAULT 'GLOBAL',
        prefix TEXT NOT NULL DEFAULT 'POS',
        last_sequence INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Migrate data from old tables if present
    const updatedTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    if (updatedTables.includes('_old_orders')) {
      const hasBusinessDate = hasColumn('_old_orders', 'business_date');
      const hasBranchId = hasColumn('_old_orders', 'branch_id');
      const hasCashierUserId = hasColumn('_old_orders', 'cashier_user_id');
      const hasUserId = hasColumn('_old_orders', 'user_id');
      const hasShiftId = hasColumn('_old_orders', 'shift_id');
      const hasCashierSessionId = hasColumn('_old_orders', 'cashier_session_id');
      const hasLifecycleState = hasColumn('_old_orders', 'lifecycle_state');
      const hasStatus = hasColumn('_old_orders', 'status');
      const hasCustomerId = hasColumn('_old_orders', 'customer_id');
      const hasTableId = hasColumn('_old_orders', 'table_id');
      const hasOrderType = hasColumn('_old_orders', 'order_type');
      const hasSubtotal = hasColumn('_old_orders', 'subtotal');
      const hasTaxTotal = hasColumn('_old_orders', 'tax_total');
      const hasDiscountTotal = hasColumn('_old_orders', 'discount_total');
      const hasGrandTotal = hasColumn('_old_orders', 'grand_total');
      const hasHoldName = hasColumn('_old_orders', 'hold_name');
      const hasHeldAt = hasColumn('_old_orders', 'held_at');
      const hasCreatedAt = hasColumn('_old_orders', 'created_at');
      const hasUpdatedAt = hasColumn('_old_orders', 'updated_at');

      const cashierUserExpr = hasCashierUserId ? 'cashier_user_id' : (hasUserId ? 'user_id' : "'SYSTEM'");
      const shiftExpr = hasShiftId ? 'shift_id' : (hasCashierSessionId ? 'cashier_session_id' : "'SYSTEM_SHIFT'");
      const statusExpr = hasLifecycleState ? 'lifecycle_state' : (hasStatus ? 'status' : "'DRAFT'");
      const createdAtExpr = hasCreatedAt ? 'created_at' : 'CURRENT_TIMESTAMP';
      const updatedAtExpr = hasUpdatedAt ? 'updated_at' : createdAtExpr;
      const businessDateExpr = hasBusinessDate
        ? `COALESCE(business_date, strftime('%Y-%m-%d', ${createdAtExpr}))`
        : `strftime('%Y-%m-%d', ${createdAtExpr})`;

      const branchExpr = hasBranchId ? "COALESCE(branch_id, 'DEFAULT_BRANCH')" : "'DEFAULT_BRANCH'";

      db.exec(`
        INSERT INTO orders (
          id, order_number, business_date, branch_id, cashier_user_id, shift_id, customer_id, table_id,
          order_type, lifecycle_state, kitchen_state, payment_state, subtotal, tax_total, discount_total,
          grand_total, paid_total, due_total, hold_name, held_at, created_at, updated_at
        )
        SELECT 
          id,
          order_number,
          ${businessDateExpr} AS business_date,
          ${branchExpr} AS branch_id,
          ${cashierUserExpr} AS cashier_user_id,
          ${shiftExpr} AS shift_id,
          ${hasCustomerId ? 'customer_id' : 'NULL'} AS customer_id,
          ${hasTableId ? 'table_id' : 'NULL'} AS table_id,
          ${hasOrderType ? "COALESCE(order_type, 'DINE_IN')" : "'DINE_IN'"},
          COALESCE(${statusExpr}, 'DRAFT') AS lifecycle_state,
          'PENDING' AS kitchen_state,
          CASE WHEN ${statusExpr} = 'PAID' THEN 'PAID' ELSE 'UNPAID' END AS payment_state,
          ${hasSubtotal ? 'COALESCE(subtotal, 0)' : '0'},
          ${hasTaxTotal ? 'COALESCE(tax_total, 0)' : '0'},
          ${hasDiscountTotal ? 'COALESCE(discount_total, 0)' : '0'},
          ${hasGrandTotal ? 'COALESCE(grand_total, 0)' : '0'},
          CASE WHEN ${statusExpr} = 'PAID' THEN ${hasGrandTotal ? 'COALESCE(grand_total, 0)' : '0'} ELSE 0 END AS paid_total,
          CASE WHEN ${statusExpr} = 'PAID' THEN 0 ELSE ${hasGrandTotal ? 'COALESCE(grand_total, 0)' : '0'} END AS due_total,
          ${hasHoldName ? 'hold_name' : 'NULL'} AS hold_name,
          ${hasHeldAt ? 'held_at' : 'NULL'} AS held_at,
          ${createdAtExpr} AS created_at,
          ${updatedAtExpr} AS updated_at
        FROM _old_orders
      `);
      db.exec('DROP TABLE _old_orders');
    }

    if (updatedTables.includes('_old_order_items')) {
      const hasProductNameSnapshot = hasColumn('_old_order_items', 'product_name_snapshot');
      const hasProductCodeSnapshot = hasColumn('_old_order_items', 'product_code_snapshot');
      const hasBaseUnitPrice = hasColumn('_old_order_items', 'base_unit_price');
      const hasUnitPrice = hasColumn('_old_order_items', 'unit_price');
      const hasKitchenState = hasColumn('_old_order_items', 'kitchen_state');
      const hasStatus = hasColumn('_old_order_items', 'status');
      const hasSubtotal = hasColumn('_old_order_items', 'subtotal');
      const hasNotes = hasColumn('_old_order_items', 'notes');
      const hasQuantity = hasColumn('_old_order_items', 'quantity');
      const hasCreatedAt = hasColumn('_old_order_items', 'created_at');

      const productNameExpr = hasProductNameSnapshot ? 'oi.product_name_snapshot' : 'p.name';
      const productCodeExpr = hasProductCodeSnapshot ? 'oi.product_code_snapshot' : 'p.product_code';
      const unitPriceExpr = hasBaseUnitPrice ? 'oi.base_unit_price' : (hasUnitPrice ? 'oi.unit_price' : '0');
      const itemStateExpr = hasKitchenState
        ? "COALESCE(oi.kitchen_state, 'PENDING')"
        : (hasStatus ? "COALESCE(oi.status, 'PENDING')" : "'PENDING'");
      const itemCreatedAtExpr = hasCreatedAt ? 'oi.created_at' : 'CURRENT_TIMESTAMP';

      db.exec(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name_snapshot, product_code_snapshot,
          base_unit_price, final_unit_price, quantity, subtotal, discount_amount,
          tax_amount, total_amount, notes, kitchen_state, created_at
        )
        SELECT 
          oi.id,
          oi.order_id,
          oi.product_id,
          COALESCE(${productNameExpr}, d.name, 'Item') AS product_name_snapshot,
          COALESCE(${productCodeExpr}, d.code, 'SKU') AS product_code_snapshot,
          COALESCE(${unitPriceExpr}, 0) AS base_unit_price,
          COALESCE(${unitPriceExpr}, 0) AS final_unit_price,
          ${hasQuantity ? 'oi.quantity' : '1'} AS quantity,
          ${hasSubtotal ? 'oi.subtotal' : '0'} AS subtotal,
          0 AS discount_amount,
          0 AS tax_amount,
          ${hasSubtotal ? 'oi.subtotal' : '0'} AS total_amount,
          ${hasNotes ? 'oi.notes' : 'NULL'} AS notes,
          ${itemStateExpr} AS kitchen_state,
          ${itemCreatedAtExpr} AS created_at
        FROM _old_order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN deals d ON oi.product_id = d.id
      `);
      db.exec('DROP TABLE _old_order_items');
    }

    if (updatedTables.includes('_old_order_item_modifiers')) {
      db.exec(`
        INSERT INTO order_item_modifiers (
          id, order_item_id, modifier_id, modifier_name_snapshot, price_adjustment, quantity, created_at
        )
        SELECT 
          oim.id,
          oim.order_item_id,
          oim.modifier_id,
          COALESCE(m.name, 'Modifier') AS modifier_name_snapshot,
          oim.price_adjustment,
          1 AS quantity,
          oim.created_at
        FROM _old_order_item_modifiers oim
        LEFT JOIN modifiers m ON oim.modifier_id = m.id
      `);
      db.exec('DROP TABLE _old_order_item_modifiers');
    }

    if (updatedTables.includes('_old_payments')) {
      const payCols = db.prepare("PRAGMA table_info(_old_payments)").all().map(c => c.name);
      const hasShiftId = payCols.includes('shift_id');
      const hasCashierSessionId = payCols.includes('cashier_session_id');
      const hasCashierUserId = payCols.includes('cashier_user_id');
      const hasPaymentMethod = payCols.includes('payment_method');
      const hasAmount = payCols.includes('amount');
      const hasStatus = payCols.includes('status');
      const hasTransactionReference = payCols.includes('transaction_reference');
      const hasCreatedAt = payCols.includes('created_at');

      const shiftExpr = hasShiftId
        ? 'p.shift_id'
        : (hasCashierSessionId ? 'p.cashier_session_id' : "'SYSTEM_SHIFT'");
      const userExpr = hasCashierUserId ? 'p.cashier_user_id' : "'SYSTEM_USER'";
      const paymentMethodExpr = hasPaymentMethod ? 'p.payment_method' : "'CASH'";
      const amountExpr = hasAmount ? 'p.amount' : '0';
      const statusExpr = hasStatus ? 'COALESCE(p.status, \'COMPLETED\')' : "'COMPLETED'";
      const txRefExpr = hasTransactionReference ? 'p.transaction_reference' : 'NULL';
      const createdAtExpr = hasCreatedAt ? 'p.created_at' : 'CURRENT_TIMESTAMP';

      db.exec(`
        INSERT INTO order_payments (
          id, order_id, shift_id, cashier_user_id, payment_method, amount, status, transaction_reference, created_at
        )
        SELECT 
          p.id,
          p.order_id,
          ${shiftExpr} AS shift_id,
          ${userExpr} AS cashier_user_id,
          ${paymentMethodExpr} AS payment_method,
          ${amountExpr} AS amount,
          ${statusExpr} AS status,
          ${txRefExpr} AS transaction_reference,
          ${createdAtExpr} AS created_at
        FROM _old_payments p
      `);
      db.exec('DROP TABLE _old_payments');
    }

    // 4. Create Indexes
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_date_state ON orders(business_date, lifecycle_state);
      CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
      CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
      CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_item_variants_item ON order_item_variants(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_item_modifiers_item ON order_item_modifiers(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_item_addons_item ON order_item_addons(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_combo_components_item ON order_combo_components(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_metadata_order ON order_metadata(order_id, meta_key);
      CREATE INDEX IF NOT EXISTS idx_order_tags_order ON order_tags(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_order_num_seq_unique ON order_number_sequences(branch_id, business_date, prefix);
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 012_enterprise_order_foundation.');
  }
};
