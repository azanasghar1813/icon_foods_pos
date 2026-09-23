import express from 'express';
import { inventoryController } from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);

router.get('/', inventoryController.getAll);
router.get('/logs', inventoryController.getLogs);
router.get('/:id', inventoryController.getById);

router.post('/', inventoryController.create);
router.put('/:id', inventoryController.update);
router.post('/:id/adjust', inventoryController.adjustStock);
router.delete('/:id', inventoryController.delete);

export default router;
