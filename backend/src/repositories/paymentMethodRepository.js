import { dbEngine } from '../database/sqlite.js';

export const paymentMethodRepository = {
  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM payment_methods ORDER BY display_order ASC, name ASC');
    return stmt.all();
  },

  findByCode: (code) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM payment_methods WHERE code = ? COLLATE NOCASE');
    return stmt.get(code);
  },

  create: (methodData) => {
    const stmt = dbEngine.db.prepare(`
      INSERT INTO payment_methods (code, name, is_active, display_order)
      VALUES (?, ?, ?, ?)
    `);
    const code = methodData.code.toUpperCase();
    stmt.run(
      code,
      methodData.name,
      methodData.isActive === undefined ? 1 : (methodData.isActive ? 1 : 0),
      methodData.displayOrder || 0
    );
    return code;
  },

  update: (code, methodData) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE payment_methods 
      SET name = ?, is_active = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE code = ? COLLATE NOCASE
    `);
    stmt.run(
      methodData.name,
      methodData.isActive ? 1 : 0,
      methodData.displayOrder || 0,
      code
    );
  },

  delete: (code) => {
    const stmt = dbEngine.db.prepare('DELETE FROM payment_methods WHERE code = ? COLLATE NOCASE');
    stmt.run(code);
  }
};
