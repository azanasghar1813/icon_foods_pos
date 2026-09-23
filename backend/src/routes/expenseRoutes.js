import express from 'express';
import { expenseController } from '../controllers/expenseController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', expenseController.getAll);
router.get('/:id', expenseController.getById);

router.post('/', expenseController.create);
router.put('/:id', expenseController.update);
router.delete('/:id', expenseController.delete);

export default router;
