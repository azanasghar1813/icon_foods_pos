const Database = require('better-sqlite3');
const db = new Database('C:/Users/Azan/AppData/Roaming/Restaurant POS/storage/database/pos.db');

const SALE = `(
  o.deleted_at IS NULL
  AND (
    o.lifecycle_state = 'COMPLETED'
    OR (o.lifecycle_state = 'ACTIVE' AND UPPER(COALESCE(o.payment_state, '')) = 'PAID')
  )
)`;

function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const orders = db.prepare(`SELECT * FROM orders WHERE deleted_at IS NULL AND lifecycle_state NOT IN ('DRAFT','HELD')`).all();
let repaired = 0;
const updateItem = db.prepare(`UPDATE order_items SET subtotal = ?, tax_amount = 0, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
const updateOrder = db.prepare(`UPDATE orders SET subtotal = ?, tax_total = 0, discount_total = ?, delivery_fee = ?, service_charge = ?, grand_total = ?, paid_total = ?, due_total = ?, payment_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
const itemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`);
const addonStmt = db.prepare(`SELECT COALESCE(SUM(subtotal),0) s FROM order_item_addons WHERE order_item_id = ?`);
const paidStmt = db.prepare(`SELECT COALESCE(SUM(amount),0) paid FROM order_payments WHERE order_id = ? AND UPPER(COALESCE(status,'COMPLETED')) = 'COMPLETED'`);

const tx = db.transaction(() => {
  for (const order of orders) {
    const items = itemsStmt.all(order.id);
    let subtotal = 0;
    let lineDisc = 0;
    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const unit = Number(item.final_unit_price ?? item.base_unit_price) || 0;
      const addons = Number(addonStmt.get(item.id).s) || 0;
      const st = round(unit * qty + addons);
      const disc = Number(item.discount_amount) || 0;
      updateItem.run(st, round(Math.max(0, st - disc)), item.id);
      subtotal += st;
      lineDisc += disc;
    }
    subtotal = round(subtotal);
    const storedDisc = Number(order.discount_total);
    const discount = round(Number.isFinite(storedDisc) && storedDisc > 0 ? storedDisc : lineDisc);
    const type = String(order.order_type || '').toUpperCase().replace(/\s+/g, '_');
    const food = Math.max(0, subtotal - discount);
    const service = type === 'DINE_IN' ? Math.round(food * 0.07) : 0;
    const delivery = type === 'DELIVERY' ? round(Number(order.delivery_fee) || 0) : 0;
    const grand = round(Math.max(0, food + service + delivery + (Number(order.tip_total) || 0)));
    const paid = round(Number(paidStmt.get(order.id).paid) || 0);
    const due = round(Math.max(0, grand - paid));
    const payState = paid + 0.005 >= grand && grand > 0 ? 'PAID' : 'UNPAID';
    updateOrder.run(subtotal, discount, delivery, service, grand, paid, due, payState, order.id);
    repaired++;
  }
});
tx();
console.log('Repaired', repaired, 'orders');

const days = db.prepare(`SELECT DISTINCT business_date FROM orders WHERE deleted_at IS NULL ORDER BY 1 DESC`).all();
for (const { business_date: biz } of days) {
  const sale = db.prepare(`
    SELECT COUNT(*) c,
      ROUND(SUM(grand_total),2) gross,
      ROUND(SUM(subtotal - discount_total),2) net,
      ROUND(SUM(service_charge),2) svc,
      ROUND(SUM(delivery_fee),2) del,
      ROUND(SUM(discount_total),2) disc
    FROM orders o WHERE business_date = ? AND ${SALE}
  `).get(biz);
  const items = db.prepare(`
    SELECT ROUND(SUM(oi.subtotal),2) item_sub
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.business_date = ? AND ${SALE}
  `).get(biz);
  const recon = round((sale.net || 0) + (sale.svc || 0) + (sale.del || 0));
  console.log(JSON.stringify({
    biz,
    orders: sale.c,
    gross: sale.gross,
    net: sale.net,
    svc: sale.svc,
    del: sale.del,
    item_sub: items.item_sub,
    net_plus_charges: recon,
    gross_minus_recon: round((sale.gross || 0) - recon),
    items_minus_subtotal: round((items.item_sub || 0) - ((sale.net || 0) + (sale.disc || 0)))
  }));
}

db.close();
