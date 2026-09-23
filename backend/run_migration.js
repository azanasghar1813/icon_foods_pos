import { dbEngine } from './src/database/sqlite.js';
import migration from './src/database/migrations/013_deals_engine.js';
import path from 'path';

dbEngine.connect(path.resolve(process.cwd(), 'storage/database/pos.db'));

try {
  migration.up(dbEngine.db);
  console.log("Migration 013 executed successfully!");
} catch (e) {
  console.error("Migration failed:", e);
}
