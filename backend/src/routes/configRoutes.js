import express from 'express';
import { configController } from '../controllers/configController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

// router.use(authenticate);

// Global unified config (can be fetched by any authenticated user for UI rendering)
router.get('/', configController.getAllConfig);

// All mutation endpoints require MANAGE_SETTINGS
// router.use(authorize('MANAGE_SETTINGS'));

// Key-Value Settings
router.put('/business/:category', configController.updateBusinessCategory);
router.put('/application/:category', configController.updateApplicationCategory);

// Printers
router.get('/printers/discover', configController.discoverPrinters);
router.get('/printers', configController.getPrinters);
router.post('/printers', configController.createPrinter);
router.put('/printers/:id', configController.updatePrinter);
router.delete('/printers/:id', configController.deletePrinter);

// Payment Methods
router.get('/payments', configController.getPaymentMethods);
router.post('/payments', configController.createPaymentMethod);
router.put('/payments/:code', configController.updatePaymentMethod);
router.delete('/payments/:code', configController.deletePaymentMethod);

export default router;
