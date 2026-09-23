import { kitchenService } from '../services/kitchenService.js';
import fs from 'fs';

const ok = (res, data, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res, error) => res.status(error.statusCode || 400).json({ success: false, error: error.message || 'Request failed' });

const getActorId = (req) => req.user?.userId || req.headers['x-user-id'] || 'SYSTEM';

export const kitchenController = {
  getQueue: (req, res) => {
    try {
      const data = kitchenService.getQueue({
        branchId: req.query.branch_id || req.query.branchId || null,
        stationId: req.query.station_id || req.query.stationId || null,
        changedSince: req.query.changed_since || req.query.changedSince || null,
        limit: req.query.limit ? Number(req.query.limit) : 100,
        monitorMode: req.query.monitorMode === 'true'
      });
      ok(res, data);
    } catch (error) {
      console.error('Error in getQueue:', error);
      try { fs.writeFileSync('getQueueError.log', error.stack || error.message); } catch(e){}
      fail(res, error);
    }
  },

  getTicket: (req, res) => {
    try {
      const ticket = kitchenService.getTicket(req.params.orderId);
      if (!ticket) return res.status(404).json({ success: false, error: 'Kitchen ticket not found' });
      ok(res, ticket);
    } catch (error) {
      fail(res, error);
    }
  },

  getSummary: (req, res) => {
    try {
      const data = kitchenService.getDashboardMetrics(req.query.branch_id || req.query.branchId || null);
      ok(res, data);
    } catch (error) {
      fail(res, error);
    }
  },

  markItemSent: (req, res) => {
    try {
      const data = kitchenService.markItemSent(req.params.itemId, getActorId(req));
      ok(res, data, 'Item marked accepted (sent)');
    } catch (error) {
      fail(res, error);
    }
  },

  startPreparingItem: (req, res) => {
    try {
      const data = kitchenService.startPreparingItem(req.params.itemId, getActorId(req));
      ok(res, data, 'Item moved to preparing');
    } catch (error) {
      fail(res, error);
    }
  },

  markItemReady: (req, res) => {
    try {
      const data = kitchenService.markItemReady(req.params.itemId, getActorId(req));
      ok(res, data, 'Item marked ready');
    } catch (error) {
      fail(res, error);
    }
  },

  markItemServed: (req, res) => {
    try {
      const data = kitchenService.markItemServed(req.params.itemId, getActorId(req));
      ok(res, data, 'Item marked served');
    } catch (error) {
      fail(res, error);
    }
  },

  completeItem: (req, res) => {
    try {
      const data = kitchenService.completeItem(req.params.itemId, getActorId(req));
      ok(res, data, 'Item marked completed');
    } catch (error) {
      fail(res, error);
    }
  },

  cancelItem: (req, res) => {
    try {
      const data = kitchenService.cancelItem(req.params.itemId, getActorId(req));
      ok(res, data, 'Item cancelled');
    } catch (error) {
      fail(res, error);
    }
  },

  returnItemToPreparing: (req, res) => {
    try {
      const data = kitchenService.returnItemToPreparing(req.params.itemId, getActorId(req));
      ok(res, data, 'Item returned to preparing');
    } catch (error) {
      fail(res, error);
    }
  },

  addOrderNote: (req, res) => {
    try {
      const data = kitchenService.addOrderKitchenNote(req.params.orderId, getActorId(req), req.body.note);
      ok(res, data, 'Kitchen note updated');
    } catch (error) {
      fail(res, error);
    }
  },

  addItemNote: (req, res) => {
    try {
      const data = kitchenService.addItemKitchenNote(req.params.itemId, getActorId(req), req.body.note);
      ok(res, data, 'Kitchen item note updated');
    } catch (error) {
      fail(res, error);
    }
  },

  setPriority: (req, res) => {
    try {
      const data = kitchenService.setPriority(req.params.orderId, getActorId(req), req.body.priority);
      ok(res, data, 'Kitchen priority updated');
    } catch (error) {
      fail(res, error);
    }
  },

  clearFailed: (req, res) => {
    try {
      const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds : [];
      const data = kitchenService.clearFailedTickets(orderIds, getActorId(req));
      ok(res, data, 'Failed kitchen tickets cleared');
    } catch (error) {
      fail(res, error);
    }
  }
};
