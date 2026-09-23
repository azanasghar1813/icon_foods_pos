import { dbEngine } from './sqlite.js';
import config from '../config/index.js';
import { migrationRunner } from './migrationRunner.js';
import { seedOrchestrator } from './seeder.js';

/**
 * Bootstraps the SQLite Database Engine.
 * Called exactly once during application startup.
 * 
 * @returns {Promise<Object>} Database connection metadata
 */
export const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    try {
      const dbPath = config.paths.database.file;
      
      // 1. Establish connection and apply PRAGMAs
      const db = dbEngine.connect(dbPath);
      
      // 2. Validate connection by querying sqlite_version
      const { version } = dbEngine.get('SELECT sqlite_version() as version');
      
      // 3. Verify Foreign Key support is active
      const { foreign_keys } = dbEngine.get('PRAGMA foreign_keys');
      
      // 4. Verify WAL mode is active
      const { journal_mode } = dbEngine.get('PRAGMA journal_mode');

      // 5. Automatically run migrations
      migrationRunner.runPendingMigrations().then(migrationStats => {
        // 6. Automatically inject missing default seed data
        const seedStats = seedOrchestrator.runAllSeeds();
        
        resolve({
          status: 'CONNECTED',
          path: dbPath,
          version: version,
          foreignKeysActive: foreign_keys === 1,
          journalMode: journal_mode.toUpperCase(),
          migrations: migrationStats,
          seeds: seedStats
        });
      }).catch(err => reject(err));
      
    } catch (error) {
      reject(error);
    }
  });
};
