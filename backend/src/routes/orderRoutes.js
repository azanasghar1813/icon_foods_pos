import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { orderController } from '../controllers/orderController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { 
  createOrderSchema, 
  addItemSchema, 
  updateQuantitySchema, 
  holdOrderSchema, 
  transitionStateSchema 
} from '../validation/orderValidation.js';

const router = Router();

router.use(authenticate);

router.get('/next-number', orderController.peekNextNumber);

// Draft operations
router.get('/draft', orderController.getDraft);
router.post('/draft/items', validate(addItemSchema), orderController.addItemToDraft);

// Create new order
router.post('/', validate(createOrderSchema), orderController.createOrder);

// Order by ID operations
router.get('/held', orderController.getHeldOrders);
router.get('/:orderId', orderController.getOrderDetails);
router.put('/:orderId/meta', orderController.updateOrderMeta);
router.post('/:orderId/items', validate(addItemSchema), orderController.addItemToOrder);
router.put('/:orderId/items/:itemId', validate(updateQuantitySchema), orderController.updateItemQuantity);
router.delete('/:orderId/items/:itemId', orderController.removeItemFromOrder);

// State & Hold operations
router.post('/draft/hold', validate(holdOrderSchema), orderController.holdOrder);
router.post('/resume/:orderId', orderController.resumeOrder);
router.post('/:orderId/transition', validate(transitionStateSchema), orderController.transitionState);

// Lock operations
router.post('/:orderId/lock', orderController.lockOrder);
router.post('/:orderId/unlock', orderController.unlockOrder);

router.post('/:orderId/discount', orderController.applyDiscount);

// Delete order
router.delete('/:orderId', orderController.deleteOrder);

export default router;
