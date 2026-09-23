import { dbEngine } from '../database/sqlite.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { orderTimelineRepository } from '../repositories/orderTimelineRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { paymentReceiptRepository } from '../repositories/paymentReceiptRepository.js';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository.js';
import { paymentValidationService } from './paymentValidationService.js';
import { cashPaymentService } from './cashPaymentService.js';
import { nonCashPaymentService } from './nonCashPaymentService.js';
import { receiptService } from './receiptService.js';
import { orderLifecycleService } from './orderLifecycleService.js';
import { orderTimelineService } from './orderTimelineService.js';
import { orderCacheService } from './orderCacheService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { kitchenService } from './kitchenService.js';
import { printService } from './printService.js';
import { OrderLifecycleState, PaymentState, KitchenState } from '../constants/orderStates.js';
import { releaseTableIfIdle } from '../controllers/tableController.js';
import { orderTotalsService } from './orderTotalsService.js';
import { lanSyncService } from './lanSyncService.js';
import crypto from 'crypto';

/**
 * PaymentService — Enterprise Payment Orchestrator
 *
 * This is the single entry point for ALL payment operations.
 * It coordinates the validation → write → state-update → receipt → audit pipeline
 * inside one atomic SQLite transaction.
 *
 * Transaction boundary:
 *   ┌─ dbEngine.transaction() ─────────────────────────────────────┐
 *   │  INSERT order_payments                                       │
 *   │  UPDATE orders (paid_total, due_total, payment_state,       │
 *   │                 lifecycle_state, updated_at)                 │
 *   │  INSERT payment_receipts                                     │
 *   │  INSERT order_timeline (PAYMENT_COMPLETED)                  │
 *   │  INSERT activity_logs  (PAYMENT_COMPLETED)                  │
 *   │  INSERT sync_queue     (PAYMENT_COMPLETED)                  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * If anything inside the transaction throws, the entire block is rolled back.
 * The order is left unchanged and the payment is never recorded.
 */
class PaymentService {
  // ──────────────────────────────────────────────────────────────────────────
  // Core payment processing
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Universal payment processor. Dispatches to cash or non-cash path.
   *
   * @param {string} orderId         - UUID of the target order
   * @param {string} sessionId       - Active cashier shift/session ID
   * @param {string} cashierUserId   - Acting cashier's user ID
   * @param {Object} input           - Payment input (see below)
   *
   * Cash input:    { payment_method: 'CASH', amount_received: 1000 }
   * Non-cash input: { payment_method: 'CARD', amount: 450.00, transaction_reference: '****1234' }
   *
   * @returns {Object} { payment, order, receipt, change_returned, quick_summary }
   */
  processPayment(orderId, sessionId, cashierUserId, input, idempotencyKey = null) {
    // ── 0. Idempotency Check (Race-safe in SQLite because it runs sequentially) ──
    if (idempotencyKey) {
      const existingPayment = orderPaymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingPayment) {
        // If we've already processed this exact payment attempt, return the existing successful state.
        const order = this._hydrateOrder(orderId);
        return {
          payment: existingPayment,
          order: order,
          receipt: this.getReceipt(existingPayment.id),
          change_returned: existingPayment.change_returned,
          is_fully_paid: Number(order.due_total) <= 0.005,
          quick_summary: {
            order_number: order.order_number,
            payment_method: existingPayment.payment_method_label,
            amount_charged: existingPayment.amount,
            amount_received: existingPayment.amount_received,
            change_returned: existingPayment.change_returned,
            new_payment_state: order.payment_state,
            new_lifecycle_state: order.lifecycle_state
          }
        };
      }
    }

    // ── 1. Pre-transaction validation (read-only, safe to run outside tx) ──
    paymentValidationService.validateSession(sessionId, cashierUserId);

    if (input.discount_total != null && Number(input.discount_total) >= 0) {
      const live = orderRepository.findById(orderId);
      if (live) {
        const discount = Math.max(0, Number(input.discount_total) || 0);
        orderRepository.update(orderId, { discount_total: discount });
        // Recompute 7% dine-in service on food-after-discount, then grand/due.
        orderTotalsService.recalculate(orderId);
        try {
          orderMetadataRepository.setMeta(orderId, 'receipt_paid_stamp', input.print_paid ? 'true' : 'false');
        } catch { /* optional */ }
      }
    }

    const order = this._hydrateOrder(orderId);
    paymentValidationService.validateOrderIsPayable(order);

    const method = paymentValidationService.validatePaymentMethod(input.payment_method);

    // ── 2. Build normalized payment input depending on method ──────────────
    let normalizedInput;
    const amountDue = Number(order.due_total) > 0 ? order.due_total : order.grand_total;

    if (input.payment_method === 'CASH') {
      paymentValidationService.validateCashTendered(input.amount_received, amountDue);
      normalizedInput = cashPaymentService.buildPaymentInput(
        input.amount_received,
        amountDue,
        { notes: input.notes }
      );
    } else {
      // For non-cash: amount defaults to full due amount if not supplied
      const nonCashAmount = input.amount !== undefined ? Number(input.amount) : amountDue;
      paymentValidationService.validatePaymentAmount(nonCashAmount, amountDue);
      paymentValidationService.validateNonCashReference(method, input.transaction_reference);
      normalizedInput = nonCashPaymentService.buildPaymentInput(
        input.payment_method,
        nonCashAmount,
        {
          transaction_reference: input.transaction_reference,
          approval_code:         input.approval_code,
          notes:                 input.notes
        }
      );
    }

    // ── 3. Atomic transaction ──────────────────────────────────────────────
    const { payment, updatedOrder, receipt } = dbEngine.transaction(() => {
      if (idempotencyKey) {
        const existingPayment = orderPaymentRepository.findByIdempotencyKey(idempotencyKey);
        if (existingPayment) {
          const replayOrder = this._hydrateOrder(orderId);
          return {
            payment: existingPayment,
            updatedOrder: replayOrder,
            receipt: this.getReceipt(existingPayment.id)
          };
        }
      }

      const liveOrder = this._hydrateOrder(orderId);
      paymentValidationService.validateOrderIsPayable(liveOrder);
      const liveDue = Number(liveOrder.due_total) > 0 ? liveOrder.due_total : liveOrder.grand_total;
      if (normalizedInput.amount - liveDue > 0.005 && input.payment_method !== 'CASH') {
        throw new Error('Payment amount exceeds remaining due.');
      }

      const paymentId    = crypto.randomUUID();
      const businessDate = liveOrder.business_date ||
                           new Date().toISOString().split('T')[0];

      // ── 3a. Insert payment record ────────────────────────────────────────
      const newPayment = orderPaymentRepository.addPayment({
        id:                    paymentId,
        order_id:              orderId,
        shift_id:              sessionId,
        cashier_user_id:       cashierUserId,
        business_date:         businessDate,
        payment_method:        normalizedInput.payment_method,
        payment_method_label:  method.name,
        amount:                normalizedInput.amount,
        amount_received:       normalizedInput.amount_received,
        change_returned:       normalizedInput.change_returned,
        transaction_reference: normalizedInput.transaction_reference,
        approval_code:         normalizedInput.approval_code,
        notes:                 normalizedInput.notes,
        status:                'COMPLETED',
        idempotency_key:       idempotencyKey
      });

      // ── 3b. Recalculate order financials ────────────────────────────────
      const newPaidTotal = Number(liveOrder.paid_total || 0) + normalizedInput.amount;
      const newDueTotal  = Math.max(0, Number(liveOrder.grand_total) - newPaidTotal);
      const isFullyPaid  = newDueTotal <= 0.005; // float tolerance

      const newPaymentState = isFullyPaid
        ? PaymentState.PAID
        : PaymentState.UNPAID; // PARTIALLY_PAID was removed per user request

      let newLifecycleState = liveOrder.lifecycle_state;
      if (isFullyPaid) {
        if (liveOrder.kitchen_state === 'COMPLETED' || liveOrder.kitchen_state === 'SERVED') {
          newLifecycleState = OrderLifecycleState.COMPLETED;
        } else if (liveOrder.lifecycle_state === OrderLifecycleState.DRAFT || liveOrder.lifecycle_state === OrderLifecycleState.HELD) {
          newLifecycleState = OrderLifecycleState.ACTIVE;
        }
      }

      // ── 3c. Update order record ──────────────────────────────────────────
      const orderUpdates = {
        paid_total:    newPaidTotal,
        due_total:     newDueTotal,
        payment_state: newPaymentState,
        updated_at:    new Date().toISOString()
      };

      if (newLifecycleState !== liveOrder.lifecycle_state) {
        orderUpdates.lifecycle_state = newLifecycleState;
        if (newLifecycleState === OrderLifecycleState.COMPLETED) {
          orderUpdates.completed_at = new Date().toISOString();
        }
      }

      const updatedRawOrder = orderRepository.update(orderId, orderUpdates);
      if (newLifecycleState === OrderLifecycleState.COMPLETED) {
        try { releaseTableIfIdle(liveOrder.table_id); } catch { /* best-effort */ }
      }

      // ── 3d. Generate + save receipt payload ─────────────────────────────
      // Build hydrated order for the receipt (items already loaded above)
      const orderForReceipt = { ...updatedRawOrder, items: liveOrder.items };
      const receiptPayload  = receiptService.generateReceiptPayload(orderForReceipt, newPayment);
      const savedReceipt    = receiptService.saveReceipt(
        paymentId,
        orderId,
        liveOrder.order_number,
        receiptPayload
      );

      // ── 3e. Timeline event ───────────────────────────────────────────────
      orderTimelineService.recordEvent(orderId, cashierUserId, 'PAYMENT_COMPLETED', {
        to_state:    newPaymentState,
        description: `Payment of ${normalizedInput.amount.toFixed(2)} via ${method.name} processed for order ${liveOrder.order_number}`,
        metadata: {
          payment_id:            paymentId,
          payment_method:        normalizedInput.payment_method,
          amount:                normalizedInput.amount,
          amount_received:       normalizedInput.amount_received,
          change_returned:       normalizedInput.change_returned,
          transaction_reference: normalizedInput.transaction_reference,
          new_payment_state:     newPaymentState,
          new_lifecycle_state:   newLifecycleState,
          is_fully_paid:         isFullyPaid
        }
      });

      // ── 3f. Activity log ─────────────────────────────────────────────────
      activityLogService.logActivity(cashierUserId, 'PAYMENT_COMPLETED', 'PAYMENT', paymentId, {
        order_id:       orderId,
        order_number:   liveOrder.order_number,
        payment_method: normalizedInput.payment_method,
        amount:         normalizedInput.amount,
        is_fully_paid:  isFullyPaid
      });

      // ── 3g. Sync queue ───────────────────────────────────────────────────
      syncService.queueSyncEvent('PAYMENT', paymentId, 'PAYMENT_COMPLETED', {
        order_id:       orderId,
        order_number:   liveOrder.order_number,
        payment_method: normalizedInput.payment_method,
        amount:         normalizedInput.amount,
        business_date:  businessDate
      });

      if (isFullyPaid) {
        syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
          order_number:   liveOrder.order_number,
          lifecycle_state: newLifecycleState,
          payment_state:  newPaymentState
        });
      }

      // ── 3h. Invalidate order cache ───────────────────────────────────────
      orderCacheService.invalidate(orderId);

      kitchenService.onOrderLifecycleChange(updatedRawOrder, {
        fromLifecycle: liveOrder.lifecycle_state,
        toLifecycle: updatedRawOrder.lifecycle_state,
        userId: cashierUserId,
        context: {
          trigger: 'PAYMENT_COMPLETED',
          payment_state: updatedRawOrder.payment_state
        }
      });

      return { payment: newPayment, updatedOrder: updatedRawOrder, receipt: savedReceipt };
    });

    // ── 4. Re-hydrate and return complete result ───────────────────────────
    const finalOrder = this._hydrateOrder(orderId);
    
    // Broadcast order state to Hub
    lanSyncService.broadcastOrder(orderId);

    // ── 5. Emit print events (OUTSIDE transaction — never blocks checkout) ─
    // The Print Engine is completely independent. If it fails, the order is
    // already saved and payment is already recorded.
    if (Number(finalOrder.due_total) <= 0.005) {
      setImmediate(() => {
        printService.onPaymentCompleted(finalOrder, payment, {
          cashierUserId,
          branchId: finalOrder.branch_id,
        }).catch(err => {
          console.error('[PaymentService] Print event failed (non-fatal):', err.message);
        });
      });
    }

    return {
      payment,
      order:          finalOrder,
      receipt,
      change_returned: normalizedInput.change_returned,
      is_fully_paid:   Number(finalOrder.due_total) <= 0.005,
      quick_summary: {
        order_number:   order.order_number,
        payment_method: method.name,
        amount_charged: normalizedInput.amount,
        amount_received: normalizedInput.amount_received,
        change_returned: normalizedInput.change_returned,
        new_payment_state: finalOrder.payment_state,
        new_lifecycle_state: finalOrder.lifecycle_state
      }
    };
  }

  refundOrder(orderId, sessionId, cashierUserId, input = {}, idempotencyKey = null) {
    if (idempotencyKey) {
      const existingPayment = orderPaymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existingPayment) {
        return { payment: existingPayment, order: this._hydrateOrder(orderId), replayed: true };
      }
    }

    paymentValidationService.validateSession(sessionId, cashierUserId);
    const order = this._hydrateOrder(orderId);
    if (!order) throw new Error('Order not found.');
    if (order.lifecycle_state === OrderLifecycleState.REFUNDED || order.payment_state === PaymentState.REFUNDED) {
      return { order, alreadyRefunded: true };
    }
    if (order.payment_state !== PaymentState.PAID) {
      throw new Error('Only paid orders can be refunded. Cancel unpaid tickets instead.');
    }

    const reason = String(input.reason || 'Refund from History').slice(0, 500);

    const result = dbEngine.transaction(() => {
      if (idempotencyKey) {
        const existingPayment = orderPaymentRepository.findByIdempotencyKey(idempotencyKey);
        if (existingPayment) {
          return { payment: existingPayment, order: this._hydrateOrder(orderId), replayed: true };
        }
      }

      dbEngine.prepare(`
        UPDATE order_payments
        SET status = 'REFUNDED'
        WHERE order_id = ? AND UPPER(COALESCE(status, 'COMPLETED')) = 'COMPLETED'
      `).run(orderId);

      const refundId = crypto.randomUUID();
      const refundPayment = orderPaymentRepository.addPayment({
        id: refundId,
        order_id: orderId,
        shift_id: sessionId,
        cashier_user_id: cashierUserId,
        business_date: order.business_date,
        payment_method: 'CASH',
        payment_method_label: 'Refund',
        amount: 0,
        amount_received: 0,
        change_returned: Number(order.paid_total) || 0,
        notes: reason,
        status: 'REFUNDED',
        idempotency_key: idempotencyKey
      });

      orderLifecycleService.transition(orderId, OrderLifecycleState.REFUNDED, {
        userId: cashierUserId,
        reason,
        paymentState: PaymentState.REFUNDED,
        kitchenState: KitchenState.CANCELLED
      });
      orderRepository.update(orderId, {
        paid_total: 0,
        due_total: 0,
        payment_state: PaymentState.REFUNDED
      });

      orderTimelineService.recordEvent(orderId, cashierUserId, 'ORDER_REFUNDED', {
        to_state: OrderLifecycleState.REFUNDED,
        description: reason,
        metadata: { payment_id: refundId }
      });
      activityLogService.logActivity(cashierUserId, 'ORDER_REFUNDED', 'PAYMENT', refundId, {
        order_id: orderId,
        order_number: order.order_number,
        reason
      });
      syncService.queueSyncEvent('ORDER', orderId, 'ORDER_UPDATED', {
        order_number: order.order_number,
        lifecycle_state: OrderLifecycleState.REFUNDED,
        payment_state: PaymentState.REFUNDED
      });
      orderCacheService.invalidate(orderId);
      return { payment: refundPayment, order: this._hydrateOrder(orderId) };
    });

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns all payments for an order with their receipt refs.
   */
  getPaymentsByOrder(orderId) {
    const payments = orderPaymentRepository.findByOrderId(orderId);
    return payments.map(p => ({
      ...p,
      receipt: paymentReceiptRepository.findByPaymentId(p.id)
    }));
  }

  /**
   * Returns a single payment by ID with its receipt.
   */
  getPaymentById(paymentId) {
    const payment = orderPaymentRepository.findById(paymentId);
    if (!payment) return null;
    return {
      ...payment,
      receipt: paymentReceiptRepository.findByPaymentId(paymentId)
    };
  }

  /**
   * Returns receipt payload for a payment. Useful for re-print flows.
   */
  getReceipt(paymentId) {
    return receiptService.getByPaymentId(paymentId);
  }

  /**
   * Returns all active payment methods for the UI.
   */
  getPaymentMethods() {
    const methods = paymentMethodRepository.findAll().filter(m => m.is_active);
    return methods.map(m => ({
      code:               m.code,
      name:               m.name,
      requires_reference: !!m.requires_reference,
      requires_approval:  !!m.requires_approval,
      quick_cash_buttons: m.quick_cash_buttons
        ? this._tryParseJson(m.quick_cash_buttons)
        : null,
      icon:               m.icon || null,
      display_order:      m.display_order
    }));
  }

  /**
   * Returns cash quick-button configuration for the POS UI.
   */
  getCashQuickButtons(amountDue) {
    const cashMethod = paymentMethodRepository.findByCode('CASH');
    const presets = cashMethod?.quick_cash_buttons
      ? this._tryParseJson(cashMethod.quick_cash_buttons)
      : [500, 1000, 2000, 5000];
    return cashPaymentService.buildQuickCashButtons(amountDue, presets);
  }

  /**
   * Payment summary by method for a business date (for dashboard/reports).
   */
  getDailySummary(businessDate, branchId = null) {
    return orderPaymentRepository.getSummaryByMethod(businessDate, branchId);
  }

  /**
   * Recent payments feed for the dashboard.
   */
  getRecentPayments(limit = 20, branchId = null) {
    return orderPaymentRepository.getRecentPayments(limit, branchId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Loads and fully hydrates an order for use in payment logic.
   * Uses direct DB fetch (never the in-memory cart).
   */
  _hydrateOrder(orderId) {
    const order = orderRepository.findById(orderId);
    if (!order) return null;
    order.items    = orderItemRepository.findItemsByOrderId(orderId);
    order.payments = orderPaymentRepository.findByOrderId(orderId);
    order.timeline = orderTimelineRepository.findByOrderId(orderId);
    order.metadata = orderMetadataRepository.getAllMeta(orderId);
    order.tags     = orderMetadataRepository.getTags(orderId);
    return order;
  }

  _tryParseJson(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
}

export const paymentService = new PaymentService();
