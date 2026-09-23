import express from 'express';
import { customerController } from '../controllers/customerController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);

router.get('/', customerController.getAll);
router.get('/:id', customerController.getById);

// Optional: You could add authorize('MANAGE_CUSTOMERS') here, but let's just use authenticate for now
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.delete);
router.delete('/', customerController.deleteAll);

export default router;
