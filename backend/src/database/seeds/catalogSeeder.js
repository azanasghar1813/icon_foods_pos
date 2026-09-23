import crypto from 'crypto';

/**
 * Seeds Default Categories.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * Note: Category names aren't strictly UNIQUE in schema normally, 
 * but for seeding, we will query if it exists first to prevent duplicates.
 * 
 * @param {Object} db 
 * @returns {Object} 
 */
export const runCatalogSeeder = (db) => {
  let inserted = 0;

  const checkCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertCategory = db.prepare('INSERT INTO categories (id, name, display_order, color_code) VALUES (?, ?, ?, ?)');
  
  const defaultCategories = [
    { name: 'Restaurant', order: 10, color: '#EF4444' },
    { name: 'Fast Food', order: 20, color: '#F59E0B' },
    { name: 'Deals', order: 30, color: '#10B981' },
    { name: 'Cold Drinks', order: 40, color: '#3B82F6' },
    { name: 'Desserts', order: 50, color: '#8B5CF6' }
  ];

  for (const cat of defaultCategories) {
    // Prevent duplicate category names during seeding
    const exists = checkCategory.get(cat.name);
    if (!exists) {
      const res = insertCategory.run(crypto.randomUUID(), cat.name, cat.order, cat.color);
      if (res.changes > 0) inserted++;
    }
  }

  return { name: 'Catalog', inserted };
};
