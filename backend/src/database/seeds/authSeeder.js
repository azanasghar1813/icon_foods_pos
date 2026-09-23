import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Seeds Roles, Permissions, and the Super Admin account.
 * Uses INSERT OR IGNORE to guarantee idempotency.
 * 
 * @param {Object} db - The better-sqlite3 database instance
 * @returns {Object} Seeding statistics
 */
export const runAuthSeeder = (db) => {
  let inserted = 0;

  // 1. Roles
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)');
  
  const roles = [
    { id: crypto.randomUUID(), name: 'Super Admin', desc: 'Full system access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Admin', desc: 'Administrative access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Manager', desc: 'Store management', sys: 1 },
    { id: crypto.randomUUID(), name: 'Cashier', desc: 'Point of sale operations', sys: 1 },
    { id: crypto.randomUUID(), name: 'Kitchen', desc: 'Kitchen display access', sys: 1 },
    { id: crypto.randomUUID(), name: 'Waiter', desc: 'Table service operations', sys: 1 }
  ];

  for (const role of roles) {
    const res = insertRole.run(role.id, role.name, role.desc, role.sys);
    if (res.changes > 0) inserted++;
  }

  // 1.5. Permissions
  const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)');
  const permissions = [
    { id: crypto.randomUUID(), code: 'MANAGE_USERS', module: 'IAM', desc: 'Manage users' },
    { id: crypto.randomUUID(), code: 'MANAGE_ROLES', module: 'IAM', desc: 'Manage roles and permissions' },
    { id: crypto.randomUUID(), code: 'MANAGE_SETTINGS', module: 'CONFIG', desc: 'Manage system settings' },
    { id: crypto.randomUUID(), code: 'MANAGE_PRODUCTS', module: 'CATALOG', desc: 'Manage products and categories' }
  ];

  for (const perm of permissions) {
    const res = insertPermission.run(perm.id, perm.code, perm.module, perm.desc);
    if (res.changes > 0) inserted++;
  }

  // Link Permissions to Super Admin
  const superAdminRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Super Admin');
  const allPerms = db.prepare('SELECT id FROM permissions').all();
  
  if (superAdminRole && allPerms.length > 0) {
    const linkPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const perm of allPerms) {
      linkPerm.run(superAdminRole.id, perm.id);
    }
  }

  // 2. Super Admin User
  
  if (superAdminRole) {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, role_id, username, password_hash, first_name, last_name, pin_code, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const adminPin = String(process.env.DEFAULT_ADMIN_PIN || '1234');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const hashedPin = bcrypt.hashSync(adminPin, 10);

    const res = insertUser.run(
      crypto.randomUUID(),
      superAdminRole.id,
      'admin',
      hashedPassword,
      'Super',
      'Administrator',
      hashedPin,
      1
    );
    if (res.changes > 0) {
      inserted++;
      try {
        db.prepare('UPDATE users SET force_pin_change = 1 WHERE username = ?').run('admin');
      } catch { /* column may not exist on very old DBs */ }
    }
  }

  return { name: 'Auth', inserted };
};
