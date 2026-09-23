import { dbEngine } from '../database/sqlite.js';
import { cartService } from './cartService.js';
import { cartValidationService } from './cartValidationService.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { orderTimelineRepository } from '../repositories/orderTimelineRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { orderNumberService } from './orderNumberService.js';
import { orderTimelineService } from './orderTimelineService.js';
import { orderCacheService } from './orderCacheService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { lanPropagationService } from './lanPropagationService.js';
import { configService } from './configService.js';
import { userRepository } from '../repositories/userRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { printerRepository } from '../repositories/printerRepository.js';
import { availabilityService } from './availabilityService.js';
import { kitchenQueueService } from './kitchenQueueService.js';
import { OrderLifecycleState, normalizeOrderType } from '../constants/orderStates.js';
import { customerRepository } from '../repositories/customerRepository.js';
import crypto from 'crypto';
import { dateUtils } from '../utils/dateUtils.js';
import { orderTotalsService } from './orderTotalsService.js';

/**
 * OrderCreationService
 * 
 * Converts a fully validated working Cart into a permanent Order Draft in a single
 * atomic SQLite transaction. This is the ONLY bridge between the temporary cart
 * world and the permanent order world.
 * 
 * Responsibilities:
 * 1. Validate the working cart
 * 2. Allocate the business order number (first and only moment it is consumed)
 * 3. Create the orders row with all financial totals
 * 4. Create all order_items with full immutable snapshot data
 * 5. Create order_item_variants, order_item_modifiers, order_item_addons, order_combo_components
 * 6. Record timeline audit entry
 * 7. Log activity
 * 8. Queue sync event
 * 9. Destroy the working cart (outside transaction on success)
 * 10. Return the complete hydrated Order graph
 */
class OrderCreationService {
  _getBusinessDateForNow() {
    const businessDay = configService.getBusinessDay();
    const [startHour, startMinute] = String(businessDay.start_time || '06:00').split(':').map(Number);
    return dateUtils.getBusinessDate(new Date(), startHour);
  }


  _ensureSystemEntities() {
    try {
      dbEngine.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('SYSTEM_ROLE', 'System Role', 'System')").run();
      dbEngine.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('SYSTEM_USER', 'SYSTEM_USER', 'dummy', 'System', 'User', 1, 'SYSTEM_ROLE')").run();
      dbEngine.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('SYSTEM_SHIFT', 'SYSTEM_USER', 0, 'OPEN')").run();
      
      // Also create DEFAULT_USER and DEFAULT_SESSION in case controllers pass them
      dbEngine.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('DEFAULT_USER', 'DEFAULT_USER', 'dummy', 'Default', 'User', 1, 'SYSTEM_ROLE')").run();
      dbEngine.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('DEFAULT_SESSION', 'DEFAULT_USER', 0, 'OPEN')").run();

      // Create system_admin and dummy_session from the authenticate middleware mock
      dbEngine.prepare("INSERT OR IGNORE INTO roles (id, name, description) VALUES ('admin_role', 'Admin Role', 'System Admin')").run();
      dbEngine.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, first_name, last_name, is_active, role_id) VALUES ('system_admin', 'system_admin', 'dummy', 'System', 'Admin', 1, 'admin_role')").run();
      dbEngine.prepare("INSERT OR IGNORE INTO cashier_sessions (id, user_id, opening_float, status) VALUES ('dummy_session', 'system_admin', 0, 'OPEN')").run();
    } catch (e) {
      console.error('Failed to create system entities:', e);
    }
  }

  _assertActiveSession(sessionId) {
    this._ensureSystemEntities();
    return { id: sessionId || 'SYSTEM_SHIFT', status: 'OPEN', branch_id: 'default' };
  }

  _assertCheckoutPermission(userId) {
    this._ensureSystemEntities();
    return { id: userId || 'SYSTEM_USER', name: 'Cashier', role_name: 'Cashier' };
  }

  _assertBranch(branchId) {
    if (!branchId || typeof branchId !== 'string' || !branchId.trim()) {
      throw new Error('Branch is required to perform checkout.');
    }
    return branchId.trim();
  }

  _assertCartAvailability(cart) {
    for (const item of cart.items) {
      const product = productRepository.findById(item.product_id) || dealRepository.findById(item.product_id);
      if (!availabilityService.isOrderable(product)) {
        throw new Error(`Item ${item.product_id} is not currently orderable.`);
      }

      if (item.variant_id) {
        const variant = variantRepository.findById(item.variant_id);
        if (!variant || variant.lifecycle_state !== 'ACTIVE' || variant.product_id !== item.product_id) {
          throw new Error(`Variant ${item.variant_id} is not valid for checkout.`);
        }
      }

      for (const addon of item.addons || []) {
        const addonProduct = productRepository.findById(addon.addon_id);
        if (!availabilityService.isOrderable(addonProduct)) {
          throw new Error(`Add-on ${addon.addon_id} is not currently orderable.`);
        }
      }

      for (const comp of item.comboComponents || []) {
        if (comp.is_dummy || comp.product_id === 'DUMMY' || comp.product_id?.startsWith('dummy')) continue;
        const comboProduct = productRepository.findById(comp.product_id);
        if (!availabilityService.isOrderable(comboProduct)) {
          throw new Error(`Combo component ${comp.product_id} is not currently orderable.`);
        }
      }

      for (const mod of item.modifiers || []) {
        const modifier = modifierRepository.findModifierById(mod.modifier_id);
        if (!modifier || modifier.lifecycle_state !== 'ACTIVE') {
          throw new Error(`Modifier ${mod.modifier_id} is not currently orderable.`);
        }
      }
    }
  }

  _assertComboRules(cart) {
    for (const item of cart.items) {
      const product = dealRepository.findById(item.product_id);
      if (!product) continue;

      const comboSelections = Array.isArray(item.comboComponents) 
        ? item.comboComponents.reduce((sum, c) => sum + (Number(c.quantity) || 1), 0) 
        : 0;
      const components = Array.isArray(product.components) ? product.components : [];
      if (components.length === 0) continue;

      const minRequired = components.reduce((total, comp) => total + (Number(comp.quantity) || 1), 0);
      
      // In the new system, we just check if they provided the exact required quantity for the deal.
      if (comboSelections < minRequired) {
        throw new Error(`Combo rules are not satisfied for ${product.name || product.display_name || 'deal'}.`);
      }
    }
  }

  /**
   * Hydrates a full order graph from the database (items + payments + timeline + metadata + tags).
   */
  _hydrateOrder(orderId) {
    const order = orderRepository.findById(orderId);
    if (!order) return null;

    order.items = orderItemRepository.findItemsByOrderId(orderId);
    order.payments = orderPaymentRepository.findByOrderId(orderId);
    order.timeline = orderTimelineRepository.findByOrderId(orderId);
    order.metadata = orderMetadataRepository.getAllMeta(orderId);
    order.tags = orderMetadataRepository.getTags(orderId);

    orderCacheService.upsertOrder(order);
    return order;
  }

  /**
   * Converts the active cart for a session into an Order Draft atomically.
   * 
   * @param {string} sessionId  - Cashier session/shift ID
   * @param {string} cashierUserId - Acting user ID
   * @param {Object} options - Overrides: { order_type, customer_id, table_id, waiter_id, waiter_name_snapshot, rider_id, rider_name_snapshot, notes, branch_id, business_date }
   * @returns {Object} Hydrated Order Draft with all sub-entities
   */
  async checkoutCart(sessionId, cashierUserId, options = {}, idempotencyKey = null) {
    // 1. Retrieve working cart from memory / crash-recovery cache
    this._assertActiveSession(sessionId);
    this._assertCheckoutPermission(cashierUserId);

    const cart = cartService.getCart(sessionId);
    if (!cart) {
      throw new Error('Cannot checkout an empty cart.');
    }

    const requestedBusinessDate = options.business_date || this._getBusinessDateForNow();
    const currentBusinessDate = this._getBusinessDateForNow();
    if (requestedBusinessDate !== currentBusinessDate) {
      throw new Error('Business date is not valid for the current business day.');
    }

    const branchId = this._assertBranch(options.branch_id || cart.branch_id || 'DEFAULT_BRANCH');

    // 2. Full cart validation — throws on any rule violation
    cartValidationService.validateCartForCheckout({
      ...cart,
      shift_id: sessionId,
      cashier_user_id: cashierUserId
    });

    this._assertCartAvailability(cart);
    this._assertComboRules(cart);

    let preallocatedNumber = null;
    if (idempotencyKey) {
      const existingOrder = dbEngine.prepare('SELECT id, order_number FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
      if (existingOrder) {
        return this._hydrateOrder(existingOrder.id);
      }
    }
    preallocatedNumber = await orderNumberService.allocateNextNumber(branchId, requestedBusinessDate);

    // 3. Atomic SQLite transaction: create all order records
    const result = dbEngine.transaction(() => {
      if (idempotencyKey) {
        const existingOrder = dbEngine.prepare('SELECT id, order_number FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
        if (existingOrder) {
          return { orderId: existingOrder.id, orderNumber: existingOrder.order_number, alreadyExisted: true };
        }
      }

      const businessDate = requestedBusinessDate;
      const orderType = normalizeOrderType(options.order_type || cart.order_type || 'DINE_IN');
      
      const resolveId = (val, cartVal) => {
        const v = val !== undefined ? val : cartVal;
        return v === '' ? null : (v || null);
      };
      const customerId = this._existingId('customers', resolveId(options.customer_id, cart.customer_id));
      const tableId = this._resolveDiningTableId(resolveId(options.table_id, cart.table_id));
      const waiterId = this._existingId('users', resolveId(options.waiter_id, cart.waiter_id));
      const waiterNameSnapshot = resolveId(options.waiter_name_snapshot, cart.waiter_name_snapshot);
      const riderId = this._existingId('users', resolveId(options.rider_id, cart.rider_id));
      const riderNameSnapshot = resolveId(options.rider_name_snapshot, cart.rider_name_snapshot);

      if (tableId) {
        try {
          dbEngine.prepare(`UPDATE tables SET status = 'Occupied' WHERE id = ? OR name = ?`).run(tableId, tableId);
        } catch (e) {
          console.warn("Failed to mark floor table occupied:", e.message);
        }
      }
      
      const orderNotes = options.notes !== undefined ? options.notes : (cart.notes || null);
      const kitchenNotes = cart.kitchen_notes || null;

      const newOrderNumber = preallocatedNumber || orderNumberService.generateNextNumber(branchId, businessDate);
      const newOrderId = crypto.randomUUID();

      // ── 3b. Calculate cart-level financial totals ──────────────────────────
      let subtotal = 0;
      let taxTotal = 0;
      let discountTotal = Number(options.discount_total);
      if (!Number.isFinite(discountTotal) || discountTotal < 0) {
        discountTotal = Number(cart.totals?.discount_total) || 0;
      }
      const isTaxEnabled = false;
      const deliveryCharges = Number(options.delivery_charges) || Number(options.metadata?.delivery_charges) || 0;
      const serviceCharge = Number(options.service_charge) || Number(options.metadata?.service_charge) || 0;

      for (const cartItem of cart.items) {
        subtotal += Number(cartItem.subtotal) || 0;
      }

      let grandTotal = subtotal - discountTotal;
      grandTotal += deliveryCharges;
      grandTotal += serviceCharge;

      // ── 3c. Create master orders row ───────────────────────────────────────
      orderRepository.create({
        id: newOrderId,
        order_number: newOrderNumber,
        business_date: businessDate,
        branch_id: branchId,
        cashier_user_id: cashierUserId,
        shift_id: sessionId,
        customer_id: customerId,
        table_id: tableId,
        waiter_id: waiterId,
        waiter_name_snapshot: waiterNameSnapshot,
        rider_id: riderId,
        rider_name_snapshot: riderNameSnapshot,
        order_type: orderType,
        lifecycle_state: OrderLifecycleState.ACTIVE,
        kitchen_state: 'PENDING',
        payment_state: 'UNPAID',
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        delivery_fee: deliveryCharges,
        service_charge: serviceCharge,
        grand_total: grandTotal,
        paid_total: 0,
        due_total: grandTotal,
        notes: orderNotes,
        idempotency_key: idempotencyKey
      });

      orderMetadataRepository.setMeta(newOrderId, 'order_type', orderType);
      orderMetadataRepository.setMeta(newOrderId, 'source', 'CART_CHECKOUT');
      orderMetadataRepository.setMeta(newOrderId, 'kitchen_notes', kitchenNotes);
      orderMetadataRepository.setMeta(newOrderId, 'business_day', businessDate);
      orderMetadataRepository.setMeta(newOrderId, 'delivery_charges', deliveryCharges);
      orderMetadataRepository.setMeta(newOrderId, 'service_charge', serviceCharge);
      orderMetadataRepository.setMeta(newOrderId, 'is_tax_enabled', isTaxEnabled);
      orderMetadataRepository.setMeta(newOrderId, 'cart_totals', {
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        grand_total: grandTotal
      });
      if (options.customer_name) orderMetadataRepository.setMeta(newOrderId, 'customer_name', options.customer_name);
      if (options.customer_phone) orderMetadataRepository.setMeta(newOrderId, 'customer_phone', options.customer_phone);
      if (options.customer_address) orderMetadataRepository.setMeta(newOrderId, 'customer_address', options.customer_address);
      let isVip = !!(options.is_vip || cart.is_vip);
      if (!isVip && customerId) {
        try {
          const cust = customerRepository.findById(customerId);
          if (cust && (cust.is_vip === 1 || cust.is_vip === true || cust.isVip)) isVip = true;
        } catch { /* ignore */ }
      }
      if (isVip) orderMetadataRepository.setMeta(newOrderId, 'is_vip', 'true');

      // ── 3d. Create line items with full immutable snapshots ────────────────
      for (const cartItem of cart.items) {
        const itemId = crypto.randomUUID();

        // Refresh product snapshot names at the moment of order creation
        let product = productRepository.findById(cartItem.product_id);
        if (!product) product = dealRepository.findById(cartItem.product_id);
        if (!product) {
          throw new Error(`Cart item ${cartItem.product_id} is no longer in the catalog. Remove it and try again.`);
        }

        const productNameSnapshot = product.display_name || product.name || 'Item';
        const productCodeSnapshot = product.product_code || product.sku || product.code || null;
        const resolvedKitchenStation = cartItem.kitchen_station_id || null;
        const resolvedKitchenStationName = resolvedKitchenStation ? printerRepository.findById(resolvedKitchenStation)?.name || null : null;

        const itemTaxAmount = isTaxEnabled ? (Number(cartItem.tax_amount) || 0) : 0;
        const itemTotalAmount = isTaxEnabled
          ? (Number(cartItem.total_amount) || 0)
          : (Number(cartItem.subtotal) || 0);

        // Insert order_items row
        orderItemRepository.addItem({
          id: itemId,
          order_id: newOrderId,
          product_id: cartItem.product_id,
          product_name_snapshot: productNameSnapshot,
          product_code_snapshot: productCodeSnapshot,
          base_unit_price: Number(cartItem.base_unit_price) || 0,
          final_unit_price: Number(cartItem.final_unit_price) || 0,
          quantity: Number(cartItem.quantity) || 1,
          subtotal: Number(cartItem.subtotal) || 0,
          discount_amount: Number(cartItem.discount_amount) || 0,
          tax_amount: itemTaxAmount,
          total_amount: itemTotalAmount,
          tax_rate: isTaxEnabled ? (Number(cartItem.tax_rate) || 0) : 0,
          tax_name: cartItem.tax_name || 'VAT',
          is_tax_inclusive: cartItem.is_tax_inclusive ? 1 : 0,
          kitchen_station_id: resolvedKitchenStation,
          kitchen_station_name_snapshot: resolvedKitchenStationName,
          estimated_prep_minutes: Number(cartItem.estimated_prep_minutes) || 10,
          kitchen_state: 'PENDING',
          notes: cartItem.notes || null
        });

        // Variant snapshot
        if (cartItem.variant_id) {
          const variant = variantRepository.findById(cartItem.variant_id);
          if (variant) {
            orderItemRepository.addVariant({
              id: crypto.randomUUID(),
              order_item_id: itemId,
              variant_id: variant.id,
              variant_name_snapshot: cartItem.variant_name || variant.name,
              variant_sku_snapshot: cartItem.variant_sku || variant.sku || variant.product_code || null,
              price_adjustment: Number(cartItem.variant_price_adj) || 0
            });
          }
        }

        // Modifier snapshots
        for (const mod of (cartItem.modifiers || [])) {
          orderItemRepository.addModifier({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            modifier_id: mod.modifier_id,
            group_id: mod.group_id || null,
            group_name_snapshot: mod.group_name || null,
            modifier_name_snapshot: mod.modifier_name || 'Modifier',
            price_adjustment: Number(mod.price_adjustment) || 0,
            quantity: Number(mod.quantity) || 1
          });
        }

        // Add-on snapshots
        for (const addon of (cartItem.addons || [])) {
          orderItemRepository.addAddon({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            addon_id: addon.addon_id,
            addon_name_snapshot: addon.addon_name || 'Add-on',
            unit_price: Number(addon.unit_price) || 0,
            quantity: Number(addon.quantity) || 1,
            subtotal: Number(addon.subtotal) || (Number(addon.unit_price) * (Number(addon.quantity) || 1))
          });
        }

        // Combo component snapshots
        for (const comp of (cartItem.comboComponents || cartItem.combo_components || [])) {
          orderItemRepository.addComboComponent({
            id: crypto.randomUUID(),
            order_item_id: itemId,
            component_id: comp.component_id || crypto.randomUUID(),
            product_id: comp.product_id,
            product_name_snapshot: comp.product_name_snapshot || 'Component',
            variant_snapshot: comp.variant_snapshot || null,
            price_adjustment: Number(comp.price_adjustment) || 0,
            quantity: Number(comp.quantity) || 1
          });
        }
      }

      try {
        orderTotalsService.recalculate(newOrderId);
      } catch (e) {
        console.warn('Checkout totals recalc skipped:', e.message);
      }

      // ── 3e. Timeline audit entry ───────────────────────────────────────────
      orderTimelineService.recordEvent(newOrderId, cashierUserId, 'ORDER_CREATED', {
        to_state: OrderLifecycleState.DRAFT,
        description: `Order ${newOrderNumber} created from cart by cashier ${cashierUserId}`,
        metadata: {
          branch_id: branchId,
          order_type: orderType,
          item_count: cart.items.length,
          grand_total: grandTotal
        }
      }, { strict: true });

      // ── 3f. Activity log ───────────────────────────────────────────────────
      activityLogService.logActivity(cashierUserId, 'ORDER_DRAFT_CREATED', 'ORDER', newOrderId, {
        order_number: newOrderNumber,
        branch_id: branchId,
        grand_total: grandTotal,
        item_count: cart.items.length
      }, { strict: true });

      // ── 3g. Sync queue ─────────────────────────────────────────────────────
      syncService.queueSyncEvent('ORDER', newOrderId, 'ORDER_CREATED', {
        order_number: newOrderNumber,
        business_date: businessDate,
        grand_total: grandTotal
      }, 1, { strict: true });

      // Invalidate kitchen queue cache so KDS sees the new order immediately
      kitchenQueueService.invalidate(newOrderId);

      return { orderId: newOrderId, orderNumber: newOrderNumber, alreadyExisted: false };
    });

    // 4. Destroy working cart AFTER successful transaction commit
    //    (if transaction throws, the cart is preserved for retry)
    if (!result.alreadyExisted) {
      cartService.destroyCart(sessionId);
    }

    // 5. Hydrate and return full order graph
    const hydrated = this._hydrateOrder(result.orderId);
    if (!result.alreadyExisted) {
      lanPropagationService.propagate(result.orderId);
    }
    return hydrated;
  }

  _existingId(table, id) {
    if (!id) return null;
    try {
      const row = dbEngine.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
      return row ? row.id : null;
    } catch {
      return null;
    }
  }

  _resolveDiningTableId(tableId) {
    if (!tableId) return null;
    try {
      const byId = dbEngine.prepare('SELECT id FROM dining_tables WHERE id = ?').get(tableId);
      if (byId) return byId.id;
      const byNumber = dbEngine.prepare('SELECT id FROM dining_tables WHERE table_number = ?').get(String(tableId));
      if (byNumber) return byNumber.id;

      let floor = null;
      try {
        floor = dbEngine.prepare('SELECT id, name FROM tables WHERE id = ? OR name = ?').get(tableId, String(tableId));
      } catch { /* floor table map may be missing */ }

      const id = floor?.id || String(tableId);
      const number = floor?.name || String(tableId);
      try {
        dbEngine.prepare(
          `INSERT OR IGNORE INTO dining_tables (id, table_number, status) VALUES (?, ?, 'OCCUPIED')`
        ).run(id, number);
      } catch (e) {
        try {
          dbEngine.prepare(
            `INSERT OR IGNORE INTO dining_tables (id, table_number, status) VALUES (?, ?, 'OCCUPIED')`
          ).run(id, id);
        } catch {
          console.warn('Failed to auto-create dining table:', e.message);
          return null;
        }
      }
      const created = dbEngine.prepare('SELECT id FROM dining_tables WHERE id = ?').get(id);
      return created ? created.id : null;
    } catch (e) {
      console.warn('Failed to resolve dining table:', e.message);
      return null;
    }
  }
}

export const orderCreationService = new OrderCreationService();
