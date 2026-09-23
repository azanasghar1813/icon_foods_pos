import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

export function releaseTableIfIdle(tableRef) {
  if (!tableRef) return;
  try {
    const active = dbEngine.prepare(`
      SELECT COUNT(*) as c FROM orders
      WHERE table_id = ? AND lifecycle_state IN ('ACTIVE', 'DRAFT', 'HELD')
    `).get(tableRef);
    if (!active || Number(active.c) === 0) {
      dbEngine.prepare(`UPDATE tables SET status = 'Available' WHERE id = ? OR name = ?`).run(tableRef, tableRef);
      try {
        dbEngine.prepare(`UPDATE dining_tables SET status = 'Available' WHERE id = ? OR table_number = ?`).run(tableRef, String(tableRef));
      } catch { /* dining_tables may not have status */ }
    }
  } catch (e) {
    console.warn('Failed to release floor table:', e.message);
  }
}

export class TableController {
  // --- CATEGORIES ---
  static getCategories(req, res) {
    try {
      const categories = dbEngine.db.prepare('SELECT * FROM table_categories ORDER BY created_at ASC').all();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching table categories:', error);
      res.status(500).json({ message: 'Failed to fetch table categories' });
    }
  }

  static createCategory(req, res) {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: 'Name is required' });

      const id = crypto.randomUUID();
      dbEngine.db.prepare('INSERT INTO table_categories (id, name) VALUES (?, ?)').run(id, name);
      
      const category = dbEngine.db.prepare('SELECT * FROM table_categories WHERE id = ?').get(id);
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating table category:', error);
      res.status(500).json({ message: 'Failed to create table category' });
    }
  }

  static updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: 'Name is required' });

      dbEngine.db.prepare('UPDATE table_categories SET name = ? WHERE id = ?').run(name, id);
      const category = dbEngine.db.prepare('SELECT * FROM table_categories WHERE id = ?').get(id);
      
      if (!category) return res.status(404).json({ message: 'Category not found' });
      res.json(category);
    } catch (error) {
      console.error('Error updating table category:', error);
      res.status(500).json({ message: 'Failed to update table category' });
    }
  }

  static deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const result = dbEngine.db.prepare('DELETE FROM table_categories WHERE id = ?').run(id);
      if (result.changes === 0) return res.status(404).json({ message: 'Category not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting table category:', error);
      res.status(500).json({ message: 'Failed to delete table category' });
    }
  }

  // --- TABLES ---
  static getTables(req, res) {
    try {
      const tables = dbEngine.db.prepare(`
        SELECT t.*, c.name as category_name 
        FROM tables t
        LEFT JOIN table_categories c ON t.category_id = c.id
        ORDER BY t.created_at ASC
      `).all();
      res.json(tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
      res.status(500).json({ message: 'Failed to fetch tables' });
    }
  }

  static createTable(req, res) {
    try {
      const { name, category_id, status = 'Available' } = req.body;
      if (!name || !category_id) return res.status(400).json({ message: 'Name and category_id are required' });

      const id = crypto.randomUUID();
      dbEngine.db.prepare('INSERT INTO tables (id, name, category_id, status) VALUES (?, ?, ?, ?)').run(id, name, category_id, status);
      
      const table = dbEngine.db.prepare(`
        SELECT t.*, c.name as category_name 
        FROM tables t
        LEFT JOIN table_categories c ON t.category_id = c.id
        WHERE t.id = ?
      `).get(id);
      res.status(201).json(table);
    } catch (error) {
      console.error('Error creating table:', error);
      res.status(500).json({ message: 'Failed to create table' });
    }
  }

  static updateTable(req, res) {
    try {
      const { id } = req.params;
      const { name, category_id, status } = req.body;
      
      const updates = [];
      const values = [];
      
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (category_id !== undefined) { updates.push('category_id = ?'); values.push(category_id); }
      if (status !== undefined) { updates.push('status = ?'); values.push(status); }

      if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

      values.push(id);
      dbEngine.db.prepare(`UPDATE tables SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      
      const table = dbEngine.db.prepare(`
        SELECT t.*, c.name as category_name 
        FROM tables t
        LEFT JOIN table_categories c ON t.category_id = c.id
        WHERE t.id = ?
      `).get(id);
      
      if (!table) return res.status(404).json({ message: 'Table not found' });
      res.json(table);
    } catch (error) {
      console.error('Error updating table:', error);
      res.status(500).json({ message: 'Failed to update table' });
    }
  }

  static deleteTable(req, res) {
    try {
      const { id } = req.params;
      const result = dbEngine.db.prepare('DELETE FROM tables WHERE id = ?').run(id);
      if (result.changes === 0) return res.status(404).json({ message: 'Table not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting table:', error);
      res.status(500).json({ message: 'Failed to delete table' });
    }
  }
}
