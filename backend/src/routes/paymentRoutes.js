import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { paymentController } from '../controllers/paymentController.js';

const router = Router();

router.use(authenticate);

// ── Payment Method & Utility Routes ────────────────────────────────────────
// GET /api/payments/methods                  — Active payment method list for POS UI
router.get('/methods',              paymentController.getPaymentMethods);

// GET /api/payments/cash-buttons?amount=450  — Quick-cash button amounts
router.get('/cash-buttons',         paymentController.getCashQuickButtons);

// GET /api/payments/summary/daily?date=...   — Daily breakdown by payment method
router.get('/summary/daily',        paymentController.getDailySummary);

// GET /api/payments/recent?limit=20          — Recent payments dashboard feed
router.get('/recent',               paymentController.getRecentPayments);

// ── Order-Scoped Payment Routes ─────────────────────────────────────────────
// POST   /api/payments/order/:orderId        — Process a payment for an order
router.post('/order/:orderId',      paymentController.processPayment);
router.post('/order/:orderId/refund', paymentController.refundPayment);

// GET    /api/payments/order/:orderId        — Get all payments for an order
router.get('/order/:orderId',       paymentController.getOrderPayments);

// ── Single Payment Routes ───────────────────────────────────────────────────
// GET /api/payments/:paymentId               — Get single payment with receipt ref
router.get('/:paymentId',           paymentController.getPaymentById);

// GET /api/payments/:paymentId/receipt       — Get full receipt payload
router.get('/:paymentId/receipt',   paymentController.getReceipt);

export default router;
