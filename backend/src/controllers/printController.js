import { printService } from '../services/printService.js';
import { printerManagerService } from '../services/printerManagerService.js';
import { printQueueService } from '../services/printQueueService.js';

/**
 * PrintController
 *
 * Handles all print-related HTTP requests.
 * All print operations are async — the HTTP response is returned
 * immediately with a job ID; actual printing happens in the background.
 */

// ─── Queue ──────────────────────────────────────────────────────────────────

export const getQueue = (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const filters = {
      status:    req.query.status    || null,
      job_type:  req.query.job_type  || null,
      order_id:  req.query.order_id  || null,
      branch_id: req.query.branch_id || null,
      date_from: req.query.date_from || null,
    };

    // Remove null values
    Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

    const result = printService.getQueue(filters, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobById = (req, res) => {
  try {
    const job = printService.getJobById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Print job not found.' });
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getJobsByOrder = (req, res) => {
  try {
    const jobs = printService.getJobsByOrder(req.params.orderId);
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getQueueStats = (req, res) => {
  try {
    const stats = printService.getQueueStats(req.query.branch_id || null);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Print Operations ────────────────────────────────────────────────────────

export const printReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cashierUserId = req.body?.cashier_user_id || req.query.cashier_user_id || 'SYSTEM';

    const printPaid = req.body?.print_paid === true || req.query.print_paid === 'true';
    const result = await printService.printReceipt(orderId, cashierUserId, { printPaid });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const printKitchenTickets = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cashierUserId = req.body?.cashier_user_id || req.query.cashier_user_id || 'SYSTEM';

    const result = await printService.printKitchenTickets(orderId, cashierUserId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("KITCHEN PRINT ERROR:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const reprintReceipt = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { cashier_user_id, reason } = req.body || {};

    if (!cashier_user_id) {
      return res.status(400).json({ success: false, message: 'cashier_user_id is required for reprint.' });
    }

    const result = await printService.reprintReceipt(jobId, cashier_user_id, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const openCashDrawer = async (req, res) => {
  try {
    const cashierUserId = req.body?.cashier_user_id || 'SYSTEM';
    const result = await printService.openCashDrawer(cashierUserId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const cancelJob = (req, res) => {
  try {
    printQueueService.cancel(req.params.jobId);
    res.json({ success: true, message: 'Print job cancelled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearQueue = (req, res) => {
  try {
    const deleted = printQueueService.clearAll();
    res.json({ success: true, message: `Print queue cleared (${deleted} jobs removed).`, data: { deleted } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Printer Management ──────────────────────────────────────────────────────

export const getPrinterStatuses = (req, res) => {
  try {
    const printers = printerManagerService.getAllWithStatus();
    res.json({ success: true, data: printers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPrinterStatus = (req, res) => {
  try {
    const printer = printerManagerService.getWithStatus(req.params.printerId);
    if (!printer) return res.status(404).json({ success: false, message: 'Printer not found.' });
    res.json({ success: true, data: printer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testPrinter = async (req, res) => {
  try {
    const result = await printerManagerService.testPrinter(req.params.printerId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getStatusHistory = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = printerManagerService.getStatusHistory(req.params.printerId, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Reprint Log ─────────────────────────────────────────────────────────────

export const getReprintLog = (req, res) => {
  try {
    const log = printService.getReprintLog(req.params.orderId);
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
