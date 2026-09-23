import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Cloud sync rewrote product_images.image_path to Cloudinary URLs that 404.
 * Restore local /storage/images/products/{productId}_* files when they exist.
 */
export default {
  version: '039',
  name: 'restore_local_product_images',

  up: (db) => {
    const storageRoot = process.env.STORAGE_ROOT
      || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage');
    const dir = path.join(storageRoot, 'images', 'products');
    if (!dir || !fs.existsSync(dir)) return;

    const byProduct = new Map();
    for (const file of fs.readdirSync(dir)) {
      const match = String(file).match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i
      );
      if (match && !byProduct.has(match[1].toLowerCase())) {
        byProduct.set(match[1].toLowerCase(), file);
      }
    }
    if (byProduct.size === 0) return;

    const rows = db.prepare('SELECT id, product_id, image_path FROM product_images').all();
    const update = db.prepare('UPDATE product_images SET image_path = ? WHERE id = ?');
    let restored = 0;
    for (const row of rows) {
      const file = byProduct.get(String(row.product_id || '').toLowerCase());
      if (!file) continue;
      const localPath = `/storage/images/products/${file}`;
      if (row.image_path === localPath) continue;
      update.run(localPath, row.id);
      restored += 1;
    }
    console.log(`[Migration 039] Restored ${restored} product images to local files.`);
  },

  down: () => {
    console.warn('Manual rollback required for 039_restore_local_product_images.');
  }
};
