import { configService } from './configService.js';
import { categoryRepository } from '../repositories/categoryRepository.js';

class RoutingService {
  /**
   * Resolves the correct kitchen printer ID for a product.
   * Priority:
   * 1. Variant kitchen printer override
   * 2. Explicit product kitchen printer
   * 3. Category kitchen printer
   * 4. System default kitchen printer (from ConfigService)
   * 
   * @param {Object} product The product object
   * @param {Object} variant Optional variant object
   * @returns {string|null} The resolved printer ID
   */
  resolveKitchenPrinter(product, variant = null) {
    // 1. Variant-level routing override
    if (variant && variant.kitchen_printer_id) {
      return variant.kitchen_printer_id;
    }

    // 2. Product-level routing
    if (product.kitchen_printer_id) {
      return product.kitchen_printer_id;
    }

    // 3. Category-level routing (Inheritance)
    if (product.category_id) {
      // Because we might have infinite nesting, we traverse upwards
      let currentCategoryId = product.category_id;
      
      while (currentCategoryId) {
        const category = categoryRepository.findById(currentCategoryId);
        if (!category) break;

        if (category.kitchen_printer_id) {
          return category.kitchen_printer_id;
        }

        currentCategoryId = category.parent_id;
      }
    }

    // 4. System Default Routing
    // Check configService for the default kitchen printer
    const orderConfig = configService.getOrderConfig();
    if (orderConfig && orderConfig.default_kitchen_printer_id) {
      return orderConfig.default_kitchen_printer_id;
    }

    return null;
  }
}

export const routingService = new RoutingService();
