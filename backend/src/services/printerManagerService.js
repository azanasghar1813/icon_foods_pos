import { dbEngine } from '../database/sqlite.js';
import { printerDriverService, PrinterStatus } from './printerDriverService.js';
import crypto from 'crypto';

/**
 * PrinterManagerService
 *
 * Tracks real-time and historical printer status.
 * Never blocks the print queue — status updates are best-effort.
 */
class PrinterManagerService {
  constructor() {
    // In-memory status cache: printerId → { status, updated_at }
    this._statusCache = new Map();
  }

  /**
   * Get all printers with their current status.
   */
  getAllWithStatus() {
    const printers = dbEngine.prepare('SELECT * FROM printers ORDER BY created_at ASC').all();

    return printers.map(printer => {
      const cached = this._statusCache.get(printer.id);
      const latestLog = dbEngine.prepare(`
        SELECT status, error_detail, recorded_at
        FROM printer_status_log
        WHERE printer_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
      `).get(printer.id);

      return {
        ...printer,
        current_status:    cached?.status || latestLog?.status || printer.status || PrinterStatus.OFFLINE,
        status_updated_at: cached?.updated_at || latestLog?.recorded_at || null,
        last_error:        latestLog?.error_detail || null,
      };
    });
  }

  /**
   * Get a single printer with its status.
   */
  getWithStatus(printerId) {
    const printer = dbEngine.prepare('SELECT * FROM printers WHERE id = ?').get(printerId);
    if (!printer) return null;

    const cached = this._statusCache.get(printerId);
    const latestLog = dbEngine.prepare(`
      SELECT status, error_detail, recorded_at
      FROM printer_status_log
      WHERE printer_id = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `).get(printerId);

    return {
      ...printer,
      current_status:    cached?.status || latestLog?.status || printer.status || PrinterStatus.OFFLINE,
      status_updated_at: cached?.updated_at || latestLog?.recorded_at || null,
      last_error:        latestLog?.error_detail || null,
    };
  }

  /**
   * Update a printer's status and persist to log.
   */
  updateStatus(printerId, status, options = {}) {
    // Update in-memory cache
    this._statusCache.set(printerId, {
      status,
      updated_at: new Date().toISOString(),
    });

    // Update printers.status column
    try {
      dbEngine.prepare(`
        UPDATE printers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(status, printerId);
    } catch { /* non-critical */ }

    // Append to printer_status_log
    try {
      dbEngine.prepare(`
        INSERT INTO printer_status_log (id, printer_id, status, error_detail, job_id, recorded_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        crypto.randomUUID(),
        printerId,
        status,
        options.error || null,
        options.jobId || null
      );
    } catch { /* non-critical */ }
  }

  /**
   * Get the best available printer for a given job type.
   * Priority: exact match by station_type → first online printer → any printer.
   */
  getDefaultPrinterForJobType(jobType) {
    const stationTypeMap = {
      CUSTOMER_RECEIPT: ['RECEIPT', 'GENERAL'],
      REPRINT_RECEIPT:  ['RECEIPT', 'GENERAL'],
      KITCHEN_TICKET:   ['KITCHEN', 'RESTAURANT', 'FAST_FOOD', 'GENERAL'],
      BAR_TICKET:       ['BAR', 'DRINKS', 'GENERAL'],
      DESSERT_TICKET:   ['DESSERT', 'GENERAL'],
      X_REPORT:         ['RECEIPT', 'GENERAL'],
      Z_REPORT:         ['RECEIPT', 'GENERAL'],
      CLOSING_REPORT:   ['RECEIPT', 'GENERAL'],
      CASH_DRAWER:      ['RECEIPT', 'GENERAL'],
    };

    const preferred = stationTypeMap[jobType] || ['GENERAL'];

    for (const stationType of preferred) {
      const printer = dbEngine.prepare(`
        SELECT * FROM printers
        WHERE is_active = 1 AND station_type = ?
        ORDER BY created_at ASC LIMIT 1
      `).get(stationType);

      if (printer) return printer;
    }

    // Fallback: first active printer
    return dbEngine.prepare(
      'SELECT * FROM printers WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1'
    ).get() || null;
  }

  /**
   * Get printer by ID with validation.
   */
  getPrinter(printerId) {
    if (!printerId) return null;
    return dbEngine.prepare('SELECT * FROM printers WHERE id = ?').get(printerId) || null;
  }

  /**
   * Test a specific printer by sending a test job.
   */
  async testPrinter(printerId) {
    const printer = this.getPrinter(printerId);
    if (!printer) throw new Error(`Printer ${printerId} not found.`);

    const testJob = {
      id:          'TEST',
      job_type:    'TEST_PRINT',
      order_number: null,
      payload: {
        business: { name: 'TEST PRINT' },
        items: [{ product_name: 'Test Item', quantity: 1, total_amount: 0, modifiers: [], addons: [], combo_components: [] }],
        financials: { grand_total: 0, tax_total: 0, subtotal: 0, currency_symbol: 'AED', tax_rate: 0 },
        footer: { text: 'Printer Test OK', show_reprint_label: false, qr: null, barcode: null },
      },
    };

    this.updateStatus(printerId, PrinterStatus.PRINTING);
    const result = await printerDriverService.executePrintJob(testJob, printer);

    if (result.success) {
      this.updateStatus(printerId, PrinterStatus.ONLINE);
    } else {
      this.updateStatus(printerId, PrinterStatus.ERROR, { error: result.error });
    }

    return result;
  }

  /**
   * Minimal status history for the monitoring UI.
   */
  getStatusHistory(printerId, limit = 20) {
    return dbEngine.prepare(`
      SELECT * FROM printer_status_log
      WHERE printer_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `).all(printerId, limit);
  }

  /**
   * Clear in-memory cache (e.g. on server restart).
   */
  clearCache() {
    this._statusCache.clear();
  }
}

export const printerManagerService = new PrinterManagerService();
