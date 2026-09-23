import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

/**
 * AuditService
 *
 * Records and retrieves structured audit entries for orders.
 * Separate from order_timeline (which is the operational state machine).
 * This captures compliance-grade audit: WHO changed WHAT with old/new values.
 *
 * Called when:
 *   - An order is reopened
 *   - An order is cancelled
 *   - A receipt is reprinted
 *   - An audit log is viewed by a manager (tracks who looked)
 *   - Any permission override occurs
 */
class AuditService {
  /**
   * Record an audit entry.
   *
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.userId
   * @param {string} params.action
   * @param {string} [params.entityType='ORDER']
   * @param {string} [params.entityId]
   * @param {*}      [params.oldValue]
   * @param {*}      [params.newValue]
   * @param {string} [params.reason]
   * @param {string} [params.branchId]
   * @param {boolean}[params.permissionOverride]
   * @param {string} [params.deviceId]
   * @param {string} [params.ipAddress]
   */
  record(params) {
    try {
      const {
        orderId,
        userId,
        action,
        entityType    = 'ORDER',
        entityId      = null,
        oldValue      = null,
        newValue      = null,
        reason        = null,
        branchId      = 'DEFAULT_BRANCH',
        permissionOverride = false,
        deviceId      = null,
        ipAddress     = null,
      } = params;

      dbEngine.prepare(`
        INSERT INTO order_audit_trail (
          id, order_id, user_id, action, entity_type, entity_id,
          old_value, new_value, reason, device_id, branch_id,
          permission_override, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        crypto.randomUUID(),
        orderId,
        userId        || null,
        action,
        entityType,
        entityId      || orderId,
        oldValue  !== null ? JSON.stringify(oldValue)  : null,
        newValue  !== null ? JSON.stringify(newValue)  : null,
        reason        || null,
        deviceId      || null,
        branchId,
        permissionOverride ? 1 : 0,
        ipAddress     || null
      );
    } catch (error) {
      // Never throw — audit failure must not affect business operations
      console.error('[AuditService] Failed to record audit entry:', error.message);
    }
  }

  /**
   * Get all audit entries for an order (newest first).
   */
  getByOrderId(orderId, limit = 200) {
    const rows = dbEngine.prepare(`
      SELECT * FROM order_audit_trail
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(orderId, limit);

    return rows.map(row => ({
      ...row,
      old_value: row.old_value ? this._tryParse(row.old_value) : null,
      new_value: row.new_value ? this._tryParse(row.new_value) : null,
      permission_override: !!row.permission_override,
    }));
  }

  /**
   * Get audit entries by user (admin view).
   */
  getByUserId(userId, { dateFrom, dateTo, limit = 100 } = {}) {
    let sql = 'SELECT * FROM order_audit_trail WHERE user_id = ?';
    const params = [userId];

    if (dateFrom) { sql += ' AND created_at >= ?'; params.push(dateFrom); }
    if (dateTo)   { sql += ' AND created_at <= ?'; params.push(dateTo);   }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return dbEngine.prepare(sql).all(...params).map(row => ({
      ...row,
      old_value: row.old_value ? this._tryParse(row.old_value) : null,
      new_value: row.new_value ? this._tryParse(row.new_value) : null,
    }));
  }

  /**
   * Get audit entries by action type (e.g. all REPRINT events).
   */
  getByAction(action, { dateFrom, dateTo, branchId, limit = 100 } = {}) {
    let sql = 'SELECT * FROM order_audit_trail WHERE action = ?';
    const params = [action];

    if (dateFrom) { sql += ' AND created_at >= ?'; params.push(dateFrom); }
    if (dateTo)   { sql += ' AND created_at <= ?'; params.push(dateTo);   }
    if (branchId) { sql += ' AND branch_id = ?';   params.push(branchId); }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return dbEngine.prepare(sql).all(...params);
  }

  /**
   * Common audit actions — pre-built for convenience.
   */
  recordOrderCancellation(orderId, userId, reason, oldState, branchId) {
    this.record({
      orderId, userId, branchId, reason,
      action:    'ORDER_CANCELLED',
      entityType: 'ORDER',
      oldValue:  { lifecycle_state: oldState },
      newValue:  { lifecycle_state: 'CANCELLED' },
    });
  }

  recordReprint(orderId, userId, reprintCount, reason, branchId) {
    this.record({
      orderId, userId, branchId, reason,
      action:    'REPRINT',
      entityType: 'RECEIPT',
      newValue:  { reprint_count: reprintCount },
    });
  }

  recordAuditView(orderId, userId, branchId) {
    this.record({
      orderId, userId, branchId,
      action:    'AUDIT_VIEWED',
      entityType: 'AUDIT',
    });
  }

  _tryParse(str) {
    try { return JSON.parse(str); } catch { return str; }
  }
}

export const auditService = new AuditService();
