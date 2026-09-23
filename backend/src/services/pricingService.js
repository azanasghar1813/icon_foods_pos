import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';

class PricingService {
  /**
   * Calculates the final price of a product including its variant and modifiers.
   * 
   * @param {string} productId - The base product ID
   * @param {string|null} variantId - Optional variant ID
   * @param {string[]} modifierOptionIds - Array of selected modifier_group_options IDs
   * @param {string[]} addonProductIds - Array of selected add-on product IDs
   * @returns {number} The calculated total price
   */
  calculateItemPrice(productId, variantId = null, modifierOptionIds = [], addonProductIds = []) {
    let totalPrice = 0;

    // 1. Base Price or Variant Price
    if (variantId) {
      const variant = variantRepository.findById(variantId);
      if (!variant) throw new Error(`Variant ${variantId} not found`);
      totalPrice += variant.price;
    } else {
      const product = productRepository.findById(productId);
      if (!product) throw new Error(`Product ${productId} not found`);
      totalPrice += product.price;
    }

    // 2. Modifiers Pricing
    if (modifierOptionIds.length > 0) {
      // We would ideally fetch all options at once, but for simplicity we fetch the product's modifier groups
      // and match the options to calculate the effective price.
      const groups = modifierRepository.getGroupsForProduct(productId);
      const optionsMap = new Map();
      
      groups.forEach(g => {
        g.options.forEach(opt => {
          optionsMap.set(opt.id, opt.effective_price);
        });
      });

      for (const optId of modifierOptionIds) {
        if (optionsMap.has(optId)) {
          totalPrice += optionsMap.get(optId);
        } else {
          throw new Error(`Modifier option ${optId} is not valid for product ${productId}`);
        }
      }
    }

    // 3. Add-ons Pricing
    if (addonProductIds.length > 0) {
      const availableAddons = productRepository.getAddons(productId);
      const addonsMap = new Map();
      
      availableAddons.forEach(a => {
        addonsMap.set(a.addon_product_id, a.effective_price);
      });

      for (const addonId of addonProductIds) {
        if (addonsMap.has(addonId)) {
          totalPrice += addonsMap.get(addonId);
        } else {
          throw new Error(`Add-on product ${addonId} is not valid for product ${productId}`);
        }
      }
    }

    return totalPrice;
  }

  /**
   * Calculates the total price of a combo deal based on its strategy and selected components.
   * 
   * @param {string} dealId 
   * @param {Object[]} selectedComponents - Array of { product_id, quantity }
   */
  calculateComboPrice(dealId, selectedComponents = []) {
    const deal = dealRepository.findById(dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    if (deal.pricing_strategy === 'FIXED') {
      return deal.price;
    }

    if (deal.pricing_strategy === 'DYNAMIC') {
      // Sum the prices of all selected components
      let sum = 0;
      for (const comp of selectedComponents) {
        // Find component in deal groups to get possible adjustment, or just base price
        // DYNAMIC usually means base price of items
        const product = productRepository.findById(comp.product_id);
        if (product) {
          sum += product.price * comp.quantity;
        }
      }
      return sum;
    }

    if (deal.pricing_strategy === 'FIXED_WITH_ADJUSTMENTS') {
      let sum = deal.price;
      // We need to look up the price_adjustment for each selected component
      const componentsMap = new Map();
      deal.groups.forEach(g => {
        g.components.forEach(c => {
          componentsMap.set(c.product_id, c.price_adjustment || 0);
        });
      });

      for (const comp of selectedComponents) {
        if (componentsMap.has(comp.product_id)) {
          sum += componentsMap.get(comp.product_id) * comp.quantity;
        }
      }
      return sum;
    }

    return deal.price;
  }
}

export const pricingService = new PricingService();
