import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const expenseRepository = {
  create: (data) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO expenses (id, category, amount, description, recorded_by, expense_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.category,
      data.amount,
      data.description || null,
      data.recorded_by || null,
      data.expense_date || new Date().toISOString()
    );
    
    return expenseRepository.findById(id);
  },

  update: (id, data) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE expenses 
      SET category = ?, amount = ?, description = ?, expense_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.category,
      data.amount,
      data.description || null,
      data.expense_date || new Date().toISOString(),
      id
    );
    
    return expenseRepository.findById(id);
  },

  delete: (id) => {
    const stmt = dbEngine.db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM expenses WHERE id = ?');
    return stmt.get(id);
  },

  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC');
    return stmt.all();
  }
};
