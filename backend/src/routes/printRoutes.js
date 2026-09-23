import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getQueue,
  getJobById,
  getJobsByOrder,
  getQueueStats,
  printReceipt,
  printKitchenTickets,
  reprintReceipt,
  openCashDrawer,
  cancelJob,
  clearQueue,
  getPrinterStatuses,
  getPrinterStatus,
  testPrinter,
  getStatusHistory,
  getReprintLog,
} from '../controllers/printController.js';

const router = Router();

router.use(authenticate);

// ─── Queue Monitoring ─────────────────────────────────────────────────────────
router.get('/queue',                     getQueue);
router.get('/queue/stats',               getQueueStats);
router.get('/queue/order/:orderId',      getJobsByOrder);
router.post('/queue/clear',              authorize('MANAGE_SETTINGS'), clearQueue);
router.get('/queue/:jobId',              getJobById);
router.delete('/queue/:jobId',           cancelJob);
router.post('/receipt/:orderId',         printReceipt);
router.post('/kitchen/:orderId',         printKitchenTickets);
router.get('/reprint-log/:orderId',      getReprintLog);

// ─── Reprint ──────────────────────────────────────────────────────────────────
router.post('/reprint/:jobId',           reprintReceipt);

// ─── Cash Drawer ──────────────────────────────────────────────────────────────
router.post('/cash-drawer',              openCashDrawer);

// ─── Printer Management ───────────────────────────────────────────────────────
router.get('/printers',                  getPrinterStatuses);
router.get('/printers/:printerId',       getPrinterStatus);
router.post('/printers/:printerId/test', testPrinter);
router.get('/printers/:printerId/history', getStatusHistory);

export default router;
