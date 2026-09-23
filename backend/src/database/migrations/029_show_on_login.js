export default {
  version: '029',
  name: 'show_on_login',
  up: (db) => {
    try {
      db.prepare('ALTER TABLE users ADD COLUMN show_on_login INTEGER NOT NULL DEFAULT 1').run();
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
    }
  },
  down: (db) => {
    try {
      db.prepare('ALTER TABLE users DROP COLUMN show_on_login').run();
    } catch (e) {
      console.warn('Could not drop show_on_login column:', e.message);
    }
  }
};
