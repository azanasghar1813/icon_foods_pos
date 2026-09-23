import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';
import { syncService } from './syncService.js';
import { orderCacheService } from './orderCacheService.js';
import { historyCacheService } from './historyCacheService.js';
import { releaseTableIfIdle } from '../controllers/tableController.js';

class OrderUpsertService {
  /**
   * Upserts a hydrated order broadcasted from a Terminal to the Hub.
   * 
   * @param {Object} order Hydrated order payload from Terminal
   */
  upsertHydratedOrder(order) {
    if (!order || !order.id || !order.order_number) {
      throw new Error('Invalid order payload.');
    }

    return dbEngine.transaction(() => {
      // Safely ensure foreign keys exist locally to prevent constraint failures
      const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
      const SYSTEM_SHIFT_ID = '00000000-0000-0000-0000-000000000001';

      const ensureId = (table, id, fallback) => {
        if (!id) return fallback === undefined ? null : fallback;
        const exists = dbEngine.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
        return exists ? id : (fallback === undefined ? null : fallback);
      };

      dbEngine.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, role, first_name, is_active, created_at, updated_at) VALUES (?, 'system', 'sys', 'ADMIN', 'System', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(SYSTEM_USER_ID);
      dbEngine.prepare(`INSERT OR IGNORE INTO cashier_sessions (id, user_id, terminal_id, status, opening_float, opened_at, created_at, updated_at) VALUES (?, ?, 'System Sync', 'CLOSED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(SYSTEM_SHIFT_ID, SYSTEM_USER_ID);

      const safeCashierUserId = ensureId('users', order.cashier_user_id, SYSTEM_USER_ID);
      const safeShiftId = ensureId('cashier_sessions', order.shift_id, SYSTEM_SHIFT_ID);
      const safeCustomerId = ensureId('customers', order.customer_id, null);
      const safeTableId = ensureId('dining_tables', order.table_id, null);

      // 1. Upsert Orders row
      const orderStmt = dbEngine.prepare(`
        INSERT INTO orders (
          id, order_number, business_date, branch_id, cashier_user_id, shift_id,
          customer_id, table_id, waiter_id, waiter_name_snapshot, rider_id, rider_name_snapshot,
          order_type, lifecycle_state, kitchen_state, payment_state, delivery_state,
          subtotal, tax_total, discount_total, tip_total, delivery_fee, service_charge, grand_total,
          paid_total, due_total, hold_name, held_at, notes, sync_status, sync_version, synced_to_hub, idempotency_key,
          created_at, updated_at
        ) VALUES (
          @id, @order_number, @business_date, @branch_id, @cashier_user_id, @shift_id,
          @customer_id, @table_id, @waiter_id, @waiter_name_snapshot, @rider_id, @rider_name_snapshot,
          @order_type, @lifecycle_state, @kitchen_state, @payment_state, @delivery_state,
          @subtotal, @tax_total, @discount_total, @tip_total, @delivery_fee, @service_charge, @grand_total,
          @paid_total, @due_total, @hold_name, @held_at, @notes, @sync_status, @sync_version, @synced_to_hub, @idempotency_key,
          COALESCE(@created_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          order_number = excluded.order_number,
          business_date = excluded.business_date,
          branch_id = excluded.branch_id,
          cashier_user_id = excluded.cashier_user_id,
          shift_id = excluded.shift_id,
          customer_id = excluded.customer_id,
          table_id = excluded.table_id,
          waiter_id = excluded.waiter_id,
          waiter_name_snapshot = excluded.waiter_name_snapshot,
          rider_id = excluded.rider_id,
          rider_name_snapshot = excluded.rider_name_snapshot,
          order_type = excluded.order_type,
          lifecycle_state = excluded.lifecycle_state,
          kitchen_state = excluded.kitchen_state,
          payment_state = excluded.payment_state,
          delivery_state = excluded.delivery_state,
          subtotal = excluded.subtotal,
          tax_total = excluded.tax_total,
          discount_total = excluded.discount_total,
          tip_total = excluded.tip_total,
          delivery_fee = excluded.delivery_fee,
          service_charge = excluded.service_charge,
          grand_total = excluded.grand_total,
          paid_total = excluded.paid_total,
          due_total = excluded.due_total,
          hold_name = excluded.hold_name,
          held_at = excluded.held_at,
          notes = excluded.notes,
          sync_version = excluded.sync_version,
          synced_to_hub = excluded.synced_to_hub,
          idempotency_key = excluded.idempotency_key,
          updated_at = CURRENT_TIMESTAMP
      `);

      const info = orderStmt.run({
        id: order.id,
        order_number: order.order_number,
        business_date: order.business_date,
        branch_id: order.branch_id || 'DEFAULT_BRANCH',
        cashier_user_id: safeCashierUserId,
        shift_id: safeShiftId,
        customer_id: safeCustomerId,
        table_id: safeTableId,
        waiter_id: order.waiter_id || null,
        waiter_name_snapshot: order.waiter_name_snapshot || null,
        rider_id: order.rider_id || null,
        rider_name_snapshot: order.rider_name_snapshot || null,
        order_type: order.order_type || 'DINE_IN',
        lifecycle_state: order.lifecycle_state || 'DRAFT',
        kitchen_state: order.kitchen_state || 'PENDING',
        payment_state: order.payment_state || 'UNPAID',
        delivery_state: order.delivery_state || null,
        subtotal: order.subtotal || 0,
        tax_total: order.tax_total || 0,
        discount_total: order.discount_total || 0,
        tip_total: order.tip_total || 0,
        delivery_fee: order.delivery_fee || 0,
        service_charge: order.service_charge || 0,
        grand_total: order.grand_total || 0,
        paid_total: order.paid_total || 0,
        due_total: order.due_total || 0,
        hold_name: order.hold_name || null,
        held_at: order.held_at || null,
        notes: order.notes || null,
        sync_status: 'PENDING',
        sync_version: order.sync_version || 1,
        synced_to_hub: order.synced_to_hub ?? 0,
        idempotency_key: order.idempotency_key || null,
        created_at: order.created_at || null
      });

      // 2. Upsert Order Items
      const incomingItemIds = new Set((order.items || []).map(i => i.id));
      
      // Delete local items not present in the payload ONLY if payload is not empty/stale? 
      // Actually, if we got here, we're applying the update.
      if (incomingItemIds.size > 0) {
        dbEngine.prepare(`
          DELETE FROM order_items 
          WHERE order_id = ? AND id NOT IN (${Array.from(incomingItemIds).map(() => '?').join(',')})
        `).run(order.id, ...Array.from(incomingItemIds));
      } else {
        dbEngine.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(order.id);
      }

      const itemStmt = dbEngine.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name_snapshot, quantity,
          base_unit_price, final_unit_price, subtotal, tax_amount, total_amount,
          notes, created_at, updated_at
        ) VALUES (
          @id, @order_id, @product_id, @product_name_snapshot, @quantity,
          @base_unit_price, @final_unit_price, @subtotal, @tax_amount, @total_amount,
          @notes, COALESCE(@created_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
          quantity = excluded.quantity,
          base_unit_price = excluded.base_unit_price,
          final_unit_price = excluded.final_unit_price,
          subtotal = excluded.subtotal,
          tax_amount = excluded.tax_amount,
          total_amount = excluded.total_amount,
          notes = excluded.notes,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const item of (order.items || [])) {
        itemStmt.run({
          id: item.id,
          order_id: order.id,
          product_id: item.product_id,
          product_name_snapshot: item.product_name_snapshot,
          quantity: item.quantity,
          base_unit_price: item.base_unit_price || 0,
          final_unit_price: item.final_unit_price || 0,
          subtotal: item.subtotal || 0,
          tax_amount: item.tax_amount || 0,
          total_amount: item.total_amount || 0,
          notes: item.notes || null,
          created_at: item.created_at || null
        });

        // Upsert nested variants
        dbEngine.prepare(`DELETE FROM order_item_variants WHERE order_item_id = ?`).run(item.id);
        const vStmt = dbEngine.prepare(`
          INSERT INTO order_item_variants (id, order_item_id, variant_id, variant_name_snapshot, variant_sku_snapshot, price_adjustment)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const v of (item.variants || [])) {
          vStmt.run(v.id, item.id, v.variant_id, v.variant_name_snapshot, v.variant_sku_snapshot || null, v.price_adjustment || 0);
        }

        // Upsert nested modifiers
        dbEngine.prepare(`DELETE FROM order_item_modifiers WHERE order_item_id = ?`).run(item.id);
        const mStmt = dbEngine.prepare(`
          INSERT INTO order_item_modifiers (id, order_item_id, modifier_id, group_id, group_name_snapshot, modifier_name_snapshot, price_adjustment, quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of (item.modifiers || [])) {
          mStmt.run(m.id, item.id, m.modifier_id, m.group_id || null, m.group_name_snapshot || null, m.modifier_name_snapshot, m.price_adjustment || 0, m.quantity || 1);
        }

        // Upsert nested addons
        dbEngine.prepare(`DELETE FROM order_item_addons WHERE order_item_id = ?`).run(item.id);
        const aStmt = dbEngine.prepare(`
          INSERT INTO order_item_addons (id, order_item_id, addon_id, addon_name_snapshot, unit_price, quantity, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of (item.addons || [])) {
          aStmt.run(a.id, item.id, a.addon_id, a.addon_name_snapshot, a.unit_price || 0, a.quantity || 1, a.subtotal || 0);
        }

        // Upsert nested combo_components
        dbEngine.prepare(`DELETE FROM order_combo_components WHERE order_item_id = ?`).run(item.id);
        const cStmt = dbEngine.prepare(`
          INSERT INTO order_combo_components (id, order_item_id, component_id, product_id, product_name_snapshot, variant_snapshot, price_adjustment, quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of (item.combo_components || [])) {
          cStmt.run(c.id, item.id, c.component_id, c.product_id, c.product_name_snapshot, c.variant_snapshot || null, c.price_adjustment || 0, c.quantity || 1);
        }
      }

      // 3. Upsert Order Payments
      const incomingPaymentIds = new Set((order.payments || []).map(p => p.id));
      if (incomingPaymentIds.size > 0) {
        dbEngine.prepare(`
          DELETE FROM order_payments 
          WHERE order_id = ? AND id NOT IN (${Array.from(incomingPaymentIds).map(() => '?').join(',')})
        `).run(order.id, ...Array.from(incomingPaymentIds));
      } else {
        dbEngine.prepare(`DELETE FROM order_payments WHERE order_id = ?`).run(order.id);
      }

      const paymentStmt = dbEngine.prepare(`
        INSERT INTO order_payments (
          id, order_id, shift_id, cashier_user_id, business_date,
          payment_method, payment_method_label, amount, amount_received, change_returned,
          transaction_reference, approval_code, notes, status, idempotency_key, created_at
        ) VALUES (
          @id, @order_id, @shift_id, @cashier_user_id, @business_date,
          @payment_method, @payment_method_label, @amount, @amount_received, @change_returned,
          @transaction_reference, @approval_code, @notes, @status, @idempotency_key, COALESCE(@created_at, CURRENT_TIMESTAMP)
        )
        ON CONFLICT(id) DO UPDATE SET
          amount = excluded.amount,
          amount_received = excluded.amount_received,
          change_returned = excluded.change_returned,
          status = excluded.status,
          notes = excluded.notes
      `);

      for (const pay of (order.payments || [])) {
        paymentStmt.run({
          id: pay.id,
          order_id: pay.order_id || order.id,
          shift_id: pay.shift_id,
          cashier_user_id: pay.cashier_user_id,
          business_date: pay.business_date,
          payment_method: pay.payment_method,
          payment_method_label: pay.payment_method_label,
          amount: pay.amount || 0,
          amount_received: pay.amount_received || 0,
          change_returned: pay.change_returned || 0,
          transaction_reference: pay.transaction_reference || null,
          approval_code: pay.approval_code || null,
          notes: pay.notes || null,
          status: pay.status || 'COMPLETED',
          idempotency_key: pay.idempotency_key || null,
          created_at: pay.created_at || null
        });
      }

      // 4. Update order metadata
      if (order.metadata) {
        for (const [key, value] of Object.entries(order.metadata)) {
          if (value !== undefined && value !== null) {
             dbEngine.prepare(`DELETE FROM order_metadata WHERE order_id = ? AND meta_key = ?`).run(order.id, key);
             dbEngine.prepare(`
                INSERT INTO order_metadata (id, order_id, meta_key, meta_value) 
                VALUES (?, ?, ?, ?)
             `).run(crypto.randomUUID(), order.id, key, String(value));
          }
        }
      }

      // Queue Sync Event so the Hub pushes this newly acquired data to Vercel
      syncService.queueSyncEvent('ORDER', order.id, 'ORDER_UPDATED', { lan_sync: true, order_number: order.order_number });

      // Cache invalidation
      orderCacheService.invalidate(order.id);
      try { historyCacheService.invalidateOrder(order.id); } catch { /* optional */ }

      if (order.lifecycle_state === 'COMPLETED') {
        try { releaseTableIfIdle(order.table_id); } catch { /* optional */ }
      }

      return { success: true, orderId: order.id };
    });
  }
}

export const orderUpsertService = new OrderUpsertService();
