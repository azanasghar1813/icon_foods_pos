import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';
import { kitchenService } from './kitchenService.js';
import { SALE_PREDICATE, OPEN_BILL_PREDICATE, REFUND_PREDICATE } from '../utils/saleScope.js';

export const dashboardService = {
  getBusinessDayBounds: () => {
    const { start, end } = dateUtils.getBusinessDayBounds();
    return { start, end, businessDate: dateUtils.getBusinessDate() };
  },

  getSummary: () => {
    const businessDate = dateUtils.getBusinessDate();

    const sale = dbEngine.get(`
      SELECT
        COALESCE(SUM(grand_total), 0) as todaySales,
        COUNT(id) as ordersCount
      FROM orders o
      WHERE o.business_date = ? AND ${SALE_PREDICATE}
    `, businessDate);

    const todaySales = sale?.todaySales || 0;
    const ordersCount = sale?.ordersCount || 0;
    const aov = ordersCount > 0 ? Math.round(todaySales / ordersCount) : 0;

    const paid = dbEngine.get(`
      SELECT COUNT(id) as paid
      FROM orders o
      WHERE o.business_date = ? AND ${SALE_PREDICATE} AND UPPER(COALESCE(o.payment_state, '')) = 'PAID'
    `, businessDate)?.paid || 0;

    const unpaid = dbEngine.get(`
      SELECT COUNT(id) as unpaid
      FROM orders o
      WHERE o.business_date = ? AND ${SALE_PREDICATE} AND UPPER(COALESCE(o.payment_state, '')) != 'PAID'
    `, businessDate)?.unpaid || 0;

    const cancelled = dbEngine.get(`
      SELECT COUNT(id) as cancelled
      FROM orders o
      WHERE o.business_date = ? AND ${REFUND_PREDICATE}
    `, businessDate)?.cancelled || 0;

    const completedRow = dbEngine.get(`
      SELECT
        COUNT(id) as completed,
        COALESCE(SUM(grand_total), 0) as completedSales
      FROM orders o
      WHERE o.business_date = ? AND o.lifecycle_state = 'COMPLETED'
    `, businessDate);

    const notCompleted = dbEngine.get(`
      SELECT COUNT(id) as notCompleted
      FROM orders o
      WHERE o.business_date = ? AND ${OPEN_BILL_PREDICATE}
    `, businessDate)?.notCompleted || 0;

    const cashInDrawer = dbEngine.get(`
      SELECT COALESCE(SUM(op.amount), 0) as cashInDrawer
      FROM order_payments op
      JOIN orders o ON o.id = op.order_id
      WHERE o.business_date = ?
        AND ${SALE_PREDICATE}
        AND UPPER(COALESCE(op.status, 'COMPLETED')) = 'COMPLETED'
        AND UPPER(op.payment_method) = 'CASH'
    `, businessDate)?.cashInDrawer || 0;

    const customers = dbEngine.get(`
      SELECT COUNT(DISTINCT customer_id) as customers
      FROM orders o
      WHERE o.business_date = ? AND o.customer_id IS NOT NULL AND ${SALE_PREDICATE}
    `, businessDate)?.customers || 0;

    const types = dbEngine.all(`
      SELECT order_type, COUNT(id) as count
      FROM orders o
      WHERE o.business_date = ? AND ${SALE_PREDICATE}
      GROUP BY order_type
    `, businessDate);

    let restaurant = 0, fastFood = 0, deals = 0;
    for (const t of types) {
      if (t.order_type === 'DINE_IN') restaurant += t.count;
      else if (t.order_type === 'TAKEAWAY' || t.order_type === 'DELIVERY') fastFood += t.count;
    }

    return {
      todaySales,
      ordersCount,
      preparing: 0,
      ready: 0,
      served: 0,
      paid,
      unpaid,
      cancelled,
      completed: completedRow?.completed || 0,
      notCompleted,
      completedSales: completedRow?.completedSales || 0,
      aov,
      customers,
      fastFood,
      restaurant,
      deals,
      cashInDrawer,
      businessDate,
      businessDayLabel: dateUtils.getBusinessDayLabel()
    };
  },

  getOperations: () => {
    const businessDate = dateUtils.getBusinessDate();
    const activeCashiers = 1;

    const kitchenMetrics = {
      kitchenQueue: 0,
      preparing: 0,
      ready: 0,
      served: 0,
      averagePreparationTime: 0,
      overdue: 0
    };

    const unpaid = dbEngine.get(`
      SELECT COUNT(id) as unpaid
      FROM orders o
      WHERE o.business_date = ?
        AND UPPER(COALESCE(o.payment_state, '')) != 'PAID'
        AND o.lifecycle_state NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT', 'HELD', 'ARCHIVED')
    `, businessDate)?.unpaid || 0;

    return {
      activeCashiers,
      kitchenQueue: kitchenMetrics.kitchenQueue,
      preparing: kitchenMetrics.preparing,
      ready: kitchenMetrics.ready,
      served: kitchenMetrics.served,
      averagePreparationTime: kitchenMetrics.averagePreparationTime,
      overdueKitchenItems: kitchenMetrics.overdue,
      unpaidOrders: unpaid
    };
  },

  getRevenueAnalytics: () => {
    const businessDate = dateUtils.getBusinessDate();
    const results = dbEngine.all(`
      SELECT created_at, grand_total
      FROM orders o
      WHERE o.business_date = ? AND ${SALE_PREDICATE}
    `, businessDate);

    const buckets = [
      { hourStr: "06:00 AM", h: 6 },
      { hourStr: "08:00 AM", h: 8 },
      { hourStr: "10:00 AM", h: 10 },
      { hourStr: "12:00 PM", h: 12 },
      { hourStr: "02:00 PM", h: 14 },
      { hourStr: "04:00 PM", h: 16 },
      { hourStr: "06:00 PM", h: 18 },
      { hourStr: "08:00 PM", h: 20 },
      { hourStr: "10:00 PM", h: 22 },
      { hourStr: "12:00 AM", h: 0 },
      { hourStr: "02:00 AM", h: 2 },
      { hourStr: "04:00 AM", h: 4 },
    ];
    const mapped = buckets.map(b => ({ hour: b.hourStr, sales: 0 }));

    for (const r of results) {
      if (!r.created_at) continue;
      const raw = String(r.created_at);
      const dt = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.endsWith('Z') ? '' : 'Z'));
      if (Number.isNaN(dt.getTime())) continue;
      const h = dt.getHours();

      let bucketIndex = 0;
      if (h >= 6 && h < 8) bucketIndex = 0;
      else if (h >= 8 && h < 10) bucketIndex = 1;
      else if (h >= 10 && h < 12) bucketIndex = 2;
      else if (h >= 12 && h < 14) bucketIndex = 3;
      else if (h >= 14 && h < 16) bucketIndex = 4;
      else if (h >= 16 && h < 18) bucketIndex = 5;
      else if (h >= 18 && h < 20) bucketIndex = 6;
      else if (h >= 20 && h < 22) bucketIndex = 7;
      else if (h >= 22 && h < 24) bucketIndex = 8;
      else if (h >= 0 && h < 2) bucketIndex = 9;
      else if (h >= 2 && h < 4) bucketIndex = 10;
      else bucketIndex = 11;

      mapped[bucketIndex].sales += (r.grand_total || 0);
    }

    return mapped;
  },

  getPopularProducts: () => {
    const businessDate = dateUtils.getBusinessDate();
    const stmt = dbEngine.db.prepare(`
      SELECT oi.product_name_snapshot as name, SUM(oi.quantity) as sales, oi.product_id as id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.business_date = ? AND ${SALE_PREDICATE}
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY sales DESC
      LIMIT 5
    `);
    return stmt.all(businessDate).map(row => ({
      id: row.id || Math.random().toString(36).substr(2, 9),
      name: row.name || 'Unknown',
      sales: row.sales || 0
    }));
  },

  getActivityFeed: (limit = 10) => {
    return [];
  }
};
