export default {
  version: '008',
  name: 'product_lifecycle',
  disableForeignKeys: true,

  up: (db) => {
    // ----------------------------------------------------
    // Sync Queue Table
    // ----------------------------------------------------
    db.exec(`DROP TABLE IF EXISTS sync_queue;`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        metadata TEXT,
        payload_version INTEGER NOT NULL DEFAULT 1,
        error_details TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_entity ON sync_queue(entity_type, entity_id);
    `);

    // We must rebuild tables to replace is_active with lifecycle_state and add version.
    // SQLite table rebuild process:
    
    // 1. Categories
    console.log('008: Creating categories_new');
    db.exec(`
      CREATE TABLE categories_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        display_order INTEGER DEFAULT 0,
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        color_code TEXT,
        image_path TEXT,
        icon_name TEXT,
        visibility TEXT NOT NULL DEFAULT 'VISIBLE',
        kitchen_printer_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (kitchen_printer_id) REFERENCES printers(id) ON DELETE SET NULL
      );
    `);
    
    console.log('008: Inserting into categories_new');
    db.exec(`
      INSERT INTO categories_new (id, name, parent_id, display_order, lifecycle_state, color_code, image_path, icon_name, visibility, kitchen_printer_id, created_at, updated_at)
      SELECT id, name, parent_id, display_order, CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, color_code, image_path, icon_name, visibility, kitchen_printer_id, created_at, updated_at
      FROM categories;
    `);

    // 2. Products
    console.log('008: Creating products_new');
    db.exec(`
      CREATE TABLE products_new (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        product_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        display_name TEXT,
        short_name TEXT,
        description TEXT,
        price REAL NOT NULL,
        cost REAL DEFAULT 0,
        barcode TEXT UNIQUE,
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        track_inventory INTEGER NOT NULL DEFAULT 0,
        kitchen_printer_id TEXT,
        keywords TEXT,
        preparation_time INTEGER DEFAULT 0,
        is_popular INTEGER DEFAULT 0,
        is_suggested INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'VISIBLE',
        status TEXT DEFAULT 'AVAILABLE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
        FOREIGN KEY (kitchen_printer_id) REFERENCES printers(id) ON DELETE SET NULL
      );
    `);

    console.log('008: Inserting into products_new');
    db.exec(`
      INSERT INTO products_new (
        id, category_id, product_code, name, display_name, short_name, description, 
        price, cost, barcode, lifecycle_state, track_inventory, kitchen_printer_id, 
        keywords, preparation_time, is_popular, is_suggested, visibility, status, created_at, updated_at
      )
      SELECT 
        id, category_id, product_code, name, display_name, short_name, description, 
        price, cost, barcode, CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, track_inventory, kitchen_printer_id, 
        keywords, preparation_time, is_popular, is_suggested, visibility, status, created_at, updated_at
      FROM products;
    `);

    // 3. Product Variants
    console.log('008: Creating product_variants_new');
    db.exec(`
      CREATE TABLE product_variants_new (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        product_code TEXT UNIQUE,
        sku TEXT UNIQUE,
        price REAL NOT NULL,
        preparation_time INTEGER,
        kitchen_printer_id TEXT,
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (kitchen_printer_id) REFERENCES printers(id) ON DELETE SET NULL
      );
    `);

    console.log('008: Inserting into product_variants_new');
    db.exec(`
      INSERT INTO product_variants_new (
        id, product_id, name, product_code, sku, price, preparation_time, kitchen_printer_id,
        lifecycle_state, display_order, created_at, updated_at
      )
      SELECT 
        id, product_id, name, product_code, sku, price, preparation_time, kitchen_printer_id,
        CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, display_order, created_at, updated_at
      FROM product_variants;
    `);

    // 4. Modifier Groups
    console.log('008: Creating modifier_groups_new');
    db.exec(`
      CREATE TABLE modifier_groups_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        min_selection INTEGER NOT NULL DEFAULT 0,
        max_selection INTEGER,
        is_required INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      INSERT INTO modifier_groups_new (
        id, name, description, min_selection, max_selection, is_required, display_order,
        lifecycle_state, created_at, updated_at
      )
      SELECT 
        id, name, description, min_selection, max_selection, is_required, display_order,
        CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, created_at, updated_at
      FROM modifier_groups;
    `);

    // 5. Modifiers
    console.log('008: Creating modifiers_new');
    db.exec(`
      CREATE TABLE modifiers_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT,
        price_adjustment REAL NOT NULL DEFAULT 0,
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      INSERT INTO modifiers_new (id, name, short_name, price_adjustment, lifecycle_state, created_at, updated_at)
      SELECT id, name, short_name, price_adjustment, CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, created_at, updated_at
      FROM modifiers;
    `);

    // 6. Deals
    console.log('008: Creating deals_new');
    db.exec(`
      CREATE TABLE deals_new (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        pricing_strategy TEXT NOT NULL DEFAULT 'FIXED',
        lifecycle_state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER NOT NULL DEFAULT 1,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      INSERT INTO deals_new (id, code, name, description, price, pricing_strategy, lifecycle_state, start_date, end_date, created_at, updated_at)
      SELECT id, code, name, description, price, pricing_strategy, CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'ARCHIVED' END, start_date, end_date, created_at, updated_at
      FROM deals;
    `);

    // Turn off FK constraints temporarily to drop and rename (Safe in SQLite during transaction, but we handle carefully)
    console.log('008: PRAGMA foreign_keys=OFF; is handled by runner');

    // Drop old tables
    console.log('008: Dropping tables');
    try { db.exec(`DROP TABLE deals;`); } catch (e) { console.error('Error dropping deals:', e.message); }
    try { db.exec(`DROP TABLE modifiers;`); } catch (e) { console.error('Error dropping modifiers:', e.message); }
    try { db.exec(`DROP TABLE modifier_groups;`); } catch (e) { console.error('Error dropping modifier_groups:', e.message); }
    try { db.exec(`DROP TABLE product_variants;`); } catch (e) { console.error('Error dropping product_variants:', e.message); }
    try { db.exec(`DROP TABLE products;`); } catch (e) { console.error('Error dropping products:', e.message); }
    try { db.exec(`DROP TABLE categories;`); } catch (e) { console.error('Error dropping categories:', e.message); }

    // Rename new tables
    console.log('008: Renaming tables');
    db.exec(`ALTER TABLE categories_new RENAME TO categories;`);
    db.exec(`ALTER TABLE products_new RENAME TO products;`);
    db.exec(`ALTER TABLE product_variants_new RENAME TO product_variants;`);
    db.exec(`ALTER TABLE modifier_groups_new RENAME TO modifier_groups;`);
    db.exec(`ALTER TABLE modifiers_new RENAME TO modifiers;`);
    db.exec(`ALTER TABLE deals_new RENAME TO deals;`);

    // Recreate indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_lifecycle ON products(lifecycle_state);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_lifecycle ON categories(lifecycle_state);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);`);
  },

  down: (db) => {
    console.warn('Manual rollback required for 008_product_lifecycle.');
  }
};
