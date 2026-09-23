import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';

class CatalogValidationService {
  /**
   * Validates if a proposed variant configuration is valid for the product.
   */
  validateVariant(productId, data) {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Variant name is required');
    }
    
    const existingVariants = variantRepository.findByProduct(productId);
    const duplicate = existingVariants.find(v => v.name.toLowerCase() === data.name.toLowerCase() && v.id !== data.id);
    
    if (duplicate) {
      throw new Error(`A variant named '${data.name}' already exists for this product.`);
    }

    if (data.product_code) {
      const codeExists = variantRepository.findByProductCode(data.product_code);
      if (codeExists && codeExists.id !== data.id) {
        throw new Error(`Variant code '${data.product_code}' is already in use.`);
      }
    }
  }

  /**
   * Validates modifier group configurations before saving.
   */
  validateModifierGroup(data) {
    if (data.min_selection < 0) {
      throw new Error('Minimum selection cannot be negative.');
    }
    
    if (data.max_selection !== null && data.max_selection !== undefined) {
      if (data.max_selection < data.min_selection) {
        throw new Error('Maximum selection cannot be less than minimum selection.');
      }
    }
  }

  /**
   * Prevents circular add-on relationships (A -> B -> A).
   * For enterprise, deep circular checks might be needed, but this prevents direct loops.
   */
  validateAddon(productId, addonProductId) {
    if (productId === addonProductId) {
      throw new Error('A product cannot be an add-on to itself.');
    }

    const addonSubAddons = productRepository.getAddons(addonProductId);
    if (addonSubAddons.find(a => a.addon_product_id === productId)) {
      throw new Error('Circular add-on relationship detected. Product A cannot be an add-on to B if B is an add-on to A.');
    }
  }
}

export const catalogValidationService = new CatalogValidationService();
