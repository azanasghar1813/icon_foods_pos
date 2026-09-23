import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class ProductRepository {
  findAll() {
    return dbEngine.prepare(`
      SELECT * FROM products 
      ORDER BY name ASC
    `).all();
  }

  findById(id) {
    return dbEngine.prepare(`
      SELECT * FROM products WHERE id = ?
    `).get(id);
  }

  findByCode(code) {
    return dbEngine.prepare(`
      SELECT * FROM products WHERE product_code = ? AND lifecycle_state != 'DELETED'
    `).get(code);
  }

  create(data) {
    const id = crypto.randomUUID();
    const stmt = dbEngine.prepare(`
      INSERT INTO products (
        id, category_id, product_code, name, display_name, short_name,
        description, price, cost, barcode, lifecycle_state, track_inventory,
        kitchen_printer_id, keywords, preparation_time, is_popular, is_suggested,
        visibility, status
      ) VALUES (
        @id, @category_id, @product_code, @name, @display_name, @short_name,
        @description, @price, @cost, @barcode, @lifecycle_state, @track_inventory,
        @kitchen_printer_id, @keywords, @preparation_time, @is_popular, @is_suggested,
        @visibility, @status
      )
    `);

    stmt.run({
      id,
      category_id: data.category_id,
      product_code: data.product_code,
      name: data.name,
      display_name: data.display_name || data.name,
      short_name: data.short_name || data.name,
      description: data.description || null,
      price: data.price,
      cost: data.cost || 0,
      barcode: data.barcode || null,
      lifecycle_state: data.lifecycle_state || 'DRAFT',
      track_inventory: data.track_inventory || 0,
      kitchen_printer_id: data.kitchen_printer_id || null,
      keywords: data.keywords || null,
      preparation_time: data.preparation_time || 0,
      is_popular: data.is_popular || 0,
      is_suggested: data.is_suggested || 0,
      visibility: data.visibility || 'VISIBLE',
      status: data.status || 'AVAILABLE'
    });

    return this.findById(id);
  }

  update(id, data) {
    const updates = [];
    const params = { id };

    const allowedFields = [
      'category_id', 'product_code', 'name', 'display_name', 'short_name',
      'description', 'price', 'cost', 'barcode', 'track_inventory',
      'kitchen_printer_id', 'keywords', 'preparation_time', 'is_popular', 'is_suggested',
      'visibility', 'status', 'lifecycle_state'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });

    updates.push("version = version + 1");
    updates.push("updated_at = CURRENT_TIMESTAMP");

    if (updates.length > 2) {
      const query = `UPDATE products SET ${updates.join(', ')} WHERE id = @id`;
      dbEngine.prepare(query).run(params);
    }

    return this.findById(id);
  }

  softDelete(id) {
    dbEngine.prepare(`
      UPDATE products 
      SET lifecycle_state = 'DELETED', 
          product_code = product_code || '_del_' || id,
          barcode = CASE WHEN barcode IS NOT NULL THEN barcode || '_del_' || id ELSE NULL END,
          version = version + 1, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
  }

  // --- Image Handling ---

  getImageById(imageId) {
    return dbEngine.prepare(`
      SELECT * FROM product_images WHERE id = ?
    `).get(imageId);
  }

  getImages(productId) {
    return dbEngine.prepare(`
      SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, created_at ASC
    `).all(productId);
  }

  addImage(productId, imagePath, isPrimary = 0) {
    const id = crypto.randomUUID();
    
    // If this is the primary image, unset primary on others
    if (isPrimary) {
      dbEngine.prepare(`UPDATE product_images SET is_primary = 0 WHERE product_id = ?`).run(productId);
    }

    dbEngine.prepare(`
      INSERT INTO product_images (id, product_id, image_path, is_primary)
      VALUES (?, ?, ?, ?)
    `).run(id, productId, imagePath, isPrimary ? 1 : 0);

    return id;
  }

  removeImage(imageId) {
    dbEngine.prepare(`DELETE FROM product_images WHERE id = ?`).run(imageId);
  }
  // --- Add-ons ---

  getAddons(productId) {
    return dbEngine.prepare(`
      SELECT a.*, p.name, p.product_code, p.price as base_price,
             COALESCE(a.price_override, p.price) as effective_price
      FROM product_addons a
      JOIN products p ON a.addon_product_id = p.id
      WHERE a.product_id = ?
      ORDER BY a.display_order ASC
    `).all(productId);
  }

  addAddon(productId, addonProductId, priceOverride = null, displayOrder = 0, isDefault = 0) {
    dbEngine.prepare(`
      INSERT INTO product_addons (product_id, addon_product_id, price_override, display_order, is_default)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, addon_product_id) DO UPDATE SET 
        price_override = excluded.price_override,
        display_order = excluded.display_order,
        is_default = excluded.is_default
    `).run(productId, addonProductId, priceOverride, displayOrder, isDefault ? 1 : 0);
  }

  removeAddon(productId, addonProductId) {
    dbEngine.prepare(`
      DELETE FROM product_addons WHERE product_id = ? AND addon_product_id = ?
    `).run(productId, addonProductId);
  }
}

export const productRepository = new ProductRepository();
