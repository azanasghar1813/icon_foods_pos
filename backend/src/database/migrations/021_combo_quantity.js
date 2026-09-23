export default {
  version: '021',
  name: 'combo_quantity',

  up: (db) => {
    // Add quantity column to order_combo_components
    try {
      db.exec(`
        ALTER TABLE order_combo_components 
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
      `);
      console.log('Successfully added quantity column to order_combo_components.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
      console.log('quantity column already exists in order_combo_components.');
    }
  },

  down: (db) => {
    console.warn('Manual rollback required for 013_combo_quantity.');
  }
};
