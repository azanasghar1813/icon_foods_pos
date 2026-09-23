import { historyRepository } from '../repositories/historyRepository.js';
import { historyFilterService } from './historyFilterService.js';
import { historySearchService } from './historySearchService.js';
import { historyCacheService } from './historyCacheService.js';
import { auditService } from './auditService.js';
import { syncStatusService } from './syncStatusService.js';
import { dbEngine } from '../database/sqlite.js';
import { kitchenQueueService } from './kitchenQueueService.js';
import { orderTotalsService } from './orderTotalsService.js';
import { orderCacheService } from './orderCacheService.js';

/**
 * OrderHistoryService — The Central History Orchestrator
 *
 * This is the ONLY service that other modules (reports, analytics, loyalty)
 * should use to access historical order data. Never query orders directly.
 *
 * Principles:
 *   - All data returned is snapshot-based (never re-reads current catalog)
 *   - Results are paginated for large datasets
 *   - Cache is used intelligently
 *   - Viewing history does NOT generate activity logs
 *   - Administrative actions (cancel, reprint) DO generate audit entries
 */
class OrderHistoryService {
  // ──────────────────────────────────────────────────────────────────────────
  // Primary Query: Order List
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Paginated order list with full filter support.
   *
   * @param {Object} filters   - All filter dimensions (see historyFilterService)
   * @param {Object} pagination - { page, limit, sortBy }
   * @returns {Object} - { orders, total, page, limit, totalPages }
   */
  getOrderList(filters = {}, pagination = {}) {
    const page   = Math.max(1, parseInt(pagination.page)  || 1);
    const limit  = Math.min(200, parseInt(pagination.limit) || 50);
    const sortBy = pagination.sortBy || 'NEWEST';

    // Check list cache
    const cacheKey = historyCacheService.buildListKey({ ...filters, sortBy }, page, limit);
    const cached   = historyCacheService.getList(cacheKey);
    if (cached) return cached;

    // Build filter SQL
    const { sql: whereSql, params: whereParams } = historyFilterService.buildQuery(filters);
    const orderBySql = historyFilterService.buildOrderBy(sortBy);

    const result = historyRepository.findPaginated(whereSql, whereParams, orderBySql, page, limit);

    // Cache the result
    historyCacheService.setList(cacheKey, result);

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Order Detail
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Full order detail — all sub-entities from snapshots.
   * Uses cache for repeat requests.
   *
   * @param {string} orderId
   * @returns {Object|null}
   */
  _foodSum(order) {
    return (order.items || []).reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }

  _headerMatchesLines(order) {
    const food = this._foodSum(order);
    const stored = Number(order.subtotal) || 0;
    if (!(order.items || []).length) return stored <= 0.009;
    return Math.abs(food - stored) <= 0.5;
  }

  getOrderDetail(orderId) {
    const cached = historyCacheService.getDetail(orderId);
    if (cached && this._headerMatchesLines(cached)) return cached;

    let order = historyRepository.findFullDetail(orderId);
    if (!order) return null;

    if (!this._headerMatchesLines(order)) {
      try {
        orderTotalsService.recalculate(orderId);
        orderCacheService.invalidate(orderId);
        historyCacheService.invalidateOrder(orderId);
        order = historyRepository.findFullDetail(orderId) || order;
      } catch (err) {
        console.warn('[history] repaired stale ticket totals failed:', err.message);
      }
    }

    historyCacheService.setDetail(orderId, order, order.business_date);
    return order;
  }

  /**
   * Find order by order number (exact match).
   */
  getByOrderNumber(orderNumber) {
    const order = historyRepository.findByOrderNumber(orderNumber);
    if (!order) return null;
    return this.getOrderDetail(order.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Timeline
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Chronological timeline of all events for an order.
   * Displayed as a visual timeline in the Order Detail panel.
   */
  getTimeline(orderId) {
    const detail = this.getOrderDetail(orderId);
    if (!detail) return null;

    return {
      order_id:     orderId,
      order_number: detail.order_number,
      events:       detail.timeline || [],
      total:        (detail.timeline || []).length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Audit Trail
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Audit trail for an order.
   * Viewing the audit trail by an admin generates its own audit entry.
   *
   * @param {string} orderId
   * @param {string} viewingUserId  - User requesting the audit trail
   * @param {Object} options        - { recordViewAudit }
   */
  getAuditTrail(orderId, viewingUserId = null, options = {}) {
    const order = historyRepository.findLightweight(orderId);
    if (!order) return null;

    const entries = auditService.getByOrderId(orderId);

    // Record that this audit was viewed (only for admin/manager use)
    if (options.recordViewAudit && viewingUserId) {
      auditService.recordAuditView(orderId, viewingUserId, order.branch_id || 'DEFAULT_BRANCH');
    }

    return {
      order_id:     orderId,
      order_number: order.order_number,
      entries,
      total:        entries.length,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Search
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Enterprise full-text search across orders.
   *
   * @param {string} query
   * @param {Object} filters  - Additional filter dimensions
   * @param {Object} pagination
   */
  search(query, filters = {}, pagination = {}) {
    const page  = Math.max(1, parseInt(pagination.page)  || 1);
    const limit = Math.min(100, parseInt(pagination.limit) || 50);

    return historySearchService.search(query, filters, page, limit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sync Status
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get sync status display data for an order.
   * Read-only — never triggers sync operations.
   */
  getSyncStatus(orderId) {
    return syncStatusService.getOrderSyncStatus(orderId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stats & Aggregates
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Aggregate statistics for the history dashboard header.
   */
  getStats(filters = {}) {
    return historyRepository.getStats(filters);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Management (for admin use)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Wipes out all order history completely.
   * Irreversible action.
   */
  wipeOutHistory() {
    const run = (sql) => {
      try { dbEngine.prepare(sql).run(); } catch { /* table may not exist */ }
    };
    dbEngine.transaction(() => {
      run('DELETE FROM order_combo_components');
      run('DELETE FROM order_item_modifiers');
      run('DELETE FROM order_item_addons');
      run('DELETE FROM order_item_variants');
      run('DELETE FROM order_items');
      run('DELETE FROM order_payments');
      run('DELETE FROM payment_receipts');
      run('DELETE FROM order_timeline');
      run('DELETE FROM order_metadata');
      run('DELETE FROM order_audit_trail');
      run('DELETE FROM reprint_log');
      run('DELETE FROM print_jobs');
      run('DELETE FROM print_queue');
      run('DELETE FROM orders');
      run('DELETE FROM order_number_sequences');
      run("DELETE FROM sqlite_sequence WHERE name='orders'");
      run("DELETE FROM sqlite_sequence WHERE name='order_number_sequences'");
      run("DELETE FROM activity_logs WHERE entity_type = 'ORDER'");
      run("DELETE FROM sync_queue WHERE entity_type IN ('ORDER', 'ORDER_ITEM', 'ORDER_PAYMENT', 'PAYMENT')");
    });
    historyCacheService.clearAll();
    try { kitchenQueueService.invalidate(); } catch { /* optional */ }
    console.log('[OrderHistoryService] All order history wiped out successfully.');
  }

  /**
   * Cleans up data older than specified months.
   * Runs automatically at startup to maintain 3-month retention.
   */
  cleanupOldData(months = 3) {
    import('../database/sqlite.js').then(({ dbEngine }) => {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      const cutoffString = cutoffDate.toISOString().slice(0, 10);

      dbEngine.transaction(() => {
        const deletedOrders = dbEngine.prepare('DELETE FROM orders WHERE business_date < ?').run(cutoffString);
        if (deletedOrders.changes > 0) {
          dbEngine.prepare('DELETE FROM order_number_sequences WHERE business_date < ?').run(cutoffString);
          console.log(`[OrderHistoryService] Cleaned up ${deletedOrders.changes} orders older than 3 months (${cutoffString}).`);
        }
      });
      historyCacheService.clearAll();
    });
  }

  getCacheStats() {
    return historyCacheService.getStats();
  }

  invalidateOrder(orderId) {
    historyCacheService.invalidateOrder(orderId);
    historySearchService.rebuildIndex(orderId);
  }
}

export const orderHistoryService = new OrderHistoryService();
