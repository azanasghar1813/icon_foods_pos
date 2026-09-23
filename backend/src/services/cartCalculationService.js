import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';
import { routingService } from './routingService.js';
import { configService } from './configService.js';

/**
 * CartCalculationService
 * 
 * Computes line item and cart-level pricing using the backend pricing engine and
 * finance configuration (tax rate, tax-inclusive/exclusive, tax name).
 * 
 * This is a pure calculation service — it does NOT read or write any database state.
 * It operates on plain cart data objects provided by the CartService.
 */
class CartCalculationService {
  /**
   * Computes full pricing for a single cart line item.
   * 
   * @param {Object} itemInput { product_id, variant_id, modifiers, addons, comboComponents, quantity }
   * @returns {Object} Calculated line item with pricing fields
   */
  calculateLineItem(itemInput) {
    const financeConfig = configService.getFinanceConfig() || {};
    const taxRate = 0;
    const isTaxInclusive = false;
    const taxName = financeConfig.tax_name || 'VAT';

    let product = productRepository.findById(itemInput.product_id);
    let isDeal = false;

    if (!product) {
      product = dealRepository.findById(itemInput.product_id);
      if (product) isDeal = true;
    }

    if (!product) {
      throw new Error(`Product or Deal ${itemInput.product_id} not found.`);
    }

    const quantity = Number(itemInput.quantity) || 1;
    let baseUnitPrice = Number(product.price) || 0;
    let variantName = null;
    let variantSku = null;
    let variantPriceAdj = 0;
    let resolvedVariant = null;

    // 1. Resolve variant price
    if (!isDeal && itemInput.variant_id) {
      resolvedVariant = variantRepository.findById(itemInput.variant_id);
    }
    if (!isDeal && !resolvedVariant && itemInput.variant_name) {
      try {
        resolvedVariant = (variantRepository.findByProduct(itemInput.product_id) || []).find(
          (v) => String(v.name || '').trim().toLowerCase() === String(itemInput.variant_name).trim().toLowerCase()
            && v.lifecycle_state !== 'DELETED'
        ) || null;
      } catch {
        resolvedVariant = null;
      }
    }
    if (resolvedVariant && Number(resolvedVariant.price) > 0) {
      variantPriceAdj = Number(resolvedVariant.price) - baseUnitPrice;
      baseUnitPrice = Number(resolvedVariant.price);
      variantName = resolvedVariant.name;
      variantSku = resolvedVariant.sku || resolvedVariant.product_code || null;
    }

    // 2. Modifier price adjustments
    let modifierTotalAdj = 0;
    const resolvedModifiers = [];

    if (Array.isArray(itemInput.modifiers) && itemInput.modifiers.length > 0) {
      for (const modInput of itemInput.modifiers) {
        const modId = typeof modInput === 'string' ? modInput : modInput.modifier_id;
        const mod = modifierRepository.findModifierById(modId);

        if (mod) {
          const priceAdj = modInput.price_adjustment !== undefined
            ? Number(modInput.price_adjustment)
            : Number(mod.price_adjustment || 0);
          const modQty = modInput.quantity || 1;

          let groupName = modInput.group_name_snapshot || null;
          if (!groupName && modInput.group_id) {
            const grp = modifierRepository.findGroupById(modInput.group_id);
            if (grp) groupName = grp.name;
          }

          modifierTotalAdj += priceAdj * modQty;
          resolvedModifiers.push({
            modifier_id: mod.id,
            modifier_name: mod.name,
            group_id: modInput.group_id || null,
            group_name: groupName,
            price_adjustment: priceAdj,
            quantity: modQty
          });
        }
      }
    }

    // 3. Add-on prices
    let addonTotalPrice = 0;
    const resolvedAddons = [];

    if (Array.isArray(itemInput.addons) && itemInput.addons.length > 0) {
      for (const addonInput of itemInput.addons) {
        const addonId = typeof addonInput === 'string' ? addonInput : addonInput.addon_id;
        const addonProd = productRepository.findById(addonId);

        if (addonProd) {
          const unitPrice = addonInput.unit_price !== undefined
            ? Number(addonInput.unit_price)
            : Number(addonProd.price || 0);
          const addonQty = addonInput.quantity || 1;
          const subtotal = unitPrice * addonQty;

          addonTotalPrice += subtotal;
          resolvedAddons.push({
            addon_id: addonProd.id,
            addon_name: addonProd.display_name || addonProd.name,
            unit_price: unitPrice,
            quantity: addonQty,
            subtotal
          });
        }
      }
    }

    // 4. Combo components
    const resolvedCombos = [];
    let comboPriceAdj = 0;
    
    const inputComboComps = itemInput.comboComponents || itemInput.combo_components;

    if (Array.isArray(inputComboComps) && inputComboComps.length > 0) {
      for (const comp of inputComboComps) {
        const compProd = productRepository.findById(comp.product_id);
        if (compProd) {
          const adj = Number(comp.price_adjustment || 0);
          comboPriceAdj += adj;
          resolvedCombos.push({
            component_id: comp.component_id || null,
            product_id: compProd.id,
            product_name_snapshot: compProd.display_name || compProd.name || comp.product_name_snapshot,
            variant_snapshot: comp.variant_snapshot || comp.variant_name || null,
            price_adjustment: adj,
            quantity: comp.quantity || 1
          });
        } else if (comp.is_dummy || comp.product_id?.startsWith('dummy')) {
          resolvedCombos.push({
            component_id: comp.component_id || null,
            product_id: comp.product_id || 'DUMMY',
            product_name_snapshot: comp.product_name_snapshot || comp.product_name || comp.name || 'Item',
            variant_snapshot: comp.variant_snapshot || comp.variant_name || null,
            price_adjustment: 0,
            quantity: comp.quantity || 1
          });
        }
      }
    }

    // 5. Final unit price and subtotals
    const finalUnitPrice = baseUnitPrice + modifierTotalAdj + comboPriceAdj;
    const lineSubtotal = (finalUnitPrice * quantity) + addonTotalPrice;

    // Tax is not charged. Service charge is applied on the order, not the line.
    const taxAmount = 0;
    const totalAmount = lineSubtotal;

    const resolvedKitchenStationId = routingService.resolveKitchenPrinter(product, resolvedVariant);

    return {
      product_id: product.id,
      product_name: product.display_name || product.name,
      product_code: product.product_code || product.sku || product.code || null,
      variant_id: itemInput.variant_id || null,
      variant_name: variantName,
      variant_sku: variantSku,
      variant_price_adj: variantPriceAdj,
      base_unit_price: baseUnitPrice,
      modifier_total_adj: modifierTotalAdj,
      addon_total_price: addonTotalPrice,
      final_unit_price: finalUnitPrice,
      quantity,
      subtotal: lineSubtotal,
      discount_amount: 0,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      tax_name: taxName,
      is_tax_inclusive: isTaxInclusive,
      total_amount: totalAmount,
      modifiers: resolvedModifiers,
      addons: resolvedAddons,
      comboComponents: resolvedCombos,
      kitchen_station_id: resolvedKitchenStationId,
      estimated_prep_minutes: Number(product.preparation_time) || 10,
      notes: itemInput.notes || null
    };
  }

  /**
   * Recalculates cart-level totals from all line items.
   * 
   * @param {Object[]} items - Calculated line items from calculateLineItem()
   * @returns {Object} Cart totals summary
   */
  calculateCartTotals(items) {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    for (const item of items) {
      subtotal += item.subtotal;
      taxTotal += item.tax_amount;
      discountTotal += item.discount_amount || 0;
    }

    const grandTotal = subtotal - discountTotal;

    return {
      subtotal: this._round(subtotal),
      tax_total: this._round(taxTotal),
      discount_total: this._round(discountTotal),
      grand_total: this._round(grandTotal),
      item_count: items.length,
      total_quantity: items.reduce((sum, i) => sum + i.quantity, 0)
    };
  }

  _round(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

export const cartCalculationService = new CartCalculationService();
