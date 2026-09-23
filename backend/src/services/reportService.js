import { dbEngine } from '../database/sqlite.js';
import { dateUtils } from '../utils/dateUtils.js';
import {
  SALE_PREDICATE,
  OPEN_BILL_PREDICATE,
  REFUND_PREDICATE,
  CATEGORY_BUCKET_SQL,
  ITEM_FOOD_NET_SQL
} from '../utils/saleScope.js';

const buildDateFilter = (filters) => dateUtils.resolveReportRange(filters);

const buildWhereClause = (filters, prefix = 'o') => {
  const { startDate, endDate } = buildDateFilter(filters);
  const params = [startDate, endDate];
  let where = `${prefix}.business_date BETWEEN ? AND ?`;

  if (filters.cashier && filters.cashier !== 'All') {
    where += ` AND ${prefix}.cashier_user_id = ?`;
    params.push(filters.cashier);
  }
  if (filters.orderType && filters.orderType !== 'All') {
    where += ` AND ${prefix}.order_type = ?`;
    params.push(String(filters.orderType).toUpperCase().replace(/\s+/g, '_'));
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'All') {
    where += ` AND EXISTS (
      SELECT 1 FROM order_payments op
      WHERE op.order_id = ${prefix}.id
        AND UPPER(op.payment_method) = ?
        AND UPPER(COALESCE(op.status, 'COMPLETED')) = 'COMPLETED'
    )`;
    params.push(String(filters.paymentMethod).toUpperCase());
  }

  return { where, params, startDate, endDate };
};

const emptyBuckets = () => ({
  restaurantSales: 0,
  fastFoodSales: 0,
  dealsSales: 0,
  drinksSales: 0,
  chipsSales: 0,
  specialDrinksSales: 0,
  otherSales: 0
});

const bucketToField = (bucket) => {
  switch (bucket) {
    case 'Restaurant': return 'restaurantSales';
    case 'Fast Food': return 'fastFoodSales';
    case 'Deals': return 'dealsSales';
    case 'Drinks': return 'drinksSales';
    case 'Fries': return 'chipsSales';
    case 'Soda Bar': return 'specialDrinksSales';
    default: return 'otherSales';
  }
};

export const reportService = {
  getSummary: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');

    const summary = dbEngine.get(`
      SELECT
        COUNT(DISTINCT o.id) as ordersCount,
        COALESCE(SUM(o.subtotal), 0) as subtotal,
        COALESCE(SUM(o.subtotal - o.discount_total), 0) as netSales,
        COALESCE(SUM(o.grand_total), 0) as grossSales,
        COALESCE(SUM(o.discount_total), 0) as discounts,
        COALESCE(SUM(COALESCE(o.delivery_fee, 0)), 0) as deliveryCharges,
        COALESCE(SUM(COALESCE(o.service_charge, 0)), 0) as serviceCharges,
        COALESCE(SUM(COALESCE(o.tip_total, 0)), 0) as tips
      FROM orders o
      WHERE ${where} AND ${SALE_PREDICATE}
    `, ...params) || {};

    const items = dbEngine.get(`
      SELECT COALESCE(SUM(oi.quantity), 0) as itemsSold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${where} AND ${SALE_PREDICATE}
    `, ...params);

    const refundsRow = dbEngine.get(`
      SELECT
        COALESCE(SUM(o.grand_total), 0) as refunds,
        COUNT(o.id) as refundCount
      FROM orders o
      WHERE ${where} AND ${REFUND_PREDICATE}
    `, ...params);

    const openRow = dbEngine.get(`
      SELECT
        COUNT(o.id) as openCount,
        COALESCE(SUM(o.grand_total), 0) as openTotal
      FROM orders o
      WHERE ${where} AND ${OPEN_BILL_PREDICATE}
    `, ...params);

    const paymentSplit = dbEngine.get(`
      SELECT
        COALESCE(SUM(CASE WHEN UPPER(op.payment_method) = 'CASH' THEN op.amount ELSE 0 END), 0) as cashSales,
        COALESCE(SUM(CASE WHEN UPPER(op.payment_method) != 'CASH' THEN op.amount ELSE 0 END), 0) as digitalSales
      FROM order_payments op
      JOIN orders o ON o.id = op.order_id
      WHERE ${where}
        AND ${SALE_PREDICATE}
        AND UPPER(COALESCE(op.status, 'COMPLETED')) = 'COMPLETED'
    `, ...params);

    const paidCounts = dbEngine.get(`
      SELECT
        SUM(CASE WHEN UPPER(COALESCE(o.payment_state, '')) = 'PAID' THEN 1 ELSE 0 END) as paidCount,
        SUM(CASE WHEN UPPER(COALESCE(o.payment_state, '')) != 'PAID' THEN 1 ELSE 0 END) as unpaidCount
      FROM orders o
      WHERE ${where} AND ${SALE_PREDICATE}
    `, ...params);

    const bucketRows = dbEngine.all(`
      SELECT
        ${CATEGORY_BUCKET_SQL} as bucket,
        COALESCE(SUM(${ITEM_FOOD_NET_SQL}), 0) as net
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN deals d ON d.id = oi.product_id
      LEFT JOIN categories c1 ON p.category_id = c1.id
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE ${where} AND ${SALE_PREDICATE}
      GROUP BY bucket
    `, ...params);

    const buckets = emptyBuckets();
    for (const row of bucketRows) {
      const field = bucketToField(row.bucket);
      buckets[field] += Number(row.net) || 0;
    }

    const netSales = Number(summary.netSales) || 0;
    const grossSales = Number(summary.grossSales) || 0;
    const ordersCount = Number(summary.ordersCount) || 0;
    const cashSales = Number(paymentSplit?.cashSales) || 0;
    const digitalSales = Number(paymentSplit?.digitalSales) || 0;
    const unpaidSales = Math.max(0, grossSales - cashSales - digitalSales);
    const serviceCharges = Number(summary.serviceCharges) || 0;
    const deliveryCharges = Number(summary.deliveryCharges) || 0;
    const tips = Number(summary.tips) || 0;
    const totalCatSales =
      buckets.restaurantSales + buckets.fastFoodSales + buckets.dealsSales
      + buckets.drinksSales + buckets.chipsSales + buckets.specialDrinksSales + buckets.otherSales;

    return {
      grossSales,
      netSales,
      ordersCount,
      itemsSold: Number(items?.itemsSold) || 0,
      discounts: Number(summary.discounts) || 0,
      tax: 0,
      serviceCharges,
      deliveryCharges,
      tips,
      refunds: Number(refundsRow?.refunds) || 0,
      refundCount: Number(refundsRow?.refundCount) || 0,
      cashSales,
      digitalSales,
      unpaidSales,
      paidCount: Number(paidCounts?.paidCount) || 0,
      unpaidCount: Number(paidCounts?.unpaidCount) || 0,
      averageOrderValue: ordersCount > 0 ? grossSales / ordersCount : 0,
      openBillsCount: Number(openRow?.openCount) || 0,
      openBillsTotal: Number(openRow?.openTotal) || 0,
      totalCatSales,
      ...buckets
    };
  },

  getDetailedSales: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');

    const query = `
      SELECT
        ${CATEGORY_BUCKET_SQL} as main_category,
        COALESCE(
          CASE WHEN d.id IS NOT NULL THEN d.name END,
          c1.name,
          'Uncategorized'
        ) as sub_category,
        COALESCE(oi.product_name_snapshot, p.name, d.name, 'Unknown') as product_name,
        oi.product_id,
        SUM(oi.quantity) as qty,
        COUNT(DISTINCT o.id) as orders,
        SUM(COALESCE(oi.subtotal, 0)) as gross,
        SUM(COALESCE(oi.subtotal, 0) - (${ITEM_FOOD_NET_SQL})) as discount,
        0 as tax,
        SUM(${ITEM_FOOD_NET_SQL}) as net,
        0 as refunds,
        0 as is_component,
        NULL as parent_deal_name,
        SUM(COALESCE(oi.subtotal, 0)) as original_value
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN deals d ON oi.product_id = d.id
      LEFT JOIN categories c1 ON p.category_id = c1.id
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      WHERE ${where} AND ${SALE_PREDICATE}
      GROUP BY main_category, sub_category, product_name, oi.product_id
      HAVING qty > 0
      ORDER BY main_category, sub_category, net DESC
    `;

    return dbEngine.all(query, ...params);
  },

  getRecentItems: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');

    const query = `
      SELECT
        COALESCE(oi.product_name_snapshot, p.name, d.name, 'Unknown') as name,
        COALESCE(
          CASE WHEN d.id IS NOT NULL THEN 'Deals' END,
          c.name,
          'Other'
        ) as cat,
        oi.quantity as qty,
        oi.subtotal as price,
        o.created_at as time
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN deals d ON oi.product_id = d.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where} AND ${SALE_PREDICATE}
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    return dbEngine.all(query, ...params);
  },

  getTrends: async (filters) => {
    const { where, params } = buildWhereClause(filters, 'o');

    const query = `
      SELECT
        o.business_date as date,
        SUM(o.grand_total) as sales
      FROM orders o
      WHERE ${where} AND ${SALE_PREDICATE}
      GROUP BY o.business_date
      ORDER BY o.business_date ASC
    `;

    return dbEngine.all(query, ...params);
  },

  getProductDetails: async (productId, filters) => {
    const { where, params } = buildWhereClause(filters, 'o');

    const query = `
      SELECT
        o.order_type,
        SUM(oi.quantity) as qty,
        SUM(${ITEM_FOOD_NET_SQL}) as net
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE ${where} AND ${SALE_PREDICATE} AND oi.product_id = ?
      GROUP BY o.order_type
    `;

    return dbEngine.all(query, ...params, productId);
  }
};
