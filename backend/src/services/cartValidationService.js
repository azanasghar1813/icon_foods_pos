import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';

class CartValidationService {
  /**
   * Validates a cart line item before addition or checkout.
   * 
   * @param {Object} itemInput { product_id, variant_id, modifiers, addons, comboComponents, quantity }
   */
  validateCartItem(itemInput) {
    if (!itemInput || !itemInput.product_id) {
      throw new Error('Product ID is required.');
    }

    const quantity = Number(itemInput.quantity) || 1;
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    let product = productRepository.findById(itemInput.product_id);
    let isDeal = false;

    if (!product) {
      product = dealRepository.findById(itemInput.product_id);
      if (product) isDeal = true;
    }

    if (!product) {
      throw new Error(`Product or Deal with ID ${itemInput.product_id} not found.`);
    }

    if (product.lifecycle_state === 'DELETED') {
      throw new Error(`Item "${product.name || product.display_name}" has been deleted from catalog.`);
    }

    if (product.status === 'UNAVAILABLE' || product.status === 'OUT_OF_STOCK') {
      throw new Error(`Item "${product.name || product.display_name}" is currently unavailable.`);
    }

    // 1. Variant Validation
    if (!isDeal) {
      const variants = variantRepository.findByProduct(product.id) || [];
      const allowedStates = ['ACTIVE', 'UNAVAILABLE', 'HIDDEN'];
      const activeVariants = variants.filter(v => allowedStates.includes(v.lifecycle_state));

      if (activeVariants.length > 0) {
        if (!itemInput.variant_id) {
          throw new Error(`Variant selection is required for "${product.display_name || product.name}".`);
        }
        const selectedVar = activeVariants.find(v => v.id === itemInput.variant_id);
        if (!selectedVar) {
          throw new Error(`Selected variant is invalid for "${product.display_name || product.name}".`);
        }
      }
    }

    // 2. Modifier Group Min/Max Validation
    if (!isDeal) {
      const groups = modifierRepository.getGroupsForProduct(product.id) || [];
      const selectedModifiers = Array.isArray(itemInput.modifiers) ? itemInput.modifiers : [];

      for (const group of groups) {
        const allowedStates = ['ACTIVE', 'UNAVAILABLE', 'HIDDEN'];
        if (!allowedStates.includes(group.lifecycle_state)) continue;

        // Count how many options from this group were selected
        const groupOptionIds = (group.options || []).map(o => o.id);
        const selectedInGroup = selectedModifiers.filter(m => {
          const modId = typeof m === 'string' ? m : m.modifier_id;
          const grpId = typeof m === 'object' ? m.group_id : null;
          if (grpId && grpId === group.id) return true;
          return groupOptionIds.includes(modId);
        });

        const selectedCount = selectedInGroup.reduce((sum, m) => sum + (typeof m === 'object' && m.quantity ? m.quantity : 1), 0);

        if ((group.is_required || group.min_selection > 0) && selectedCount < group.min_selection) {
          throw new Error(`Modifier group "${group.name}" requires at least ${group.min_selection} selection(s).`);
        }

        if (group.max_selection > 0 && selectedCount > group.max_selection) {
          throw new Error(`Modifier group "${group.name}" permits at most ${group.max_selection} selection(s).`);
        }
      }
    }
  }

  /**
   * Validates an entire working cart before checkout conversion.
   * 
   * @param {Object} cart { items, order_type, cashier_user_id, shift_id }
   */
  validateCartForCheckout(cart) {
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new Error('Cannot checkout an empty cart.');
    }

    if (!cart.shift_id) {
      throw new Error('Cashier shift session is required to perform checkout.');
    }

    if (!cart.cashier_user_id) {
      throw new Error('Cashier user ID is required to perform checkout.');
    }

    // Validate each item in cart against current catalog rules
    for (const item of cart.items) {
      this.validateCartItem(item);
    }
  }
}

export const cartValidationService = new CartValidationService();
