import { Router } from 'express';
import { TableController } from '../controllers/tableController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Categories
router.get('/categories', authenticate, TableController.getCategories);
router.post('/categories', authenticate, TableController.createCategory);
router.put('/categories/:id', authenticate, TableController.updateCategory);
router.delete('/categories/:id', authenticate, TableController.deleteCategory);

// Tables
router.get('/', authenticate, TableController.getTables);
router.post('/', authenticate, TableController.createTable);
router.put('/:id', authenticate, TableController.updateTable);
router.delete('/:id', authenticate, TableController.deleteTable);

export default router;
