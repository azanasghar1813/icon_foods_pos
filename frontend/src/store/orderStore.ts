import { create } from 'zustand'
import type { CartItem } from './posStore'
import { fetchOrders, fetchOrderDetail, type HistoryOrderRow, type HistoryOrderDetail } from '../api/historyApi'
import { formatReceiptOrderNumber } from '../utils/receiptOrderNumber'

export type OrderStatus = 'Draft' | 'Held' | 'Active' | 'Completed' | 'Cancelled' | 'Refunded'
export type KitchenStatus = 'Pending' | 'Sent' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Unpaid' | 'Paid' | 'Refunded'
export type PaymentMethod = 'Cash' | 'JazzCash' | 'EasyPaisa' | 'Meezan' | 'Bank Transfer' | 'Debit Card' | 'Credit Card' | 'QR' | 'Store Credit' | 'Mixed'

export interface PaymentRecord {
  id: string
  method: PaymentMethod
  amount: number
  received?: number
  change?: number
  timestamp: string
  cashier: string
  status: 'Completed' | 'Refunded' | 'Pending'
}

export interface SplitRecord {
  id: string
  label: string
  amount: number
  payments: PaymentRecord[]
  status: PaymentStatus
}

export interface AuditLogEntry {
  id: string
  who: string
  when: string
  actionType: string
  oldValue: string
  newValue: string
  reason: string
}

export interface TimelineEvent {
  event: string
  timestamp: string
  cashier: string
  remarks?: string
}

export interface Order {
  id: string
  orderNumber: string
  waiterId?: string
  waiterName?: string
  riderId?: string
  riderName?: string
  cashierName: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  isVip?: boolean
  tableNumber?: string | null
  guestCount?: number
  orderType: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through'
  items: CartItem[]
  subtotal: number
  tax: number
  serviceCharge: number
  deliveryCharge?: number
  discount: number
  isEdited?: boolean
  isNegativeEdit?: boolean
  total: number
  businessDate?: string
  status: OrderStatus
  kitchenStatus: KitchenStatus
  paymentStatus: PaymentStatus
  timestamp: string // Created Time
  lastEdited?: string // Updated Time
  editedBy?: string // Last Editor
  isLocked?: boolean
  lockedBy?: string
  timeline: TimelineEvent[]
  auditLog: AuditLogEntry[]
  notes?: string
  kitchenNotes?: string
  payments: PaymentRecord[]
  splits?: SplitRecord[]
  roundOffAdjustment?: number
  syncStatus?: 'Pending' | 'Synced' | 'Failed'
  receiptReprints?: number
}

interface OrderState {
  orders: Order[]
  orderCounter: number
  isSyncingFromBackend: boolean
  addOrder: (order: Order) => void
  upsertOrder: (order: Order) => void
  updateOrder: (id: string, updates: Partial<Order>) => void
  addAuditLog: (orderId: string, log: Omit<AuditLogEntry, 'id' | 'when'>) => void
  addTimelineEvent: (orderId: string, event: Omit<TimelineEvent, 'timestamp'>) => void
  getOrders: () => Order[]
  lockOrder: (id: string, cashier: string) => void
  unlockOrder: (id: string, override?: boolean) => void
  syncOrdersFromBackend: (filters?: any, options?: { fetchAll?: boolean }) => Promise<void>
}

const mapLifecycleState = (state: string): OrderStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'DRAFT') return 'Draft'
  if (normalized === 'HELD') return 'Held'
  if (normalized === 'ACTIVE') return 'Active'
  if (normalized === 'COMPLETED') return 'Completed'
  if (normalized === 'CANCELLED') return 'Cancelled'
  if (normalized === 'REFUNDED') return 'Refunded'
  return 'Draft'
}

const mapKitchenState = (state: string): KitchenStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'PENDING') return 'Pending'
  if (normalized === 'SENT') return 'Sent'
  if (normalized === 'PREPARING') return 'Preparing'
  if (normalized === 'READY') return 'Ready'
  if (normalized === 'SERVED') return 'Served'
  if (normalized === 'COMPLETED') return 'Completed'
  return 'Pending'
}

const mapPaymentState = (state: string, paidStamp?: any): PaymentStatus => {
  const normalized = String(state || '').toUpperCase()
  if (normalized === 'REFUNDED') return 'Refunded'
  if (normalized === 'PAID') return 'Paid'
  if (paidStamp === true || paidStamp === 1 || paidStamp === '1' || paidStamp === 'true') return 'Paid'
  return 'Unpaid'
}

const formatName = (nameOrId?: string): string => {
  if (!nameOrId) return 'Staff'
  if (nameOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)) {
    return 'Staff'
  }
  return nameOrId
}

const parseBackendDate = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString()
  if (dateStr.includes('T')) {
    // If it's already an ISO string (e.g. from Supabase), new Date() parses it natively
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }
  // If it's SQLite local/UTC format without 'T' (YYYY-MM-DD HH:MM:SS)
  const d = new Date(dateStr.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export const itemVariantName = (item: any): string => {
  const raw = item?.variant || item?.variants?.[0] || null
  return String(
    raw?.variant_name_snapshot
    || raw?.variant_name
    || raw?.name
    || item?.variant_name
    || item?.variant_name_snapshot
    || ''
  ).trim()
}

export const mapHistoryDetailToOrder = (row: HistoryOrderRow, detail?: HistoryOrderDetail): Order => {
  const items = (detail?.items || []).map((item: any, index: number) => {
    const vName = itemVariantName(item)
    const base = item.product_name_snapshot || item.product_name || item.name || 'Item'
    return {
    cartItemId: item.id || `${row.id}-item-${index}`,
    id: item.product_id || item.id || `${row.id}-product-${index}`,
    variant_id: item.variant_id || item.variant?.variant_id || null,
    variant_name: vName || null,
    variant: item.variant || item.variants?.[0] || (vName ? { variant_name_snapshot: vName, variant_name: vName } : null),
    name: base,
    price: Number(item.final_unit_price ?? item.unit_price ?? item.price ?? 0),
    quantity: Number(item.quantity ?? 1),
    subtotal: Number(item.subtotal ?? (Number(item.final_unit_price ?? item.unit_price ?? item.price ?? 0) * Number(item.quantity ?? 1))),
    category: item.category || item.category_name || 'Unknown',
    code: item.code || item.product_code || '',
    selectedModifiers: item.modifiers || item.selectedModifiers || [],
    combo_components: item.combo_components || [],
    addons: item.addons || [],
    notes: item.notes || '',
    isEdited: Boolean(item.is_edited || item.updated_at),
    discount: Number(item.discount_total ?? item.discount ?? 0),
    status: 'Active'
  }
  }) as unknown as CartItem[]

  const payments = (detail?.payments || []).map((payment: any, index: number) => ({
    id: payment.id || `${row.id}-payment-${index}`,
    method: payment.payment_method || payment.method || 'Cash',
    amount: Number(payment.amount || 0),
    received: payment.amount_received ?? payment.received,
    change: payment.change_amount ?? payment.change,
    timestamp: parseBackendDate(payment.created_at || row.updated_at),
    cashier: formatName(payment.cashier_name || row.cashier_user_id),
    status: payment.status || 'Completed'
  })) as PaymentRecord[]

  const timeline = (detail?.timeline || []).map((event: any) => ({
    event: event.event_type || event.notes || 'Event',
    timestamp: parseBackendDate(event.created_at),
    cashier: formatName(event.user_id || event.actor_user_id),
    remarks: event.description || event.notes || ''
  }))

  const auditLog = (detail?.audit_trail || []).map((entry: any) => ({
    id: entry.id,
    who: formatName(entry.user_id),
    when: parseBackendDate(entry.created_at),
    actionType: (entry.action || 'Other') as AuditLogEntry['actionType'],
    oldValue: typeof entry.old_value === 'string' ? entry.old_value : JSON.stringify(entry.old_value ?? ''),
    newValue: typeof entry.new_value === 'string' ? entry.new_value : JSON.stringify(entry.new_value ?? ''),
    reason: entry.reason || ''
  }))

  const isNegativeEdit = Boolean(row.is_edited) && (detail?.timeline || []).some((e: any) => {
    if (e.event_type === 'ITEM_REMOVED') return true;
    if (e.event_type === 'ITEM_QUANTITY_CHANGED') {
      try {
        const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
        if (metadata && metadata.old_qty > metadata.new_qty) return true;
      } catch (err) {}
    }
    return false;
  })

  return {
    id: row.id,
    orderNumber: formatReceiptOrderNumber(row.order_number),
    waiterId: row.waiter_id || undefined,
    waiterName: row.waiter_name_snapshot || row.waiter_name || detail?.metadata?.waiter_name || undefined,
    riderId: row.rider_id || undefined,
    riderName: row.rider_name_snapshot || row.rider_name || detail?.metadata?.rider_name || undefined,
    cashierName: formatName((row as any).cashier_name || row.cashier_user_id),
    customerName: row.customer_name || detail?.metadata?.customer_name || [(detail as any)?.customer?.first_name, (detail as any)?.customer?.last_name].filter(Boolean).join(' ').trim() || 'Guest',
    customerPhone: row.customer_phone || detail?.metadata?.customer_phone || (detail as any)?.customer?.phone || undefined,
    customerAddress: detail?.metadata?.customer_address || (detail as any)?.customer?.address || row.customer_address || undefined,
    isVip: detail?.metadata?.is_vip === 'true' || detail?.metadata?.is_vip === true || detail?.metadata?.is_vip === 1 || String(detail?.metadata?.is_vip) === '1' || row.is_vip === 1 || row.is_vip === true || !!(detail as any)?.customer?.is_vip || false,
    tableNumber: row.table_id || detail?.metadata?.table_number || null,
    guestCount: Number(detail?.metadata?.guest_count ?? 1) || 1,
    orderType: (row.order_type === 'TAKEAWAY' ? 'Takeaway' : row.order_type === 'DELIVERY' ? 'Delivery' : (row.order_type === 'DRIVE_THROUGH' || row.order_type === 'DRIVE_THRU') ? 'Drive Through' : 'Dine In'),
    items,
    ...(() => {
      const foodNet = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      const serviceCharge = Number(detail?.service_charge ?? row.service_charge ?? detail?.metadata?.service_charge ?? 0) || 0
      const deliveryCharge = Number(
        (detail as any)?.delivery_fee
        ?? detail?.delivery_charges
        ?? row.delivery_charges
        ?? detail?.metadata?.delivery_charges
        ?? 0
      ) || 0
      const discount = Number(detail?.discount_total ?? row.discount_total ?? 0) || 0
      let subtotal = Number(detail?.subtotal ?? row.subtotal ?? foodNet ?? 0) || 0
      if (foodNet > 0 && Math.abs(foodNet - subtotal) > 0.5) subtotal = foodNet
      const reconstructed = Math.max(0, subtotal - discount + serviceCharge + deliveryCharge)
      let total = Number(detail?.grand_total ?? row.grand_total ?? reconstructed) || 0
      if (Math.abs(reconstructed - total) > 0.5) total = reconstructed
      return {
        subtotal,
        tax: Number(detail?.tax_total ?? row.tax_total ?? 0) || 0,
        serviceCharge,
        deliveryCharge,
        discount,
        total
      }
    })(),
    businessDate: row.business_date,
    status: mapLifecycleState(row.lifecycle_state),
    kitchenStatus: mapKitchenState(row.kitchen_state),
    paymentStatus: mapPaymentState(row.payment_state, row.receipt_paid_stamp ?? detail?.metadata?.receipt_paid_stamp),
    timestamp: parseBackendDate(row.created_at),
    lastEdited: parseBackendDate(row.updated_at),
    isEdited: Boolean(row.is_edited),
    isNegativeEdit,
    editedBy: undefined,
    isLocked: false,
    lockedBy: undefined,
    timeline,
    auditLog,
    notes: row.notes || detail?.metadata?.notes || undefined,
    kitchenNotes: (typeof detail?.metadata?.kitchen_notes === 'string' && detail.metadata.kitchen_notes.trim())
      ? detail.metadata.kitchen_notes
      : undefined,
    payments,
    splits: undefined,
    roundOffAdjustment: 0,
    syncStatus: 'Synced',
    receiptReprints: 0
  }
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  orderCounter: 1,
  isSyncingFromBackend: false,

  addOrder: (order) => set((state) => ({
    orders: [order, ...state.orders],
    orderCounter: state.orderCounter + 1
  })),

  upsertOrder: (order) => set((state) => {
    const exists = state.orders.some(o => o.id === order.id);
    if (exists) {
      return {
        orders: state.orders.map(o => o.id === order.id ? order : o)
      };
    } else {
      return {
        orders: [order, ...state.orders]
      };
    }
  }),

  updateOrder: (id, updates) => set((state) => ({
    orders: state.orders.map(order =>
      order.id === id ? { ...order, ...updates, lastEdited: new Date().toISOString() } : order
    )
  })),

  addAuditLog: (orderId, log) => set((state) => ({
    orders: state.orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          auditLog: [{ ...log, id: `al-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, when: new Date().toISOString() }, ...order.auditLog]
        }
      }
      return order
    })
  })),

  addTimelineEvent: (orderId, event) => set((state) => ({
    orders: state.orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          timeline: [...order.timeline, { ...event, timestamp: new Date().toISOString() }]
        }
      }
      return order
    })
  })),

  getOrders: () => get().orders,

  lockOrder: (id, cashier) => set(state => ({
    orders: state.orders.map(o =>
      o.id === id ? { ...o, isLocked: true, lockedBy: cashier } : o
    )
  })),

  unlockOrder: (id, _override) => set(state => ({
    orders: state.orders.map(o =>
      o.id === id ? { ...o, isLocked: false, lockedBy: undefined } : o
    )
  })),

  syncOrdersFromBackend: async (filters = {}, options: { fetchAll?: boolean } = {}) => {
    set({ isSyncingFromBackend: true })
    try {
      const pageLimit = options.fetchAll ? 200 : 100
      let page = 1
      const rows: HistoryOrderRow[] = []
      let total = Infinity
      while (rows.length < total) {
        const listResult = await fetchOrders(filters, { page, limit: pageLimit, sort_by: 'NEWEST' })
        const batch = listResult.data || []
        total = Number(listResult.meta?.total ?? (rows.length + batch.length))
        rows.push(...batch)
        if (!options.fetchAll) break
        if (!batch.length) break
        page += 1
        if (page > 100) break
      }
      const detailedOrders = []
      const chunkSize = 10
      
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const chunkResults = await Promise.all(
          chunk.map(async (row: HistoryOrderRow) => {
            try {
              const detailResult = await fetchOrderDetail(row.id)
              return mapHistoryDetailToOrder(row, detailResult.data)
            } catch {
              return mapHistoryDetailToOrder(row)
            }
          })
        )
        detailedOrders.push(...chunkResults)
      }

      let maxBusinessDate = ''
      detailedOrders.forEach(o => {
        if (o.businessDate && (!maxBusinessDate || o.businessDate > maxBusinessDate)) {
          maxBusinessDate = o.businessDate
        }
      })

      const latestOrders = detailedOrders.filter(o => o.businessDate === maxBusinessDate)

      const highestOrderNumber = latestOrders.reduce((max, order) => {
        const parsed = Number(order.orderNumber)
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max
      }, 0)

      set({
        orders: detailedOrders,
        orderCounter: highestOrderNumber + 1,
        isSyncingFromBackend: false
      })
    } catch (error) {
      console.error('Failed to sync backend orders', error)
      set({ isSyncingFromBackend: false })
    }
  }
}))

