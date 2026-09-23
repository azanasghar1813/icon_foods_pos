import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { cartController } from '../controllers/cartController.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  addItemToCartSchema,
  updateCartItemSchema,
  setCartNotesSchema,
  setCartMetaSchema,
  checkoutCartSchema
} from '../validation/cartValidation.js';

const router = Router();

router.use(authenticate);

// ── Cart session ────────────────────────────────────────────────────────────
// GET  /api/cart           — Get current cart (creates empty if none exists)
router.get('/', cartController.getCart);

// DELETE /api/cart         — Clear all items from cart
router.delete('/', cartController.clearCart);

// ── Cart metadata ───────────────────────────────────────────────────────────
// PATCH /api/cart/notes    — Set order/kitchen notes
router.patch('/notes', validate(setCartNotesSchema), cartController.setNotes);

// PATCH /api/cart/meta     — Set order type, customer, table
router.patch('/meta', validate(setCartMetaSchema), cartController.setMeta);

// ── Cart items ──────────────────────────────────────────────────────────────
// POST   /api/cart/items                  — Add item (merges if identical)
router.post('/items', validate(addItemToCartSchema), cartController.addItem);

// PATCH  /api/cart/items/:cartItemId      — Update item details (notes/modifiers/add-ons)
router.patch('/items/:cartItemId', cartController.updateItemDetails);

// POST   /api/cart/items/:cartItemId/duplicate — Duplicate an item line
router.post('/items/:cartItemId/duplicate', cartController.duplicateItem);

// PUT    /api/cart/items/:cartItemId      — Update quantity (0 = remove)
router.put('/items/:cartItemId', validate(updateCartItemSchema), cartController.updateItemQuantity);

// DELETE /api/cart/items/:cartItemId     — Remove specific item
router.delete('/items/:cartItemId', cartController.removeItem);

// ── Checkout ────────────────────────────────────────────────────────────────
// POST /api/cart/checkout  — Convert cart into permanent Order Draft
router.post('/checkout', validate(checkoutCartSchema), cartController.checkout);

export default router;
