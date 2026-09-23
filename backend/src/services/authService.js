import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { cashierSessionRepository } from '../repositories/cashierSessionRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { activityLogService } from './activityLogService.js';
import { securityUtils } from '../utils/security.js';
import { dbEngine } from '../database/sqlite.js';

const buildUserPayload = (user, permissions) => {
  const role = roleRepository.findById(user.role_id);
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    name,
    roleId: user.role_id,
    role: role?.name || 'User',
    forcePinChange: user.force_pin_change === 1,
    permissions,
  };
};

export const authService = {
  /**
   * Orchestrates the login process securely.
   * Handles brute-force checks, PIN validation, session creation, and activity logging.
   */
  login: (username, pin, deviceInfo = 'Unknown Device') => {
    const user = userRepository.findByUsername(username);

    if (!user) {
      // Log generic failure (do not leak whether user exists)
      activityLogService.logActivity(null, 'LOGIN_FAILED', 'AUTH', null, { username, reason: 'Invalid credentials' });
      throw new Error('Invalid username or PIN');
    }

    if (user.is_active === 0) {
      activityLogService.logActivity(user.id, 'LOGIN_FAILED', 'AUTH', user.id, { reason: 'Inactive account' });
      throw new Error('This account is disabled. Contact an administrator.');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      activityLogService.logActivity(user.id, 'LOGIN_FAILED', 'AUTH', user.id, { reason: 'Locked' });
      throw new Error('Account is temporarily locked. Try again later.');
    }

    // 1. Verify PIN
    const isValid = securityUtils.verifyPin(pin, user.pin_code);

    if (!isValid) {
      userRepository.incrementFailedAttempts(user.id, user.failed_login_attempts || 0);
      activityLogService.logActivity(user.id, 'LOGIN_FAILED', 'AUTH', user.id, { reason: 'Invalid PIN' });
      throw new Error('Invalid username or PIN');
    }

    // 2. Login Successful - Transaction to create session
    let token = null;
    let userDetails = null;
    let cashierSessionId = null;

    dbEngine.transaction(() => {
      userRepository.resetFailedAttempts(user.id);
      userRepository.updateLastLogin(user.id);

      const tokenId = crypto.randomUUID();
      sessionRepository.createSession(user.id, tokenId, deviceInfo);

      const permissions = userRepository.getUserPermissions(user.role_id);
      const role = roleRepository.findById(user.role_id);
      const roleName = String(role?.name || '').trim().toLowerCase();
      if (roleName === 'super admin' || roleName === 'super administrator' || roleName === 'owner') {
        if (!permissions.includes('*')) {
          permissions.push('*');
        }
      }

      cashierSessionId = cashierSessionRepository.getOrCreateOpenSession(user.id, deviceInfo, 0);
      
      // Token payload
      const payload = {
        userId: user.id,
        roleId: user.role_id,
        permissions: permissions
      };

      token = securityUtils.generateToken(payload, tokenId);
      userDetails = buildUserPayload(user, permissions);
    });

    activityLogService.logActivity(user.id, 'LOGIN_SUCCESS', 'AUTH', user.id, { device: deviceInfo });
    
    return { token, user: userDetails, cashierSessionId };
  },

  /**
   * Securely revokes a session.
   */
  logout: (tokenId, userId) => {
    sessionRepository.revokeSession(tokenId);
    activityLogService.logActivity(userId, 'LOGOUT_SUCCESS', 'AUTH');
  },

  /**
   * Retrieves active users for the login dropdown.
   * Only returns non-sensitive fields.
   */
  getActiveUsersForLogin: () => {
    // Only return id, username, first_name for the login screen
    const users = userRepository.getAllActive();
    return users.map(u => ({
      id: u.id,
      username: u.username,
      firstName: u.first_name,
      lastName: u.last_name,
      role_name: u.role_name
    }));
  },

  verifyManagerPin: (pin) => {
    const trimmed = String(pin || '').trim();
    if (trimmed.length < 4) return false;

    const managers = dbEngine.prepare(`
      SELECT u.pin_code, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
        AND r.name IN ('Super Admin', 'Super Administrator', 'Admin', 'Manager', 'Owner')
    `).all();

    for (const manager of managers) {
      if (manager.pin_code && securityUtils.verifyPin(trimmed, manager.pin_code)) {
        return true;
      }
    }
    return false;
  }
};
