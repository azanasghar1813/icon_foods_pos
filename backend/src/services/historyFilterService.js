import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';

/**
 * HistoryFilterService
 *
 * Builds parameterized WHERE clauses for order history queries.
 * Every filter combination is handled here — the History Service
 * never constructs SQL directly.
 *
 * Supports:
 *   - Date ranges (today, yesterday, custom, business_day, shift)
 *   - State filters (lifecycle, payment, kitchen, order_type)
 *   - Entity filters (cashier, branch, customer, table)
 *   - Amount filters (min_amount, max_amount)
 *   - Payment method filter
 *   - Product/modifier presence filter (subquery-based)
 */
class HistoryFilterService {
  /**
   * Build a complete WHERE clause from a filters object.
   *
   * @param {Object} filters
   * @returns {{ sql: string, params: Array }}
   */
  buildQuery(filters = {}) {
    const conditions = [];
    const params     = [];

    // ── Date Filters ──────────────────────────────────────────────────────
    if (filters.date_preset) {
      const dateCondition = this._resolveDatePreset(filters.date_preset, filters);
      if (dateCondition) {
        conditions.push(dateCondition.sql);
        params.push(...dateCondition.params);
      }
    } else {
      if (filters.date_from) {
        conditions.push('o.business_date >= ?');
        params.push(filters.date_from);
      }
      if (filters.date_to) {
        conditions.push('o.business_date <= ?');
        params.push(filters.date_to);
      }
    }

    // ── State Filters ─────────────────────────────────────────────────────
    if (filters.lifecycle_state) {
      const states = Array.isArray(filters.lifecycle_state)
        ? filters.lifecycle_state
        : [filters.lifecycle_state];
      conditions.push(`o.lifecycle_state IN (${states.map(() => '?').join(',')})`);
      params.push(...states);
    }

    if (filters.payment_state) {
      const states = Array.isArray(filters.payment_state)
        ? filters.payment_state
        : [filters.payment_state];
      conditions.push(`o.payment_state IN (${states.map(() => '?').join(',')})`);
      params.push(...states);
    }

    if (filters.kitchen_state) {
      const states = Array.isArray(filters.kitchen_state)
        ? filters.kitchen_state
        : [filters.kitchen_state];
      conditions.push(`o.kitchen_state IN (${states.map(() => '?').join(',')})`);
      params.push(...states);
    }

    if (filters.order_type) {
      conditions.push('o.order_type = ?');
      params.push(filters.order_type.toUpperCase());
    }

    // ── Entity Filters ────────────────────────────────────────────────────
    if (filters.cashier_user_id) {
      conditions.push('o.cashier_user_id = ?');
      params.push(filters.cashier_user_id);
    }

    if (filters.waiter_id) {
      conditions.push('o.waiter_id = ?');
      params.push(filters.waiter_id);
    }
    if (filters.rider_id) {
      conditions.push('o.rider_id = ?');
      params.push(filters.rider_id);
    }

    if (filters.branch_id) {
      conditions.push('o.branch_id = ?');
      params.push(filters.branch_id);
    }

    if (filters.customer_id) {
      conditions.push('o.customer_id = ?');
      params.push(filters.customer_id);
    }

    if (filters.table_id) {
      conditions.push('o.table_id = ?');
      params.push(filters.table_id);
    }

    if (filters.shift_id) {
      conditions.push('o.shift_id = ?');
      params.push(filters.shift_id);
    }

    // ── Amount Filters ────────────────────────────────────────────────────
    if (filters.min_amount !== undefined && filters.min_amount !== null) {
      conditions.push('o.grand_total >= ?');
      params.push(Number(filters.min_amount));
    }

    if (filters.max_amount !== undefined && filters.max_amount !== null) {
      conditions.push('o.grand_total <= ?');
      params.push(Number(filters.max_amount));
    }

    // ── Payment Method Filter ─────────────────────────────────────────────
    if (filters.payment_method) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM order_payments op
          WHERE op.order_id = o.id
            AND op.payment_method = ?
            AND op.status = 'COMPLETED'
        )
      `);
      params.push(filters.payment_method.toUpperCase());
    }

    // ── Product / Item Filter (contains a specific product) ───────────────
    if (filters.product_id) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.product_id = ?
        )
      `);
      params.push(filters.product_id);
    }

    if (filters.product_name) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id
            AND LOWER(oi.product_name_snapshot) LIKE LOWER(?)
        )
      `);
      params.push(`%${filters.product_name}%`);
    }

    // ── Modifier Filter ───────────────────────────────────────────────────
    if (filters.modifier_id) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM order_item_modifiers oim
          JOIN order_items oi ON oim.order_item_id = oi.id
          WHERE oi.order_id = o.id AND oim.modifier_id = ?
        )
      `);
      params.push(filters.modifier_id);
    }

    // ── Sync Status Filter ────────────────────────────────────────────────
    if (filters.sync_status) {
      conditions.push('o.sync_status = ?');
      params.push(filters.sync_status.toUpperCase());
    }

    const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql, params };
  }

  _resolveDatePreset(preset, filters) {
    const today = dateUtils.getBusinessDate();

    switch (preset.toUpperCase()) {
      case 'TODAY':
        return { sql: 'o.business_date = ?', params: [today] };

      case 'YESTERDAY': {
        const yesterday = dateUtils.getYesterdayBusinessDate();
        return { sql: 'o.business_date = ?', params: [yesterday] };
      }

      case 'LAST_7_DAYS': {
        const weekAgo = dateUtils.addBusinessDays(today, -6);
        return { sql: 'o.business_date BETWEEN ? AND ?', params: [weekAgo, today] };
      }

      case 'LAST_30_DAYS': {
        const monthAgo = dateUtils.addBusinessDays(today, -29);
        return { sql: 'o.business_date BETWEEN ? AND ?', params: [monthAgo, today] };
      }

      case 'THIS_WEEK': {
        return { sql: 'o.business_date BETWEEN ? AND ?', params: [dateUtils.getBusinessWeekStart(), today] };
      }

      case 'THIS_MONTH':
      case 'MONTHLY': {
        const monthStart = dateUtils.getBusinessMonthStart();
        return { sql: 'o.business_date BETWEEN ? AND ?', params: [monthStart, today] };
      }

      case 'ALL_TIME': {
        return { sql: 'o.business_date >= ?', params: ['1970-01-01'] };
      }
      
      case 'CUSTOM_DATE': {
        if (filters.date_from && filters.date_to) {
          return { sql: 'o.business_date BETWEEN ? AND ?', params: [filters.date_from, filters.date_to] };
        }
        return null;
      }

      case 'CURRENT_SHIFT':
        if (filters.shift_id) {
          return { sql: 'o.shift_id = ?', params: [filters.shift_id] };
        }
        return { sql: 'o.business_date = ?', params: [today] };

      case 'BUSINESS_DAY':
        if (filters.business_date) {
          return { sql: 'o.business_date = ?', params: [filters.business_date] };
        }
        return { sql: 'o.business_date = ?', params: [today] };

      default:
        return null;
    }
  }

  /**
   * Build ORDER BY clause from sort options.
   */
  buildOrderBy(sortBy = 'NEWEST') {
    const sortMap = {
      NEWEST:       'o.created_at DESC',
      OLDEST:       'o.created_at ASC',
      HIGHEST:      'o.grand_total DESC',
      LOWEST:       'o.grand_total ASC',
      ORDER_NUMBER: 'o.order_number DESC',
      UPDATED:      'o.updated_at DESC',
    };
    return sortMap[sortBy.toUpperCase()] || 'o.created_at DESC';
  }
}

export const historyFilterService = new HistoryFilterService();
