import { orderService } from '../services/orderService.js';
import { orderNumberService } from '../services/orderNumberService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { authService } from '../services/authService.js';
import { socketService } from '../services/socketService.js';
import { lanSyncService } from '../services/lanSyncService.js';
import { configService } from '../services/configService.js';
import { dbEngine } from '../database/sqlite.js';



const resolveSessionContext = (req, res, { requireShift = true } = {}) => {
  const shiftId = req.headers['x-cashier-session-id'] || 'DEFAULT_SESSION';
  const userId = req.user?.userId || req.headers['x-user-id'] || 'DEFAULT_USER';
  const terminalId = req.headers['x-terminal-id'] || 'DEFAULT_DEVICE';

  return { shiftId, userId, terminalId };
};

export const orderController = {
  peekNextNumber: async (_req, res) => {
    try {
      sendSuccess(res, { order_number: orderNumberService.peekNextNumberSync() }, 'Next order number');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getDraft: async (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const draft = await orderService.getOrCreateDraft(ctx.shiftId, ctx.userId);
      sendSuccess(res, draft, 'Draft retrieved successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  createOrder: async (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const businessDate = req.body?.business_date || new Date().toISOString().split('T')[0];
      const branchId = req.body?.branch_id || 'DEFAULT_BRANCH';
      const orderNumber = await orderNumberService.allocateNextNumber(branchId, businessDate);
      const order = orderService.createDraftOrder(ctx.shiftId, ctx.userId, { ...req.body, business_date: businessDate, branch_id: branchId, order_number: orderNumber });
sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getOrderDetails: (req, res) => {
    try {
      const order = orderService.getOrderById(req.params.orderId);
      if (!order) {
        return sendError(res, 404, 'Order not found');
      }
      sendSuccess(res, order, 'Order details retrieved');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateOrderMeta: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.updateOrderMeta(req.params.orderId, req.body, ctx.userId, ctx.terminalId);
sendSuccess(res, updatedOrder, 'Order metadata updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToDraft: async (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const updatedDraft = await orderService.addItemToDraft(ctx.shiftId, ctx.userId, req.body);
sendSuccess(res, updatedDraft, 'Item added to draft');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.addItemToOrder(req.params.orderId, req.body, ctx.userId, ctx.terminalId);
sendSuccess(res, updatedOrder, 'Item added to order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.updateItemQuantity(req.params.orderId, req.params.itemId, req.body.quantity, ctx.userId, ctx.terminalId);
sendSuccess(res, updatedOrder, 'Item quantity updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItemFromOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.removeItem(req.params.orderId, req.params.itemId, ctx.userId, req.body.reason, ctx.terminalId);
sendSuccess(res, updatedOrder, 'Item removed from order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  holdOrder: async (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const heldOrder = await orderService.holdOrder(ctx.shiftId, ctx.userId, req.body.holdName);
sendSuccess(res, heldOrder, 'Order held successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getHeldOrders: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || null;
    try {
      const heldOrders = orderService.getHeldOrders(shiftId);
      sendSuccess(res, heldOrders, 'Held orders retrieved');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  resumeOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const resumedOrder = orderService.resumeOrder(ctx.shiftId, ctx.userId, req.params.orderId);
sendSuccess(res, resumedOrder, 'Order resumed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  transitionState: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.transitionOrderState(
        req.params.orderId,
        req.body.targetState,
        {
          userId: ctx.userId,
          reason: req.body.reason,
          kitchenState: req.body.kitchenState,
        }
      );
sendSuccess(res, updatedOrder, 'Order state updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  applyDiscount: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const order = orderService.applyOrderDiscount(
        req.params.orderId,
        req.body?.discount_total,
        !!req.body?.print_paid
      );
sendSuccess(res, order, 'Discount applied');
      sendSuccess(res, resumedOrder, 'Order resumed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  transitionState: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.transitionOrderState(
        req.params.orderId,
        req.body.targetState,
        {
          userId: ctx.userId,
          reason: req.body.reason,
          kitchenState: req.body.kitchenState,
        }
      );
sendSuccess(res, updatedOrder, 'Order state updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  applyDiscount: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const order = orderService.applyOrderDiscount(
        req.params.orderId,
        req.body?.discount_total,
        !!req.body?.print_paid
      );
sendSuccess(res, order, 'Discount applied');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  deleteOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    const pin = String(req.body?.pin || req.headers['x-manager-pin'] || '').trim();
    if (!authService.verifyManagerPin(pin)) {
      return sendError(res, 403, 'Unauthorized. Enter a manager PIN.');
    }
    try {
      const result = orderService.deleteOrder(req.params.orderId, ctx.userId, ctx.terminalId);
sendSuccess(res, result, 'Order deleted successfully');
    } catch (error) {
      console.error('Delete Order Error:', error);
      sendError(res, 400, error.message);
    }
  },

  lockOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const order = orderService.lockOrder(req.params.orderId, ctx.terminalId, ctx.userId);
      socketService.emitOrderLockChanged(order.id, true, ctx.userId);
sendSuccess(res, order, 'Order locked');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  unlockOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const order = orderService.unlockOrder(req.params.orderId, ctx.terminalId, ctx.userId);
      socketService.emitOrderLockChanged(order.id, false, null);
sendSuccess(res, order, 'Order unlocked');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  }
};

