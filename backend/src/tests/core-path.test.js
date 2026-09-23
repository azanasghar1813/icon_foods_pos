import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-core-'));
process.env.JWT_SECRET = 'test-jwt-secret-16chars';
process.env.DEVICE_SECRET = 'test-device-secret-16';
process.env.NODE_ENV = 'test';
process.env.STORAGE_ROOT = tmpRoot;
process.env.DEFAULT_ADMIN_PIN = '582941';
process.env.PORT = '5099';
process.env.HOST = '127.0.0.1';

const { initDatabase } = await import('../database/initDatabase.js');
const { dbEngine } = await import('../database/sqlite.js');
const { authService } = await import('../services/authService.js');
const { backupService } = await import('../backup/backupService.js');
const { cartService } = await import('../services/cartService.js');
const { orderCreationService } = await import('../services/orderCreationService.js');
const { paymentService } = await import('../services/paymentService.js');
const { orderTotalsService } = await import('../services/orderTotalsService.js');
const { reportService } = await import('../services/reportService.js');
const { cashPaymentService } = await import('../services/cashPaymentService.js');
const { orderService } = await import('../services/orderService.js');
const { orderHistoryService } = await import('../services/orderHistoryService.js');

let sessionId;
let userId;

before(async () => {
  await initDatabase();
});

after(() => {
  try { dbEngine.close(); } catch {}
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
});

test('archiver ZipArchive named export can write a zip', async () => {
  const zipPath = path.join(tmpRoot, 'archiver-smoke.zip');
  const payload = path.join(tmpRoot, 'hello.txt');
  fs.writeFileSync(payload, 'ok');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 1 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(payload, { name: 'hello.txt' });
    archive.finalize();
  });
  assert.equal(fs.existsSync(zipPath), true);
  assert.ok(fs.statSync(zipPath).size > 0);
});

test('login succeeds with the default admin PIN', () => {
  const pin = process.env.DEFAULT_ADMIN_PIN || '1234';
  const result = authService.login('admin', pin, 'TEST');
  assert.ok(result.token);
  assert.equal(result.user.username, 'admin');
  assert.ok(result.cashierSessionId);
  sessionId = result.cashierSessionId;
  userId = result.user.id;
});

test('checkout then cash payment is idempotent', async () => {
  const category = dbEngine.prepare('SELECT id FROM categories LIMIT 1').get();
  assert.ok(category);
  const productId = crypto.randomUUID();
  dbEngine.prepare(`
    INSERT INTO products (id, category_id, product_code, name, display_name, short_name, price, cost, lifecycle_state, status, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'AVAILABLE', 'VISIBLE')
  `).run(productId, category.id, 'TEST-BURGER', 'Test Burger', 'Test Burger', 'Test Burger', 100, 40);

  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', {
    product_id: productId,
    quantity: 1
  });

  const checkoutKey = crypto.randomUUID();
  const order = await orderCreationService.checkoutCart(sessionId, userId, { order_type: 'TAKEAWAY' }, checkoutKey);
  assert.ok(order.id);
  assert.ok(order.order_number);

  const due = Number(order.due_total || order.grand_total || 100);
  const payKey = crypto.randomUUID();
  const first = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: due
  }, payKey);
  assert.ok(first.payment);

  const second = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: due
  }, payKey);
  assert.equal(second.payment.id, first.payment.id);
});

test('backup create writes a zip', async () => {
  const result = await backupService.createBackup('test');
  assert.ok(result.file);
  assert.equal(fs.existsSync(result.file), true);
  assert.ok(result.size > 0);
});

async function seedPricedProduct(price) {
  const category = dbEngine.prepare('SELECT id FROM categories LIMIT 1').get();
  assert.ok(category);
  const productId = crypto.randomUUID();
  dbEngine.prepare(`
    INSERT INTO products (id, category_id, product_code, name, display_name, short_name, price, cost, lifecycle_state, status, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'AVAILABLE', 'VISIBLE')
  `).run(productId, category.id, `TEST-${productId.slice(0, 8)}`, 'Sale Item', 'Sale Item', 'Sale Item', price, 1);
  return productId;
}

async function checkoutPriced({ price, orderType, discount = 0, delivery = 0 }) {
  const productId = await seedPricedProduct(price);
  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', {
    product_id: productId,
    quantity: 1
  });
  return orderCreationService.checkoutCart(sessionId, userId, {
    order_type: orderType,
    discount_total: discount,
    delivery_charges: delivery
  }, crypto.randomUUID());
}

function money(value) {
  return Number(Number(value).toFixed(2));
}

test('service charge: takeaway 0, dine-in 7% rounded to rupees', () => {
  assert.equal(orderTotalsService.computeServiceCharge(100, 'TAKEAWAY'), 0);
  assert.equal(orderTotalsService.computeServiceCharge(100, 'DELIVERY'), 0);
  assert.equal(orderTotalsService.computeServiceCharge(100, 'DINE_IN'), 7);
  assert.equal(orderTotalsService.computeServiceCharge(90, 'DINE_IN'), 6);
  assert.equal(orderTotalsService.computeServiceCharge(0, 'DINE_IN'), 0);
});

test('cash payment amount is due, not tendered', () => {
  const built = cashPaymentService.buildPaymentInput(200, 107);
  assert.equal(built.amount, 107);
  assert.equal(built.amount_received, 200);
  assert.equal(built.change_returned, 93);
});

test('takeaway 100 → grand 100, tax 0, service 0', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'TAKEAWAY' });
  assert.equal(money(order.subtotal), 100);
  assert.equal(money(order.tax_total), 0);
  assert.equal(money(order.service_charge), 0);
  assert.equal(money(order.grand_total), 100);
  assert.equal(money(order.due_total), 100);
});

test('dine-in 100 → service 7, grand 107', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'DINE_IN' });
  assert.equal(money(order.subtotal), 100);
  assert.equal(money(order.tax_total), 0);
  assert.equal(money(order.service_charge), 7);
  assert.equal(money(order.grand_total), 107);
});

test('dine-in 100 with discount 10 → service 6, grand 96', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'DINE_IN', discount: 10 });
  assert.equal(money(order.discount_total), 10);
  assert.equal(money(order.service_charge), 6);
  assert.equal(money(order.grand_total), 96);
});

test('delivery 100 + 40 fee → grand 140, no service', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'DELIVERY', delivery: 40 });
  assert.equal(money(order.service_charge), 0);
  assert.equal(money(order.delivery_fee), 40);
  assert.equal(money(order.grand_total), 140);
});

test('payment discount on dine-in recomputes 7% service', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'DINE_IN' });
  assert.equal(money(order.grand_total), 107);

  const paid = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 96,
    discount_total: 10
  }, crypto.randomUUID());

  const live = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  assert.equal(money(live.discount_total), 10);
  assert.equal(money(live.service_charge), 6);
  assert.equal(money(live.tax_total), 0);
  assert.equal(money(live.grand_total), 96);
  assert.equal(money(paid.payment.amount), 96);
  assert.equal(String(live.payment_state).toUpperCase(), 'PAID');
});

test('cash overpay records due as amount, not tendered', async () => {
  const order = await checkoutPriced({ price: 100, orderType: 'TAKEAWAY' });
  const paid = paymentService.processPayment(order.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 200
  }, crypto.randomUUID());
  assert.equal(money(paid.payment.amount), 100);
  assert.equal(money(paid.payment.amount_received), 200);
  assert.equal(money(paid.payment.change_returned), 100);
});

test('reports: food net + service + delivery = gross, AOV uses ticket total, cash = due', async () => {
  const before = await reportService.getSummary({ dateFilter: 'Today' });

  const dineIn = await checkoutPriced({ price: 100, orderType: 'DINE_IN', discount: 10 });
  paymentService.processPayment(dineIn.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 96
  }, crypto.randomUUID());

  const delivery = await checkoutPriced({ price: 100, orderType: 'DELIVERY', delivery: 40 });
  paymentService.processPayment(delivery.id, sessionId, userId, {
    payment_method: 'CASH',
    amount_received: 140
  }, crypto.randomUUID());

  const after = await reportService.getSummary({ dateFilter: 'Today' });
  const dNet = money(after.netSales - before.netSales);
  const dService = money(after.serviceCharges - before.serviceCharges);
  const dDelivery = money(after.deliveryCharges - before.deliveryCharges);
  const dGross = money(after.grossSales - before.grossSales);
  const dCash = money(after.cashSales - before.cashSales);
  const dOrders = (after.ordersCount || 0) - (before.ordersCount || 0);
  const dCat = money(after.totalCatSales - before.totalCatSales);

  assert.equal(dNet, 190);
  assert.equal(dService, 6);
  assert.equal(dDelivery, 40);
  assert.equal(dGross, 236);
  assert.equal(dCash, 236);
  assert.equal(dOrders, 2);
  assert.equal(dCat, 190);
  assert.equal(after.tax, 0);
  assert.ok(Math.abs((after.netSales + after.serviceCharges + after.deliveryCharges + (after.tips || 0)) - after.grossSales) < 0.05);
  assert.ok(after.ordersCount === 0 || Math.abs(after.averageOrderValue - after.grossSales / after.ordersCount) < 0.001);
});

test('editing a 3000 bill down to one 600 item rewrites subtotal and grand to 600', async () => {
  const p1 = await seedPricedProduct(600);
  const p2 = await seedPricedProduct(1200);
  const p3 = await seedPricedProduct(1200);
  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', { product_id: p1, quantity: 1 });
  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', { product_id: p2, quantity: 1 });
  cartService.addItem(sessionId, userId, 'DEFAULT_BRANCH', { product_id: p3, quantity: 1 });
  const order = await orderCreationService.checkoutCart(sessionId, userId, {
    order_type: 'TAKEAWAY'
  }, crypto.randomUUID());
  assert.equal(money(order.grand_total), 3000);
  assert.ok((order.items || []).length >= 3);

  const keep = (order.items || []).find((item) => money(item.subtotal) === 600 || money(item.final_unit_price) === 600);
  assert.ok(keep);
  for (const item of order.items) {
    if (item.id !== keep.id) {
      orderService.removeItem(order.id, item.id, userId);
    }
  }

  const live = dbEngine.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  const lines = dbEngine.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  assert.equal(lines.length, 1);
  assert.equal(money(live.subtotal), 600);
  assert.equal(money(live.tax_total), 0);
  assert.equal(money(live.service_charge), 0);
  assert.equal(money(live.grand_total), 600);
  assert.equal(money(live.due_total), 600);

  dbEngine.prepare(`
    UPDATE orders SET subtotal = 3000, grand_total = 3000, due_total = 3000 WHERE id = ?
  `).run(order.id);
  const repaired = orderHistoryService.getOrderDetail(order.id);
  assert.equal(money(repaired.subtotal), 600);
  assert.equal(money(repaired.grand_total), 600);
});

test('deleting an order removes the ticket and its lines', async () => {
  const order = await checkoutPriced({ price: 80, orderType: 'TAKEAWAY' });
  const result = orderService.deleteOrder(order.id, userId);
  assert.equal(result.success, true);
  const gone = dbEngine.prepare('SELECT id FROM orders WHERE id = ?').get(order.id);
  assert.equal(gone, undefined);
  const lines = dbEngine.prepare('SELECT id FROM order_items WHERE order_id = ?').all(order.id);
  assert.equal(lines.length, 0);
});
