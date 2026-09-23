import express from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('VIEW_DASHBOARD'));

router.get('/summary', dashboardController.getSummary);
router.get('/operations', dashboardController.getOperations);
router.get('/revenue', dashboardController.getRevenue);
router.get('/popular', dashboardController.getPopular);
router.get('/activity', dashboardController.getActivity);

export default router;
