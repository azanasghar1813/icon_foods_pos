import { create } from 'zustand'
import {
  fetchOrders,
  fetchOrderDetail,
  fetchTimeline,
  fetchAuditTrail,
  fetchSyncStatus,
  searchOrders,
  fetchHistoryStats,
  type HistoryFilters,
  type HistoryPagination,
  type HistoryOrderRow,
  type HistoryOrderDetail,
  type TimelineEvent,
  type AuditEntry,
} from '../api/historyApi'

interface HistoryStats {
  today?: {
    total_orders:  number;
    total_revenue: number;
    completed:     number;
    cancelled:     number;
    paid:          number;
  };
  by_state?: { lifecycle_state: string; count: number; total: number }[];
}

interface HistoryState {
  // Order list
  orders:       HistoryOrderRow[];
  total:        number;
  currentPage:  number;
  totalPages:   number;
  isLoadingList: boolean;
  listError:    string | null;

  // Active filters
  filters:      HistoryFilters;
  pagination:   HistoryPagination;
  searchQuery:  string;

  // Selected order detail
  selectedOrder:     HistoryOrderDetail | null;
  isLoadingDetail:   boolean;
  detailError:       string | null;

  // Timeline
  timeline:          TimelineEvent[];
  isLoadingTimeline: boolean;

  // Audit trail
  auditTrail:        AuditEntry[];
  isLoadingAudit:    boolean;

  // Sync status
  syncStatus:        any | null;
  isLoadingSyncStatus: boolean;

  // Stats
  stats:             HistoryStats | null;
  isLoadingStats:    boolean;

  // Actions
  fetchOrders:        (filters?: HistoryFilters, pagination?: HistoryPagination) => Promise<void>;
  searchOrdersAction: (query: string, filters?: HistoryFilters) => Promise<void>;
  selectOrder:        (orderId: string) => Promise<void>;
  loadTimeline:       (orderId: string) => Promise<void>;
  loadAuditTrail:     (orderId: string, viewerUserId?: string) => Promise<void>;
  loadSyncStatus:     (orderId: string) => Promise<void>;
  loadStats:          () => Promise<void>;
  setFilters:         (filters: Partial<HistoryFilters>) => void;
  setPagination:      (pagination: Partial<HistoryPagination>) => void;
  setPage:            (page: number) => void;
  clearSelectedOrder: () => void;
  refreshList:        () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  orders:            [],
  total:             0,
  currentPage:       1,
  totalPages:        0,
  isLoadingList:     false,
  listError:         null,

  filters:           {},
  pagination:        { page: 1, limit: 50, sort_by: 'NEWEST' },
  searchQuery:       '',

  selectedOrder:     null,
  isLoadingDetail:   false,
  detailError:       null,

  timeline:          [],
  isLoadingTimeline: false,

  auditTrail:        [],
  isLoadingAudit:    false,

  syncStatus:        null,
  isLoadingSyncStatus: false,

  stats:             null,
  isLoadingStats:    false,

  // ── Order List ────────────────────────────────────────────────────────────
  fetchOrders: async (filters, pagination) => {
    const activeFilters    = filters    ?? get().filters;
    const activePagination = pagination ?? get().pagination;

    set({ isLoadingList: true, listError: null });
    try {
      const result = await fetchOrders(activeFilters, activePagination);
      set({
        orders:       result.data || [],
        total:        result.meta.total,
        currentPage:  result.meta.page,
        totalPages:   result.meta.total_pages,
        filters:      activeFilters,
        pagination:   activePagination,
        isLoadingList: false,
      });
    } catch (error: any) {
      set({ listError: error.message, isLoadingList: false });
    }
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchOrdersAction: async (query, filters) => {
    set({ isLoadingList: true, listError: null, searchQuery: query });
    try {
      const activeFilters = filters ?? get().filters;
      const pagination = get().pagination;

      const result = query.trim().length >= 2
        ? await searchOrders(query, activeFilters, pagination)
        : await fetchOrders(activeFilters, pagination);

      set({
        orders:       result.data || [],
        total:        result.meta.total,
        currentPage:  result.meta.page,
        totalPages:   result.meta.total_pages,
        isLoadingList: false,
      });
    } catch (error: any) {
      set({ listError: error.message, isLoadingList: false });
    }
  },

  // ── Order Detail ──────────────────────────────────────────────────────────
  selectOrder: async (orderId) => {
    set({ isLoadingDetail: true, detailError: null, selectedOrder: null });
    try {
      const result = await fetchOrderDetail(orderId);
      set({
        selectedOrder:   result.data,
        isLoadingDetail: false,
      });
      // Auto-load timeline when order is selected
      get().loadTimeline(orderId);
    } catch (error: any) {
      set({ detailError: error.message, isLoadingDetail: false });
    }
  },

  // ── Timeline ──────────────────────────────────────────────────────────────
  loadTimeline: async (orderId) => {
    set({ isLoadingTimeline: true });
    try {
      const result = await fetchTimeline(orderId);
      set({ timeline: result.data?.events || [], isLoadingTimeline: false });
    } catch {
      set({ timeline: [], isLoadingTimeline: false });
    }
  },

  // ── Audit Trail ───────────────────────────────────────────────────────────
  loadAuditTrail: async (orderId, viewerUserId) => {
    set({ isLoadingAudit: true });
    try {
      const result = await fetchAuditTrail(orderId, viewerUserId);
      set({ auditTrail: result.data?.entries || [], isLoadingAudit: false });
    } catch {
      set({ auditTrail: [], isLoadingAudit: false });
    }
  },

  // ── Sync Status ───────────────────────────────────────────────────────────
  loadSyncStatus: async (orderId) => {
    set({ isLoadingSyncStatus: true, syncStatus: null });
    try {
      const result = await fetchSyncStatus(orderId);
      set({ syncStatus: result.data, isLoadingSyncStatus: false });
    } catch {
      set({ syncStatus: null, isLoadingSyncStatus: false });
    }
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  loadStats: async () => {
    set({ isLoadingStats: true });
    try {
      const result = await fetchHistoryStats();
      set({ stats: result.data, isLoadingStats: false });
    } catch {
      set({ isLoadingStats: false });
    }
  },

  // ── Filter & Pagination Controls ─────────────────────────────────────────
  setFilters: (newFilters) => {
    const merged = { ...get().filters, ...newFilters };
    // Remove undefined/null/empty keys
    Object.keys(merged).forEach(k => {
      if (merged[k as keyof HistoryFilters] === undefined || merged[k as keyof HistoryFilters] === '') {
        delete merged[k as keyof HistoryFilters];
      }
    });
    set({ filters: merged, pagination: { ...get().pagination, page: 1 } });
  },

  setPagination: (newPagination) => {
    set({ pagination: { ...get().pagination, ...newPagination } });
  },

  setPage: (page) => {
    set({ pagination: { ...get().pagination, page } });
  },

  clearSelectedOrder: () => {
    set({ selectedOrder: null, timeline: [], auditTrail: [], syncStatus: null });
  },

  refreshList: async () => {
    const { filters, pagination, searchQuery } = get();
    if (searchQuery.trim().length >= 2) {
      await get().searchOrdersAction(searchQuery, filters);
    } else {
      await get().fetchOrders(filters, pagination);
    }
  },
}))
