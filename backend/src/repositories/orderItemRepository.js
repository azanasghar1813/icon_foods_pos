import { dbEngine } from '../database/sqlite.js';

class OrderItemRepository {
  addItem(itemData) {
    dbEngine.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_name_snapshot, product_code_snapshot,
        base_unit_price, final_unit_price, quantity, subtotal, discount_amount,
        tax_amount, total_amount, tax_rate, tax_name, is_tax_inclusive,
        kitchen_station_id, kitchen_station_name_snapshot, estimated_prep_minutes,
        kitchen_state, notes, created_at, updated_at
      ) VALUES (
        @id, @order_id, @product_id, @product_name_snapshot, @product_code_snapshot,
        @base_unit_price, @final_unit_price, @quantity, @subtotal, @discount_amount,
        @tax_amount, @total_amount, @tax_rate, @tax_name, @is_tax_inclusive,
        @kitchen_station_id, @kitchen_station_name_snapshot, @estimated_prep_minutes,
        @kitchen_state, @notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run({
      id: itemData.id,
      order_id: itemData.order_id,
      product_id: itemData.product_id,
      product_name_snapshot: itemData.product_name_snapshot,
      product_code_snapshot: itemData.product_code_snapshot || null,
      base_unit_price: itemData.base_unit_price || 0,
      final_unit_price: itemData.final_unit_price || 0,
      quantity: itemData.quantity || 1,
      subtotal: itemData.subtotal || 0,
      discount_amount: itemData.discount_amount || 0,
      tax_amount: itemData.tax_amount || 0,
      total_amount: itemData.total_amount || 0,
      tax_rate: itemData.tax_rate || 0,
      tax_name: itemData.tax_name || 'VAT',
      is_tax_inclusive: itemData.is_tax_inclusive ? 1 : 0,
      kitchen_station_id: itemData.kitchen_station_id || null,
      kitchen_station_name_snapshot: itemData.kitchen_station_name_snapshot || null,
      estimated_prep_minutes: itemData.estimated_prep_minutes || 10,
      kitchen_state: itemData.kitchen_state || 'PENDING',
      notes: itemData.notes || null
    });

    return itemData.id;
  }

  addVariant(variantData) {
    dbEngine.prepare(`
      INSERT INTO order_item_variants (
        id, order_item_id, variant_id, variant_name_snapshot, variant_sku_snapshot, price_adjustment
      ) VALUES (
        @id, @order_item_id, @variant_id, @variant_name_snapshot, @variant_sku_snapshot, @price_adjustment
      )
    `).run({
      id: variantData.id,
      order_item_id: variantData.order_item_id,
      variant_id: variantData.variant_id,
      variant_name_snapshot: variantData.variant_name_snapshot,
      variant_sku_snapshot: variantData.variant_sku_snapshot || null,
      price_adjustment: variantData.price_adjustment || 0
    });
  }

  addModifier(modifierData) {
    dbEngine.prepare(`
      INSERT INTO order_item_modifiers (
        id, order_item_id, modifier_id, group_id, group_name_snapshot, modifier_name_snapshot, price_adjustment, quantity
      ) VALUES (
        @id, @order_item_id, @modifier_id, @group_id, @group_name_snapshot, @modifier_name_snapshot, @price_adjustment, @quantity
      )
    `).run({
      id: modifierData.id,
      order_item_id: modifierData.order_item_id,
      modifier_id: modifierData.modifier_id,
      group_id: modifierData.group_id || null,
      group_name_snapshot: modifierData.group_name_snapshot || null,
      modifier_name_snapshot: modifierData.modifier_name_snapshot,
      price_adjustment: modifierData.price_adjustment || 0,
      quantity: modifierData.quantity || 1
    });
  }

  addAddon(addonData) {
    dbEngine.prepare(`
      INSERT INTO order_item_addons (
        id, order_item_id, addon_id, addon_name_snapshot, unit_price, quantity, subtotal
      ) VALUES (
        @id, @order_item_id, @addon_id, @addon_name_snapshot, @unit_price, @quantity, @subtotal
      )
    `).run({
      id: addonData.id,
      order_item_id: addonData.order_item_id,
      addon_id: addonData.addon_id,
      addon_name_snapshot: addonData.addon_name_snapshot,
      unit_price: addonData.unit_price || 0,
      quantity: addonData.quantity || 1,
      subtotal: addonData.subtotal || 0
    });
  }

  addComboComponent(componentData) {
    dbEngine.prepare(`
      INSERT INTO order_combo_components (
        id, order_item_id, component_id, product_id, product_name_snapshot, variant_snapshot, price_adjustment, quantity
      ) VALUES (
        @id, @order_item_id, @component_id, @product_id, @product_name_snapshot, @variant_snapshot, @price_adjustment, @quantity
      )
    `).run({
      id: componentData.id,
      order_item_id: componentData.order_item_id,
      component_id: componentData.component_id,
      product_id: componentData.product_id,
      product_name_snapshot: componentData.product_name_snapshot,
      variant_snapshot: componentData.variant_snapshot || null,
      price_adjustment: componentData.price_adjustment || 0,
      quantity: componentData.quantity || 1
    });
  }

  findItemById(itemId) {
    const item = dbEngine.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
    if (!item) return null;

    item.variants = dbEngine.prepare('SELECT * FROM order_item_variants WHERE order_item_id = ?').all(itemId);
    item.modifiers = dbEngine.prepare('SELECT * FROM order_item_modifiers WHERE order_item_id = ?').all(itemId);
    item.addons = dbEngine.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(itemId);
    item.combo_components = dbEngine.prepare('SELECT * FROM order_combo_components WHERE order_item_id = ?').all(itemId);
    return item;
  }

  findItemsByOrderId(orderId) {
    const items = dbEngine.prepare(`
      SELECT 
        oi.*,
        CASE 
          WHEN d.id IS NOT NULL THEN 'Deals'
          ELSE c.name 
        END AS category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN deals d ON d.id = oi.product_id
      WHERE oi.order_id = ? 
      ORDER BY oi.created_at ASC
    `).all(orderId);
    if (!items.length) return [];

    const itemIds = items.map(i => i.id);
    const placeholders = itemIds.map(() => '?').join(',');

    const variants = dbEngine.prepare(`SELECT * FROM order_item_variants WHERE order_item_id IN (${placeholders})`).all(...itemIds);
    const modifiers = dbEngine.prepare(`SELECT * FROM order_item_modifiers WHERE order_item_id IN (${placeholders})`).all(...itemIds);
    const addons = dbEngine.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})`).all(...itemIds);
    const combos = dbEngine.prepare(`SELECT * FROM order_combo_components WHERE order_item_id IN (${placeholders})`).all(...itemIds);

    const variantMap = new Map();
    const modifierMap = new Map();
    const addonMap = new Map();
    const comboMap = new Map();

    for (const v of variants) {
      if (!variantMap.has(v.order_item_id)) variantMap.set(v.order_item_id, []);
      variantMap.get(v.order_item_id).push(v);
    }
    for (const m of modifiers) {
      if (!modifierMap.has(m.order_item_id)) modifierMap.set(m.order_item_id, []);
      modifierMap.get(m.order_item_id).push(m);
    }
    for (const a of addons) {
      if (!addonMap.has(a.order_item_id)) addonMap.set(a.order_item_id, []);
      addonMap.get(a.order_item_id).push(a);
    }
    for (const c of combos) {
      if (!comboMap.has(c.order_item_id)) comboMap.set(c.order_item_id, []);
      comboMap.get(c.order_item_id).push(c);
    }

    for (const item of items) {
      item.variants = variantMap.get(item.id) || [];
      item.variant = item.variants[0] || null;
      item.variant_name = item.variant?.variant_name_snapshot || null;
      item.modifiers = modifierMap.get(item.id) || [];
      item.addons = addonMap.get(item.id) || [];
      item.combo_components = comboMap.get(item.id) || [];
    }

    return items;
  }

  updateItem(itemId, updates) {
    const fields = [];
    const params = { id: itemId };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      dbEngine.prepare(`
        UPDATE order_items 
        SET ${fields.join(', ')} 
        WHERE id = @id
      `).run(params);
    }
  }

  removeItem(itemId) {
    dbEngine.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
  }
}

export const orderItemRepository = new OrderItemRepository();
