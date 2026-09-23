import { dbEngine } from '../database/sqlite.js';

class OrderRepository {
  create(orderData) {
    dbEngine.prepare(`
      INSERT INTO orders (
        id, order_number, business_date, branch_id, cashier_user_id, shift_id,
        customer_id, table_id, waiter_id, waiter_name_snapshot, rider_id, rider_name_snapshot, order_type, lifecycle_state, kitchen_state, payment_state, delivery_state,
        subtotal, tax_total, discount_total, tip_total, delivery_fee, service_charge, grand_total,
        paid_total, due_total, hold_name, held_at, notes, sync_status, sync_version, idempotency_key,
        created_at, updated_at
      ) VALUES (
        @id, @order_number, @business_date, @branch_id, @cashier_user_id, @shift_id,
        @customer_id, @table_id, @waiter_id, @waiter_name_snapshot, @rider_id, @rider_name_snapshot, @order_type, @lifecycle_state, @kitchen_state, @payment_state, @delivery_state,
        @subtotal, @tax_total, @discount_total, @tip_total, @delivery_fee, @service_charge, @grand_total,
        @paid_total, @due_total, @hold_name, @held_at, @notes, @sync_status, @sync_version, @idempotency_key,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run({
      id: orderData.id,
      order_number: orderData.order_number,
      business_date: orderData.business_date,
      branch_id: orderData.branch_id || 'DEFAULT_BRANCH',
      cashier_user_id: orderData.cashier_user_id,
      shift_id: orderData.shift_id,
      customer_id: orderData.customer_id || null,
      table_id: orderData.table_id || null,
      waiter_id: orderData.waiter_id || null,
      waiter_name_snapshot: orderData.waiter_name_snapshot || null,
      rider_id: orderData.rider_id || null,
      rider_name_snapshot: orderData.rider_name_snapshot || null,
      order_type: orderData.order_type || 'DINE_IN',
      lifecycle_state: orderData.lifecycle_state || 'DRAFT',
      kitchen_state: orderData.kitchen_state || 'PENDING',
      payment_state: orderData.payment_state || 'UNPAID',
      delivery_state: orderData.delivery_state || null,
      subtotal: orderData.subtotal || 0,
      tax_total: orderData.tax_total || 0,
      discount_total: orderData.discount_total || 0,
      tip_total: orderData.tip_total || 0,
      delivery_fee: orderData.delivery_fee || 0,
      service_charge: orderData.service_charge || 0,
      grand_total: orderData.grand_total || 0,
      paid_total: orderData.paid_total || 0,
      due_total: orderData.due_total || 0,
      hold_name: orderData.hold_name || null,
      held_at: orderData.held_at || null,
      notes: orderData.notes || null,
      sync_status: orderData.sync_status || 'PENDING',
      sync_version: orderData.sync_version || 1,
      idempotency_key: orderData.idempotency_key || null
    });

    return this.findById(orderData.id);
  }

  findById(id) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return order || null;
  }

  findByNumber(orderNumber) {
    const order = dbEngine.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    return order || null;
  }

  findDraftBySession(shiftId) {
    const order = dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE shift_id = ? AND lifecycle_state = 'DRAFT'
      ORDER BY created_at DESC LIMIT 1
    `).get(shiftId);
    return order || null;
  }

  update(id, updates) {
    const fields = [];
    const params = { id };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (fields.length > 0) {
      if (!params.updated_at) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
      }
      
      // CRITICAL FIX: Automatically bump sync_version on every local mutation
      // so the cloud sees this as a newer payload and conflict resolution works correctly.
      if (!params.sync_version) {
        fields.push('sync_version = sync_version + 1');
      }
      if (!params.payload_version) {
        try {
          const hasPv = dbEngine.prepare("PRAGMA table_info(orders)").all().some((c) => c.name === 'payload_version');
          if (hasPv) fields.push('payload_version = COALESCE(payload_version, 1) + 1');
        } catch { /* column may not exist */ }
      }

      dbEngine.prepare(`
        UPDATE orders 
        SET ${fields.join(', ')} 
        WHERE id = @id
      `).run(params);
    }

    return this.findById(id);
  }

  queryActive(branchId = 'DEFAULT_BRANCH') {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE branch_id = ? 
        AND lifecycle_state IN ('DRAFT', 'HELD', 'ACTIVE')
      ORDER BY updated_at DESC
    `).all(branchId);
  }

  queryHeld(shiftId = null) {
    let sql = "SELECT * FROM orders WHERE lifecycle_state = 'HELD'";
    const params = [];
    if (shiftId) {
      sql += ' AND shift_id = ?';
      params.push(shiftId);
    }
    sql += ' ORDER BY held_at DESC';
    return dbEngine.prepare(sql).all(...params);
  }

  queryByState(lifecycleState, limit = 100) {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE lifecycle_state = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(lifecycleState, limit);
  }

  queryByDateRange(startDate, endDate, branchId = 'DEFAULT_BRANCH') {
    return dbEngine.prepare(`
      SELECT * FROM orders 
      WHERE branch_id = ? 
        AND business_date >= ? 
        AND business_date <= ?
      ORDER BY created_at DESC
    `).all(branchId, startDate, endDate);
  }

  delete(id) {
    return dbEngine.transaction(() => {
      const run = (sql) => {
        try { dbEngine.prepare(sql).run(id); } catch { /* table may not exist */ }
      };
      run('DELETE FROM order_combo_components WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)');
      run('DELETE FROM order_item_modifiers WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)');
      run('DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)');
      run('DELETE FROM order_item_variants WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)');
      run('DELETE FROM order_items WHERE order_id = ?');
      run('DELETE FROM payment_receipts WHERE order_id = ?');
      run('DELETE FROM order_payments WHERE order_id = ?');
      run('DELETE FROM order_timeline WHERE order_id = ?');
      run('DELETE FROM order_metadata WHERE order_id = ?');
      run('DELETE FROM order_tags WHERE order_id = ?');
      run('DELETE FROM order_attachments WHERE order_id = ?');
      run('DELETE FROM order_audit_trail WHERE order_id = ?');
      run('DELETE FROM order_search_index WHERE order_id = ?');
      run('DELETE FROM order_search_fts WHERE order_id = ?');
      run('UPDATE reprint_log SET order_id = NULL WHERE order_id = ?');
      run('UPDATE print_jobs SET order_id = NULL WHERE order_id = ?');
      const res = dbEngine.prepare('DELETE FROM orders WHERE id = ?').run(id);
      return res.changes > 0;
    });
  }
}

export const orderRepository = new OrderRepository();
