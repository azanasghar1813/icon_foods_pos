export default {
  version: '022',
  name: 'deals_engine',

  up: (db) => {
    console.log('013: Expanding Deals Engine');

    // 1. Add is_customizable to deals
    try {
      db.exec(`ALTER TABLE deals ADD COLUMN is_customizable INTEGER NOT NULL DEFAULT 1;`);
    } catch (e) {
      console.warn('is_customizable already exists on deals');
    }

    // 2. Rebuild deal_components to support choices
    db.exec(`
      CREATE TABLE IF NOT EXISTS deal_components_new (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        name TEXT, -- e.g., "Small Pizza", "Drink"
        component_type TEXT NOT NULL DEFAULT 'FIXED_PRODUCT', -- 'FIXED_PRODUCT', 'CATEGORY_CHOICE'
        product_id TEXT, -- Nullable if it's a choice
        quantity INTEGER NOT NULL DEFAULT 1,
        price_adjustment REAL DEFAULT 0,
        target_category_id TEXT, -- Category to pick from (e.g., Pizza category ID)
        target_variant_name TEXT, -- Force variant (e.g., "Small")
        allowed_product_ids TEXT, -- Comma separated IDs of allowed products
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (target_category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);

    // Migrate existing components (if any exist)
    try {
      db.exec(`
        INSERT INTO deal_components_new (id, deal_id, product_id, quantity, price_adjustment)
        SELECT id, deal_id, product_id, quantity, price_adjustment FROM deal_components;
      `);
    } catch (e) {
      console.warn('Failed to migrate old deal_components, skipping (possible foreign key violation):', e.message);
    }

    // Drop old and rename
    try {
      db.exec(`DROP TABLE deal_components;`);
    } catch (e) {
      console.warn('Could not drop old deal_components', e.message);
    }

    db.exec(`ALTER TABLE deal_components_new RENAME TO deal_components;`);
  },

  down: (db) => {
    console.warn('Manual rollback required for 013_deals_engine.');
  }
};
