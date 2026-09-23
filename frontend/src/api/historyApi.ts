/**
 * History API Client
 *
 * Typed API functions for all order history endpoints.
 * All functions return typed result objects.
 */

import { apiClient } from './client';

// ─── History Filters ──────────────────────────────────────────────────────────

export interface HistoryFilters {
  date_preset?:      string;
  date_from?:        string;
  date_to?:          string;
  business_date?:    string;
  lifecycle_state?:  string | string[];
  payment_state?:    string;
  kitchen_state?:    string;
  order_type?:       string;
  cashier_user_id?:  string;
  branch_id?:        string;
  customer_id?:      string;
  table_id?:         string;
  shift_id?:         string;
  min_amount?:       number;
  max_amount?:       number;
  payment_method?:   string;
  product_id?:       string;
  product_name?:     string;
  modifier_id?:      string;
  sync_status?:      string;
}

export interface HistoryPagination {
  page?:    number;
  limit?:   number;
  sort_by?: string;
}

export interface HistoryListResult {
  data:  HistoryOrderRow[];
  meta:  { total: number; page: number; limit: number; total_pages: number; filters_applied: number };
}

export interface HistoryOrderRow {
  id:                    string;
  order_number:          string;
  business_date:         string;
  branch_id:             string;
  cashier_user_id:       string;
  cashier_name?:         string | null;
  shift_id:              string;
  customer_id:           string | null;
  customer_name?:        string | null;
  customer_phone?:       string | null;
  customer_address?:     string | null;
  is_vip?:               number | boolean | string | null;
  receipt_paid_stamp?:   number | boolean | string | null;
  table_id:              string | null;
  waiter_id?:            string | null;
  waiter_name?:          string | null;
  waiter_name_snapshot?: string | null;
  rider_id?:             string | null;
  rider_name?:           string | null;
  rider_name_snapshot?:  string | null;
  order_type:            string;
  lifecycle_state:       string;
  kitchen_state:         string;
  payment_state:         string;
  subtotal:              number;
  tax_total:             number;
  service_charge?:       number | string;
  delivery_charges?:     number | string;
  discount_total:        number;
  grand_total:           number;
  paid_total:            number;
  due_total:             number;
  sync_status:           string;
  notes:                 string | null;
  created_at:            string;
  updated_at:            string;
  completed_at:          string | null;
  item_count:            number;
  primary_payment_method: string | null;
  is_edited?:            number | boolean;
}

export interface HistoryOrderDetail extends HistoryOrderRow {
  items:       any[];
  payments:    any[];
  receipts:    any[];
  timeline:    TimelineEvent[];
  audit_trail: AuditEntry[];
  print_jobs:  any[];
  reprint_log: any[];
  metadata:    Record<string, any>;
  tags:        { tag_name: string; tag_color: string }[];
}

export interface TimelineEvent {
  id:             string;
  order_id:       string;
  event_type:     string;
  from_state:     string | null;
  to_state:       string | null;
  actor_user_id:  string | null;
  actor_type:     string;
  metadata:       any;
  notes:          string | null;
  created_at:     string;
}

export interface AuditEntry {
  id:                  string;
  order_id:            string;
  user_id:             string | null;
  action:              string;
  entity_type:         string;
  entity_id:           string | null;
  old_value:           any;
  new_value:           any;
  reason:              string | null;
  device_id:           string | null;
  branch_id:           string;
  permission_override: boolean;
  created_at:          string;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

function buildQueryString(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      q.set(k, v.join(','));
    } else {
      q.set(k, String(v));
    }
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch paginated order list with all filter dimensions.
 */
export async function fetchOrders(filters: HistoryFilters, pagination: HistoryPagination): Promise<HistoryListResult> {
  const qs = buildQueryString({
    ...filters,
    page:    pagination.page    || 1,
    limit:   pagination.limit   || 50,
    sort_by: pagination.sort_by || 'NEWEST',
  });
  return apiClient.get(`/history/orders${qs}`);
}

/**
 * Fetch full order detail (all sub-entities from snapshots).
 */
export async function fetchOrderDetail(orderId: string): Promise<{ success: boolean; data: HistoryOrderDetail }> {
  return apiClient.get(`/history/orders/${orderId}`);
}

/**
 * Fetch timeline events for an order.
 */
export async function fetchTimeline(orderId: string): Promise<{ success: boolean; data: { events: TimelineEvent[]; total: number } }> {
  return apiClient.get(`/history/orders/${orderId}/timeline`);
}

/**
 * Fetch audit trail for an order.
 */
export async function fetchAuditTrail(orderId: string, viewerUserId?: string): Promise<{ success: boolean; data: { entries: AuditEntry[]; total: number } }> {
  const qs = viewerUserId ? `?viewer_user_id=${viewerUserId}&record_view=true` : '';
  return apiClient.get(`/history/orders/${orderId}/audit${qs}`);
}

/**
 * Fetch sync status for an order.
 */
export async function fetchSyncStatus(orderId: string): Promise<{ success: boolean; data: any }> {
  return apiClient.get(`/history/orders/${orderId}/sync-status`);
}

/**
 * Full-text search across orders.
 */
export async function searchOrders(query: string, filters: HistoryFilters, pagination: HistoryPagination): Promise<HistoryListResult> {
  const qs = buildQueryString({
    q:       query,
    ...filters,
    page:    pagination.page  || 1,
    limit:   pagination.limit || 50,
  });
  return apiClient.get(`/history/search${qs}`);
}

/**
 * Get dashboard stats.
 */
export async function fetchHistoryStats(): Promise<{ success: boolean; data: any }> {
  return apiClient.get('/history/stats');
}

// ─── Print API ────────────────────────────────────────────────────────────────

/**
 * Trigger receipt print for an order.
 */
export async function printReceipt(orderId: string, cashierUserId: string): Promise<{ success: boolean; data: { job_id: string; status: string } }> {
  return apiClient.post(`/print/receipt/${orderId}`, { cashier_user_id: cashierUserId });
}

/**
 * Reprint a previous receipt.
 */
export async function reprintReceipt(jobId: string, cashierUserId: string, reason?: string): Promise<{ success: boolean; data: any }> {
  return apiClient.post(`/print/reprint/${jobId}`, { cashier_user_id: cashierUserId, reason });
}

/**
 * Get all print jobs for an order.
 */
export async function fetchPrintJobs(orderId: string): Promise<{ success: boolean; data: any[] }> {
  return apiClient.get(`/print/queue/order/${orderId}`);
}

/**
 * Get reprint log for an order.
 */
export async function fetchReprintLog(orderId: string): Promise<{ success: boolean; data: any[] }> {
  return apiClient.get(`/print/reprint-log/${orderId}`);
}

/**
 * Delete an order permanently.
 */
export async function deleteOrder(orderId: string, pin?: string): Promise<{ success: boolean; message?: string }> {
  return apiClient.delete(`/orders/${orderId}`, {
    data: { pin }
  } as any);
}

/**
 * Wipe out entire order history. Requires PIN.
 */
export async function wipeOutHistory(pin: string): Promise<{ success: boolean; message?: string }> {
  return apiClient.post('/history/wipe-out', { pin });
}
