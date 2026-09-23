import { authService } from '../services/authService.js';
import { z } from 'zod';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { zodFirstMessage } from '../utils/zodErrors.js';
import { userRepository } from '../repositories/userRepository.js';
import { cashierSessionRepository } from '../repositories/cashierSessionRepository.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  pin: z.string().min(4, 'PIN must be at least 4 digits'),
  deviceInfo: z.string().optional()
});

export const authController = {
  login: (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const { token, user, cashierSessionId } = authService.login(parsed.username, parsed.pin, parsed.deviceInfo);
      
      return sendSuccess(res, { token, user, cashierSessionId }, 'Login successful');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, 400, zodFirstMessage(error));
      }
      return sendError(res, 401, error.message);
    }
  },

  logout: (req, res) => {
    try {
      authService.logout(req.sessionId, req.user.userId);
      return sendSuccess(res, null, 'Logout successful');
    } catch (error) {
      return sendError(res, 500, 'Failed to logout');
    }
  },

  getMe: (req, res) => {
    try {
      const user = userRepository.findById(req.user.userId);
      if (!user) {
        return sendError(res, 404, 'User not found');
      }
      
      const permissions = userRepository.getUserPermissions(user.role_id);
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
      const openShift = cashierSessionRepository.findOpenSessionForUser(user.id);

      const userDetails = {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        name,
        roleId: user.role_id,
        role: user.role_name || 'User',
        forcePinChange: user.force_pin_change === 1,
        permissions,
        cashierSessionId: openShift?.id || null,
      };
      
      return sendSuccess(res, { user: userDetails }, 'User details fetched');
    } catch (error) {
      return sendError(res, 500, 'Failed to fetch user details');
    }
  },

  getUsers: (req, res) => {
    try {
      const users = authService.getActiveUsersForLogin();
      return sendSuccess(res, users, 'Users fetched successfully');
    } catch (error) {
      return sendError(res, 500, 'Failed to retrieve users');
    }
  },

  verifyManagerPin: (req, res) => {
    try {
      const pin = String(req.body?.pin || '');
      if (pin.length < 4) {
        return sendError(res, 400, 'PIN is required');
      }
      const ok = authService.verifyManagerPin(pin);
      if (!ok) {
        return sendError(res, 401, 'Invalid manager PIN');
      }
      return sendSuccess(res, { verified: true }, 'PIN verified');
    } catch (error) {
      return sendError(res, 500, 'Failed to verify PIN');
    }
  }
};
