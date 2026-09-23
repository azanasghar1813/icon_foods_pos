import crypto from 'crypto';

export default {
  version: '037',
  name: 'customers_tables_permissions',

  up: (db) => {
    const screens = [
      { code: 'VIEW_CUSTOMERS', desc: 'Access Customers', module: 'SCREENS' },
      { code: 'VIEW_TABLES', desc: 'Access Tables', module: 'SCREENS' }
    ];

    const insertPerm = db.prepare(`
      INSERT INTO permissions (id, code, description, module)
      VALUES (?, ?, ?, ?)
    `);

    const newPermIds = [];
    for (const screen of screens) {
      const existing = db.prepare('SELECT id FROM permissions WHERE code = ?').get(screen.code);
      if (existing) {
        newPermIds.push(existing.id);
        continue;
      }
      const newId = crypto.randomUUID();
      insertPerm.run(newId, screen.code, screen.desc, screen.module);
      newPermIds.push(newId);
    }

    const insertRolePerm = db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      VALUES (?, ?)
    `);

    const adminRoles = db.prepare(`
      SELECT id FROM roles
      WHERE name IN ('Super Admin', 'Super Administrator', 'Admin', 'Owner')
    `).all();
    for (const role of adminRoles) {
      for (const permId of newPermIds) {
        insertRolePerm.run(role.id, permId);
      }
    }

    // Keep existing access: anyone who could open Customers/Tables via Dashboard still can until you uncheck.
    const dashboardRoles = db.prepare(`
      SELECT rp.role_id
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'VIEW_DASHBOARD'
    `).all();
    for (const role of dashboardRoles) {
      for (const permId of newPermIds) {
        insertRolePerm.run(role.role_id, permId);
      }
    }
  },

  down: (db) => {
    db.exec(`DELETE FROM permissions WHERE code IN ('VIEW_CUSTOMERS', 'VIEW_TABLES')`);
  }
};
