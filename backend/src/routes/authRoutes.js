import express from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/login', authLimiter, authController.login);
router.get('/users', authController.getUsers);
router.post('/verify-manager-pin', authenticate, authController.verifyManagerPin);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.get('/validate', authenticate, authController.getMe);

export default router;
