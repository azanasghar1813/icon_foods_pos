/**
 * CashPaymentService
 *
 * Handles all cash-specific payment logic.
 * This service is a PURE domain layer — it performs calculations only,
 * and delegates the actual database write to paymentService.processPayment().
 *
 * Responsibility:
 *  - Precise change calculation
 *  - Rounding to 2 decimal places (currency precision)
 *  - Building the normalized cash payment input object
 */
class CashPaymentService {
  /**
   * Calculates exact change to return to the customer.
   *
   * @param {number} amountReceived - Cash tendered by the customer
   * @param {number} amountDue      - Total amount owed
   * @returns {number}              - Change to return (always >= 0)
   */
  calculateChange(amountReceived, amountDue) {
    const received = Number(amountReceived) || 0;
    const due = Number(amountDue) || 0;
    const change = received - due;
    return this._round(Math.max(0, change));
  }

  /**
   * Builds the normalized payment input from raw cash-payment request data.
   * The "amount" applied to the order is always exactly the amount due
   * (not the tendered amount — you do not credit the customer for overpayment).
   *
   * @param {number} amountReceived - Tendered
   * @param {number} amountDue      - What the order owes
   * @param {Object} extras         - { notes }
   * @returns {Object}              - Normalized payment input ready for paymentService
   */
  buildPaymentInput(amountReceived, amountDue, extras = {}) {
    const changeReturned = this.calculateChange(amountReceived, amountDue);
    return {
      payment_method:        'CASH',
      amount:                this._round(amountDue),
      amount_received:       this._round(Number(amountReceived)),
      change_returned:       changeReturned,
      transaction_reference: null,
      approval_code:         null,
      notes:                 extras.notes || null
    };
  }

  /**
   * Builds the set of quick-cash button amounts for display in the POS UI.
   * Returns the first preset that covers the due amount, plus Exact and Custom.
   *
   * @param {number}   amountDue
   * @param {number[]} presets - e.g. [500, 1000, 2000, 5000]
   * @returns {Object[]} Array of { label, value } button descriptors
   */
  buildQuickCashButtons(amountDue, presets = [500, 1000, 2000, 5000]) {
    const due = Number(amountDue) || 0;
    const buttons = [{ label: 'Exact', value: this._round(due) }];

    for (const preset of presets) {
      if (preset > due) {
        buttons.push({ label: `${preset}`, value: preset });
      }
    }

    buttons.push({ label: 'Custom', value: null });
    return buttons;
  }

  _round(value) {
    return Math.round(Number(value) * 100) / 100;
  }
}

export const cashPaymentService = new CashPaymentService();
