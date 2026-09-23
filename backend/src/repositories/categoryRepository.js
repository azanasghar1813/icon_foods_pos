import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class CategoryRepository {
  /**
   * Retrieves all categories, ordered by display_order.
   */
  findAll() {
    return dbEngine.prepare(`
      SELECT 
        id, name, parent_id, display_order, lifecycle_state, color_code, 
        image_path, icon_name, visibility, kitchen_printer_id,
        created_at, updated_at
      FROM categories 
      ORDER BY display_order ASC, name ASC
    `).all();
  }

  findById(id) {
    return dbEngine.prepare(`
      SELECT * FROM categories WHERE id = ?
    `).get(id);
  }

  create(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const stmt = dbEngine.prepare(`
      INSERT INTO categories (
        id, name, parent_id, display_order, lifecycle_state, color_code,
        image_path, icon_name, visibility, kitchen_printer_id, version, created_at, updated_at
      ) VALUES (
        @id, @name, @parent_id, @display_order, @lifecycle_state, @color_code,
        @image_path, @icon_name, @visibility, @kitchen_printer_id, 1, @now, @now
      )
    `);

    stmt.run({
      id,
      name: data.name,
      parent_id: data.parent_id || null,
      display_order: data.display_order || 0,
      lifecycle_state: data.lifecycle_state || 'ACTIVE',
      color_code: data.color_code || null,
      image_path: data.image_path || null,
      icon_name: data.icon_name || null,
      visibility: data.visibility || 'VISIBLE',
      kitchen_printer_id: data.kitchen_printer_id || null,
      now
    });

    return this.findById(id);
  }

  update(id, data) {
    // Dynamically build the update query
    const updates = [];
    const params = { id, now: new Date().toISOString() };

    const allowedFields = [
      'name', 'parent_id', 'display_order', 'lifecycle_state', 'color_code',
      'image_path', 'icon_name', 'visibility', 'kitchen_printer_id'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });

    updates.push("version = version + 1");
    updates.push("updated_at = @now");

    if (updates.length > 0) {
      const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = @id`;
      dbEngine.prepare(query).run(params);
    }

    return this.findById(id);
  }

  /**
   * Performs a soft delete on a category by setting lifecycle_state = 'DELETED'
   */
  softDelete(id) {
    const stmt = dbEngine.prepare(`
      UPDATE categories 
      SET lifecycle_state = 'DELETED', version = version + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(id);
  }
}

export const categoryRepository = new CategoryRepository();
