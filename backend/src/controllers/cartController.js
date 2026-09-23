import { cartService } from '../services/cartService.js';
import { orderCreationService } from '../services/orderCreationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { cashierSessionRepository } from '../repositories/cashierSessionRepository.js';

const resolveCartContext = (req, res) => {
  const sessionId = req.headers['x-cashier-session-id'] || 'DEFAULT_SESSION';
  const userId = req.user?.userId || req.headers['x-user-id'] || 'DEFAULT_USER';
  const branchId = req.headers['x-branch-id'] || 'DEFAULT_BRANCH';

  return { sessionId, userId, branchId };
};

export const cartController = {
  getCart: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const cart = cartService.getOrCreateCart(ctx.sessionId, ctx.userId, ctx.branchId, {
        order_type: req.query.order_type || 'DINE_IN'
      });
      sendSuccess(res, cart, 'Cart retrieved successfully.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.addItem(ctx.sessionId, ctx.userId, ctx.branchId, req.body);
      sendSuccess(res, updatedCart, 'Item added to cart.');
    } catch (error) {
      console.error("[CART ERROR]", error.message);
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.updateItemQuantity(
        ctx.sessionId,
        req.params.cartItemId,
        Number(req.body.quantity),
        ctx.userId
      );
      sendSuccess(res, updatedCart, 'Cart item quantity updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemDetails: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.updateItemDetails(ctx.sessionId, req.params.cartItemId, req.body || {}, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  duplicateItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.duplicateItem(ctx.sessionId, req.params.cartItemId, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item duplicated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.removeItem(ctx.sessionId, req.params.cartItemId, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item removed.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  setNotes: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'] || 'DEFAULT_SESSION';
    try {
      const updatedCart = cartService.setNotes(sessionId, {
        notes: req.body.notes,
        kitchen_notes: req.body.kitchen_notes
      });
      sendSuccess(res, updatedCart, 'Cart notes updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  setMeta: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.setCartMeta(ctx.sessionId, {
        order_type: req.body.order_type,
        customer_id: req.body.customer_id,
        table_id: req.body.table_id,
        waiter_id: req.body.waiter_id,
        waiter_name_snapshot: req.body.waiter_name_snapshot,
        rider_id: req.body.rider_id,
        rider_name_snapshot: req.body.rider_name_snapshot,
        is_vip: req.body.is_vip
      });
      sendSuccess(res, updatedCart, 'Cart metadata updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  clearCart: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const clearedCart = cartService.clearCart(ctx.sessionId, ctx.userId);
      sendSuccess(res, clearedCart, 'Cart cleared.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  checkout: async (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return sendError(res, 400, 'Idempotency-Key header is required.');

    try {
      const order = await orderCreationService.checkoutCart(ctx.sessionId, ctx.userId, req.body || {}, idempotencyKey);
      sendSuccess(res, order, `Order ${order.order_number} created successfully.`, 201);
    } catch (error) {
      console.error("CHECKOUT ERROR:", error);
      sendError(res, 400, error.message);
    }
  }
};
