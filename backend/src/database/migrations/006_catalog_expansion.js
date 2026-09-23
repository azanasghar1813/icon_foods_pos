export default {
  version: '006',
  name: 'catalog_expansion',

  up: (db) => {
    // Categories Expansion
    db.exec(`ALTER TABLE categories ADD COLUMN image_path TEXT`);
    db.exec(`ALTER TABLE categories ADD COLUMN icon_name TEXT`);
    db.exec(`ALTER TABLE categories ADD COLUMN visibility TEXT NOT NULL DEFAULT 'VISIBLE'`);
    db.exec(`ALTER TABLE categories ADD COLUMN kitchen_printer_id TEXT`);
    
    // Products Expansion
    db.exec(`ALTER TABLE products ADD COLUMN display_name TEXT`);
    db.exec(`ALTER TABLE products ADD COLUMN short_name TEXT`);
    db.exec(`ALTER TABLE products ADD COLUMN keywords TEXT`);
    db.exec(`ALTER TABLE products ADD COLUMN preparation_time INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE products ADD COLUMN is_popular INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE products ADD COLUMN is_suggested INTEGER NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE products ADD COLUMN visibility TEXT NOT NULL DEFAULT 'VISIBLE'`);
    db.exec(`ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'AVAILABLE'`);

    // Deals Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Deal Components
    db.exec(`
      CREATE TABLE IF NOT EXISTS deal_components (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price_adjustment REAL DEFAULT 0,
        FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      );
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 006_catalog_expansion.');
  }
};
