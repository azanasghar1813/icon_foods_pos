import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

export const inventoryRepository = {
  createItem: (data) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO inventory_items (id, name, sku, category, quantity, min_stock_level, unit, unit_cost, last_restock_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.name,
      data.sku || null,
      data.category || null,
      data.quantity || 0,
      data.min_stock_level || 0,
      data.unit || 'pcs',
      data.unit_cost || 0,
      data.last_restock_date || null
    );
    
    return inventoryRepository.findById(id);
  },

  updateItem: (id, data) => {
    const stmt = dbEngine.db.prepare(`
      UPDATE inventory_items 
      SET name = ?, sku = ?, category = ?, min_stock_level = ?, unit = ?, unit_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      data.name,
      data.sku || null,
      data.category || null,
      data.min_stock_level || 0,
      data.unit || 'pcs',
      data.unit_cost || 0,
      id
    );
    
    return inventoryRepository.findById(id);
  },

  adjustQuantity: (id, quantityChanged, newQuantity, lastRestockDate = null) => {
    let query = `UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP`;
    let params = [newQuantity];
    
    if (lastRestockDate) {
      query += `, last_restock_date = ?`;
      params.push(lastRestockDate);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);
    
    const stmt = dbEngine.db.prepare(query);
    stmt.run(...params);
    return inventoryRepository.findById(id);
  },

  logAction: (itemId, userId, action, quantityChanged, newQuantity, referenceId = null, notes = null) => {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO inventory_logs (id, inventory_item_id, user_id, action, quantity_changed, new_quantity, reference_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, itemId, userId, action, quantityChanged, newQuantity, referenceId, notes);
    return id;
  },

  deleteItem: (id) => {
    const stmt = dbEngine.db.prepare('DELETE FROM inventory_items WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  findById: (id) => {
    const stmt = dbEngine.db.prepare('SELECT * FROM inventory_items WHERE id = ?');
    return stmt.get(id);
  },

  findAll: () => {
    const stmt = dbEngine.db.prepare('SELECT * FROM inventory_items ORDER BY name ASC');
    return stmt.all();
  },

  getLogs: (itemId = null, limit = 100) => {
    if (itemId) {
      const stmt = dbEngine.db.prepare('SELECT * FROM inventory_logs WHERE inventory_item_id = ? ORDER BY created_at DESC LIMIT ?');
      return stmt.all(itemId, limit);
    }
    const stmt = dbEngine.db.prepare('SELECT * FROM inventory_logs ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit);
  }
};
