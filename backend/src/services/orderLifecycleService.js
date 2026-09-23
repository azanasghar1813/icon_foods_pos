import { 
  OrderLifecycleState, 
  KitchenState, 
  PaymentState, 
  AllowedLifecycleTransitions, 
  AllowedKitchenTransitions, 
  AllowedPaymentTransitions,
  EditableLifecycleStates 
} from '../constants/orderStates.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderTimelineService } from './orderTimelineService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { orderCacheService } from './orderCacheService.js';
import { historyCacheService } from './historyCacheService.js';
import { kitchenService } from './kitchenService.js';
import { dbEngine } from '../database/sqlite.js';
import { releaseTableIfIdle } from '../controllers/tableController.js';
import { orderTotalsService } from './orderTotalsService.js';
import { dateUtils } from '../utils/dateUtils.js';

class OrderLifecycleService {
  /**
   * Evaluates if a proposed lifecycle transition is allowed.
   */
  canTransitionLifecycle(currentState, targetState) {
    if (!currentState || !targetState) return false;
    const from = String(currentState).toUpperCase();
    const to = String(targetState).toUpperCase();
    if (from === to) return true;
    if (from === 'CANCELLED' && (to === 'ACTIVE' || to === 'DRAFT' || to === 'HELD' || to === 'ARCHIVED')) {
      return true;
    }
    const allowed = AllowedLifecycleTransitions[from] || AllowedLifecycleTransitions[currentState] || [];
    return allowed.includes(targetState) || allowed.includes(to);
  }

  /**
   * Evaluates if a proposed kitchen transition is allowed.
   */
  canTransitionKitchen(currentState, targetState) {
    if (currentState === targetState) return true;
    const allowed = AllowedKitchenTransitions[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Evaluates if a proposed payment transition is allowed.
   */
  canTransitionPayment(currentState, targetState) {
    if (currentState === targetState) return true;
    const allowed = AllowedPaymentTransitions[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Checks if an order's cart/items are editable.
   */
  isOrderEditable(order) {
    if (!order) return false;
    return EditableLifecycleStates.includes(order.lifecycle_state);
  }

  /**
   * Centralized State Transition Engine.
   * ALL order state transitions MUST pass through this method.
   * 
   * @param {string} orderId 
   * @param {string} targetLifecycleState 
   * @param {Object} context { userId, reason, holdName, kitchenState, paymentState }
   * @returns {Object} Updated order object
   */
  transition(orderId, targetLifecycleState, context = {}) {
    return dbEngine.transaction(() => {
      const order = orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Order with ID ${orderId} not found.`);
      }

      const currentLifecycle = order.lifecycle_state;
      const userId = context.userId || order.cashier_user_id || 'SYSTEM';

      // 1. Validate Lifecycle State Transition
      if (targetLifecycleState && targetLifecycleState !== currentLifecycle) {
        if (!this.canTransitionLifecycle(currentLifecycle, targetLifecycleState)) {
          throw new Error(`Invalid lifecycle transition from ${currentLifecycle} to ${targetLifecycleState} for order ${order.order_number}.`);
        }
      }

      // 2. Kitchen state is best-effort so History status can still change
      let targetKitchenState = context.kitchenState || order.kitchen_state;
      if (context.kitchenState && context.kitchenState !== order.kitchen_state) {
        if (!this.canTransitionKitchen(order.kitchen_state, context.kitchenState)) {
          targetKitchenState = context.kitchenState;
        }
      }

      // 3. Validate Payment State Transition if requested
      let targetPaymentState = context.paymentState || order.payment_state;
      if (context.paymentState && context.paymentState !== order.payment_state) {
        if (!this.canTransitionPayment(order.payment_state, context.paymentState)) {
          throw new Error(`Invalid payment transition from ${order.payment_state} to ${context.paymentState} for order ${order.order_number}.`);
        }
      }

      const updates = {
        updated_at: new Date().toISOString()
      };

      if (targetLifecycleState && targetLifecycleState !== currentLifecycle) {
        updates.lifecycle_state = targetLifecycleState;
      }
      if (targetKitchenState !== order.kitchen_state) {
        updates.kitchen_state = targetKitchenState;
      }
      if (targetPaymentState !== order.payment_state) {
        updates.payment_state = targetPaymentState;
      }

      // Special state fields updates
      if (targetLifecycleState === OrderLifecycleState.HELD) {
        updates.hold_name = context.holdName || order.hold_name || 'Hold';
        updates.held_at = new Date().toISOString();
      } else if (currentLifecycle === OrderLifecycleState.HELD && targetLifecycleState === OrderLifecycleState.DRAFT) {
        updates.hold_name = null;
        updates.held_at = null;
      }

      if (targetLifecycleState === OrderLifecycleState.CANCELLED) {
        if (this.canTransitionKitchen(order.kitchen_state, KitchenState.CANCELLED)) {
          updates.kitchen_state = KitchenState.CANCELLED;
        }
      }
      if (currentLifecycle === OrderLifecycleState.CANCELLED && targetLifecycleState === OrderLifecycleState.ACTIVE) {
        if (order.kitchen_state === KitchenState.CANCELLED && this.canTransitionKitchen(KitchenState.CANCELLED, KitchenState.PENDING)) {
          updates.kitchen_state = KitchenState.PENDING;
        }
      }
      if (targetLifecycleState === OrderLifecycleState.COMPLETED) {
        updates.completed_at = new Date().toISOString();
        if (!order.business_date) {
          updates.business_date = dateUtils.getBusinessDate(order.created_at || new Date());
        }
        if (!context.kitchenState) updates.kitchen_state = KitchenState.COMPLETED;
      }
      if (targetLifecycleState === OrderLifecycleState.ARCHIVED) {
        updates.archived_at = new Date().toISOString();
      }

      // Execute update
      let updatedOrder = orderRepository.update(orderId, updates);

      try {
        if (targetLifecycleState === OrderLifecycleState.COMPLETED) {
          dbEngine.prepare(`
            UPDATE order_items SET kitchen_state = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = ? AND kitchen_state != ?
          `).run(KitchenState.COMPLETED, orderId, KitchenState.CANCELLED);
        } else if (targetLifecycleState === OrderLifecycleState.CANCELLED) {
          dbEngine.prepare(`
            UPDATE order_items SET kitchen_state = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = ?
          `).run(KitchenState.CANCELLED, orderId);
        } else if (targetLifecycleState === OrderLifecycleState.ACTIVE && targetKitchenState === KitchenState.PREPARING) {
          dbEngine.prepare(`
            UPDATE order_items SET kitchen_state = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = ? AND kitchen_state != ?
          `).run(KitchenState.PREPARING, orderId, KitchenState.CANCELLED);
        }
      } catch { /* item kitchen sync is best-effort */ }

      if (targetLifecycleState === OrderLifecycleState.COMPLETED) {
        try {
          updatedOrder = orderTotalsService.recalculate(orderId) || updatedOrder;
        } catch (e) {
          console.warn('Complete-order totals recalc skipped:', e.message);
        }
      }

      if (targetLifecycleState === OrderLifecycleState.COMPLETED || targetLifecycleState === OrderLifecycleState.CANCELLED) {
        try { releaseTableIfIdle(order.table_id); } catch { /* table release is best-effort */ }
      }

      // Record Timeline Entry
      orderTimelineService.recordEvent(orderId, userId, 'STATE_TRANSITION', {
        from_state: currentLifecycle,
        to_state: targetLifecycleState || currentLifecycle,
        description: `Order ${order.order_number} transitioned from ${currentLifecycle} to ${targetLifecycleState || currentLifecycle}${context.reason ? `: ${context.reason}` : ''}`,
        metadata: {
          kitchen_state: targetKitchenState,
          payment_state: targetPaymentState,
          context
        }
      });

      // Record Activity Log
      activityLogService.logActivity(
        userId,
        'ORDER_STATUS_CHANGED',
        'ORDER',
        orderId,
        {
          order_number: order.order_number,
          from: currentLifecycle,
          to: targetLifecycleState || currentLifecycle,
          kitchen_state: targetKitchenState,
          payment_state: targetPaymentState
        }
      );

      // Queue Sync Event
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
        order_number: order.order_number,
        lifecycle_state: targetLifecycleState || currentLifecycle,
        kitchen_state: targetKitchenState,
        payment_state: targetPaymentState
      });

      // Update/Invalidate Cache
      orderCacheService.upsertOrder(updatedOrder);
      try { historyCacheService.invalidateOrder(orderId); } catch { /* optional */ }

      // Notify kitchen workflow when the order becomes eligible for production.
      kitchenService.onOrderLifecycleChange(updatedOrder, {
        fromLifecycle: currentLifecycle,
        toLifecycle: targetLifecycleState || currentLifecycle,
        userId,
        context
      });

      return updatedOrder;
    });
  }
}

export const orderLifecycleService = new OrderLifecycleService();
