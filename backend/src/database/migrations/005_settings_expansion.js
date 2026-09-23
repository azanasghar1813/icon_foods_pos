export default {
  version: '005',
  name: 'settings_expansion',

  up: (db) => {
    db.exec(`
      ALTER TABLE application_settings ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL';
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 005_settings_expansion.');
  }
};
