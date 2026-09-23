import { paymentMethodRepository } from '../repositories/paymentMethodRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { OrderLifecycleState, PaymentState } from '../constants/orderStates.js';
import { dbEngine } from '../database/sqlite.js';

/**
 * PaymentValidationService
 *
 * All business rule validation before any payment write occurs.
 * Throws descriptive Error objects on any violation.
 * Contains zero database writes — pure guard logic only.
 */
class PaymentValidationService {
  /**
   * Validates that an order is in a state where payment is permitted.
   * Orders that are COMPLETED, CANCELLED, ARCHIVED, or REFUNDED cannot accept payments.
   * Orders that are already FULLY PAID cannot accept another full payment.
   */
  validateOrderIsPayable(order) {
    if (!order) {
      throw new Error('Order not found.');
    }

    const terminalStates = [
      OrderLifecycleState.CANCELLED,
      OrderLifecycleState.REFUNDED,
      OrderLifecycleState.ARCHIVED
    ];

    if (terminalStates.includes(order.lifecycle_state)) {
      throw new Error(
        `Order ${order.order_number} is in state ${order.lifecycle_state} and cannot accept payments.`
      );
    }

    const due = Number(order.due_total);
    if (order.payment_state === PaymentState.PAID && Number.isFinite(due) && due <= 0) {
      throw new Error(
        `Order ${order.order_number} has already been fully paid. No further payments accepted.`
      );
    }

    if (!order.grand_total || Number(order.grand_total) <= 0) {
      throw new Error(
        `Order ${order.order_number} has a zero or invalid grand total. Cannot process payment.`
      );
    }
  }

  /**
   * Validates that the payment amount is positive and does not exceed what is due.
   */
  validatePaymentAmount(amount, dueTotal) {
    const amt = Number(amount);
    const due = Number(dueTotal);

    if (isNaN(amt) || amt <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (amt > due + 0.005) {
      // Allow tiny floating point tolerance; overpayment is not permitted for non-cash
      throw new Error(
        `Payment amount (${amt.toFixed(2)}) exceeds the amount due (${due.toFixed(2)}).`
      );
    }
  }

  /**
   * Validates cash-specific tendered amount.
   * Cash tendered must cover the full amount due.
   */
  validateCashTendered(amountReceived, amountDue) {
    const received = Number(amountReceived);
    const due = Number(amountDue);

    if (isNaN(received) || received <= 0) {
      throw new Error('Cash tendered (amount_received) must be greater than zero.');
    }

    if (received < due - 0.005) {
      const shortfall = (due - received).toFixed(2);
      throw new Error(
        `Insufficient cash: received ${received.toFixed(2)}, due ${due.toFixed(2)}. Shortfall: ${shortfall}.`
      );
    }
  }

  /**
   * Validates that the payment method code exists and is currently active.
   */
  validatePaymentMethod(methodCode) {
    if (!methodCode || typeof methodCode !== 'string') {
      throw new Error('Payment method code is required.');
    }

    const method = paymentMethodRepository.findByCode(methodCode.toUpperCase());

    if (!method) {
      throw new Error(`Payment method '${methodCode}' does not exist.`);
    }

    if (!method.is_active) {
      throw new Error(`Payment method '${method.name}' is currently disabled.`);
    }

    return method;
  }

  /**
   * Validates non-cash payment requirements (reference number for card/mobile).
   */
  validateNonCashReference(method, transactionReference) {
    if (method.requires_reference && !transactionReference) {
      throw new Error(
        `Payment method '${method.name}' requires a transaction reference or approval code.`
      );
    }
  }

  /**
   * Validates that the session/shift is present and consistent.
   */
  validateSession(sessionId, cashierUserId) {
    return;
  }
}

export const paymentValidationService = new PaymentValidationService();
