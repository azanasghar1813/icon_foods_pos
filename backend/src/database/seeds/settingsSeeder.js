/**
 * Seeds Business, Application, and Receipt Settings.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db 
 * @returns {Object} 
 */
export const runSettingsSeeder = (db) => {
  let inserted = 0;

  const insertSetting = db.prepare('INSERT OR IGNORE INTO business_settings (key, value, category, description) VALUES (?, ?, ?, ?)');
  
  const defaultSettings = [
    // General
    { key: 'business_name', val: 'Icon Food', cat: 'GENERAL', desc: 'The official name of the business' },
    { key: 'business_address', val: 'Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)', cat: 'GENERAL', desc: 'Main physical address' },
    { key: 'phone_number', val: '0308-8020784, 0345-6420784', cat: 'GENERAL', desc: 'Main contact number' },
    { key: 'whatsapp_number', val: '0308-8020784, 0345-6420784', cat: 'GENERAL', desc: 'WhatsApp support number' },
    { key: 'email_address', val: 'contact@iconfood.com', cat: 'GENERAL', desc: 'Support email address' },
    { key: 'timezone', val: 'Asia/Karachi', cat: 'GENERAL', desc: 'Business timezone' },
    
    // Financial
    { key: 'currency_code', val: 'PKR', cat: 'FINANCIAL', desc: 'Default currency code' },
    { key: 'currency_symbol', val: 'Rs', cat: 'FINANCIAL', desc: 'Currency symbol' },
    { key: 'tax_rate_percent', val: '0', cat: 'FINANCIAL', desc: 'Default VAT rate' },
    { key: 'service_charge_percent', val: '7', cat: 'FINANCIAL', desc: 'Default Service Charge' },
    
    // Operations
    { key: 'business_day_start', val: '06:00', cat: 'OPERATIONS', desc: 'When the financial day resets' },
    
    // Receipt
    { key: 'receipt_footer_text', val: 'Thank you for dining with us!', cat: 'RECEIPT', desc: 'Text printed at the bottom of the receipt' },
    { key: 'receipt_show_qr', val: 'true', cat: 'RECEIPT', desc: 'Enable QR code printing' }
  ];

  for (const setting of defaultSettings) {
    const res = insertSetting.run(setting.key, setting.val, setting.cat, setting.desc);
    if (res.changes > 0) inserted++;
  }

  const forceSettings = [
    ['business_name', 'Icon Food'],
    ['business_address', 'Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)'],
    ['address', 'Opposite Akbar Plaza Near Waqas Nazir Printers Layyah Road,\nChowk Azam (Layyah)'],
    ['phone_number', '0308-8020784, 0345-6420784'],
    ['phone', '0308-8020784, 0345-6420784'],
    ['whatsapp_number', '0308-8020784, 0345-6420784'],
    ['timezone', 'Asia/Karachi'],
    ['currency_code', 'PKR'],
    ['currency_symbol', 'Rs'],
    ['tax_rate_percent', '0']
  ];
  const forceStmt = db.prepare('UPDATE business_settings SET value = ? WHERE key = ?');
  for (const [key, val] of forceSettings) {
    forceStmt.run(val, key);
  }

  // Insert default printers for UI kitchen selections
  const insertPrinter = db.prepare('INSERT OR IGNORE INTO printers (id, name, type, station_type) VALUES (?, ?, ?, ?)');
  const defaultPrinters = [
    { id: 'Fast Food', name: 'Fast Food Station', type: 'Fast Food', station: 'FAST_FOOD' },
    { id: 'Restaurant', name: 'Restaurant Station', type: 'Restaurant', station: 'RESTAURANT' },
    { id: 'Drinks', name: 'Drinks Station', type: 'Receipt', station: 'RECEIPT' },
    { id: 'Main Kitchen', name: 'Main Kitchen Station', type: 'Kitchen', station: 'KITCHEN' }
  ];

  for (const printer of defaultPrinters) {
    const res = insertPrinter.run(printer.id, printer.name, printer.type, printer.station);
    if (res.changes > 0) inserted++;
  }

  return { name: 'Settings/Printers', inserted };
};
