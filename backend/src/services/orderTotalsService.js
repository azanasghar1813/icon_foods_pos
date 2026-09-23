import { dbEngine } from '../database/sqlite.js';
import { configService } from './configService.js';

/**
 * Single writer for order money fields.
 * Food subtotal comes from line items. Service is 7% of dine-in food after discount.
 * Delivery is kept only on DELIVERY orders. Tax is not charged (rate stored, amount 0).
 */
class OrderTotalsService {
  getServiceChargeRate() {
    return 0;
  }

  computeServiceCharge(foodAfterDiscount, orderType) {
    const type = String(orderType || '').toUpperCase().replace(/\s+/g, '_');
    if (type !== 'DINE_IN') return 0;
    const base = Math.max(0, Number(foodAfterDiscount) || 0);
    return Math.round(base * this.getServiceChargeRate());
  }

  _addonSum(itemId) {
    const row = dbEngine.get(
      'SELECT COALESCE(SUM(subtotal), 0) AS s FROM order_item_addons WHERE order_item_id = ?',
      itemId
    );
    return Number(row?.s) || 0;
  }

  _recomputeLine(item) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unit = Number(item.final_unit_price ?? item.base_unit_price) || 0;
    const addons = this._addonSum(item.id);
    const subtotal = unit * qty + addons;
    const discount = Math.max(0, Number(item.discount_amount) || 0);
    return {
      subtotal: this._round(subtotal),
      tax_amount: 0,
      total_amount: this._round(Math.max(0, subtotal - discount))
    };
  }

  /**
   * Rebuild item subtotals, then order subtotal / service / grand / due.
   * Safe to call inside an existing transaction.
   */
  recalculate(orderId) {
    const order = dbEngine.get('SELECT * FROM orders WHERE id = ?', orderId);
    if (!order) throw new Error('Order not found.');

    const items = dbEngine.all('SELECT * FROM order_items WHERE order_id = ?', orderId);
    let subtotal = 0;
    let lineDiscountTotal = 0;

    for (const item of items) {
      const next = this._recomputeLine(item);
      if (
        Math.abs((Number(item.subtotal) || 0) - next.subtotal) > 0.009
        || Math.abs((Number(item.total_amount) || 0) - next.total_amount) > 0.009
        || Math.abs((Number(item.tax_amount) || 0) - next.tax_amount) > 0.009
      ) {
        dbEngine.run(
          `UPDATE order_items
           SET subtotal = ?, tax_amount = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          next.subtotal, next.tax_amount, next.total_amount, item.id
        );
      }
      subtotal += next.subtotal;
      lineDiscountTotal += Number(item.discount_amount) || 0;
    }

    subtotal = this._round(subtotal);
    const storedDiscount = Number(order.discount_total);
    const rawDiscount = this._round(
      Number.isFinite(storedDiscount) && storedDiscount > 0
        ? storedDiscount
        : lineDiscountTotal
    );
    const discountTotal = this._round(Math.min(Math.max(0, rawDiscount), subtotal));

    const orderType = order.order_type;
    const serviceCharge = this.computeServiceCharge(subtotal - discountTotal, orderType);
    const typeKey = String(orderType || '').toUpperCase().replace(/\s+/g, '_');
    const deliveryFee = typeKey === 'DELIVERY' ? this._round(Number(order.delivery_fee) || 0) : 0;
    const taxTotal = 0;
    const tipTotal = this._round(Number(order.tip_total) || 0);
    const grandTotal = this._round(Math.max(0, subtotal - discountTotal + serviceCharge + deliveryFee + taxTotal + tipTotal));

    const paidRow = dbEngine.get(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM order_payments
       WHERE order_id = ? AND UPPER(COALESCE(status, 'COMPLETED')) = 'COMPLETED'`,
      orderId
    );
    const paidTotal = this._round(Number(paidRow?.paid) || 0);
    const dueTotal = this._round(Math.max(0, grandTotal - paidTotal));

    let paymentState = order.payment_state;
    if (paidTotal + 0.005 >= grandTotal && grandTotal > 0) {
      paymentState = 'PAID';
    } else {
      paymentState = 'UNPAID';
    }

    dbEngine.run(
      `UPDATE orders SET
         subtotal = ?,
         tax_total = ?,
         discount_total = ?,
         delivery_fee = ?,
         service_charge = ?,
         grand_total = ?,
         paid_total = ?,
         due_total = ?,
         payment_state = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      subtotal,
      taxTotal,
      discountTotal,
      deliveryFee,
      serviceCharge,
      grandTotal,
      paidTotal,
      dueTotal,
      paymentState,
      orderId
    );

    return dbEngine.get('SELECT * FROM orders WHERE id = ?', orderId);
  }

  repairAllOrders() {
    const orders = dbEngine.all(
      `SELECT id FROM orders
       WHERE lifecycle_state NOT IN ('DRAFT', 'HELD')`
    );
    let repaired = 0;
    for (const row of orders) {
      try {
        this.recalculate(row.id);
        repaired += 1;
      } catch (err) {
        console.warn(`[orderTotals] repair failed for ${row.id}:`, err.message);
      }
    }
    return { repaired, total: orders.length };
  }

  _round(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }
}

export const orderTotalsService = new OrderTotalsService();
