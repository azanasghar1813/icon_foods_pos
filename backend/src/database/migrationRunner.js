import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbEngine } from './sqlite.js';
import { coreSchema } from './schema/core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Ensures the internal tracking table exists.
   */
  _ensureMigrationTable() {
    dbEngine.run(coreSchema);
  }

  /**
   * Retrieves all migration files from the filesystem, sorted natively.
   * @returns {string[]} Array of filenames
   */
  _getAvailableMigrations() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }
    const files = fs.readdirSync(this.migrationsDir);
    return files
      .filter(file => file.endsWith('.js'))
      .sort(); // Sorting ensures 001 runs before 002
  }

  /**
   * Retrieves a list of version strings that have already been executed.
   * @returns {string[]}
   */
  _getExecutedMigrations() {
    const rows = dbEngine.all('SELECT version FROM schema_migrations ORDER BY version ASC');
    return rows.map(r => r.version);
  }

  /**
   * The core migration orchestrator.
   * Automatically detects and applies pending migrations safely.
   * @returns {Promise<Object>} Migration statistics
   */
  async runPendingMigrations() {
    this._ensureMigrationTable();

    const availableFiles = this._getAvailableMigrations();
    const executedVersions = this._getExecutedMigrations();
    
    const appliedList = [];
    
    for (const file of availableFiles) {
      // Dynamic import of the migration file
      const migrationPath = `file://${path.join(this.migrationsDir, file)}`;
      const { default: migration } = await import(migrationPath);
      
      if (!migration || !migration.version || !migration.name || !migration.up) {
        throw new Error(`MigrationRunner: Invalid migration file structure in ${file}`);
      }

      // Check if already executed
      if (executedVersions.includes(migration.version)) {
        continue; // Skip
      }

      console.log(`[Migration] Applying ${migration.version}_${migration.name}...`);
      
      try {
        // Execute the up() function inside an exclusive SQLite transaction
        // This ensures if a migration fails halfway (e.g. syntax error), nothing is saved to disk.
        
        const disableFks = migration.disableForeignKeys === true;
        if (disableFks) {
          dbEngine.run('PRAGMA foreign_keys=OFF;');
        }

        try {
          dbEngine.transaction(() => {
            migration.up(dbEngine.db);
            
            // Record successful execution
            dbEngine.run(
              'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
              migration.version,
              migration.name
            );
          });
        } finally {
          if (disableFks) {
            dbEngine.run('PRAGMA foreign_keys=ON;');
          }
        }
        
        appliedList.push(migration.version);
        console.log(`[Migration] ✅ Successfully applied ${migration.version}`);
      } catch (error) {
        console.error(`[Migration] ❌ FAILED to apply ${migration.version}_${migration.name}`);
        console.error(error.message);
        throw new Error(`Database Migration Failed on ${migration.version}. Startup aborted safely to prevent data corruption.`);
      }
    }

    return {
      totalExecuted: executedVersions.length,
      newlyApplied: appliedList.length,
      currentVersion: executedVersions.length > 0 ? executedVersions[executedVersions.length - 1] : 'None',
      newVersion: appliedList.length > 0 ? appliedList[appliedList.length - 1] : (executedVersions.length > 0 ? executedVersions[executedVersions.length - 1] : 'None'),
    };
  }
}

export const migrationRunner = new MigrationRunner();
