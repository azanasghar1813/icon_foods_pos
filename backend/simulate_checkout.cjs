const db = require('better-sqlite3')('./storage/database/pos.db');

try {
  db.transaction(() => {
    // 1. Order
    db.prepare(`
      INSERT INTO orders (
        id, order_number, business_date, branch_id, cashier_user_id, shift_id,
        order_type, lifecycle_state, kitchen_state, payment_state, delivery_state
      ) VALUES (
        'test-order-2', 'ORD-TEST-2', '2026-09-21', 'DEFAULT_BRANCH', 'SYSTEM_USER', 'SYSTEM_SHIFT',
        'DINE_IN', 'DRAFT', 'PENDING', 'UNPAID', null
      )
    `).run();

    // 2. Metadata
    db.prepare(`
      INSERT INTO order_metadata (id, order_id, meta_key, meta_value)
      VALUES ('meta-1', 'test-order-2', 'test', 'value')
    `).run();

    // 3. Order Item
    db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_name_snapshot,
        base_unit_price, final_unit_price, quantity, subtotal
      ) VALUES (
        'item-1', 'test-order-2', 'PROD-123', 'Pizza',
        10, 10, 1, 10
      )
    `).run();

    // 4. Variant (assuming it exists, let's omit first to see if item fails)
  })();
  console.log("Insert successful!");
} catch (e) {
  console.error("Insert failed:", e);
}
