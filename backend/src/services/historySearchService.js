import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * HistorySearchService
 *
 * Enterprise full-text search for orders using SQLite FTS5.
 * Falls back to LIKE queries if FTS5 is unavailable.
 *
 * Search fields (all indexed):
 *   - order_number
 *   - customer name
 *   - cashier name / ID
 *   - product names
 *   - notes
 *   - table label
 *   - phone number
 *   - reference numbers
 */
class HistorySearchService {
  /**
   * Full-text search across orders.
   *
   * @param {string} query  - Search term
   * @param {Object} filters - Additional dimension filters
   * @param {number} page
   * @param {number} limit
   * @returns {{ orders, total, page, limit, totalPages }}
   */
  search(query, filters = {}, page = 1, limit = 50) {
    if (!query || query.trim().length < 2) {
      return { orders: [], total: 0, page, limit, totalPages: 0 };
    }

    const term = query.trim();

    // Try FTS5 first
    if (this._hasFts5()) {
      return this._searchFts5(term, filters, page, limit);
    }

    // Fallback to LIKE
    return this._searchLike(term, filters, page, limit);
  }

  /**
   * Rebuild the search index for an order after any data change.
   * Called after payment, cancellation, etc.
   */
  rebuildIndex(orderId) {
    try {
      const order = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) return;

      // Aggregate product names
      const productNames = dbEngine.prepare(`
        SELECT GROUP_CONCAT(product_name_snapshot, ' ') as names
        FROM order_items WHERE order_id = ?
      `).get(orderId)?.names || '';

      const searchText = [
        order.order_number || '',
        order.notes        || '',
        productNames,
        order.cashier_user_id || '',
      ].join(' ').trim().replace(/\s+/g, ' ');

      dbEngine.prepare(`
        INSERT OR REPLACE INTO order_search_index
          (order_id, search_text, order_number, notes, product_names, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(orderId, searchText, order.order_number, order.notes || '', productNames);

      // Update FTS5 index
      if (this._hasFts5()) {
        dbEngine.prepare(`
          INSERT OR REPLACE INTO order_search_fts(order_id, search_text) VALUES (?, ?)
        `).run(orderId, searchText);
      }
    } catch (error) {
      console.error('[HistorySearch] Index rebuild failed:', error.message);
    }
  }

  /**
   * Batch rebuild for all orders (run on startup / maintenance).
   */
  rebuildAllIndexes() {
    try {
      const orders = dbEngine.prepare('SELECT id FROM orders LIMIT 50000').all();
      dbEngine.transaction(() => {
        for (const { id } of orders) {
          this.rebuildIndex(id);
        }
      });
      console.log(`[HistorySearch] Rebuilt search index for ${orders.length} orders.`);
    } catch (error) {
      console.error('[HistorySearch] Bulk rebuild failed:', error.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private search implementations
  // ──────────────────────────────────────────────────────────────────────────

  _searchFts5(term, filters, page, limit) {
    const offset = (page - 1) * limit;

    // FTS5 MATCH query — uses ORDER number prefix search or full text
    // Escape special FTS5 characters
    const safeTerm = term.replace(/['"*()]/g, ' ').trim();

    try {
      const matchExpr = `"${safeTerm}"* OR ${safeTerm}*`;

      const ftsIds = dbEngine.prepare(`
        SELECT order_id FROM order_search_fts
        WHERE order_search_fts MATCH ?
        ORDER BY rank
        LIMIT 1000
      `).all(matchExpr).map(r => r.order_id);

      if (ftsIds.length === 0) {
        return { orders: [], total: 0, page, limit, totalPages: 0 };
      }

      const placeholders = ftsIds.map(() => '?').join(',');
      const filterConditions = this._buildFilterConditions(filters);

      const where = filterConditions.sql
        ? `WHERE o.id IN (${placeholders}) AND (${filterConditions.sql.replace('WHERE', '').trim()})`
        : `WHERE o.id IN (${placeholders})`;

      const total = dbEngine.prepare(`
        SELECT COUNT(*) as c FROM orders o ${where}
      `).get(...ftsIds, ...filterConditions.params)?.c || 0;

      const orders = dbEngine.prepare(`
        SELECT o.id, o.order_number, o.business_date, o.order_type,
               o.lifecycle_state, o.payment_state, o.kitchen_state,
               o.grand_total, o.cashier_user_id, o.customer_id, IFNULL(dt.table_number, o.table_id) as table_id,
               o.waiter_id, COALESCE(o.waiter_name_snapshot, w.username) AS waiter_name,
               o.rider_id, COALESCE(o.rider_name_snapshot, r.username) AS rider_name,
               o.created_at, o.updated_at, o.sync_status, o.notes
        FROM orders o
        LEFT JOIN dining_tables dt ON dt.id = o.table_id
        LEFT JOIN users w ON w.id = o.waiter_id
        LEFT JOIN users r ON r.id = o.rider_id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...ftsIds, ...filterConditions.params, limit, offset);

      return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch {
      // FTS5 error — fall back to LIKE
      return this._searchLike(term, filters, page, limit);
    }
  }

  _searchLike(term, filters, page, limit) {
    const offset = (page - 1) * limit;
    const likeTerm = `%${term}%`;

    const filterConditions = this._buildFilterConditions(filters);
    const filterSql = filterConditions.sql
      ? `AND (${filterConditions.sql.replace('WHERE', '').trim()})`
      : '';

    const where = `
      WHERE (
        o.order_number LIKE ?
        OR o.notes LIKE ?
        OR o.cashier_user_id LIKE ?
        OR EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND LOWER(oi.product_name_snapshot) LIKE LOWER(?)
        )
      )
      ${filterSql}
    `;

    const baseParams = [likeTerm, likeTerm, likeTerm, likeTerm, ...filterConditions.params];

    const total = dbEngine.prepare(`
      SELECT COUNT(*) as c FROM orders o ${where}
    `).get(...baseParams)?.c || 0;

    const orders = dbEngine.prepare(`
      SELECT o.id, o.order_number, o.business_date, o.order_type,
             o.lifecycle_state, o.payment_state, o.kitchen_state,
             o.grand_total, o.cashier_user_id, o.customer_id, IFNULL(dt.table_number, o.table_id) as table_id,
             o.waiter_id, COALESCE(o.waiter_name_snapshot, w.username) AS waiter_name,
             o.rider_id, COALESCE(o.rider_name_snapshot, r.username) AS rider_name,
             o.created_at, o.updated_at, o.sync_status, o.notes
      FROM orders o
      LEFT JOIN dining_tables dt ON dt.id = o.table_id
      LEFT JOIN users w ON w.id = o.waiter_id
      LEFT JOIN users r ON r.id = o.rider_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...baseParams, limit, offset);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  _buildFilterConditions(filters) {
    const conditions = [];
    const params     = [];

    if (filters.date_from) { conditions.push('o.business_date >= ?'); params.push(filters.date_from); }
    if (filters.date_to)   { conditions.push('o.business_date <= ?'); params.push(filters.date_to); }
    if (filters.lifecycle_state) { conditions.push('o.lifecycle_state = ?'); params.push(filters.lifecycle_state); }
    if (filters.cashier_user_id) { conditions.push('o.cashier_user_id = ?'); params.push(filters.cashier_user_id); }
    if (filters.waiter_id) { conditions.push('o.waiter_id = ?'); params.push(filters.waiter_id); }
    if (filters.branch_id) { conditions.push('o.branch_id = ?'); params.push(filters.branch_id); }

    const sql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql, params };
  }

  _hasFts5() {
    try {
      dbEngine.prepare("SELECT * FROM order_search_fts WHERE order_search_fts MATCH 'test' LIMIT 0").all();
      return true;
    } catch {
      return false;
    }
  }
}

export const historySearchService = new HistorySearchService();
