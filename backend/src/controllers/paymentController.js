import { paymentService } from '../services/paymentService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * PaymentController
 *
 * Thin HTTP request handlers. Zero business logic here.
 * All delegation goes directly to paymentService.
 *
 * Session identity:
 *   x-cashier-session-id  — active cashier shift/session ID
 *   x-user-id             — authenticated cashier's user ID
 *   x-branch-id           — (optional) branch ID for multi-branch filtering
 */
export const paymentController = {
  /**
   * POST /api/payments/order/:orderId
   * Processes a payment for the specified order.
   *
   * Cash body:     { payment_method: "CASH", amount_received: 1000 }
   * Non-cash body: { payment_method: "CARD", transaction_reference: "****1234" }
   */
  processPayment: (req, res) => {
    const sessionId     = req.headers['x-cashier-session-id'] || 'DEFAULT_SESSION';
    const cashierUserId = req.user?.userId || 'DEFAULT_USER';
    const idempotencyKey = req.headers['idempotency-key'];
    const { orderId }   = req.params;
    if (!orderId)       return sendError(res, 400, 'orderId path parameter is required.');
    if (!idempotencyKey) return sendError(res, 400, 'Idempotency-Key header is required.');

    try {
      const result = paymentService.processPayment(
        orderId,
        sessionId,
        cashierUserId,
        req.body,
        idempotencyKey
      );

      const method   = req.body.payment_method;
      const isCash   = method === 'CASH';
      const summary  = result.quick_summary;
      const msg      = result.is_fully_paid
        ? `Order ${summary.order_number} fully paid via ${summary.payment_method}.`
        : `Partial payment of ${summary.amount_charged.toFixed(2)} received for order ${summary.order_number}.`;

      sendSuccess(res, result, msg, 201);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  refundPayment: (req, res) => {
    const sessionId     = req.headers['x-cashier-session-id'] || 'DEFAULT_SESSION';
    const cashierUserId = req.user?.userId || 'DEFAULT_USER';
    const idempotencyKey = req.headers['idempotency-key'];
    const { orderId }   = req.params;
    if (!orderId)       return sendError(res, 400, 'orderId path parameter is required.');
    if (!idempotencyKey) return sendError(res, 400, 'Idempotency-Key header is required.');

    try {
      const result = paymentService.refundOrder(
        orderId,
        sessionId,
        cashierUserId,
        req.body || {},
        idempotencyKey
      );
      sendSuccess(res, result, 'Order refunded.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * GET /api/payments/order/:orderId
   * Returns all payment records for an order.
   */
  getOrderPayments: (req, res) => {
    try {
      const payments = paymentService.getPaymentsByOrder(req.params.orderId);
      sendSuccess(res, payments, 'Payments retrieved.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * GET /api/payments/:paymentId
   * Returns a single payment record with its receipt reference.
   */
  getPaymentById: (req, res) => {
    try {
      const payment = paymentService.getPaymentById(req.params.paymentId);
      if (!payment) return sendError(res, 404, 'Payment not found.');
      sendSuccess(res, payment, 'Payment retrieved.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * GET /api/payments/:paymentId/receipt
   * Returns the full receipt payload for a payment.
   * Used for re-printing and display.
   */
  getReceipt: (req, res) => {
    try {
      const receipt = paymentService.getReceipt(req.params.paymentId);
      if (!receipt) return sendError(res, 404, 'Receipt not found.');
      sendSuccess(res, receipt, 'Receipt retrieved.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * GET /api/payments/methods
   * Returns all active payment methods for the POS UI.
   */
  getPaymentMethods: (req, res) => {
    try {
      const methods = paymentService.getPaymentMethods();
      sendSuccess(res, methods, 'Payment methods retrieved.');
    } catch (error) {
      sendError(res, 500, error.message);
    }
  },

  /**
   * GET /api/payments/cash-buttons?amount=450.00
   * Returns quick-cash button configuration for the cash payment modal.
   */
  getCashQuickButtons: (req, res) => {
    try {
      const amountDue = Number(req.query.amount) || 0;
      const buttons   = paymentService.getCashQuickButtons(amountDue);
      sendSuccess(res, { amount_due: amountDue, buttons }, 'Quick cash buttons generated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * GET /api/payments/summary/daily?date=2026-07-31&branch_id=...
   * Returns payment breakdown by method for a business date.
   */
  getDailySummary: (req, res) => {
    const branchId = req.query.branch_id || req.headers['x-branch-id'] || null;
    const date     = req.query.date || new Date().toISOString().split('T')[0];

    try {
      const summary = paymentService.getDailySummary(date, branchId);
      sendSuccess(res, { date, branch_id: branchId, breakdown: summary }, 'Daily payment summary retrieved.');
    } catch (error) {
      sendError(res, 500, error.message);
    }
  },

  /**
   * GET /api/payments/recent?limit=20&branch_id=...
   * Returns the most recent completed payments for the dashboard feed.
   */
  getRecentPayments: (req, res) => {
    const limit    = Math.min(Number(req.query.limit) || 20, 100);
    const branchId = req.query.branch_id || req.headers['x-branch-id'] || null;

    try {
      const payments = paymentService.getRecentPayments(limit, branchId);
      sendSuccess(res, payments, 'Recent payments retrieved.');
    } catch (error) {
      sendError(res, 500, error.message);
    }
  }
};
