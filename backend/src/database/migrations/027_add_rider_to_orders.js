import crypto from 'crypto';

export default {
  version: '027',
  name: 'add_rider_to_orders',
  up: (db) => {
    // Add rider_id
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN rider_id TEXT REFERENCES users(id) ON DELETE SET NULL`).run();
      console.log('Added rider_id to orders table.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration 27 error (rider_id):', e);
      }
    }

    // Add rider_name_snapshot
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN rider_name_snapshot TEXT`).run();
      console.log('Added rider_name_snapshot to orders table.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration 27 error (rider_name_snapshot):', e);
      }
    }

    // Add index
    try {
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id)`).run();
      console.log('Added index for rider_id.');
    } catch (e) {
      console.error('Migration 27 error (idx_orders_rider):', e);
    }
    
    // Seed Rider role if not exists
    try {
      const existingRider = db.prepare('SELECT id FROM roles WHERE name = ? COLLATE NOCASE').get('Rider');
      if (!existingRider) {
        db.prepare(`
          INSERT INTO roles (id, name, description, is_system)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), 'Rider', 'Delivery fleet rider', 1);
        console.log('Seeded Rider role.');
      }
    } catch (e) {
       console.error('Migration 27 error (seed rider role):', e);
    }
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN fully until recent versions, handled manually or left as is.
    console.log('Down migration for rider_id is not automatically supported.');
  }
};
