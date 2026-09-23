import { create } from 'zustand'
import { type Order, useOrderStore } from './orderStore'
import { type CartItem } from './posStore'
import { kitchenService } from '../services/kitchenService'
import { formatReceiptOrderNumber } from '../utils/receiptOrderNumber'

// Fallback ID generator for non-secure contexts (e.g. local IP testing without HTTPS)
const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export type KitchenStatus = 'Waiting' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'
export type KitchenPriority = 'Normal' | 'High' | 'VIP' | 'Rush' | 'Late'

export interface KitchenItem {
  id: string
  cartItemId: string
  name: string
  quantity: number
  modifiers: { name: string }[]
  notes: string | null
  kitchen: string
  status: KitchenStatus
  type: 'ADD' | 'REMOVE' | 'NORMAL'
  combo_components?: Array<{ product_name_snapshot?: string; product_name?: string; quantity?: number; variant_snapshot?: string }>
}

export interface KitchenTicket {
  id: string
  orderId: string
  orderNumber: string
  table: string
  customer: string
  orderType: string
  cashier: string
  orderTime: string
  priority: KitchenPriority
  status: KitchenStatus
  items: KitchenItem[]
  notes: string
  kitchen: string // "Fast Food" | "Restaurant" etc.
  isVip: boolean
  riderName: string | null
  waiterName: string | null
}

interface KdsState {
  tickets: KitchenTicket[]
  filters: {
    status: KitchenStatus | 'All'
    priority: KitchenPriority | 'All'
    kitchen: string | 'All'
    searchQuery: string
  }

  // Actions
  fetchTickets: () => Promise<void>
  updateTicketStatus: (ticketId: string, status: KitchenStatus) => Promise<void>
  updateItemStatus: (ticketId: string, itemId: string, status: KitchenStatus) => Promise<void>
  clearFailedTickets: (ticketIds: string[]) => Promise<void>
  setFilter: (key: keyof KdsState['filters'], value: string) => void
}

export const useKdsStore = create<KdsState>((set, get) => ({
  tickets: [],
  filters: {
    status: 'All',
    priority: 'All',
    kitchen: 'All',
    searchQuery: ''
  },

  fetchTickets: async () => {
    try {
      const res = await kitchenService.getQueue({ monitorMode: true })
      if (res.success && res.data) {
        const backendTickets = (res.data as any).tickets || res.data // handle both shapes
        const mappedTickets: KitchenTicket[] = backendTickets.map((row: any) => {
          // Normalize priority
          let p = row.priority?.toUpperCase() || 'NORMAL'
          if (p === 'RUSH') p = 'Rush'
          if (p === 'NORMAL') p = 'Normal'

          // Normalize Status
          let s = row.kitchen_state?.toUpperCase() || 'PENDING'
          if (s === 'PENDING') s = 'Waiting'
          if (s === 'SENT') s = 'Accepted'
          if (s === 'PREPARING') s = 'Preparing'
          if (s === 'READY') s = 'Ready'
          if (s === 'SERVED') s = 'Served'
          if (s === 'COMPLETED') s = 'Served'
          if (s === 'CANCELLED') s = 'Cancelled'

          return {
            id: row.id,
            orderId: row.id,
            orderNumber: formatReceiptOrderNumber(row.order_number),
            table: row.table_id || 'N/A',
            customer: row.customer_id || 'Guest',
            orderType: row.order_type,
            cashier: row.cashier_name || 'System',
            orderTime: row.created_at ? (row.created_at.includes('Z') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z') : new Date().toISOString(),
            priority: p as KitchenPriority,
            status: s as KitchenStatus,
            isVip: !!row.is_vip,
            riderName: row.rider_name || null,
            waiterName: row.waiter_name || null,
            notes: row.kitchen_notes || row.customer_notes || '',
            kitchen: 'All', // Handle multiple stations if needed
            items: row.items.map((item: any) => {
              let is = item.kitchen_state?.toUpperCase() || 'PENDING'
              if (is === 'PENDING' || is === 'SENT') is = 'Waiting'
              if (is === 'PREPARING') is = 'Preparing'
              if (is === 'READY') is = 'Ready'
              if (is === 'SERVED') is = 'Served'
              if (is === 'COMPLETED') is = 'Served'
              if (is === 'CANCELLED') is = 'Cancelled'

              let type = 'NORMAL'
              if (item.created_at && row.created_at) {
                const itemTime = new Date(item.created_at.includes('Z') ? item.created_at : item.created_at.replace(' ', 'T') + 'Z').getTime()
                const orderTime = new Date(row.created_at.includes('Z') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z').getTime()
                if (itemTime > orderTime + 2000) {
                  type = 'ADD'
                }
              }

              return {
                id: item.id,
                cartItemId: item.id,
                name: item.product_name_snapshot || item.product_name || 'Item',
                quantity: item.quantity,
                modifiers: item.modifiers?.map((m: any) => ({ name: m.modifier_name_snapshot })) || [],
                notes: item.notes || null,
                kitchen: item.category_name || item.kitchen_station_name_snapshot || 'Main Kitchen',
                combo_components: item.combo_components || item.comboComponents || [],
                status: is as KitchenStatus,
                type: type as 'ADD' | 'NORMAL' | 'REMOVE'
              }
            })
          }
        })
        set({ tickets: mappedTickets })
      }
    } catch (error) {
      console.error('Failed to fetch kitchen tickets', error)
    }
  },

  updateTicketStatus: async (ticketId, status) => {
    // Optimistic update
    set(state => ({
      tickets: state.tickets.map(t => t.id === ticketId ? {
        ...t,
        status,
        items: t.items.map(i => ({ ...i, status })) // Cascade status to items visually
      } : t)
    }))

    // Backend doesn't have a batch order status endpoint, so we update each item
    try {
      const ticket = get().tickets.find(t => t.id === ticketId)
      if (ticket) {
        for (const item of ticket.items) {
          try {
            if (status === 'Accepted') await kitchenService.acceptItem(item.id)
            if (status === 'Preparing') await kitchenService.startPreparingItem(item.id)
            if (status === 'Ready') await kitchenService.markItemReady(item.id)
            if (status === 'Served') await kitchenService.markItemServed(item.id)
            if (status === 'Cancelled') await kitchenService.cancelItem(item.id)
          } catch (err) {
            console.error(`Failed to update item ${item.id}`, err)
          }
        }
      }
      get().fetchTickets()
    } catch (e) {
      console.error('Failed to update ticket status', e)
    }
  },

  updateItemStatus: async (ticketId, itemId, status) => {
    // Optimistic update
    set(state => ({
      tickets: state.tickets.map(t =>
        t.id === ticketId
          ? { ...t, items: t.items.map(i => i.id === itemId ? { ...i, status } : i) }
          : t
      )
    }))

    try {
      if (status === 'Preparing') await kitchenService.startPreparingItem(itemId)
      else if (status === 'Ready') await kitchenService.markItemReady(itemId)
      else if (status === 'Served') await kitchenService.markItemServed(itemId)
      else if (status === 'Cancelled') await kitchenService.cancelItem(itemId)

      // Refresh to ensure sync
      get().fetchTickets()
    } catch (error) {
      console.error('Failed to update item status', error)
      // Rollback optimism could go here
    }
  },

  clearFailedTickets: async (ticketIds) => {
    if (!ticketIds.length) return
    await kitchenService.clearFailed(ticketIds)
    set(state => ({
      tickets: state.tickets.filter(t => !ticketIds.includes(t.id))
    }))
    await get().fetchTickets()
  },

  setFilter: (key, value) => {
    set(state => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }))
  }
}))
