import { dbEngine } from './sqlite.js';
import { runAuthSeeder } from './seeds/authSeeder.js';
import { runSettingsSeeder } from './seeds/settingsSeeder.js';
import { runStatusSeeder } from './seeds/statusSeeder.js';
import { runPaymentSeeder } from './seeds/paymentSeeder.js';
import { runCatalogSeeder } from './seeds/catalogSeeder.js';

class SeedOrchestrator {
  /**
   * Orchestrates all modular seeders inside a safe transaction.
   * Ensures idempotency and logs the injection results.
   */
  runAllSeeds() {
    console.log('[Seeder] Starting Initial System Initialization...');
    
    let seedStats = [];

    try {
      dbEngine.transaction(() => {
        // Execute all modules safely
        seedStats.push(runAuthSeeder(dbEngine.db));
        seedStats.push(runSettingsSeeder(dbEngine.db));
        seedStats.push(runStatusSeeder(dbEngine.db));
        seedStats.push(runPaymentSeeder(dbEngine.db));
        seedStats.push(runCatalogSeeder(dbEngine.db));
      });

      console.log('[Seeder] ✅ Initialization complete.');
      return seedStats;
    } catch (error) {
      console.error('[Seeder] ❌ FAILED to inject seed data.');
      console.error(error);
      throw new Error('System Initialization Failed. Database rolled back.');
    }
  }
}

export const seedOrchestrator = new SeedOrchestrator();
