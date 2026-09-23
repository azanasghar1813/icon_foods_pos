import { lookupsSchema } from '../schema/lookups.js';

export default {
  version: '002',
  name: 'configurable_lookups',

  up: (db) => {
    // Execute lookup tables schema
    db.exec(lookupsSchema);
  },

  down: (db) => {
    console.warn('Manual rollback required for 002_configurable_lookups.');
  }
};
