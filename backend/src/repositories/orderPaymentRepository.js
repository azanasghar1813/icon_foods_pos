import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * OrderPaymentRepository
 *
 * Manages all reads and writes to the order_payments table.
 * Business logic lives entirely in the service layer.
 */
class OrderPaymentRepository {
  // ──────────────────────────────────────────────────────────────────────────
  // Write operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Inserts a new payment record. Never call outside an existing transaction.
   */
  addPayment(paymentData) {
    dbEngine.prepare(`
      INSERT INTO order_payments (
        id, order_id, shift_id, cashier_user_id, business_date,
        payment_method, payment_method_label,
        amount, amount_received, change_returned,
        transaction_reference, approval_code, gateway_response,
        notes, status, idempotency_key,
        sync_status, created_at, updated_at
      ) VALUES (
        @id, @order_id, @shift_id, @cashier_user_id, @business_date,
        @payment_method, @payment_method_label,
        @amount, @amount_received, @change_returned,
        @transaction_reference, @approval_code, @gateway_response,
        @notes, @status, @idempotency_key,
        'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run({
      id:                    paymentData.id,
      order_id:              paymentData.order_id,
      shift_id:              paymentData.shift_id,
      cashier_user_id:       paymentData.cashier_user_id,
      business_date:         paymentData.business_date,
      payment_method:        paymentData.payment_method,
      payment_method_label:  paymentData.payment_method_label || null,
      amount:                Number(paymentData.amount),
      amount_received:       Number(paymentData.amount_received || paymentData.amount),
      change_returned:       Number(paymentData.change_returned || 0),
      transaction_reference: paymentData.transaction_reference || null,
      approval_code:         paymentData.approval_code || null,
      gateway_response:      paymentData.gateway_response || null,
      notes:                 paymentData.notes || null,
      status:                paymentData.status || 'COMPLETED',
      idempotency_key:       paymentData.idempotency_key || null
    });

    return this.findById(paymentData.id);
  }

  /**
   * Finds a payment by its idempotency key
   */
  findByIdempotencyKey(key) {
    if (!key) return null;
    return dbEngine.prepare('SELECT * FROM order_payments WHERE idempotency_key = ?').get(key) || null;
  }

  /**
   * Soft-voids a payment (never hard-deletes). Audit trail preserved.
   */
  voidPayment(paymentId, voidedByUserId, voidReason) {
    dbEngine.prepare(`
      UPDATE order_payments
      SET status = 'VOIDED',
          voided_at = CURRENT_TIMESTAMP,
          void_reason = @void_reason,
          voided_by_user_id = @voided_by_user_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id: paymentId, void_reason: voidReason || null, voided_by_user_id: voidedByUserId });

    return this.findById(paymentId);
  }

  /**
   * Marks a payment as synced to the cloud.
   */
  markSynced(paymentId) {
    dbEngine.prepare(`
      UPDATE order_payments
      SET sync_status = 'SYNCED', synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paymentId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read operations
  // ──────────────────────────────────────────────────────────────────────────

  findById(id) {
    return dbEngine.prepare('SELECT * FROM order_payments WHERE id = ?').get(id) || null;
  }

  findByOrderId(orderId) {
    return dbEngine.prepare(`
      SELECT * FROM order_payments
      WHERE order_id = ?
      ORDER BY created_at ASC
    `).all(orderId);
  }

  findCompletedByOrderId(orderId) {
    return dbEngine.prepare(`
      SELECT * FROM order_payments
      WHERE order_id = ? AND status = 'COMPLETED'
      ORDER BY created_at ASC
    `).all(orderId);
  }

  /**
   * Returns the sum of all COMPLETED payments for an order.
   */
  getTotalPaidForOrder(orderId) {
    const row = dbEngine.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_paid
      FROM order_payments
      WHERE order_id = ? AND status = 'COMPLETED'
    `).get(orderId);
    return row ? Number(row.total_paid) : 0;
  }

  /**
   * Aggregated payment summary by method for a given business date.
   */
  getSummaryByMethod(businessDate, branchId = null) {
    let sql = `
      SELECT
        p.payment_method,
        p.payment_method_label,
        COUNT(*) AS payment_count,
        SUM(p.amount) AS total_amount
      FROM order_payments p
      JOIN orders o ON o.id = p.order_id
      WHERE p.business_date = ? AND p.status = 'COMPLETED'
    `;
    const params = [businessDate];
    if (branchId) {
      sql += ' AND o.branch_id = ?';
      params.push(branchId);
    }
    sql += ' GROUP BY p.payment_method ORDER BY total_amount DESC';
    return dbEngine.prepare(sql).all(...params);
  }

  /**
   * Recent payments for the dashboard feed.
   */
  getRecentPayments(limit = 20, branchId = null) {
    let sql = `
      SELECT p.*, o.order_number
      FROM order_payments p
      JOIN orders o ON o.id = p.order_id
      WHERE p.status = 'COMPLETED'
    `;
    const params = [];
    if (branchId) {
      sql += ' AND o.branch_id = ?';
      params.push(branchId);
    }
    sql += ' ORDER BY p.created_at DESC LIMIT ?';
    params.push(limit);
    return dbEngine.prepare(sql).all(...params);
  }

  /**
   * Daily revenue totals (gross, tax, discount, net) for reporting.
   */
  getDailyRevenue(businessDate, branchId = null) {
    let sql = `
      SELECT
        SUM(o.grand_total)      AS gross_revenue,
        SUM(o.tax_total)        AS total_tax,
        SUM(o.discount_total)   AS total_discount,
        SUM(o.grand_total - o.tax_total) AS net_revenue,
        COUNT(DISTINCT o.id)    AS order_count
      FROM orders o
      WHERE o.business_date = ?
        AND o.payment_state = 'PAID'
    `;
    const params = [businessDate];
    if (branchId) {
      sql += ' AND o.branch_id = ?';
      params.push(branchId);
    }
    return dbEngine.prepare(sql).get(...params) || {};
  }
}

export const orderPaymentRepository = new OrderPaymentRepository();
