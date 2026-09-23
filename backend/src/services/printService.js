import { printQueueService, PrintJobType } from './printQueueService.js';
import { receiptGeneratorService } from './receiptGeneratorService.js';
import { kitchenTicketGeneratorService } from './kitchenTicketGeneratorService.js';
import { printerManagerService } from './printerManagerService.js';
import { printerDriverService } from './printerDriverService.js';
import { printEngineService } from './printEngineService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';
import { orderPaymentRepository } from '../repositories/orderPaymentRepository.js';
import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { customerRepository } from '../repositories/customerRepository.js';
import { paymentReceiptRepository } from '../repositories/paymentReceiptRepository.js';
import { configService } from './configService.js';
import { orderService } from './orderService.js';
import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * PrintService — the public API for all print operations.
 *
 * This is the single entry point callers use. It:
 *   1. Resolves order/receipt data
 *   2. Generates the appropriate payload
 *   3. Enqueues a job via PrintQueueService
 *   4. Kicks the print engine to process immediately
 *
 * The caller (controller/payment service) NEVER waits for the physical
 * printer to respond. All printing is fire-and-forget from the API layer.
 */
class PrintService {
  // ──────────────────────────────────────────────────────────────────────────
  // Triggered by Payment Engine (the only coupling point)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called after a successful payment. Enqueues all required print jobs.
   * This is the ONLY method PaymentService should call.
   *
   * Wrapped in try/catch — NEVER throws into the payment flow.
   *
   * @param {Object} order     - Hydrated order
   * @param {Object} payment   - Payment record
   * @param {Object} options   - { cashierUserId, branchId }
   */
  async onPaymentCompleted(order, payment, options = {}) {
    try {
      await this._enqueueReceiptJobs(order, payment, options);
      await this._enqueueKitchenTicketJobs(order, options);

      // Kick the engine immediately — don't wait for the 2s interval
      setImmediate(() => {
        printEngineService.processPendingJobs().catch(err =>
          console.error('[PrintService] Engine kick failed:', err.message)
        );
      });
    } catch (error) {
      // Log but NEVER propagate — order is already saved
      console.error('[PrintService] onPaymentCompleted failed (non-fatal):', error.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Manual / On-Demand Print Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Manually trigger a customer receipt for an order.
   * Used by the print button in the POS/history UI.
   */
  async printReceipt(orderId, cashierUserId, options = {}) {
    const order = this._loadOrder(orderId);
    const receipts = paymentReceiptRepository.findByOrderId(orderId);
    const printerConfig = configService.getReceiptConfig() || {};
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CUSTOMER_RECEIPT);
    const paidStamp = options.printPaid === true
      || order?.metadata?.receipt_paid_stamp === 'true'
      || order?.metadata?.receipt_paid_stamp === true;

    const lastPayment = (order.payments && order.payments[order.payments.length - 1]) || {
      id: 'unpaid-preview',
      payment_method: receipts.length ? (receipts[receipts.length - 1]?.payload?.payment?.payment_method || null) : null,
      payment_method_label: null,
      amount: order.grand_total,
      amount_received: paidStamp ? order.grand_total : 0,
      change_returned: 0,
      cashier_user_id: cashierUserId,
      created_at: new Date().toISOString()
    };
    const payload = receiptGeneratorService.buildFromOrder(order, lastPayment, {
      printerWidth: printer?.paper_width || 80,
      copies: printerConfig.copies || 1,
      cashDrawer: false,
    });

    if (payload.order) payload.order.receipt_paid_stamp = paidStamp;

    const jobId = printQueueService.enqueue(
      PrintJobType.CUSTOMER_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId,
        orderNumber:    order.order_number,
        cashierUserId,
        shiftId:        order.shift_id,
        branchId:       order.branch_id,
        priority:       3,
      }
    );

    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    const queued = printQueueService.findById(jobId);
    return { job_id: jobId, status: queued?.status || 'PENDING' };
  }

  /**
   * Reprint a receipt by job ID (permission-controlled by caller).
   */
  async reprintReceipt(originalJobId, cashierUserId, reason, options = {}) {
    const originalJob = printQueueService.findById(originalJobId);
    if (!originalJob) throw new Error('Original print job not found.');

    const orderId = originalJob.order_id;
    if (!orderId) throw new Error('Cannot reprint a non-order job.');

    const order = this._loadOrder(orderId);
    const receipts = paymentReceiptRepository.findByOrderId(orderId);
    if (receipts.length === 0) throw new Error('No receipt found for this order.');

    const receipt = receipts[receipts.length - 1];
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.REPRINT_RECEIPT);
    const payload  = receiptGeneratorService.buildPrintPayload(receipt, {
      printerWidth: printer?.paper_width || 80,
    });

    // Mark it as a reprint
    if (payload.footer) payload.footer.show_reprint_label = true;

    const jobId = printQueueService.enqueue(
      PrintJobType.REPRINT_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId,
        orderNumber:  order.order_number,
        cashierUserId,
        shiftId:      order.shift_id,
        branchId:     order.branch_id,
        priority:     2,
      }
    );

    // Log reprint in audit trail
    const reprintCount = printQueueService.logReprint(
      jobId, originalJobId, orderId, cashierUserId, reason, order.branch_id
    );

    // Activity log
    activityLogService.logActivity(cashierUserId, 'RECEIPT_REPRINTED', 'PRINT', jobId, {
      order_id:       orderId,
      order_number:   order.order_number,
      reprint_count:  reprintCount,
      reason,
    });


    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    return { job_id: jobId, reprint_count: reprintCount, status: 'ENQUEUED' };
  }

  /**
   * Print kitchen tickets for an order.
   */
  async printKitchenTickets(orderId, cashierUserId, options = {}) {
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role === 'TERMINAL' && syncConfig.hub_ip) {
      // POST to Hub
      const url = `http://${syncConfig.hub_ip}:${syncConfig.hub_port || 5000}/api/v1/internal/print/kitchen/${orderId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), syncConfig.hub_timeout_ms || 400);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-secret': syncConfig.deviceSecret || process.env.DEVICE_SECRET || 'changeme',
            'x-terminal-id': syncConfig.device_id || 'unknown'
          },
          body: JSON.stringify({ cashierUserId, options }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          console.warn('[PrintService] Hub rejected kitchen print request:', res.status);
          throw new Error('Hub rejected print request');
        } else {
          const data = await res.json();
          return { job_ids: data.job_ids || [], count: data.count || 0, status: 'HUB_ENQUEUED' };
        }
      } catch (err) {
        clearTimeout(timeout);
        console.warn('[PrintService] Failed to forward kitchen print to Hub:', err.message);
        // Queue it locally to be picked up by the retry worker
        dbEngine.prepare(`
          INSERT INTO pending_kitchen_prints (id, order_id, cashier_user_id, options) 
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), orderId, cashierUserId || '', JSON.stringify(options || {}));
      }
      return { job_ids: [], count: 0, status: 'FAILED' };
    }

    const order = this._loadOrder(orderId);
    const tickets = kitchenTicketGeneratorService.generateTickets(order);

    if (tickets.length === 0) {
      return { job_ids: [], count: 0, message: 'No kitchen items to print.' };
    }

    const jobIds = [];

    for (const ticket of tickets) {
      const stationType = ticket.station?.station_type || 'GENERAL';
      const printer = this._resolveKitchenPrinter(stationType);
      if (!options.force) {
        const existing = printQueueService.findActiveKitchenJobs(orderId, printer?.id || null);
        if (existing.length > 0) {
          jobIds.push(existing[0].id);
          continue;
        }
      }

      const jobId = printQueueService.enqueue(
        PrintJobType.KITCHEN_TICKET,
        printer?.id || null,
        ticket,
        {
          orderId,
          orderNumber:  order.order_number,
          cashierUserId,
          shiftId:      order.shift_id,
          branchId:     order.branch_id,
          priority:     1, // Kitchen tickets are highest priority
        }
      );
      jobIds.push(jobId);
    }

    setImmediate(() => {
      printEngineService.processPendingJobs().catch(() => {});
    });

    return { job_ids: jobIds, count: jobIds.length, status: 'ENQUEUED' };
  }

  /**
   * Open the cash drawer via the receipt printer.
   */
  async openCashDrawer(cashierUserId, options = {}) {
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CASH_DRAWER);

    if (!printer) {
      throw new Error('No cash drawer printer configured.');
    }

    if (!printer.cash_drawer_enabled) {
      throw new Error('Cash drawer is not enabled on the configured printer.');
    }

    const result = await printerDriverService.openCashDrawer(printer);

    activityLogService.logActivity(cashierUserId, 'CASH_DRAWER_OPENED', 'PRINT', printer.id, {
      printer_name: printer.name,
      success:      result.success,
    });

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queue Queries
  // ──────────────────────────────────────────────────────────────────────────

  getQueue(filters, page, limit) {
    return printQueueService.list(filters, page, limit);
  }

  getJobById(jobId) {
    return printQueueService.findById(jobId);
  }

  getJobsByOrder(orderId) {
    return printQueueService.findByOrderId(orderId);
  }

  getQueueStats(branchId) {
    return printQueueService.getStats(branchId);
  }

  getReprintLog(orderId) {
    return printQueueService.getReprintLog(orderId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers — fired by onPaymentCompleted
  // ──────────────────────────────────────────────────────────────────────────

  async _enqueueReceiptJobs(order, payment, options) {
    const printerConfig = configService.getReceiptConfig() || {};
    const printer = printerManagerService.getDefaultPrinterForJobType(PrintJobType.CUSTOMER_RECEIPT);

    const payload = receiptGeneratorService.buildFromOrder(order, payment, {
      printerWidth: printer?.paper_width || 80,
      copies:       printerConfig.copies || 1,
      cashDrawer:   printer?.cash_drawer_enabled === 1 || printerConfig.open_cash_drawer === true,
      showQr:       true,
      showBarcode:  true,
    });

    printQueueService.enqueue(
      PrintJobType.CUSTOMER_RECEIPT,
      printer?.id || null,
      payload,
      {
        orderId:      order.id,
        orderNumber:  order.order_number,
        cashierUserId: options.cashierUserId || order.cashier_user_id,
        shiftId:      order.shift_id,
        branchId:     order.branch_id,
        priority:     2,
      }
    );
  }

  async _enqueueKitchenTicketJobs(order, options) {
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role === 'TERMINAL' && syncConfig.hub_ip) {
      // POST to Hub
      const url = `http://${syncConfig.hub_ip}:${syncConfig.hub_port || 5000}/api/v1/internal/print/kitchen/${order.id}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), syncConfig.hub_timeout_ms || 400);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-secret': syncConfig.deviceSecret || process.env.DEVICE_SECRET || 'changeme',
            'x-terminal-id': syncConfig.device_id || 'unknown'
          },
          body: JSON.stringify({ cashierUserId: options.cashierUserId, options }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          console.warn('[PrintService] Hub rejected kitchen print enqueuing:', res.status);
          throw new Error('Hub rejected request');
        }
      } catch (err) {
        clearTimeout(timeout);
        console.warn('[PrintService] Failed to forward kitchen print to Hub:', err.message);
        // Queue it locally to be picked up by the retry worker
        dbEngine.prepare(`
          INSERT INTO pending_kitchen_prints (id, order_id, cashier_user_id, options) 
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), order.id, options.cashierUserId || '', JSON.stringify(options || {}));
      }
      return;
    }

    const tickets = kitchenTicketGeneratorService.generateTickets(order);
    if (!tickets.length) return;

    for (const ticket of tickets) {
      const stationType = ticket.station?.station_type || 'GENERAL';
      const printer = this._resolveKitchenPrinter(stationType);

      printQueueService.enqueue(
        PrintJobType.KITCHEN_TICKET,
        printer?.id || null,
        ticket,
        {
          orderId:      order.id,
          orderNumber:  order.order_number,
          cashierUserId: options.cashierUserId || order.cashier_user_id,
          shiftId:      order.shift_id,
          branchId:     order.branch_id,
          priority:     1,
        }
      );
    }
  }

  _resolveKitchenPrinter(stationType) {
    const preferred = printerManagerService.getDefaultPrinterForJobType('KITCHEN_TICKET');
    if (preferred && preferred.driver_type && preferred.driver_type !== 'VIRTUAL') {
      return preferred;
    }
    const all = printerManagerService.getAllWithStatus();
    const hw = all.find((p) =>
      (p.driver_type === 'ESCPOS_USB' || p.driver_type === 'ESCPOS_LAN') &&
      p.is_active !== 0 &&
      (String(p.station_type || '').toUpperCase().includes('KITCHEN') ||
        String(p.type || '').toLowerCase().includes('kitchen'))
    );
    if (hw) return hw;
    return all.find((p) => (p.driver_type === 'ESCPOS_USB' || p.driver_type === 'ESCPOS_LAN') && p.is_active !== 0) || preferred;
  }

  _loadOrder(orderId) {
    const hydrated = orderService.getOrderById(orderId);
    if (hydrated) return hydrated;
    const order = orderRepository.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);
    order.items = orderItemRepository.findItemsByOrderId(orderId);
    order.payments = orderPaymentRepository.findByOrderId(orderId);
    try {
      order.metadata = orderMetadataRepository.getAllMeta(orderId);
    } catch {
      order.metadata = {};
    }
    if (order.customer_id) {
      try {
        order.customer = customerRepository.findById(order.customer_id);
      } catch {
        order.customer = null;
      }
    }
    order.is_vip = order.metadata?.is_vip === 'true' || order.metadata?.is_vip === true || String(order.metadata?.is_vip) === '1' || order.customer?.is_vip === 1 || order.customer?.is_vip === true;
    return order;
  }
}

export const printService = new PrintService();
