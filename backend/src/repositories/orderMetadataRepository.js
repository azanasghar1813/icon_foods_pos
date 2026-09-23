import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

class OrderMetadataRepository {
  setMeta(orderId, metaKey, metaValue) {
    const existing = dbEngine.prepare('SELECT id FROM order_metadata WHERE order_id = ? AND meta_key = ?').get(orderId, metaKey);
    const valueStr = typeof metaValue === 'object' ? JSON.stringify(metaValue) : String(metaValue);

    if (existing) {
      dbEngine.prepare(`
        UPDATE order_metadata SET meta_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(valueStr, existing.id);
    } else {
      dbEngine.prepare(`
        INSERT INTO order_metadata (id, order_id, meta_key, meta_value, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(crypto.randomUUID(), orderId, metaKey, valueStr);
    }
  }

  getMeta(orderId, metaKey) {
    const row = dbEngine.prepare('SELECT meta_value FROM order_metadata WHERE order_id = ? AND meta_key = ?').get(orderId, metaKey);
    return row ? row.meta_value : null;
  }

  getAllMeta(orderId) {
    const rows = dbEngine.prepare('SELECT meta_key, meta_value FROM order_metadata WHERE order_id = ?').all(orderId);
    const meta = {};
    for (const r of rows) {
      meta[r.meta_key] = r.meta_value;
    }
    return meta;
  }

  addTag(id, orderId, tagName, tagColor = null) {
    dbEngine.prepare(`
      INSERT INTO order_tags (id, order_id, tag_name, tag_color, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, orderId, tagName, tagColor);
  }

  getTags(orderId) {
    return dbEngine.prepare('SELECT * FROM order_tags WHERE order_id = ?').all(orderId);
  }

  addAttachment(id, orderId, fileName, filePath, fileType = null, fileSize = null) {
    dbEngine.prepare(`
      INSERT INTO order_attachments (id, order_id, file_name, file_path, file_type, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, orderId, fileName, filePath, fileType, fileSize);
  }

  getAttachments(orderId) {
    return dbEngine.prepare('SELECT * FROM order_attachments WHERE order_id = ?').all(orderId);
  }
}

export const orderMetadataRepository = new OrderMetadataRepository();
