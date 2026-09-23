import { printQueueService, PrintJobStatus } from './printQueueService.js';
import { printerManagerService } from './printerManagerService.js';
import { printerDriverService, PrinterStatus } from './printerDriverService.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';

/**
 * PrintEngineService — The Async Print Processor
 *
 * This is the central engine that consumes the print queue and sends
 * jobs to physical printers. It is COMPLETELY INDEPENDENT from the
 * Order Engine. Payment completion emits events; the Print Engine
 * consumes them asynchronously.
 *
 * Key design principles:
 *  1. Checkout never waits for this engine
 *  2. Printer failures NEVER affect order state
 *  3. All errors are contained and retried automatically
 *  4. The engine runs in a setInterval loop (every 2 seconds)
 *  5. Each processing cycle is fault-tolerant
 */
class PrintEngineService {
  constructor() {
    this._isRunning   = false;
    this._intervalId  = null;
    this._isProcessing = false;
    this._processIntervalMs = 2000; // Poll every 2 seconds
    this._maxJobsPerCycle   = 10;
  }

  /**
   * Start the background print processor.
   * Called once at server startup.
   */
  start() {
    if (this._isRunning) return;
    this._isRunning  = true;
    this._intervalId = setInterval(() => this._processCycle(), this._processIntervalMs);
    try { printQueueService.reclaimStuckProcessing(120); } catch { /* queue table may not exist yet */ }
    console.log('[PrintEngine] ✅ Background print processor started (interval: 2s)');
  }

  /**
   * Stop the processor (for graceful shutdown).
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._isRunning = false;
    console.log('[PrintEngine] Print processor stopped.');
  }

  /**
   * Process pending print jobs.
   * Safe to call manually (e.g. after payment). Idempotent — guards against
   * concurrent runs with _isProcessing flag.
   */
  async processPendingJobs() {
    await this._processCycle();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal processing cycle
  // ──────────────────────────────────────────────────────────────────────────

  async _processCycle() {
    if (this._isProcessing) return; // Prevent overlap
    this._isProcessing = true;

    try {
      try { printQueueService.reclaimStuckProcessing(120); } catch { /* ignore */ }
      const jobs = printQueueService.dequeuePending(this._maxJobsPerCycle);
      if (jobs.length === 0) return;

      console.log(`[PrintEngine] Processing ${jobs.length} pending job(s)`);

      // Process jobs sequentially (printers are serial devices)
      for (const job of jobs) {
        await this._processJob(job);
      }
    } catch (error) {
      console.error('[PrintEngine] Cycle error:', error.message);
    } finally {
      this._isProcessing = false;
    }
  }

  async _processJob(job) {
    const jobId = job.id;

    try {
      // Mark as processing (claim the job — prevents duplicate processing)
      printQueueService.markProcessing(jobId);

      // Parse payload if it's still a string
      let payload = job.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { /* use as-is */ }
      }
      const parsedJob = { ...job, payload };

      // Resolve target printer
      const printerId = job.printer_id || null;
      const printer = printerId
        ? printerManagerService.getPrinter(printerId)
        : printerManagerService.getDefaultPrinterForJobType(job.job_type);

      if (!printer) {
        // No printer available — mark failed for retry
        printQueueService.markFailed(jobId, 'No printer available for job type: ' + job.job_type);
        console.warn(`[PrintEngine] No printer for job ${jobId} (${job.job_type})`);
        return;
      }

      // Update printer status to PRINTING
      printerManagerService.updateStatus(printer.id, PrinterStatus.PRINTING, { jobId });

      // Execute the print job via the driver
      const result = await printerDriverService.executePrintJob(parsedJob, printer);

      if (result.success) {
        // ── Success path ──────────────────────────────────────────────────
        printQueueService.markCompleted(jobId);
        printerManagerService.updateStatus(printer.id, PrinterStatus.ONLINE, { jobId });

        console.log(`[PrintEngine] ✅ Job ${jobId} (${job.job_type}) completed in ${result.duration_ms}ms`);

        // Activity log
        activityLogService.logActivity(
          job.cashier_user_id || 'SYSTEM',
          this._getActivityAction(job.job_type, 'SUCCESS'),
          'PRINT',
          jobId,
          {
            job_type:     job.job_type,
            order_id:     job.order_id,
            order_number: job.order_number,
            printer:      printer.name,
            duration_ms:  result.duration_ms,
          }
        );


      } else {
        // ── Failure path ─────────────────────────────────────────────────
        printQueueService.markFailed(jobId, result.error || 'Print failed');
        printerManagerService.updateStatus(printer.id, PrinterStatus.ERROR, {
          error: result.error,
          jobId,
        });

        console.warn(`[PrintEngine] ❌ Job ${jobId} failed: ${result.error}`);

        // Activity log
        activityLogService.logActivity(
          job.cashier_user_id || 'SYSTEM',
          'PRINTER_FAILURE',
          'PRINT',
          jobId,
          {
            job_type:     job.job_type,
            order_id:     job.order_id,
            order_number: job.order_number,
            printer:      printer.name,
            error:        result.error,
          }
        );


      }
    } catch (error) {
      // Outer catch: protect the cycle from crashing on any single job
      console.error(`[PrintEngine] Unexpected error processing job ${jobId}:`, error.message);
      try {
        printQueueService.markFailed(jobId, 'Internal error: ' + error.message);
      } catch { /* noop */ }
    }
  }

  _getActivityAction(jobType, outcome) {
    const actionMap = {
      CUSTOMER_RECEIPT: outcome === 'SUCCESS' ? 'RECEIPT_PRINTED'        : 'RECEIPT_PRINT_FAILED',
      KITCHEN_TICKET:   outcome === 'SUCCESS' ? 'KITCHEN_TICKET_PRINTED' : 'KITCHEN_TICKET_FAILED',
      REPRINT_RECEIPT:  outcome === 'SUCCESS' ? 'RECEIPT_REPRINTED'      : 'REPRINT_FAILED',
      CASH_DRAWER:      outcome === 'SUCCESS' ? 'CASH_DRAWER_OPENED'     : 'CASH_DRAWER_FAILED',
    };
    return actionMap[jobType] || (outcome === 'SUCCESS' ? 'PRINT_JOB_COMPLETED' : 'PRINT_JOB_FAILED');
  }
}

export const printEngineService = new PrintEngineService();
