import express from 'express';
import { reportController } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('VIEW_REPORTS'));

router.get('/summary', reportController.getSummary);
router.get('/detailed-sales', reportController.getDetailedSales);
router.get('/recent-items', reportController.getRecentItems);
router.get('/trends', reportController.getTrends);
router.get('/product/:id', reportController.getProductDetails);

export default router;
