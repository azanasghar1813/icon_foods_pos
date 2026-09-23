export default {
  version: '044',
  name: 'order_number_unique',
  
  up: (db) => {
    db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_order_number_date 
      ON orders(business_date, order_number)
    `).run();
  },

  down: (db) => {
    db.prepare('DROP INDEX IF EXISTS unq_order_number_date').run();
  }
};
