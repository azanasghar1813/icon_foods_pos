/**
 * NonCashPaymentService
 *
 * Handles all non-cash payment method normalization.
 * Supported methods: CARD, JAZZCASH, EASYPAISA, BANK_TRANSFER, OTHER
 *
 * No gateway integration — this is a record-only payment engine.
 * The cashier marks the payment as successful after verifying
 * the transaction externally (card machine, mobile confirmation, etc.)
 */
class NonCashPaymentService {
  /**
   * Builds the normalized payment input for any non-cash method.
   * For non-cash, amount === amount_received (no change applies).
   *
   * @param {string} methodCode          - One of CARD|JAZZCASH|EASYPAISA|BANK_TRANSFER|OTHER
   * @param {number} amount              - Exact amount to apply to order
   * @param {Object} extras              - { transaction_reference, approval_code, notes }
   * @returns {Object}                   - Normalized payment input
   */
  buildPaymentInput(methodCode, amount, extras = {}) {
    const normalizedAmount = this._round(Number(amount));
    return {
      payment_method:        methodCode.toUpperCase(),
      amount:                normalizedAmount,
      amount_received:       normalizedAmount,   // Always equals amount for non-cash
      change_returned:       0,                  // No change for non-cash
      transaction_reference: extras.transaction_reference || null,
      approval_code:         extras.approval_code || null,
      notes:                 extras.notes || null
    };
  }

  /**
   * Human-readable labels for UI rendering.
   */
  static METHOD_LABELS = Object.freeze({
    CARD:          'Card',
    JAZZCASH:      'JazzCash',
    EASYPAISA:     'EasyPaisa',
    BANK_TRANSFER: 'Bank Transfer',
    OTHER:         'Other'
  });

  getLabel(methodCode) {
    return NonCashPaymentService.METHOD_LABELS[methodCode?.toUpperCase()] || methodCode;
  }

  _round(value) {
    return Math.round(Number(value) * 100) / 100;
  }
}

export const nonCashPaymentService = new NonCashPaymentService();
