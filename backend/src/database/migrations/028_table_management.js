import crypto from 'crypto';

export default {
  version: '028',
  name: 'table_management',
  up: (db) => {
    console.log('Running migration: 028_table_management');
    // 1. Create table_categories table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS table_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Create tables table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_id TEXT NOT NULL,
        status TEXT DEFAULT 'Available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES table_categories(id) ON DELETE CASCADE
      )
    `).run();

    // 3. Check if we already have categories to prevent re-seeding on re-run
    const existingCategories = db.prepare('SELECT COUNT(*) as count FROM table_categories').get();
    if (existingCategories.count === 0) {
      console.log('Seeding default tables and categories...');
      const categories = [
        { id: crypto.randomUUID(), name: 'Ground' },
        { id: crypto.randomUUID(), name: 'Family Hall' },
        { id: crypto.randomUUID(), name: 'RoofTop' }
      ];

      const insertCategory = db.prepare('INSERT INTO table_categories (id, name) VALUES (?, ?)');
      categories.forEach(c => insertCategory.run(c.id, c.name));

      const insertTable = db.prepare('INSERT INTO tables (id, name, category_id, status) VALUES (?, ?, ?, ?)');

      // Ground: G1 - G10
      for (let i = 1; i <= 10; i++) {
        insertTable.run(crypto.randomUUID(), `G${i}`, categories[0].id, 'Available');
      }

      // Family Hall: F1 - F4
      for (let i = 1; i <= 4; i++) {
        insertTable.run(crypto.randomUUID(), `F${i}`, categories[1].id, 'Available');
      }

      // RoofTop: T1 - T4
      for (let i = 1; i <= 4; i++) {
        insertTable.run(crypto.randomUUID(), `T${i}`, categories[2].id, 'Available');
      }
      console.log('Default tables seeded successfully.');
    }
  },
  down: (db) => {
    db.prepare(`DROP TABLE IF EXISTS tables`).run();
    db.prepare(`DROP TABLE IF EXISTS table_categories`).run();
  }
};
