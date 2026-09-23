import crypto from 'crypto';

export default {
  version: '025',
  name: 'screen_permissions',

  up: (db) => {
    // 1. Insert new permissions for screens
    const screens = [
      { code: 'VIEW_DASHBOARD', desc: 'Access Dashboard', module: 'SCREENS' },
      { code: 'VIEW_POS', desc: 'Access POS', module: 'SCREENS' },
      { code: 'VIEW_ORDERS', desc: 'Access Orders', module: 'SCREENS' },
      { code: 'VIEW_REPORTS', desc: 'Access Reports', module: 'SCREENS' },
      { code: 'VIEW_KITCHEN', desc: 'Access Kitchen (KDS)', module: 'SCREENS' },
      { code: 'VIEW_PRODUCTS', desc: 'Access Products', module: 'SCREENS' },
      { code: 'VIEW_CATEGORIES', desc: 'Access Categories', module: 'SCREENS' },
      { code: 'VIEW_CASHIERS', desc: 'Access Cashiers', module: 'SCREENS' },
      { code: 'VIEW_SETTINGS', desc: 'Access Settings', module: 'SCREENS' },
      { code: 'VIEW_BACKUP', desc: 'Access Backup', module: 'SCREENS' },
      { code: 'VIEW_SYNC', desc: 'Access Sync', module: 'SCREENS' },
      { code: 'VIEW_USERS', desc: 'Access Users & Permissions', module: 'SCREENS' },
      { code: 'VIEW_ACTIVITY_LOGS', desc: 'Access Activity Logs', module: 'SCREENS' }
    ];

    const insertPerm = db.prepare(`
      INSERT INTO permissions (id, code, description, module) 
      VALUES (?, ?, ?, ?)
    `);

    const newPermIds = [];

    for (const screen of screens) {
      // Check if exists
      const existing = db.prepare(`SELECT id FROM permissions WHERE code = ?`).get(screen.code);
      if (!existing) {
        const newId = crypto.randomUUID();
        insertPerm.run(newId, screen.code, screen.desc, screen.module);
        newPermIds.push(newId);
      }
    }

    // 2. Assign these new permissions to the built-in Super Admin and Admin roles
    const roles = db.prepare(`SELECT id, name FROM roles WHERE name IN ('Super Admin', 'Admin', 'Owner')`).all();
    const insertRolePerm = db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id) 
      VALUES (?, ?)
    `);

    for (const role of roles) {
      for (const permId of newPermIds) {
        insertRolePerm.run(role.id, permId);
      }
    }
  },

  down: (db) => {
    // Delete the screen permissions
    db.exec(`DELETE FROM permissions WHERE module = 'SCREENS'`);
  }
};
