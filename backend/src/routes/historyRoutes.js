import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getOrderList,
  getOrderDetail,
  getOrderByNumber,
  getTimeline,
  getAuditTrail,
  searchOrders,
  getSyncStatus,
  getStats,
  getCacheStats,
  invalidateOrder,
  wipeOutHistory,
} from '../controllers/historyController.js';

const router = Router();

// router.use(authenticate);

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats',                            getStats);
router.get('/cache/stats',                      getCacheStats);

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/search',                           searchOrders);

// ─── Order List ───────────────────────────────────────────────────────────────
router.get('/orders',                           getOrderList);

// ─── Order Detail ─────────────────────────────────────────────────────────────
router.get('/orders/by-number/:orderNumber',    getOrderByNumber);
router.get('/orders/:orderId',                  getOrderDetail);
router.get('/orders/:orderId/timeline',         getTimeline);
router.get('/orders/:orderId/audit',            getAuditTrail);
router.get('/orders/:orderId/sync-status',      getSyncStatus);

// ─── Cache Management ─────────────────────────────────────────────────────────
router.post('/orders/:orderId/invalidate-cache', invalidateOrder);

// ─── Data Management ──────────────────────────────────────────────────────────
router.post('/wipe-out', wipeOutHistory);

export default router;
