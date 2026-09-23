import { apiClient } from './client';

export interface ReportFilters {
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  cashier?: string;
  orderType?: string;
  paymentMethod?: string;
}

export interface ReportSummary {
  grossSales: number;
  netSales: number;
  ordersCount: number;
  itemsSold: number;
  discounts: number;
  tax: number;
  serviceCharges: number;
  deliveryCharges: number;
  tips?: number;
  refunds: number;
  refundCount?: number;
  averageOrderValue: number;
  cashSales?: number;
  digitalSales?: number;
  unpaidSales?: number;
  paidCount?: number;
  unpaidCount?: number;
  restaurantSales?: number;
  fastFoodSales?: number;
  dealsSales?: number;
  drinksSales?: number;
  chipsSales?: number;
  specialDrinksSales?: number;
  otherSales?: number;
  totalCatSales?: number;
  openBillsCount?: number;
  openBillsTotal?: number;
}

export interface DetailedSaleRow {
  main_category: string;
  sub_category: string;
  product_id: string;
  product_name: string;
  qty: number;
  orders: number;
  gross: number;
  discount: number;
  tax: number;
  net: number;
  refunds: number;
  is_component?: number;
  original_value?: number;
  parent_deal_name?: string;
}

export interface TrendRow {
  date: string;
  sales: number;
}

export const fetchReportSummary = async (filters: ReportFilters): Promise<ReportSummary> => {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await apiClient.get(`/reports/summary?${query}`);
  return res.data;
};

export const fetchDetailedSales = async (filters: ReportFilters): Promise<DetailedSaleRow[]> => {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await apiClient.get(`/reports/detailed-sales?${query}`);
  return res.data;
};

export const fetchReportTrends = async (filters: ReportFilters): Promise<TrendRow[]> => {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await apiClient.get(`/reports/trends?${query}`);
  return res.data;
};

export const fetchRecentItems = async (filters: ReportFilters): Promise<any[]> => {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await apiClient.get(`/reports/recent-items?${query}`);
  return res.data;
};

export const fetchProductDetails = async (productId: string, filters: ReportFilters): Promise<any> => {
  const query = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await apiClient.get(`/reports/product/${productId}?${query}`);
  return res.data;
};
