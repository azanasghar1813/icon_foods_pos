import config from './src/config/index.js';
import { dbEngine } from './src/database/sqlite.js';

const dbPath = config.paths.database.file;
console.log('Using DB Path:', dbPath);

dbEngine.connect(dbPath);
const res = dbEngine.prepare("DELETE FROM sync_queue WHERE entity_type IN ('ORDER', 'ORDER_ITEM', 'ORDER_PAYMENT')").run();
console.log('Cleaned sync queue:', res.changes);

process.exit(0);
