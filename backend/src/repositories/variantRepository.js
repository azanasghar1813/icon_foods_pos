import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

class VariantRepository {
  create(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = dbEngine.db.prepare(`
      INSERT INTO product_variants (
        id, product_id, name, product_code, sku, price, preparation_time, 
        kitchen_printer_id, display_order, lifecycle_state, created_at, updated_at
      )
      VALUES (
        @id, @product_id, @name, @product_code, @sku, @price, @preparation_time,
        @kitchen_printer_id, @display_order, @lifecycle_state, @now, @now
      )
    `);

    stmt.run({
      id,
      product_id: data.product_id,
      name: data.name,
      product_code: data.product_code || null,
      sku: data.sku || null,
      price: data.price,
      preparation_time: data.preparation_time || null,
      kitchen_printer_id: data.kitchen_printer_id || null,
      display_order: data.display_order || 0,
      lifecycle_state: data.lifecycle_state || 'DRAFT',
      now
    });

    return this.findById(id);
  }

  update(id, data) {
    const now = new Date().toISOString();
    
    // Dynamically build update query based on provided fields
    const updates = [];
    const params = { id, now };

    const allowedFields = [
      'name', 'product_code', 'sku', 'price', 'preparation_time', 
      'kitchen_printer_id', 'display_order'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });

    if (updates.length === 0) return this.findById(id);

    updates.push('version = version + 1');
    updates.push('updated_at = @now');

    const stmt = dbEngine.db.prepare(`
      UPDATE product_variants
      SET ${updates.join(', ')}
      WHERE id = @id
    `);

    stmt.run(params);
    return this.findById(id);
  }

  delete(id) {
    const stmt = dbEngine.db.prepare(`UPDATE product_variants SET lifecycle_state = 'DELETED', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run(id);
  }

  findById(id) {
    const stmt = dbEngine.db.prepare(`SELECT * FROM product_variants WHERE id = ?`);
    return stmt.get(id);
  }

  findByProduct(productId) {
    const stmt = dbEngine.db.prepare(`SELECT * FROM product_variants WHERE product_id = ? ORDER BY display_order ASC`);
    return stmt.all(productId);
  }

  findByProductCode(code) {
    const stmt = dbEngine.db.prepare(`SELECT * FROM product_variants WHERE product_code = ?`);
    return stmt.get(code);
  }
}

export const variantRepository = new VariantRepository();
