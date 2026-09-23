/**
 * Seeds Default Payment Methods.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db 
 * @returns {Object} 
 */
export const runPaymentSeeder = (db) => {
  let inserted = 0;

  const insertPayment = db.prepare('INSERT OR IGNORE INTO payment_methods (code, name, is_active, display_order) VALUES (?, ?, ?, ?)');
  
  const paymentMethods = [
    { code: 'CASH', name: 'Cash', active: 1, order: 10 },
    { code: 'QR', name: 'QR', active: 1, order: 15 },
    { code: 'CARD', name: 'Card', active: 1, order: 20 },
    { code: 'JAZZCASH', name: 'JazzCash', active: 1, order: 30 },
    { code: 'EASYPAISA', name: 'EasyPaisa', active: 1, order: 40 },
    { code: 'MEEZAN', name: 'Meezan Bank', active: 1, order: 50 },
    { code: 'BANK_TRANSFER', name: 'Bank Transfer', active: 1, order: 60 }
  ];

  for (const pm of paymentMethods) {
    const res = insertPayment.run(pm.code, pm.name, pm.active, pm.order);
    if (res.changes > 0) inserted++;
  }
  try {
    db.prepare("INSERT OR IGNORE INTO payment_methods (code, name, is_active, display_order) VALUES ('QR', 'QR', 1, 15)").run();
  } catch { /* already present */ }

  return { name: 'Payment Methods', inserted };
};
