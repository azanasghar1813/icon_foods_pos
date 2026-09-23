import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';
import { printerRepository } from '../repositories/printerRepository.js';
import { routingService } from './routingService.js';
import { configService } from './configService.js';
import crypto from 'crypto';

class OrderSnapshotService {
  /**
   * Generates a complete, immutable snapshot for an order line item.
   * 
   * @param {Object} params { productId, variantId, modifiers, addons, comboComponents, quantity, notes }
   * @returns {Object} Full snapshot structure ready for repository insertion
   */
  createItemSnapshot({ productId, variantId = null, variant_name = null, modifiers = [], addons = [], comboComponents = [], quantity = 1, notes = null }) {
    let product = productRepository.findById(productId);
    let isDeal = false;

    if (!product) {
      product = dealRepository.findById(productId);
      if (product) isDeal = true;
    }

    if (!product) {
      throw new Error(`Product or Deal with ID ${productId} not found in catalog.`);
    }

    const itemId = crypto.randomUUID();
    const productNameSnapshot = product.display_name || product.name || 'Item';
    const productCodeSnapshot = product.product_code || product.sku || product.code || null;

    let baseUnitPrice = Number(product.price) || 0;
    let variantSnapshot = null;
    let resolvedVariant = null;

    // 1. Process Variant Snapshot if a size/variant was chosen
    if (variantId) {
      resolvedVariant = variantRepository.findById(variantId);
    }
    if (!resolvedVariant && variant_name) {
      try {
        resolvedVariant = (variantRepository.findByProduct(productId) || []).find(
          (v) => String(v.name || '').trim().toLowerCase() === String(variant_name).trim().toLowerCase()
            && v.lifecycle_state !== 'DELETED'
        ) || null;
      } catch {
        resolvedVariant = null;
      }
    }
    if (resolvedVariant) {
      const priceAdj = Number(resolvedVariant.price) - baseUnitPrice;
      variantSnapshot = {
        id: crypto.randomUUID(),
        order_item_id: itemId,
        variant_id: resolvedVariant.id,
        variant_name_snapshot: resolvedVariant.name,
        variant_sku_snapshot: resolvedVariant.sku || resolvedVariant.product_code || null,
        price_adjustment: priceAdj > 0 ? priceAdj : 0
      };
      if (Number(resolvedVariant.price) > 0) {
        baseUnitPrice = Number(resolvedVariant.price);
      }
    }

    // 2. Process Modifiers Snapshots
    let modifierTotalAdj = 0;
    const modifierSnapshots = [];

    if (Array.isArray(modifiers) && modifiers.length > 0) {
      for (const modInput of modifiers) {
        const modId = typeof modInput === 'string' ? modInput : modInput.modifier_id;
        const modObj = modifierRepository.findModifierById(modId);

        if (modObj) {
          const priceAdj = modInput.price_adjustment !== undefined ? Number(modInput.price_adjustment) : Number(modObj.price_adjustment || 0);
          const modQty = modInput.quantity || 1;
          let groupName = modInput.group_name_snapshot || null;

          if (!groupName && modInput.group_id) {
            const grp = modifierRepository.findGroupById(modInput.group_id);
            if (grp) groupName = grp.name;
          }

          modifierTotalAdj += (priceAdj * modQty);

          modifierSnapshots.push({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            modifier_id: modObj.id,
            group_id: modInput.group_id || null,
            group_name_snapshot: groupName,
            modifier_name_snapshot: modObj.name,
            price_adjustment: priceAdj,
            quantity: modQty
          });
        }
      }
    }

    // 3. Process Add-ons Snapshots
    let addonSubtotalSum = 0;
    const addonSnapshots = [];

    if (Array.isArray(addons) && addons.length > 0) {
      for (const addonInput of addons) {
        const addonId = typeof addonInput === 'string' ? addonInput : addonInput.addon_id;
        const addonProd = productRepository.findById(addonId);

        if (addonProd) {
          const addonUnitPrice = addonInput.unit_price !== undefined ? Number(addonInput.unit_price) : Number(addonProd.price || 0);
          const addonQty = addonInput.quantity || 1;
          const addonSubtotal = addonUnitPrice * addonQty;

          addonSubtotalSum += addonSubtotal;

          addonSnapshots.push({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            addon_id: addonProd.id,
            addon_name_snapshot: addonProd.display_name || addonProd.name,
            unit_price: addonUnitPrice,
            quantity: addonQty,
            subtotal: addonSubtotal
          });
        }
      }
    }

    // 4. Process Combo Components Snapshots
    const comboSnapshots = [];
    let comboPriceAdj = 0;
    if (Array.isArray(comboComponents) && comboComponents.length > 0) {
      for (const compInput of comboComponents) {
        const compProd = productRepository.findById(compInput.product_id);
        const adj = Number(compInput.price_adjustment || 0);
        comboPriceAdj += adj;
        if (compProd) {
          comboSnapshots.push({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            component_id: compInput.component_id || crypto.randomUUID(),
            product_id: compProd.id,
            product_name_snapshot: compProd.display_name || compProd.name,
            variant_snapshot: compInput.variant_name || compInput.variant_snapshot || null,
            price_adjustment: adj,
            quantity: Number(compInput.quantity) || 1
          });
        }
      }
    }

    // 5. Pricing Calculations
    const finalUnitPrice = baseUnitPrice + modifierTotalAdj + comboPriceAdj;
    const itemSubtotal = (finalUnitPrice * quantity) + addonSubtotalSum;

    // 6. Tax Settings Snapshot
    const financeConfig = configService.getFinanceConfig() || {};
    const taxRate = Number(financeConfig.tax_rate !== undefined ? financeConfig.tax_rate : 0); // 0% default
    const isTaxInclusive = financeConfig.tax_inclusive === true || financeConfig.tax_inclusive === 1;
    const taxName = financeConfig.tax_name || 'VAT';

    let discountAmount = 0;
    let taxAmount = 0;

    if (isTaxInclusive) {
      taxAmount = itemSubtotal - (itemSubtotal / (1 + taxRate));
    } else {
      taxAmount = itemSubtotal * taxRate;
    }

    const totalAmount = isTaxInclusive ? itemSubtotal : itemSubtotal + taxAmount;

    // 7. Kitchen Station Snapshot
    let kitchenStationId = routingService.resolveKitchenPrinter(product, resolvedVariant);
    let kitchenStationName = null;
    if (kitchenStationId) {
      const printer = printerRepository.findById(kitchenStationId);
      if (printer) kitchenStationName = printer.name;
    }

    const estimatedPrepMinutes = product.preparation_time || 10;

    return {
      item: {
        id: itemId,
        product_id: product.id,
        product_name_snapshot: productNameSnapshot,
        product_code_snapshot: productCodeSnapshot,
        base_unit_price: baseUnitPrice,
        final_unit_price: finalUnitPrice,
        quantity,
        subtotal: itemSubtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        tax_rate: taxRate,
        tax_name: taxName,
        is_tax_inclusive: isTaxInclusive ? 1 : 0,
        kitchen_station_id: kitchenStationId,
        kitchen_station_name_snapshot: kitchenStationName,
        estimated_prep_minutes: estimatedPrepMinutes,
        kitchen_state: 'PENDING',
        notes
      },
      variant: variantSnapshot,
      modifiers: modifierSnapshots,
      addons: addonSnapshots,
      comboComponents: comboSnapshots
    };
  }
}

export const orderSnapshotService = new OrderSnapshotService();
