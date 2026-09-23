import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import configRoutes from './configRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import orderRoutes from './orderRoutes.js';
import cartRoutes from './cartRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import printRoutes from './printRoutes.js';
import historyRoutes from './historyRoutes.js';
import customerRoutes from './customerRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import reportRoutes from './reportRoutes.js';
import tableRoutes from './tableRoutes.js';

const router = Router();

// Mount all routes here
router.use('/health', healthRoutes);
router.use('/tables', tableRoutes);
router.use('/auth', authRoutes);
router.use('/config', configRoutes);
router.use('/catalog', catalogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);
router.use('/payments', paymentRoutes);
router.use('/print', printRoutes);
router.use('/history', historyRoutes);
router.use('/customers', customerRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', reportRoutes);

export default router;
