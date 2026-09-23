import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const customerRepository = {
  create: (data) => {
    const id = crypto.randomUUID();
    const customerNumber = data.customer_number || `CUST-${Date.now()}`;
    const stmt = dbEngine.db.prepare(`
      INSERT INTO customers (id, customer_number, first_name, last_name, phone, email, address, loyalty_points, is_vip, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      customerNumber,
      data.first_name,
      data.last_name || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.loyalty_points || 0,
      data.is_vip ? 1 : 0,
      data.notes || null
    );
    
    return customerRepository.findById(id);
  },

  update: (id, data) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE customers 
      SET first_name = ?, last_name = ?, phone = ?, email = ?, address = ?, loyalty_points = ?, is_vip = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.first_name,
      data.last_name || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.loyalty_points || 0,
      data.is_vip ? 1 : 0,
      data.notes || null,
      id
    );
    
    return customerRepository.findById(id);
  },

  delete: (id) => {
    const stmt = dbEngine.db.prepare('DELETE FROM customers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  deleteAll: () => {
    const stmt = dbEngine.db.prepare('DELETE FROM customers');
    const result = stmt.run();
    return result.changes;
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM customers WHERE id = ?');
    return stmt.get(id);
  },

  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM customers ORDER BY created_at DESC');
    return stmt.all();
  },

  search: (query) => {
    const stmt = dbEngine.db.prepare(`
      SELECT * FROM customers 
      WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?
      ORDER BY first_name ASC
    `);
    const q = `%${query}%`;
    return stmt.all(q, q, q, q);
  }
};
