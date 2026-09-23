import { variantRepository } from '../repositories/variantRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { catalogValidationService } from './catalogValidationService.js';
import { activityLogService } from './activityLogService.js';
import { lifecycleService } from './lifecycleService.js';
import { syncService } from './syncService.js';
import { menuCacheService } from './menuCacheService.js';
import { configService } from './configService.js';

class VariantService {
  createVariant(productId, data, userId) {
    const product = productRepository.findById(productId);
    if (!product) throw new Error('Product not found');

    data.product_id = productId;

    catalogValidationService.validateVariant(productId, data);

    // 1. Generate Variant Code if needed
    if (!data.product_code) {
      data.product_code = this.generateVariantCode(product);
    }

    const variant = variantRepository.create(data);

    activityLogService.logActivity(userId, 'VARIANT_CREATED', 'CATALOG', variant.id, { product_id: productId, name: variant.name });
    syncService.queueSyncEvent('VARIANT', variant.id, 'CREATED', { code: variant.product_code }, 1);

    menuCacheService.refresh();

    return variant;
  }

  updateVariant(variantId, data, userId) {
    const variant = variantRepository.findById(variantId);
    if (!variant) throw new Error('Variant not found');

    data.id = variantId;
    
    // We only need to validate if name or code is being changed
    if (data.name || data.product_code) {
      catalogValidationService.validateVariant(variant.product_id, {
        id: variantId,
        name: data.name || variant.name,
        product_code: data.product_code || variant.product_code
      });
    }

    const updated = variantRepository.update(variantId, data);
    activityLogService.logActivity(userId, 'VARIANT_UPDATED', 'CATALOG', variantId, { updates: Object.keys(data) });
    syncService.queueSyncEvent('VARIANT', variantId, 'UPDATED', {}, updated.version);
    menuCacheService.refresh();

    return updated;
  }

  deleteVariant(id, userId) {
    lifecycleService.softDelete('VARIANT', id, userId);
  }

  archiveVariant(id, userId) {
    lifecycleService.archive('VARIANT', id, userId);
  }

  publishVariant(id, userId) {
    lifecycleService.publish('VARIANT', id, userId);
  }

  // --- Code Generation ---
  generateVariantCode(product) {
    const strategy = configService.getVariantCodeStrategy();
    const existingVariants = variantRepository.findByProduct(product.id);
    
    if (strategy === 'SUFFIX') {
      let suffix = 1;
      let newCode = `${product.product_code}-${suffix}`;
      while (existingVariants.find(v => v.product_code === newCode)) {
        suffix++;
        newCode = `${product.product_code}-${suffix}`;
      }
      return newCode;
    }
    
    if (strategy === 'INDEPENDENT') {
      // In a real scenario, this would use a sequence generator like productService.generateNextProductCode()
      // But we need a robust sequence that won't conflict with base products.
      // For now, generating a random 6 digit code
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    if (strategy === 'MANUAL') {
      throw new Error('Variant code generation is set to MANUAL. Please provide a product_code.');
    }

    return null;
  }
}

export const variantService = new VariantService();
