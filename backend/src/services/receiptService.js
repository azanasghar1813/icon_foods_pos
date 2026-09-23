import { paymentReceiptRepository } from '../repositories/paymentReceiptRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { configService } from './configService.js';

/**
 * ReceiptService
 *
 * Generates the complete receipt payload snapshot at the moment of payment.
 * The receipt is a point-in-time document — it will remain accurate even if
 * the catalog, tax rates, or business profile changes later.
 *
 * Receipt generation and persistence happen INSIDE the payment transaction,
 * so the receipt is atomic with the payment record.
 */
class ReceiptService {
  /**
   * Generates a full receipt payload from a hydrated order and a payment record.
   * Call this inside the payment transaction, AFTER the payment has been inserted.
   *
   * @param {Object} order   - Hydrated order with .items array
   * @param {Object} payment - Newly inserted payment record
   * @returns {Object}       - Complete receipt payload (plain JS object)
   */
  generateReceiptPayload(order, payment) {
    const businessProfile = configService.getBusinessProfile() || {};
    const financeConfig = configService.getFinanceConfig() || {};
    const receiptConfig = configService.getReceiptConfig() || {};

    // ── Business Information ──────────────────────────────────────────────────
    const business = {
      name: businessProfile.business_name || 'Icon Foods',
      address: businessProfile.address || 'Jhang road sabzi mandi near shall pump ,\n Chaniot',
      phone: businessProfile.phone || '0329-9792223 , 0315-9792247',
      email: businessProfile.email || '',
      tax_id: businessProfile.tax_id || '',
      logo_url: businessProfile.logo_url || null,
      receipt_footer: receiptConfig.footer_text || 'Thank you for your visit!',
      receipt_header: receiptConfig.header_text || ''
    };

    // ── Order Summary ─────────────────────────────────────────────────────────
    const orderSummary = {
      order_id: order.id,
      order_number: order.order_number,
      order_type: order.order_type,
      table_id: String(order.order_type || '').toUpperCase().includes('DINE') ? (order.table_number || order.table_id || null) : null,
      table_number: String(order.order_type || '').toUpperCase().includes('DINE') ? (order.table_number || order.table_id || null) : null,
      customer_id: order.customer_id || null,
      customer_name: order.metadata?.customer_name || (order.customer ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ') : null) || 'Guest',
      customer_phone: order.metadata?.customer_phone || order.customer?.phone || null,
      customer_address: order.metadata?.customer_address || order.customer?.address || null,
      waiter_name: order.waiter_name || order.waiter_name_snapshot || null,
      rider_name: order.rider_name || order.rider_name_snapshot || null,
      is_vip: !!(order.is_vip || order.customer?.is_vip || order.metadata?.is_vip === 'true' || order.metadata?.is_vip === true),
      cashier_name: order.cashier_name || null,
      receipt_paid_stamp: order.metadata?.receipt_paid_stamp === 'true' || order.metadata?.receipt_paid_stamp === true || false,
      payment_method: payment?.payment_method || payment?.payment_method_label || null,
      business_date: order.business_date,
      created_at: order.created_at,
      cashier_user_id: order.cashier_user_id,
      branch_id: order.branch_id,
      notes: order.notes || null
    };

    // ── Line Items with full snapshots ────────────────────────────────────────
    const items = (order.items || []).map(item => ({
      item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name_snapshot,
      product_code: item.product_code_snapshot,
      quantity: item.quantity,
      base_unit_price: item.base_unit_price,
      final_unit_price: item.final_unit_price,
      subtotal: item.subtotal,
      discount_amount: item.discount_amount,
      tax_amount: item.tax_amount,
      tax_rate: item.tax_rate,
      tax_name: item.tax_name,
      is_tax_inclusive: !!item.is_tax_inclusive,
      total_amount: item.total_amount,
      notes: item.notes || null,
      // Variant snapshot
      variant: item.variant ? {
        variant_name: item.variant.variant_name_snapshot,
        variant_sku: item.variant.variant_sku_snapshot,
        price_adj: item.variant.price_adjustment
      } : null,
      // Modifier snapshots
      modifiers: (item.modifiers || []).map(m => ({
        group_name: m.group_name_snapshot,
        modifier_name: m.modifier_name_snapshot,
        price_adj: m.price_adjustment,
        quantity: m.quantity
      })),
      // Add-on snapshots
      addons: (item.addons || []).map(a => ({
        addon_name: a.addon_name_snapshot,
        unit_price: a.unit_price,
        quantity: a.quantity,
        subtotal: a.subtotal
      })),
      // Combo component snapshots
      combo_components: (item.comboComponents || item.combo_components || []).map(c => ({
        product_name: c.product_name_snapshot,
        variant_name: c.variant_snapshot,
        price_adj: c.price_adjustment
      }))
    }));

    // ── Order Financials ──────────────────────────────────────────────────────
    const financials = {
      subtotal: order.subtotal,
      tax_total: 0,
      discount_total: order.discount_total,
      tip_total: order.tip_total || 0,
      delivery_fee: order.delivery_fee || 0,
      service_charge: Number(order.service_charge) || Number(order.metadata?.service_charge) || 0,
      grand_total: order.grand_total,
      paid_total: order.grand_total,
      tax_name: '',
      tax_rate: 0,
      is_tax_inclusive: false,
      currency_symbol: 'Rs'
    };

    // ── Payment Details ───────────────────────────────────────────────────────
    const paymentDetails = {
      payment_id: payment.id,
      payment_method: payment.payment_method,
      payment_method_label: payment.payment_method_label || payment.payment_method,
      amount: payment.amount,
      amount_received: payment.amount_received,
      change_returned: payment.change_returned,
      transaction_reference: payment.transaction_reference || null,
      approval_code: payment.approval_code || null,
      cashier_user_id: payment.cashier_user_id,
      paid_at: payment.created_at
    };

    // ── QR Placeholder (future: encode order URL for customer portal) ─────────
    const qr = {
      type: 'ORDER_LOOKUP',
      value: order.order_number,
      url: null // future: `https://receipts.brand.com/${order.order_number}`
    };

    return {
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      business,
      order: orderSummary,
      items,
      financials,
      payment: paymentDetails,
      qr,
      notes: order.notes || null
    };
  }

  /**
   * Saves the generated receipt payload to the database.
   * Must be called inside the payment transaction.
   *
   * @param {string} paymentId
   * @param {string} orderId
   * @param {string} receiptNumber - Same as order_number for traceability
   * @param {Object} payload
   * @returns {Object} Saved receipt row
   */
  saveReceipt(paymentId, orderId, receiptNumber, payload) {
    return paymentReceiptRepository.saveReceipt(paymentId, orderId, receiptNumber, payload);
  }

  /**
   * Retrieves a saved receipt payload by payment ID.
   */
  getByPaymentId(paymentId) {
    return paymentReceiptRepository.findByPaymentId(paymentId);
  }

  /**
   * Retrieves all receipts for an order.
   */
  getByOrderId(orderId) {
    return paymentReceiptRepository.findByOrderId(orderId);
  }
}

export const receiptService = new ReceiptService();
