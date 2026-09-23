import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';
import { dateUtils } from '../utils/dateUtils.js';

/**
 * HistoryRepository
 *
 * All read queries for order history. Optimized with indexes from migration 017.
 * Never writes order data — immutable reads only.
 *
 * Key rules:
 *  - Snapshots are used for display; catalog tables are NEVER joined
 *  - N+1 queries are avoided — all sub-entities loaded in bulk
 *  - Load order details only when requested (not during list queries)
 */
class HistoryRepository {
  /**
   * Paginated list of orders with lightweight columns only.
   * Detail columns (items, payments, etc.) are NOT loaded here.
   *
   * @param {string} whereSql   - WHERE clause from historyFilterService
   * @param {Array}  whereParams
   * @param {string} orderBySql
   * @param {number} page
   * @param {number} limit
   * @returns {{ orders, total, page, limit, totalPages }}
   */
  findPaginated(whereSql, whereParams, orderBySql, page, limit) {
    const offset = (page - 1) * limit;

    const countSql = `
      SELECT COUNT(*) as total
      FROM orders o
      ${whereSql}
    `;

    const listSql = `
      SELECT
        o.id,
        o.order_number,
        o.business_date,
        o.branch_id,
        COALESCE(u.username, o.cashier_user_id) AS cashier_user_id,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
          u.username,
          o.cashier_user_id
        ) AS cashier_name,
        o.shift_id,
        o.customer_id,
        IFNULL(dt.table_number, o.table_id) as table_id,
        o.waiter_id,
        COALESCE(
          o.waiter_name_snapshot,
          NULLIF(TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')), ''),
          w.username
        ) AS waiter_name,
        o.rider_id,
        COALESCE(
          o.rider_name_snapshot,
          NULLIF(TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')), ''),
          r.username
        ) AS rider_name,
        o.order_type,
        o.lifecycle_state,
        o.kitchen_state,
        o.payment_state,
        o.subtotal,
        o.tax_total,
        o.discount_total,
        o.grand_total,
        o.paid_total,
        o.due_total,
        o.sync_status,
        o.synced_at,
        o.notes,
        o.created_at,
        o.updated_at,
        o.completed_at,
        -- Aggregate item count (fast subquery, uses index)
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
        -- First payment method (for display badge)
        (
          SELECT op.payment_method
          FROM order_payments op
          WHERE op.order_id = o.id AND op.status = 'COMPLETED'
          ORDER BY op.created_at ASC LIMIT 1
        ) AS primary_payment_method,
        COALESCE(
          (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'customer_name'),
          (SELECT first_name || ' ' || COALESCE(last_name, '') FROM customers c WHERE c.id = o.customer_id)
        ) AS customer_name,
        COALESCE(
          (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'customer_phone'),
          (SELECT phone FROM customers c WHERE c.id = o.customer_id)
        ) AS customer_phone,
        COALESCE(
          (SELECT meta_value FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'customer_address'),
          (SELECT address FROM customers c WHERE c.id = o.customer_id)
        ) AS customer_address,
        COALESCE(
          (SELECT CASE WHEN LOWER(CAST(meta_value AS TEXT)) IN ('true', '1') THEN 1 ELSE 0 END
           FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'is_vip' LIMIT 1),
          (SELECT CASE WHEN is_vip IN (1, '1', 'true') THEN 1 ELSE 0 END FROM customers c WHERE c.id = o.customer_id),
          0
        ) AS is_vip,
        COALESCE(
          (SELECT CASE WHEN LOWER(CAST(meta_value AS TEXT)) IN ('true', '1') THEN 1 ELSE 0 END
           FROM order_metadata om WHERE om.order_id = o.id AND om.meta_key = 'receipt_paid_stamp' LIMIT 1),
          0
        ) AS receipt_paid_stamp,
        o.service_charge AS service_charge,
        o.delivery_fee AS delivery_charges,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM activity_logs al
          WHERE al.entity_id = o.id
            AND (
              al.action IN ('ITEM_REMOVED', 'QUANTITY_CHANGED')
              OR (al.action = 'ITEM_ADDED' AND al.created_at > datetime(o.created_at, '+5 seconds'))
            )
        ) AS is_edited
      FROM orders o
      LEFT JOIN dining_tables dt ON dt.id = o.table_id
      LEFT JOIN users u ON u.id = o.cashier_user_id
      LEFT JOIN users w ON w.id = o.waiter_id
      LEFT JOIN users r ON r.id = o.rider_id
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ? OFFSET ?
    `;

    const total   = dbEngine.prepare(countSql).get(...whereParams)?.total || 0;
    const orders  = dbEngine.prepare(listSql).all(...whereParams, limit, offset);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Full order detail — all sub-entities loaded from snapshot tables.
   * NEVER joins catalog tables. Everything comes from immutable snapshots.
   *
   * @param {string} orderId
   * @returns {Object|null}
   */
  findFullDetail(orderId) {
    const order = dbEngine.prepare(`
      SELECT o.*,
        COALESCE(u.username, o.cashier_user_id) AS cashier_user_id,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
          u.username,
          o.cashier_user_id
        ) AS cashier_name,
        IFNULL(dt.table_number, o.table_id) as table_id,
        o.waiter_id,
        COALESCE(
          o.waiter_name_snapshot,
          NULLIF(TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')), ''),
          w.username
        ) AS waiter_name,
        o.rider_id,
        COALESCE(
          o.rider_name_snapshot,
          NULLIF(TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')), ''),
          r.username
        ) AS rider_name,
        o.service_charge AS service_charge,
        o.delivery_fee AS delivery_charges
      FROM orders o 
      LEFT JOIN dining_tables dt ON dt.id = o.table_id
      LEFT JOIN users u ON u.id = o.cashier_user_id
      LEFT JOIN users w ON w.id = o.waiter_id
      LEFT JOIN users r ON r.id = o.rider_id
      WHERE o.id = ?
    `).get(orderId);
    if (!order) return null;

    // Load all items in one query, joining products and categories for category_name
    const items = dbEngine.prepare(`
      SELECT 
        oi.*,
        CASE 
          WHEN d.id IS NOT NULL THEN 'Deals'
          ELSE c.name 
        END AS category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN deals d ON d.id = oi.product_id
      WHERE oi.order_id = ? 
      ORDER BY oi.created_at ASC
    `).all(orderId);

    const itemIds = items.map(i => i.id);

    // Load all sub-entities in bulk (no N+1)
    let variants = [], modifiers = [], addons = [], comboComponents = [];

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      variants         = dbEngine.prepare(`SELECT * FROM order_item_variants WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      modifiers        = dbEngine.prepare(`SELECT * FROM order_item_modifiers WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      addons           = dbEngine.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})`).all(...itemIds);
      comboComponents  = dbEngine.prepare(`SELECT * FROM order_combo_components WHERE order_item_id IN (${placeholders})`).all(...itemIds);
    }

    // Group sub-entities by item_id
    const variantsByItem   = this._groupBy(variants,        'order_item_id');
    const modifiersByItem  = this._groupBy(modifiers,       'order_item_id');
    const addonsByItem     = this._groupBy(addons,          'order_item_id');
    const combosByItem     = this._groupBy(comboComponents, 'order_item_id');

    // Hydrate items
    order.items = items.map(item => {
      const variant = variantsByItem[item.id]?.[0] || null;
      return {
      ...item,
      variant,
      variants:          variantsByItem[item.id]       || [],
      variant_name:      variant?.variant_name_snapshot || null,
      modifiers:         modifiersByItem[item.id]      || [],
      addons:            addonsByItem[item.id]          || [],
      combo_components:  combosByItem[item.id]          || [],
    };
    });

    // Payments
    order.payments = dbEngine.prepare(`
      SELECT * FROM order_payments WHERE order_id = ? ORDER BY created_at ASC
    `).all(orderId);

    // Receipt info (without full payload for list performance)
    order.receipts = dbEngine.prepare(`
      SELECT id, receipt_number, generated_at, printed_at, print_count
      FROM payment_receipts WHERE order_id = ? ORDER BY generated_at ASC
    `).all(orderId);

    // Timeline
    order.timeline = dbEngine.prepare(`
      SELECT t.*, COALESCE(u.username, t.user_id) as user_id 
      FROM order_timeline t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.order_id = ? ORDER BY t.created_at ASC
    `).all(orderId);

    // Parse timeline metadata
    order.timeline = order.timeline.map(e => ({
      ...e,
      metadata: e.metadata ? this._tryParse(e.metadata) : null,
    }));

    // Metadata
    order.metadata = this._loadMetadata(orderId);

    if (order.customer_id) {
      try {
        const cust = dbEngine.prepare(
          'SELECT is_vip, first_name, last_name, phone, address FROM customers WHERE id = ?'
        ).get(order.customer_id);
        if (cust) {
          order.customer = cust;
          if (cust.is_vip === 1 || cust.is_vip === true) {
            if (order.metadata.is_vip !== 'false' && order.metadata.is_vip !== false) {
              order.metadata.is_vip = true;
            }
          }
        }
      } catch { /* best-effort VIP from saved customer */ }
    }

    const custName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ').trim();
    order.customer_name = order.metadata.customer_name || custName || order.customer_name || null;
    order.customer_phone = order.metadata.customer_phone || order.customer?.phone || order.customer_phone || null;
    order.customer_address = order.metadata.customer_address || order.customer?.address || order.customer_address || null;
    order.is_vip = order.metadata.is_vip === true || order.metadata.is_vip === 'true' || order.metadata.is_vip === 1 || order.customer?.is_vip === 1 || order.customer?.is_vip === true;

    // Audit trail (Combine order_audit_trail and activity_logs)
    const audits = dbEngine.prepare(`
      SELECT o.id, COALESCE(u.username, o.user_id) as user_id, o.action, o.old_value, o.new_value, o.reason, o.created_at 
      FROM order_audit_trail o LEFT JOIN users u ON u.id = o.user_id WHERE o.order_id = ?
    `).all(orderId);
    
    const activities = dbEngine.prepare(`
      SELECT al.id, COALESCE(u.username, al.user_id) as user_id, al.action, NULL as old_value, al.details as new_value, NULL as reason, al.created_at
      FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id WHERE al.entity_type = 'ORDER' AND al.entity_id = ?
    `).all(orderId);
    
    order.audit_trail = [...audits, ...activities].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Tags
    order.tags = dbEngine.prepare(`
      SELECT tag_name, tag_color FROM order_tags WHERE order_id = ?
    `).all(orderId);

    // Print jobs (without full payload)
    order.print_jobs = dbEngine.prepare(`
      SELECT id, job_type, status, order_number, retries, last_error, created_at, completed_at
      FROM print_jobs WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);

    // Reprint log
    order.reprint_log = dbEngine.prepare(`
      SELECT * FROM reprint_log WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);

    return order;
  }

  /**
   * Lightweight order lookup (for search result cards).
   */
  findLightweight(orderId) {
    const order = dbEngine.prepare(`
      SELECT o.id, o.order_number, o.business_date, o.order_type, o.lifecycle_state,
             o.payment_state, o.kitchen_state, o.grand_total,
             COALESCE(u.username, o.cashier_user_id) AS cashier_user_id,
             COALESCE(
               NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
               u.username,
               o.cashier_user_id
             ) AS cashier_name,
             o.customer_id, o.table_id, o.waiter_id,
             COALESCE(o.waiter_name_snapshot, NULLIF(TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')), ''), w.username) AS waiter_name,
             o.rider_id,
             COALESCE(o.rider_name_snapshot, NULLIF(TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')), ''), r.username) AS rider_name,
             o.created_at, o.updated_at, o.sync_status
      FROM orders o 
      LEFT JOIN users u ON u.id = o.cashier_user_id 
      LEFT JOIN users w ON w.id = o.waiter_id
      LEFT JOIN users r ON r.id = o.rider_id
      WHERE o.id = ?
    `).get(orderId);

    if (!order) return null;

    order.item_count = dbEngine.prepare(
      'SELECT COUNT(*) as c FROM order_items WHERE order_id = ?'
    ).get(orderId)?.c || 0;

    return order;
  }

  /**
   * Find by order number (unique index — O(1)).
   */
  findByOrderNumber(orderNumber) {
    const order = dbEngine.prepare(
      'SELECT * FROM orders WHERE order_number = ?'
    ).get(orderNumber);
    return order || null;
  }

  /**
   * Stats for history dashboard header.
   */
  getStats(filters = {}) {
    void filters;
    const today = dateUtils.getBusinessDate();

    return {
      today: dbEngine.prepare(`
        SELECT
          COUNT(*) as total_orders,
          SUM(CASE WHEN lifecycle_state = 'COMPLETED'
                OR (lifecycle_state = 'ACTIVE' AND UPPER(COALESCE(payment_state,'')) = 'PAID')
              THEN grand_total ELSE 0 END) as total_revenue,
          SUM(CASE WHEN lifecycle_state = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN lifecycle_state = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN UPPER(COALESCE(payment_state,'')) = 'PAID' THEN 1 ELSE 0 END) as paid
        FROM orders
        WHERE business_date = ?
      `).get(today),

      by_state: dbEngine.prepare(`
        SELECT lifecycle_state, COUNT(*) as count, SUM(grand_total) as total
        FROM orders
        WHERE business_date = ?
        GROUP BY lifecycle_state
      `).all(today),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  _groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  _loadMetadata(orderId) {
    const rows = dbEngine.prepare(
      'SELECT meta_key, meta_value FROM order_metadata WHERE order_id = ?'
    ).all(orderId);

    return rows.reduce((acc, row) => {
      acc[row.meta_key] = this._tryParse(row.meta_value);
      return acc;
    }, {});
  }

  _tryParse(str) {
    try { return JSON.parse(str); } catch { return str; }
  }
}

export const historyRepository = new HistoryRepository();
