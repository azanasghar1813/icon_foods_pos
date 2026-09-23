import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * PaymentReceiptRepository
 *
 * Stores and retrieves immutable receipt payload snapshots.
 * Receipts are stored as JSON blobs and never modified after creation.
 */
class PaymentReceiptRepository {
  /**
   * Saves a generated receipt. Call only inside an existing transaction.
   *
   * @param {string} paymentId
   * @param {string} orderId
   * @param {string} receiptNumber - Human-readable receipt number (mirrors order_number)
   * @param {Object} payload - Full receipt data object (will be JSON-stringified)
   * @returns {Object} Saved receipt row
   */
  saveReceipt(paymentId, orderId, receiptNumber, payload) {
    const id = crypto.randomUUID();
    dbEngine.prepare(`
      INSERT INTO payment_receipts (id, payment_id, order_id, receipt_number, payload, generated_at)
      VALUES (@id, @payment_id, @order_id, @receipt_number, @payload, CURRENT_TIMESTAMP)
    `).run({
      id,
      payment_id:     paymentId,
      order_id:       orderId,
      receipt_number: receiptNumber,
      payload:        JSON.stringify(payload)
    });

    return this.findByPaymentId(paymentId);
  }

  /**
   * Retrieves a single receipt by its payment ID.
   * Parses the JSON payload before returning.
   */
  findByPaymentId(paymentId) {
    const row = dbEngine.prepare(
      'SELECT * FROM payment_receipts WHERE payment_id = ?'
    ).get(paymentId);

    return row ? this._parse(row) : null;
  }

  /**
   * Retrieves all receipts for an order (supports re-prints).
   */
  findByOrderId(orderId) {
    const rows = dbEngine.prepare(
      'SELECT * FROM payment_receipts WHERE order_id = ? ORDER BY generated_at ASC'
    ).all(orderId);

    return rows.map(r => this._parse(r));
  }

  /**
   * Increments the print counter (called at receipt print time — future).
   */
  recordPrint(paymentId) {
    dbEngine.prepare(`
      UPDATE payment_receipts
      SET print_count = print_count + 1, printed_at = CURRENT_TIMESTAMP
      WHERE payment_id = ?
    `).run(paymentId);
  }

  _parse(row) {
    try {
      row.payload = JSON.parse(row.payload);
    } catch {
      row.payload = {};
    }
    return row;
  }
}

export const paymentReceiptRepository = new PaymentReceiptRepository();
