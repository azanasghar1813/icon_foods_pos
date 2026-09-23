import { dbEngine } from '../database/sqlite.js';
import { syncService } from '../services/syncService.js';

export const settingsRepository = {
  getBusinessSettings: () => {
    const stmt = dbEngine.prepare('SELECT key, value, category FROM business_settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      if (!settings[row.category]) settings[row.category] = {};
      settings[row.category][row.key] = row.value;
    });
    return settings;
  },

  getApplicationSettings: () => {
    const stmt = dbEngine.prepare('SELECT key, value, category FROM application_settings');
    const rows = stmt.all();
    const settings = {};
    rows.forEach(row => {
      if (!settings[row.category]) settings[row.category] = {};
      settings[row.category][row.key] = row.value;
    });
    return settings;
  },

  updateBusinessSettings: (category, kvPairs) => {
    const stmt = dbEngine.prepare(`
      INSERT INTO business_settings (key, value, category) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value, 
      category = excluded.category, 
      updated_at = CURRENT_TIMESTAMP
    `);
    
    dbEngine.transaction(() => {
      for (const [key, value] of Object.entries(kvPairs)) {
        stmt.run(key, value, category);
        syncService.queueSyncEvent('SETTING', key, 'UPDATED', { category, context: 'business_settings' }, 1);
      }
    });
  },

  updateApplicationSettings: (category, kvPairs) => {
    const stmt = dbEngine.prepare(`
      INSERT INTO application_settings (key, value, category) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value, 
      category = excluded.category, 
      updated_at = CURRENT_TIMESTAMP
    `);
    
    dbEngine.transaction(() => {
      for (const [key, value] of Object.entries(kvPairs)) {
        stmt.run(key, value, category);
        syncService.queueSyncEvent('SETTING', key, 'UPDATED', { category, context: 'application_settings' }, 1);
      }
    });
  }
};
