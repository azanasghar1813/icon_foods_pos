export default {
  version: '034',
  name: 'order_delivery_state',
  up: (db) => {
    const hasColumn = (tableName, columnName) => {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
      return cols.includes(columnName);
    };

    if (!hasColumn('orders', 'delivery_state')) {
      db.exec(`ALTER TABLE orders ADD COLUMN delivery_state TEXT DEFAULT NULL;`);
    }
  },
  down: () => {}
};
