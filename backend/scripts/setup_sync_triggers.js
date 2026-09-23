import config from '../src/config/index.js';
import { dbEngine } from '../src/database/sqlite.js';
import { installGuardedSyncTriggers } from '../src/sync/syncTriggers.js';

async function setupTriggers() {
  await dbEngine.connect(config.paths.database.file);

  const tables = [
    'categories', 'products', 'deals', 'customers', 'users', 'orders',
    'order_items', 'order_payments', 'dining_tables'
  ];

  console.log('Adding payload_version to tables...');
  for (const table of tables) {
    try {
      dbEngine.db.prepare(`ALTER TABLE ${table} ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1`).run();
      console.log(`Added payload_version to ${table}`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.error(`Error adding payload_version to ${table}:`, e.message);
      }
    }
  }

  try {
    dbEngine.db.prepare(`ALTER TABLE sync_queue ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1`).run();
  } catch(e) {}

  try {
    dbEngine.db.prepare(`ALTER TABLE sync_queue ADD COLUMN metadata TEXT`).run();
  } catch(e) {}

  console.log('Setting up guarded sync triggers...');
  installGuardedSyncTriggers();
  console.log('Triggers setup complete!');
}

setupTriggers().catch(console.error);
