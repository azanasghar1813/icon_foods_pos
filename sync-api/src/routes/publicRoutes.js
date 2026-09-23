import express from 'express';
import { getPublicMenu, submitOnlineOrder } from '../controllers/publicController.js';

import rateLimit from 'express-rate-limit';

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 order requests per `window` (here, per 10 minutes)
  message: { error: 'Too many orders created from this IP, please try again after 10 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const menuLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 menu requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/v1/public/menu
router.get('/menu', menuLimiter, getPublicMenu);

// POST /api/v1/public/order
router.post('/order', orderLimiter, submitOnlineOrder);

export default router;
