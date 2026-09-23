import { authSchema } from '../schema/auth.js';
import { settingsSchema } from '../schema/settings.js';
import { catalogSchema } from '../schema/catalog.js';
import { operationsSchema } from '../schema/operations.js';
import { transactionsSchema } from '../schema/transactions.js';
import { systemSchema } from '../schema/system.js';

export default {
  version: '001',
  name: 'initial_schema',

  up: (db) => {
    // 1. Construct Core Tables
    db.exec(authSchema);
    db.exec(settingsSchema);
    db.exec(catalogSchema);
    db.exec(operationsSchema);
    db.exec(transactionsSchema);
    db.exec(systemSchema);
  },

  down: (db) => {
    // Left empty for safety in production. Rollbacks are manual.
    console.warn('Manual rollback required for 001_initial_schema.');
  }
};
