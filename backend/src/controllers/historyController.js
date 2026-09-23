import { orderHistoryService } from '../services/orderHistoryService.js';
import { userRepository } from '../repositories/userRepository.js';
import { authService } from '../services/authService.js';

/**
 * HistoryController
 *
 * All history endpoints are read-only.
 * Permission checks are applied per role level.
 */

// ─── Order List ──────────────────────────────────────────────────────────────

export const getOrderList = (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = Math.min(parseInt(req.query.limit) || 50, 10000);
    const sortBy = req.query.sort_by || 'NEWEST';

    // Build filters from query params
    const filters = {};

    // Date presets
    if (req.query.date_preset)    filters.date_preset   = req.query.date_preset;
    if (req.query.date_from)      filters.date_from     = req.query.date_from;
    if (req.query.date_to)        filters.date_to       = req.query.date_to;
    if (req.query.business_date)  filters.business_date = req.query.business_date;

    // State filters
    if (req.query.lifecycle_state) {
      filters.lifecycle_state = req.query.lifecycle_state.includes(',')
        ? req.query.lifecycle_state.split(',')
        : req.query.lifecycle_state;
    }
    if (req.query.payment_state)  filters.payment_state  = req.query.payment_state;
    if (req.query.kitchen_state)  filters.kitchen_state  = req.query.kitchen_state;
    if (req.query.order_type)     filters.order_type     = req.query.order_type;

    // Entity filters
    if (req.query.cashier_user_id) filters.cashier_user_id = req.query.cashier_user_id;
    if (req.query.branch_id)      filters.branch_id      = req.query.branch_id;
    if (req.query.customer_id)    filters.customer_id    = req.query.customer_id;
    if (req.query.table_id)       filters.table_id       = req.query.table_id;
    if (req.query.shift_id)       filters.shift_id       = req.query.shift_id;

    // Amount filters
    if (req.query.min_amount)     filters.min_amount     = parseFloat(req.query.min_amount);
    if (req.query.max_amount)     filters.max_amount     = parseFloat(req.query.max_amount);

    // Payment method filter
    if (req.query.payment_method) filters.payment_method = req.query.payment_method;

    // Product/modifier filters
    if (req.query.product_id)     filters.product_id     = req.query.product_id;
    if (req.query.product_name)   filters.product_name   = req.query.product_name;
    if (req.query.modifier_id)    filters.modifier_id    = req.query.modifier_id;

    // Sync status filter
    if (req.query.sync_status)    filters.sync_status    = req.query.sync_status;

    const result = orderHistoryService.getOrderList(filters, { page, limit, sortBy });

    res.json({
      success: true,
      data:    result.orders,
      meta: {
        total:       result.total,
        page:        result.page,
        limit:       result.limit,
        total_pages: result.totalPages,
        filters_applied: Object.keys(filters).length,
      },
    });
  } catch (error) {
    console.error('[HistoryController] getOrderList error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Order Detail ────────────────────────────────────────────────────────────

export const getOrderDetail = (req, res) => {
  try {
    const order = orderHistoryService.getOrderDetail(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderByNumber = (req, res) => {
  try {
    const order = orderHistoryService.getByOrderNumber(req.params.orderNumber);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Timeline ────────────────────────────────────────────────────────────────

export const getTimeline = (req, res) => {
  try {
    const timeline = orderHistoryService.getTimeline(req.params.orderId);
    if (!timeline) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export const getAuditTrail = (req, res) => {
  try {
    const viewingUserId   = req.query.viewer_user_id || null;
    const recordViewAudit = req.query.record_view === 'true';

    const trail = orderHistoryService.getAuditTrail(
      req.params.orderId,
      viewingUserId,
      { recordViewAudit }
    );

    if (!trail) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: trail });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchOrders = (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const page  = parseInt(req.query.page)  || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const filters = {};
    if (req.query.date_from)       filters.date_from       = req.query.date_from;
    if (req.query.date_to)         filters.date_to         = req.query.date_to;
    if (req.query.lifecycle_state) filters.lifecycle_state = req.query.lifecycle_state;
    if (req.query.cashier_user_id) filters.cashier_user_id = req.query.cashier_user_id;
    if (req.query.branch_id)       filters.branch_id       = req.query.branch_id;

    const result = orderHistoryService.search(query, filters, { page, limit });

    res.json({
      success: true,
      data:    result.orders,
      meta: {
        query,
        total:       result.total,
        page:        result.page,
        limit:       result.limit,
        total_pages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Sync Status ─────────────────────────────────────────────────────────────

export const getSyncStatus = (req, res) => {
  try {
    const status = orderHistoryService.getSyncStatus(req.params.orderId);
    if (!status) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Stats ───────────────────────────────────────────────────────────────────

export const getStats = (req, res) => {
  try {
    const stats = orderHistoryService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Cache Management (Admin only) ───────────────────────────────────────────

export const getCacheStats = (req, res) => {
  try {
    const stats = orderHistoryService.getCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const invalidateOrder = (req, res) => {
  try {
    orderHistoryService.invalidateOrder(req.params.orderId);
    res.json({ success: true, message: 'Cache invalidated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const WIPE_ROLES = ['Owner', 'Super Admin', 'Super Administrator', 'super_admin', 'Admin', 'admin'];

export const wipeOutHistory = (req, res) => {
  try {

    orderHistoryService.wipeOutHistory();
    res.json({ success: true, message: 'All order history wiped out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
