import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * Print Job Types — all supported print operations.
 * Adding a new type here is the only change needed to support new job kinds.
 */
export const PrintJobType = Object.freeze({
  CUSTOMER_RECEIPT:  'CUSTOMER_RECEIPT',
  KITCHEN_TICKET:    'KITCHEN_TICKET',
  BAR_TICKET:        'BAR_TICKET',
  DESSERT_TICKET:    'DESSERT_TICKET',
  REPRINT_RECEIPT:   'REPRINT_RECEIPT',
  REFUND_RECEIPT:    'REFUND_RECEIPT',      // Future
  CLOSING_REPORT:    'CLOSING_REPORT',
  X_REPORT:          'X_REPORT',
  Z_REPORT:          'Z_REPORT',
  CASH_DRAWER:       'CASH_DRAWER',
  TEST_PRINT:        'TEST_PRINT',
});

export const PrintJobStatus = Object.freeze({
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  CANCELLED:  'CANCELLED',
});

/**
 * PrintQueueService
 *
 * The single source of truth for all print jobs.
 * All print operations flow through this service.
 *
 * Key characteristics:
 * - Persistent: backed by SQLite, survives application restart
 * - Non-blocking: enqueueing is synchronous and fast (single INSERT)
 * - Auditable: every job is kept with its final status
 * - Independent: Order Engine never touches this directly
 */
class PrintQueueService {
  /**
   * Enqueue a new print job.
   * Returns immediately — actual printing happens asynchronously.
   *
   * @param {string} jobType   - PrintJobType constant
   * @param {string|null} printerId  - Target printer UUID (null = auto-route by job type)
   * @param {Object} payload   - Job-specific print data
   * @param {Object} options   - { orderId, orderNumber, cashierUserId, shiftId, branchId, priority, maxRetries }
   * @returns {string} - New print job UUID
   */
  enqueue(jobType, printerId, payload, options = {}) {
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(payload);

    dbEngine.prepare(`
      INSERT INTO print_jobs (
        id, printer_id, job_type, status, payload,
        order_id, order_number, cashier_user_id, shift_id, branch_id,
        retries, max_retries, priority, created_at
      ) VALUES (
        ?, ?, ?, 'PENDING', ?,
        ?, ?, ?, ?, ?,
        0, ?, ?, CURRENT_TIMESTAMP
      )
    `).run(
      id,
      printerId || null,
      jobType,
      payloadJson,
      options.orderId     || null,
      options.orderNumber || null,
      options.cashierUserId || null,
      options.shiftId     || null,
      options.branchId    || 'DEFAULT_BRANCH',
      options.maxRetries  ?? 5,
      options.priority    ?? 5
    );

    return id;
  }

  /**
   * Fetch pending jobs ready for processing.
   * Ordered by priority ASC (1=highest), then created_at ASC (FIFO within same priority).
   */
  dequeuePending(limit = 20) {
    return dbEngine.prepare(`
      SELECT * FROM print_jobs
      WHERE status = 'PENDING'
        AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Jobs left in PROCESSING after a crash never print again. Put them back.
   */
  reclaimStuckProcessing(maxAgeSeconds = 120) {
    const age = Math.max(Number(maxAgeSeconds) || 120, 15);
    return dbEngine.prepare(`
      UPDATE print_jobs
      SET status = 'PENDING',
          last_error = 'Reclaimed stuck PROCESSING job',
          next_retry_at = CURRENT_TIMESTAMP
      WHERE status = 'PROCESSING'
        AND (
          processing_at IS NULL
          OR datetime(processing_at) <= datetime('now', '-' || ? || ' seconds')
        )
    `).run(age).changes;
  }

  findActiveKitchenJobs(orderId, printerId = null) {
    if (printerId) {
      return dbEngine.prepare(`
        SELECT id, status FROM print_jobs
        WHERE order_id = ?
          AND job_type = 'KITCHEN_TICKET'
          AND printer_id = ?
          AND status IN ('PENDING', 'PROCESSING', 'COMPLETED')
        ORDER BY created_at DESC
      `).all(orderId, printerId);
    }
    return dbEngine.prepare(`
      SELECT id, status FROM print_jobs
      WHERE order_id = ?
        AND job_type = 'KITCHEN_TICKET'
        AND printer_id IS NULL
        AND status IN ('PENDING', 'PROCESSING', 'COMPLETED')
      ORDER BY created_at DESC
    `).all(orderId);
  }

  /**
   * Mark a job as currently being processed (prevents duplicate processing).
   */
  markProcessing(jobId) {
    dbEngine.prepare(`
      UPDATE print_jobs
      SET status = 'PROCESSING', processing_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'PENDING'
    `).run(jobId);
  }

  /**
   * Mark a job as successfully completed.
   */
  markCompleted(jobId) {
    dbEngine.prepare(`
      UPDATE print_jobs
      SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(jobId);
  }

  /**
   * Mark a job as failed. Increments retry counter and sets next retry time.
   * Exponential backoff: 1s, 2s, 4s, 8s, 16s
   */
  markFailed(jobId, errorMessage) {
    const job = this.findById(jobId);
    if (!job) return;

    const newRetries = (job.retries || 0) + 1;
    const maxRetries = job.max_retries || 5;

    if (newRetries >= maxRetries) {
      // Exhausted — mark permanently failed
      dbEngine.prepare(`
        UPDATE print_jobs
        SET status = 'FAILED', retries = ?, last_error = ?, next_retry_at = NULL
        WHERE id = ?
      `).run(newRetries, errorMessage, jobId);
    } else {
      // Schedule retry with exponential backoff
      const backoffSeconds = Math.pow(2, newRetries - 1); // 1, 2, 4, 8, 16
      dbEngine.prepare(`
        UPDATE print_jobs
        SET status = 'PENDING',
            retries = ?,
            last_error = ?,
            next_retry_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
        WHERE id = ?
      `).run(newRetries, errorMessage, backoffSeconds, jobId);
    }
  }

  /**
   * Cancel a job (only if still PENDING).
   */
  cancel(jobId) {
    dbEngine.prepare(`
      UPDATE print_jobs SET status = 'CANCELLED'
      WHERE id = ? AND status IN ('PENDING', 'FAILED')
    `).run(jobId);
  }

  findById(jobId) {
    const job = dbEngine.prepare('SELECT * FROM print_jobs WHERE id = ?').get(jobId);
    if (job?.payload) {
      try { job.payload = JSON.parse(job.payload); } catch { /* keep as string */ }
    }
    return job || null;
  }

  findByOrderId(orderId) {
    const jobs = dbEngine.prepare(`
      SELECT * FROM print_jobs WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);
    return jobs.map(j => {
      try { j.payload = JSON.parse(j.payload); } catch { /* noop */ }
      return j;
    });
  }

  /**
   * Paginated job list for monitoring UI.
   */
  list(filters = {}, page = 1, limit = 50) {
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.job_type) {
      conditions.push('job_type = ?');
      params.push(filters.job_type);
    }
    if (filters.order_id) {
      conditions.push('order_id = ?');
      params.push(filters.order_id);
    }
    if (filters.branch_id) {
      conditions.push('branch_id = ?');
      params.push(filters.branch_id);
    }
    if (filters.date_from) {
      conditions.push('created_at >= ?');
      params.push(filters.date_from);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const total = dbEngine.prepare(
      `SELECT COUNT(*) as count FROM print_jobs ${where}`
    ).get(...params)?.count || 0;

    const jobs = dbEngine.prepare(`
      SELECT id, printer_id, job_type, status, order_id, order_number,
             cashier_user_id, retries, max_retries, last_error, priority,
             created_at, processing_at, completed_at
      FROM print_jobs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const toIso = (value) => {
      if (!value) return value;
      const s = String(value).trim();
      if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return s;
      return s.replace(' ', 'T') + 'Z';
    };

    return {
      jobs: jobs.map((j) => ({
        ...j,
        created_at: toIso(j.created_at),
        processing_at: toIso(j.processing_at),
        completed_at: toIso(j.completed_at)
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  clearAll() {
    return dbEngine.prepare(`DELETE FROM print_jobs`).run().changes;
  }

  /**
   * Dashboard stats: count by status.
   */
  getStats(branchId = null) {
    const where = branchId ? 'WHERE branch_id = ?' : '';
    const params = branchId ? [branchId] : [];

    return dbEngine.prepare(`
      SELECT status, COUNT(*) as count
      FROM print_jobs
      ${where}
      GROUP BY status
    `).all(...params);
  }

  /**
   * Record a reprint in the audit log.
   */
  logReprint(printJobId, originalJobId, orderId, cashierUserId, reason, branchId) {
    // Count how many times this order has been reprinted
    const count = dbEngine.prepare(
      'SELECT COUNT(*) as c FROM reprint_log WHERE order_id = ?'
    ).get(orderId)?.c || 0;

    dbEngine.prepare(`
      INSERT INTO reprint_log
        (id, print_job_id, original_job_id, order_id, cashier_user_id, reprint_count, reason, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      printJobId,
      originalJobId || null,
      orderId || null,
      cashierUserId,
      count + 1,
      reason || null,
      branchId || 'DEFAULT_BRANCH'
    );

    return count + 1;
  }

  getReprintLog(orderId) {
    return dbEngine.prepare(`
      SELECT * FROM reprint_log WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);
  }
}

export const printQueueService = new PrintQueueService();
