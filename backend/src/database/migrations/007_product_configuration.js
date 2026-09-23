export default {
  version: '007',
  name: 'product_configuration',

  up: (db) => {
    // ----------------------------------------------------
    // Product Variants
    // ----------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL, -- e.g., 'Small', 'Medium', 'Large'
        product_code TEXT UNIQUE, -- Optional override or suffix
        sku TEXT UNIQUE,
        price REAL NOT NULL,
        preparation_time INTEGER, -- Override
        kitchen_printer_id TEXT, -- Override
        is_active INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (kitchen_printer_id) REFERENCES printers(id) ON DELETE SET NULL
      );
    `);
    
    // ----------------------------------------------------
    // Modifiers Engine
    // ----------------------------------------------------
    // We are deprecating the old product_modifiers table.
    db.exec(`DROP TABLE IF EXISTS product_modifiers;`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS modifier_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL, -- e.g., 'Burger Extras', 'Pizza Toppings'
        description TEXT,
        min_selection INTEGER NOT NULL DEFAULT 0,
        max_selection INTEGER,
        is_required INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS modifiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL, -- e.g., 'Extra Cheese'
        short_name TEXT,
        price_adjustment REAL NOT NULL DEFAULT 0, -- Default base price
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS modifier_group_options (
        id TEXT PRIMARY KEY,
        modifier_group_id TEXT NOT NULL,
        modifier_id TEXT NOT NULL,
        price_adjustment REAL, -- Override specific to this group
        display_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        max_quantity_per_selection INTEGER NOT NULL DEFAULT 1, -- e.g., allowing "Extra Extra Cheese"
        FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (modifier_id) REFERENCES modifiers(id) ON DELETE RESTRICT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS product_modifier_groups (
        product_id TEXT NOT NULL,
        modifier_group_id TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (product_id, modifier_group_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
      );
    `);

    // ----------------------------------------------------
    // Product Add-ons (Independent Products)
    // ----------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_addons (
        product_id TEXT NOT NULL,
        addon_product_id TEXT NOT NULL,
        price_override REAL, -- Optional discount/override when bought together
        display_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (product_id, addon_product_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (addon_product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);

    // ----------------------------------------------------
    // Combo Configuration Upgrades
    // ----------------------------------------------------
    db.exec(`ALTER TABLE deals ADD COLUMN pricing_strategy TEXT NOT NULL DEFAULT 'FIXED'`); // FIXED, DYNAMIC, FIXED_WITH_ADJUSTMENTS

    db.exec(`
      CREATE TABLE IF NOT EXISTS deal_groups (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        name TEXT NOT NULL, -- e.g., 'Choose 1 Drink'
        min_selection INTEGER NOT NULL DEFAULT 1,
        max_selection INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
      );
    `);

    // Add new columns to deal_components
    db.exec(`ALTER TABLE deal_components ADD COLUMN deal_group_id TEXT`);
    db.exec(`ALTER TABLE deal_components ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE deal_components ADD COLUMN max_quantity INTEGER NOT NULL DEFAULT 1`);

    // Indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_mod_options_group ON modifier_group_options(modifier_group_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_deal_groups_deal ON deal_groups(deal_id)`);
  },

  down: (db) => {
    console.warn('Manual rollback required for 007_product_configuration.');
  }
};
