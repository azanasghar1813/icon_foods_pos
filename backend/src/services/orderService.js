import { dbEngine } from '../database/sqlite.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { orderTimelineRepository } from '../repositories/orderTimelineRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { customerRepository } from '../repositories/customerRepository.js';
import { orderLifecycleService } from './orderLifecycleService.js';
import { orderNumberService } from './orderNumberService.js';
import { orderSnapshotService } from './orderSnapshotService.js';
import { orderTimelineService } from './orderTimelineService.js';
import { orderValidationService } from './orderValidationService.js';
import { orderCacheService } from './orderCacheService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { auditService } from './auditService.js';
import { OrderLifecycleState } from '../constants/orderStates.js';
import { releaseTableIfIdle } from '../controllers/tableController.js';
import { cartService } from './cartService.js';
import { lanPropagationService } from './lanPropagationService.js';

import { historyCacheService } from './historyCacheService.js';
import crypto from 'crypto';
import { dateUtils } from '../utils/dateUtils.js';
import { orderTotalsService } from './orderTotalsService.js';


function orderLineMergeKey(productId, variantId, modifiers, addons, comboComponents, notes) {
  const mods = [...(modifiers || [])]
    .map((m) => `${m.modifier_id}:${m.quantity || 1}`)
    .sort()
    .join('|');
  const ads = [...(addons || [])]
    .map((a) => `${a.addon_id}:${a.quantity || 1}`)
    .sort()
    .join('|');
  const combos = [...(comboComponents || [])]
    .map((c) => `${c.product_id}:${c.variant_snapshot || ''}`)
    .sort()
    .join('|');
  return `${productId || ''}::${variantId || ''}::${mods}::${ads}::${combos}::${String(notes || '').trim()}`;
}

class OrderService {
  /**
   * Internal guard to prevent concurrent modification of an order by different devices.
   */
  _enforceLock(orderId, terminalId) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    
    if (order.lifecycle_state === 'CANCELLED' || order.lifecycle_state === 'ARCHIVED') {
      throw new Error(`Order ${order.order_number} is ${order.lifecycle_state} and cannot be modified.`);
    }
    return order;
  }
  /**
   * Retrieves full hydrated order graph.
   */
  getOrderById(orderId) {
    // Never serve cached money. Edits must always see live item totals.
    orderCacheService.invalidate(orderId);
    const order = orderRepository.findById(orderId);
    if (!order) return null;
    return this._hydrateOrder(order);
  }

  getOrderByNumber(orderNumber) {
    const cached = orderCacheService.getOrderByNumber(orderNumber);
    if (cached) return cached;

    const order = orderRepository.findByNumber(orderNumber);
    if (!order) return null;

    return this._hydrateOrder(order);
  }

  /**
   * Internal hydrator that loads items, variants, modifiers, add-ons, combos, payments, timeline, metadata.
   */
  _hydrateOrder(order) {
    if (!order) return null;
    order.items = orderItemRepository.findItemsByOrderId(order.id);
    order.payments = orderPaymentRepository.findByOrderId(order.id);
    order.timeline = orderTimelineRepository.findByOrderId(order.id);
    order.metadata = orderMetadataRepository.getAllMeta(order.id);
    order.tags = orderMetadataRepository.getTags(order.id);
    order.attachments = orderMetadataRepository.getAttachments(order.id);

    // Auto-populate customer info if a customer is linked
    if (order.customer_id) {
      try {
        const customer = customerRepository.findById(order.customer_id);
        if (customer) {
          order.customer = customer;
          order.metadata.customer_name = customer.first_name + (customer.last_name ? ' ' + customer.last_name : '');
          order.metadata.customer_phone = customer.phone || order.metadata.customer_phone;
          order.metadata.customer_address = customer.address || order.metadata.customer_address;
          if (customer.is_vip === 1 || customer.is_vip === true || customer.isVip) {
            if (order.metadata.is_vip !== 'false') {
              order.metadata.is_vip = 'true';
            }
          }
        }
      } catch (e) {
        console.error('Failed to hydrate customer info:', e);
      }
    }
    order.is_vip = order.metadata?.is_vip === 'true' || order.metadata?.is_vip === true || String(order.metadata?.is_vip) === '1' || order.customer?.is_vip === 1 || order.customer?.is_vip === true;
    for (const item of order.items || []) {
      const v = item.variant || (item.variants && item.variants[0]) || null;
      if (v) {
        item.variant = v;
        item.variant_id = item.variant_id || v.variant_id || v.id;
        item.variant_name = v.variant_name_snapshot || v.name || item.variant_name;
      }
    }
    this._enrichPeopleAndTable(order);

    try { historyCacheService.invalidateOrder(order.id); } catch { /* optional */ }
    // Cache if active
    orderCacheService.upsertOrder(order);
    return order;
  }

  _displayUserName(userId, snapshot) {
    if (snapshot) return snapshot;
    if (!userId) return null;
    try {
      const u = dbEngine.prepare('SELECT first_name, last_name, username FROM users WHERE id = ?').get(userId);
      if (!u) return null;
      const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      return n || u.username || null;
    } catch {
      return null;
    }
  }

  _enrichPeopleAndTable(order) {
    if (!order) return order;
    try {
      if (order.table_id) {
        let tableName = null;
        try {
          const dt = dbEngine.prepare('SELECT table_number FROM dining_tables WHERE id = ? OR table_number = ?').get(order.table_id, String(order.table_id));
          tableName = dt?.table_number || null;
        } catch { /* ignore */ }
        if (!tableName) {
          try {
            const fl = dbEngine.prepare('SELECT name FROM tables WHERE id = ? OR name = ?').get(order.table_id, String(order.table_id));
            tableName = fl?.name || null;
          } catch { /* ignore */ }
        }
        order.table_number = tableName || order.table_id;
      }
    } catch {
      order.table_number = order.table_id || null;
    }
    order.cashier_name = this._displayUserName(order.cashier_user_id, null);
    order.waiter_name = this._displayUserName(order.waiter_id, order.waiter_name_snapshot);
    order.rider_name = this._displayUserName(order.rider_id, order.rider_name_snapshot);
    return order;
  }

  /**
   * Recalculates order financial totals. Nested-transaction safe.
   * Never swallow hydrate errors into a second nested transaction — that
   * can commit a line delete while rolling back the header totals.
   */
  recalculateOrderTotals(orderId) {
    const run = () => {
      const updated = orderTotalsService.recalculate(orderId);
      try { historyCacheService.invalidateOrder(orderId); } catch { /* optional */ }
      orderCacheService.invalidate(orderId);
      return this._hydrateOrder(updated);
    };
    if (dbEngine.db?.inTransaction) return run();
    return dbEngine.transaction(run);
  }

  _commitItemEdit(orderId) {
    orderCacheService.invalidate(orderId);
    try { historyCacheService.invalidateOrder(orderId); } catch { /* optional */ }
    const updated = this.recalculateOrderTotals(orderId);
    lanPropagationService.propagate(orderId);
    return updated;
  }

  applyOrderDiscount(orderId, discountTotal, printPaid = false) {
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error('Order not found.');
    const subtotal = Math.max(0, Number(order.subtotal) || 0);
    const discount = Math.min(Math.max(0, Number(discountTotal) || 0), subtotal);
    orderRepository.update(orderId, { discount_total: discount });
    try {
      orderMetadataRepository.setMeta(orderId, 'receipt_paid_stamp', printPaid ? 'true' : 'false');
    } catch { /* optional */ }
    const updated = this.recalculateOrderTotals(orderId);
    syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', { discount_total: discount });
    lanPropagationService.propagate(orderId);
    
    return updated;
  }

  /**
   * Opens a new Draft Order.
   */
  createDraftOrder(shiftId, userId, options = {}) {
    orderValidationService.validateOrderCreation({ shift_id: shiftId, cashier_user_id: userId });

    return dbEngine.transaction(() => {
      const businessDate = options.business_date || dateUtils.getBusinessDate();
      const branchId = options.branch_id || 'DEFAULT_BRANCH';

      const orderNumber = options.order_number || orderNumberService.generateNextNumber(branchId, businessDate);
      const orderId = crypto.randomUUID();

      const newOrder = orderRepository.create({
        id: orderId,
        order_number: orderNumber,
        business_date: businessDate,
        branch_id: branchId,
        cashier_user_id: userId,
        shift_id: shiftId,
        customer_id: options.customer_id || null,
        table_id: options.table_id || null,
        order_type: options.order_type || 'DINE_IN',
        lifecycle_state: OrderLifecycleState.DRAFT,
        kitchen_state: 'PENDING',
        payment_state: 'UNPAID',
        notes: options.notes || null
      });

      // Record Timeline Event
      orderTimelineService.recordEvent(orderId, userId, 'ORDER_CREATED', {
        to_state: OrderLifecycleState.DRAFT,
        description: `Order ${orderNumber} created by cashier ${userId}`,
        metadata: { branch_id: branchId, order_type: options.order_type || 'DINE_IN' }
      });

      // Log Activity
      activityLogService.logActivity(userId, 'ORDER_CREATED', 'ORDER', orderId, {
        order_number: orderNumber,
        branch_id: branchId
      });

      // Queue Sync Event
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_CREATED', {
        order_number: orderNumber,
        business_date: businessDate
      });

      const hydrated = this._hydrateOrder(newOrder);
      lanPropagationService.propagate(newOrder.id);
      return hydrated;
    });
  }

  /**
   * Gets existing active draft for cashier shift session or creates a new one.
   */
  async getOrCreateDraft(shiftId, userId, options = {}) {
    const existing = orderRepository.findDraftBySession(shiftId);
    if (existing) return this._hydrateOrder(existing);
    const businessDate = options.business_date || dateUtils.getBusinessDate();
    const branchId = options.branch_id || 'DEFAULT_BRANCH';
    const orderNumber = await orderNumberService.allocateNextNumber(branchId, businessDate);
    return this.createDraftOrder(shiftId, userId, { ...options, business_date: businessDate, branch_id: branchId, order_number: orderNumber });
  }

  /**
   * Adds an item with complete menu snapshot to an order inside an atomic transaction.
   */
  async addItemToDraft(shiftId, userId, itemInput) {
    const order = await this.getOrCreateDraft(shiftId, userId);
    return this.addItemToOrder(order.id, itemInput, userId);
  }

  /**
   * Adds an item to a specific order.
   */
  addItemToOrder(orderId, itemInput, actorUserId = 'SYSTEM', terminalId = 'SYSTEM') {
    dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemAddition(order, itemInput);

      // Create snapshot object
      const snapshot = orderSnapshotService.createItemSnapshot({
        productId: itemInput.product_id,
        variantId: itemInput.variant_id || null,
        variant_name: itemInput.variant_name || null,
        modifiers: itemInput.modifiers || [],
        addons: itemInput.addons || [],
        comboComponents: itemInput.comboComponents || [],
        quantity: itemInput.quantity || 1,
        notes: itemInput.notes || null
      });

      const incomingKey = orderLineMergeKey(
        snapshot.item.product_id,
        snapshot.variant?.variant_id || null,
        snapshot.modifiers,
        snapshot.addons,
        snapshot.comboComponents,
        snapshot.item.notes
      );
      const match = orderItemRepository.findItemsByOrderId(orderId).find((it) => (
        orderLineMergeKey(
          it.product_id,
          it.variants?.[0]?.variant_id || it.variant?.variant_id || null,
          it.modifiers,
          it.addons,
          it.combo_components || it.comboComponents,
          it.notes
        ) === incomingKey
      ));

      const billBefore = Number(order.grand_total || 0);
      const addQty = Number(snapshot.item.quantity || 1);
      const addUnitPrice = Number(snapshot.item.final_unit_price || snapshot.item.base_unit_price || 0);
      const addLineTotal = Number(snapshot.item.subtotal || addUnitPrice * addQty);
      let updatedOrder;

      if (match) {
        const oldQty = Number(match.quantity || 0);
        const newQty = oldQty + addQty;
        const addonSum = (match.addons || []).reduce((s, a) => s + (Number(a.subtotal) || 0), 0);
        const unit = Number(match.final_unit_price ?? match.base_unit_price) || 0;
        const newSubtotal = unit * newQty + addonSum;
        orderItemRepository.updateItem(match.id, {
          quantity: newQty,
          subtotal: newSubtotal,
          tax_amount: 0,
          total_amount: newSubtotal
        });
        updatedOrder = this.recalculateOrderTotals(orderId);
        orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_QUANTITY_CHANGED', {
          description: `Updated quantity of ${match.product_name_snapshot} to ${newQty}`,
          metadata: { item_id: match.id, old_qty: oldQty, new_qty: newQty, unit_price: unit, line_delta: unit * addQty }
        });
        activityLogService.logActivity(actorUserId, 'QUANTITY_CHANGED', 'ORDER', orderId, {
          order_number: order.order_number,
          item_name: match.product_name_snapshot,
          product: match.product_name_snapshot,
          old_quantity: oldQty,
          new_quantity: newQty,
          unit_price: unit,
          line_delta: unit * addQty,
          bill_before: billBefore,
          bill_after: Number(updatedOrder.grand_total || 0)
        });
        syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
          action: 'ITEM_QTY_MERGED',
          order_number: order.order_number
        });
      } else {
        snapshot.item.order_id = orderId;
        orderItemRepository.addItem(snapshot.item);

        if (snapshot.variant) {
          orderItemRepository.addVariant(snapshot.variant);
        }
        if (snapshot.modifiers.length > 0) {
          for (const mod of snapshot.modifiers) {
            orderItemRepository.addModifier(mod);
          }
        }
        if (snapshot.addons.length > 0) {
          for (const add of snapshot.addons) {
            orderItemRepository.addAddon(add);
          }
        }
        if (snapshot.comboComponents.length > 0) {
          for (const comp of snapshot.comboComponents) {
            orderItemRepository.addComboComponent(comp);
          }
        }

        updatedOrder = this.recalculateOrderTotals(orderId);
        orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_ADDED', {
          description: `Added ${snapshot.item.quantity}x ${snapshot.item.product_name_snapshot} to order ${order.order_number}`,
          metadata: { item_id: snapshot.item.id, product_id: snapshot.item.product_id, unit_price: addUnitPrice, line_total: addLineTotal, quantity: addQty }
        });
        activityLogService.logActivity(actorUserId, 'ITEM_ADDED', 'ORDER', orderId, {
          order_number: order.order_number,
          item_name: snapshot.item.product_name_snapshot,
          product: snapshot.item.product_name_snapshot,
          quantity: addQty,
          unit_price: addUnitPrice,
          line_total: addLineTotal,
          bill_before: billBefore,
          bill_after: Number(updatedOrder.grand_total || 0)
        });
        syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
          action: 'ITEM_ADDED',
          order_number: order.order_number
        });
      }

      try { historyCacheService.invalidateOrder(orderId); } catch { /* optional */ }
    });
    return this._commitItemEdit(orderId);
  }

  /**
   * Updates an item's quantity or removes if quantity <= 0.
   */
  updateItemQuantity(orderId, itemId, newQuantity, actorUserId = 'SYSTEM', terminalId = 'SYSTEM') {
    if (newQuantity <= 0) {
      return this.removeItem(orderId, itemId, actorUserId, null, terminalId);
    }

    dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemModification(order, itemId);

      const item = orderItemRepository.findItemById(itemId);
      if (!item) throw new Error('Order line item not found.');

      const addonSum = (item.addons || []).reduce((s, a) => s + (Number(a.subtotal) || 0), 0);
      const unit = Number(item.final_unit_price ?? item.base_unit_price) || 0;
      const newSubtotal = unit * newQuantity + addonSum;

      orderItemRepository.updateItem(itemId, {
        quantity: newQuantity,
        subtotal: newSubtotal,
        tax_amount: 0,
        total_amount: newSubtotal
      });

      const billBefore = Number(order.grand_total || 0);
      const unitPrice = Number(item.final_unit_price || item.base_unit_price || 0);
      const oldQty = Number(item.quantity || 0);
      const lineDelta = unitPrice * (Number(newQuantity) - oldQty);

      const updatedOrder = this.recalculateOrderTotals(orderId);

      orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_QUANTITY_CHANGED', {
        description: `Updated quantity of ${item.product_name_snapshot} to ${newQuantity}`,
        metadata: { item_id: itemId, old_qty: oldQty, new_qty: newQuantity, unit_price: unitPrice, line_delta: lineDelta }
      });

      activityLogService.logActivity(actorUserId, 'QUANTITY_CHANGED', 'ORDER', orderId, {
        order_number: order.order_number,
        item_name: item.product_name_snapshot,
        product: item.product_name_snapshot,
        old_quantity: oldQty,
        new_quantity: newQuantity,
        unit_price: unitPrice,
        line_delta: lineDelta,
        bill_before: billBefore,
        bill_after: Number(updatedOrder.grand_total || 0)
      });
    });
    return this._commitItemEdit(orderId);
  }

  /**
   * Removes an item from an order.
   */
  removeItem(orderId, itemId, actorUserId = 'SYSTEM', reason = null, terminalId = 'SYSTEM') {
    dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      orderValidationService.validateItemModification(order, itemId);

      const item = orderItemRepository.findItemById(itemId);
      const billBefore = Number(order.grand_total || 0);
      const removeQty = Number(item?.quantity || 1);
      const removeUnitPrice = Number(item?.final_unit_price || item?.base_unit_price || 0);
      const removeLineTotal = Number(item?.subtotal || removeUnitPrice * removeQty);
      const itemName = item ? item.product_name_snapshot : 'item';
      orderItemRepository.removeItem(itemId);

      const updatedOrder = this.recalculateOrderTotals(orderId);

      // If the order has already been sent to kitchen, we should log a reason
      const isSent = order.kitchen_state !== 'PENDING';
      const description = `Removed ${itemName} from order ${order.order_number}`;

      orderTimelineService.recordEvent(orderId, actorUserId, 'ITEM_REMOVED', {
        description: description + (reason ? ` - Reason: ${reason}` : ''),
        metadata: { item_id: itemId, reason, quantity: removeQty, unit_price: removeUnitPrice, line_total: removeLineTotal }
      });

      if (isSent && reason) {
        auditService.record({
          orderId,
          userId: actorUserId,
          action: 'ITEM_VOID',
          entityType: 'ORDER_ITEM',
          entityId: itemId,
          oldValue: { product_name: itemName, quantity: removeQty, unit_price: removeUnitPrice, line_total: removeLineTotal },
          newValue: { status: 'REMOVED', bill_before: billBefore, bill_after: Number(updatedOrder.grand_total || 0) },
          reason
        });
      }

      activityLogService.logActivity(actorUserId, 'ITEM_REMOVED', 'ORDER', orderId, {
        order_number: order.order_number,
        item_name: itemName,
        product: itemName,
        quantity: removeQty,
        unit_price: removeUnitPrice,
        line_total: removeLineTotal,
        bill_before: billBefore,
        bill_after: Number(updatedOrder.grand_total || 0),
        reason: reason
      });
    });
    return this._commitItemEdit(orderId);
  }

  /**
   * Places an active draft order on hold.
   */
  async holdOrder(shiftId, userId, holdName) {
    const draft = orderRepository.findDraftBySession(shiftId);
    if (draft) {
      return dbEngine.transaction(() => {
        const updated = orderLifecycleService.transition(draft.id, OrderLifecycleState.HELD, {
          userId,
          holdName
        });
        const hydrated = this._hydrateOrder(updated);
        lanPropagationService.propagate(draft.id);
        return hydrated;
      });
    }

    const cart = cartService.getCart(shiftId);
    if (!cart || !cart.items?.length) {
      throw new Error('No active cart or draft order to hold.');
    }

    const { orderCreationService } = await import('./orderCreationService.js');
    const order = await orderCreationService.checkoutCart(shiftId, userId, {}, crypto.randomUUID());
    const updated = orderLifecycleService.transition(order.id, OrderLifecycleState.HELD, {
      userId,
      holdName
    });
    const hydrated = this._hydrateOrder(updated);
    lanPropagationService.propagate(order.id);
    return hydrated;
  }

  /**
   * Resumes a held order into active draft status.
   */
  resumeOrder(shiftId, userId, orderId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      if (order.lifecycle_state !== OrderLifecycleState.HELD) {
        throw new Error(`Only HELD orders can be resumed. Order ${order.order_number} is in state ${order.lifecycle_state}.`);
      }

      // Re-assign shift/cashier if needed and set back to DRAFT
      orderRepository.update(orderId, {
        shift_id: shiftId,
        cashier_user_id: userId
      });

      const updated = orderLifecycleService.transition(orderId, OrderLifecycleState.DRAFT, {
        userId,
        reason: 'Order resumed into active cart'
      });
      const hydrated = this._hydrateOrder(updated);
      lanPropagationService.propagate(orderId);
      return hydrated;
    });
  }

  /**
   * Queries held orders.
   */
  getHeldOrders(shiftId = null) {
    const orders = orderRepository.queryHeld(shiftId);
    return orders.map(o => this._hydrateOrder(o));
  }

  transitionOrderState(orderId, targetState, context = {}) {
    const updated = orderLifecycleService.transition(orderId, targetState, context);
    const hydrated = this._hydrateOrder(updated);
    lanPropagationService.propagate(orderId);
    return hydrated;
  }

  /**
   * Updates order metadata directly (like table_id or order_type) for an active order
   */
  updateOrderMeta(orderId, meta, userId, terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      this._enforceLock(orderId, terminalId);
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      const updates = {};

      if (meta.order_type !== undefined) {
        updates.order_type = meta.order_type;
      }
      if (meta.table_id !== undefined) {
        updates.table_id = meta.table_id;
        if (meta.table_id) {
          try {
            dbEngine.db.prepare('INSERT OR IGNORE INTO dining_tables (id, table_number, status) VALUES (?, ?, ?)').run(meta.table_id, meta.table_id, 'OCCUPIED');
          } catch (err) {
            console.error('Error auto-creating dining table on meta update:', err);
          }
        }
      }
      if (meta.customer_id !== undefined) {
        let validCustomerId = null;
        if (meta.customer_id) {
          const exists = dbEngine.db.prepare('SELECT 1 FROM customers WHERE id = ?').get(meta.customer_id);
          if (exists) validCustomerId = meta.customer_id;
        }
        updates.customer_id = validCustomerId;
      }
      if (meta.waiter_id !== undefined) {
        updates.waiter_id = meta.waiter_id || null;
      }
      if (meta.waiter_name_snapshot !== undefined) {
        updates.waiter_name_snapshot = meta.waiter_name_snapshot || null;
      }
      if (meta.rider_id !== undefined) {
        updates.rider_id = meta.rider_id || null;
      }
      if (meta.rider_name_snapshot !== undefined) {
        updates.rider_name_snapshot = meta.rider_name_snapshot || null;
      }
      if (meta.delivery_charges !== undefined) {
        updates.delivery_fee = meta.delivery_charges;
      }
      if (meta.service_charge !== undefined) {
        updates.service_charge = Number(meta.service_charge) || 0;
        try {
          orderMetadataRepository.setMeta(orderId, 'service_charge', updates.service_charge);
        } catch { /* optional */ }
      }
      if (meta.customer_name !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_name', meta.customer_name || '');
      }
      if (meta.customer_phone !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_phone', meta.customer_phone || '');
      }
      if (meta.customer_address !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'customer_address', meta.customer_address || '');
      }
      if (meta.receipt_paid_stamp !== undefined || meta.print_paid !== undefined) {
        const paid = meta.receipt_paid_stamp === true || meta.receipt_paid_stamp === 'true' || meta.print_paid === true;
        orderMetadataRepository.setMeta(orderId, 'receipt_paid_stamp', paid ? 'true' : 'false');
      }
      if (meta.is_vip !== undefined) {
        orderMetadataRepository.setMeta(orderId, 'is_vip', meta.is_vip ? 'true' : 'false');
      } else if (meta.customer_id) {
        try {
          const cust = customerRepository.findById(meta.customer_id);
          if (cust && (cust.is_vip === 1 || cust.is_vip === true || cust.isVip)) {
            orderMetadataRepository.setMeta(orderId, 'is_vip', 'true');
          }
        } catch { /* customer lookup is best-effort */ }
      }

      if (Object.keys(updates).length > 0) {
        orderRepository.update(orderId, updates);

        // Log activity
        activityLogService.logActivity(userId, 'ORDER_UPDATED', 'ORDER', orderId, meta);
        
        orderTimelineService.recordEvent(orderId, userId, 'Order Edited', {
          description: `Order metadata updated.`,
          metadata: meta
        });

        syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', meta);
      }

      // Recalculate totals in case delivery charges or order type changed
      const updated = this.recalculateOrderTotals(orderId);
      lanPropagationService.propagate(orderId);
      return updated;
    });
  }

  /**
   * Deletes an order permanently from the database.
   */
  deleteOrder(orderId, userId, terminalId = 'SYSTEM') {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');

      activityLogService.logActivity(
        userId,
        'ORDER_DELETED',
        'ORDER',
        orderId,
        { orderNumber: order.order_number, reason: 'Order permanently deleted' }
      );

      const success = orderRepository.delete(orderId);
      if (!success) throw new Error('Failed to delete order.');

      orderCacheService.invalidate(orderId);
      syncService.queueSyncEvent('ORDER', orderId, 'DELETE', { order_number: order.order_number });
      releaseTableIfIdle(order.table_id);
      // For deletions, we might want to broadcast a special delete payload
      lanPropagationService.propagateDelete(orderId);
      return { success: true, message: 'Order deleted successfully' };
    });
  }

  /**
   * Lock an order for editing.
   */
  lockOrder(orderId, terminalId, userId) {
    return dbEngine.transaction(() => {
      orderTimelineService.recordEvent(orderId, userId, 'ORDER_LOCKED', { terminalId });
      const order = orderRepository.findById(orderId);
      const hydrated = this._hydrateOrder(order);
      lanPropagationService.propagate(orderId);
      return hydrated;
    });
  }

  /**
   * Unlock an order.
   */
  unlockOrder(orderId, terminalId, userId) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) throw new Error('Order not found.');
      
      const updated = orderRepository.update(orderId, { locked_by: null });
      
      activityLogService.logActivity(userId, 'ORDER_UNLOCKED', 'ORDER', orderId, { terminalId });
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', { locked_by: null });

      const updatedOrder = this._hydrateOrder(updated);
      lanPropagationService.propagate(orderId);
      return updatedOrder;
    });
  }
}

export const orderService = new OrderService();
