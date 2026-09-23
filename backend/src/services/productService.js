import { productRepository } from '../repositories/productRepository.js';
import { dbEngine } from '../database/sqlite.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { menuCacheService } from './menuCacheService.js';
import { globalSearchService } from './search/globalSearchService.js';
import { activityLogService } from './activityLogService.js';
import { configService } from './configService.js';
import crypto from 'crypto';
import { storageManager } from '../utils/storageManager.js';
import { lifecycleService } from './lifecycleService.js';
import { imageService } from './imageService.js';
import { syncService } from './syncService.js';

class ProductService {
  /**
   * Search for products instantly from the RAM cache.
   */
  searchProducts(query, userId) {
    return globalSearchService.search(query, userId);
  }

  getAllProducts() {
    return menuCacheService.products; // Raw list from cache
  }

  getProductById(id) {
    return menuCacheService.productMap.get(id) || productRepository.findById(id);
  }

  createProduct(data, userId) {
    return dbEngine.transaction(() => {
      // 1. Generate Product Code if not provided
      if (!data.product_code) {
        data.product_code = this.generateNextProductCode();
      } else {
        // Validate uniqueness
        const existing = productRepository.findByCode(data.product_code);
        if (existing) {
          throw new Error('Product code already exists in the system.');
        }
      }

      // 2. Create the base product
      const product = productRepository.create(data);

      // 3. Handle Add-ons if provided
      if (data.addons && Array.isArray(data.addons)) {
        data.addons.forEach(addonId => {
          productRepository.addAddon(product.id, addonId);
        });
      }

      // 4. Handle Variants if provided
      if (data.variants && Array.isArray(data.variants)) {
        const seen = new Set();
        data.variants.forEach((v, idx) => {
          const key = String(v.name || '').trim().toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          variantRepository.create({
            product_id: product.id,
            name: v.name,
            price: v.price || 0,
            display_order: idx,
            lifecycle_state: 'ACTIVE'
          });
        });
      }

      // 5. Log the action
      activityLogService.logActivity(
        userId,
        'PRODUCT_CREATED',
        'CATALOG',
        product.id,
        { code: product.product_code }
      );

      // 6. Queue Sync
      syncService.queueSyncEvent('PRODUCT', product.id, 'CREATED', { code: product.product_code }, 1);

      // 7. Refresh RAM cache
      menuCacheService.refresh();

      return this.getProductById(product.id);
    });
  }

  updateProduct(id, data, userId) {
    return dbEngine.transaction(() => {
      // Code uniqueness validation if changing code
      if (data.product_code) {
        const existing = productRepository.findByCode(data.product_code);
        if (existing && existing.id !== id) {
          throw new Error('Product code already exists in the system.');
        }
      }

      const product = productRepository.update(id, data);

      if (data.variants && Array.isArray(data.variants)) {
        dbEngine.prepare(`DELETE FROM product_variants WHERE product_id = ?`).run(product.id);
        const seen = new Set();
        data.variants.forEach((v, idx) => {
          const key = String(v.name || '').trim().toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          variantRepository.create({
            product_id: product.id,
            name: v.name,
            price: v.price || 0,
            display_order: idx,
            lifecycle_state: 'ACTIVE'
          });
        });
      }

      activityLogService.logActivity(
        userId,
        'PRODUCT_UPDATED',
        'CATALOG',
        product.id,
        {}
      );

      syncService.queueSyncEvent('PRODUCT', product.id, 'UPDATED', {}, product.version);

      menuCacheService.refresh();
      return this.getProductById(product.id);
    });
  }

  deleteProduct(id, userId) {
    return dbEngine.transaction(() => {
      lifecycleService.softDelete('PRODUCT', id, userId);
    });
  }

  archiveProduct(id, userId) {
    return dbEngine.transaction(() => {
      lifecycleService.archive('PRODUCT', id, userId);
    });
  }

  restoreProduct(id, userId) {
    return dbEngine.transaction(() => {
      lifecycleService.restore('PRODUCT', id, userId);
    });
  }

  hideProduct(id, userId) {
    lifecycleService.hide('PRODUCT', id, userId);
  }

  publishProduct(id, userId) {
    lifecycleService.publish('PRODUCT', id, userId);
  }

  // --- Code Generation ---

  generateNextProductCode() {
    // Basic implementation: Find the highest numeric code and add 1
    // A robust system would keep a counter in the configService database.
    
    const allProducts = productRepository.findAll();
    let maxCode = 1000; // Starting baseline

    allProducts.forEach(p => {
      const num = parseInt(p.product_code, 10);
      if (!isNaN(num) && num > maxCode) {
        maxCode = num;
      }
    });

    return (maxCode + 1).toString();
  }

  // --- Image Handling ---

  uploadImage(productId, file, isPrimary, userId) {
    return imageService.uploadProductImage(productId, file, isPrimary, userId);
  }

  removeImage(imageId, userId) {
    return imageService.deleteProductImage(imageId, userId);
  }
}

export const productService = new ProductService();
