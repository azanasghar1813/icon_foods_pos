import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cartService } from '../services/posServices/cartService'
import { apiClient } from '../api/client'
import { useOrderStore } from './orderStore'
import { configApi } from '../api/configApi'
import { useSettingsStore } from './settingsStore'
import { newId } from '../utils/uuid'

const mapCartItems = (items: any[] = []) => (items || []).map((item: any) => {
  const vName = item.variant_name || item.variant?.variant_name_snapshot || item.variants?.[0]?.variant_name_snapshot
  const baseName = item.product_name_snapshot || item.product_name || item.name || 'Unknown'
  return {
    ...item,
    name: vName ? `${baseName} (${vName})` : baseName,
    price: item.final_unit_price ?? item.unit_price ?? item.price ?? 0,
    cartItemId: item._cart_item_id || item.cartItemId || item.id,
    selectedModifiers: item.modifiers || item.selectedModifiers || [],
    combo_components: item.combo_components || item.comboComponents || []
  }
})

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  notes: string | null
  status: string
  modifiers: any[]
  is_tax_inclusive?: boolean
}

export interface ActiveOrder {
  id: string
  order_number: string
  status: string
  order_type: string
  subtotal: number
  tax_total: number
  discount_total: number
  grand_total: number
  service_charge?: number
  items: OrderItem[]
  totals?: any
  hold_name?: string | null
  notes?: string | null
  customer_notes?: string | null
}

export type CartItem = OrderItem & { 
  name: string; 
  price: number; 
  cartItemId: string; 
  selectedModifiers: any[]; 
  editState?: string; 
  removalReason?: string;
  category?: string;
  kitchen?: string;
  code?: string;
  combo_components?: any[];
};

interface POSState {
  // Global App State
  menuContext: 'Fast Food' | 'Restaurant' | 'Deals'
  gridDensity: 'small' | 'medium' | 'large'
  
  // New backend-driven state
  activeOrder: ActiveOrder | null
  isLoadingOrder: boolean
  financeConfig: any | null
  
  checkoutIdempotencyKey: string | null
  paymentIdempotencyKeys: Record<number, string>
  
  // Legacy UI state aliases for compatibility
  cart: CartItem[]
  
  // UI interactions
  editingOrderId: string | null
  customer: any | null
  isVipOrder: boolean
  deliveryCharges: number
  tableNumber: string | null
  waiterId: string | null
  waiterName: string | null
  riderId: string | null
  riderName: string | null
  guestCount: number
  isTaxEnabled: boolean
  previewOrderNumber: string | null
  orderType: string
  openOrders: Record<string, any>
  activeOrderId: string
  startTime: Date

  // Async Backend Actions
  fetchDraftOrder: () => Promise<void>
  refreshPreviewOrderNumber: () => Promise<void>
  loadOrderForEdit: (order: any) => Promise<void>
  setCart: (cart: CartItem[]) => void
  toggleVipOrder: () => void
  addToCart: (product: any, quantity?: number, selectedModifiers?: any[], notes?: string, comboComponents?: any[]) => Promise<void>
  removeFromCart: (cartItemId: string, reason?: string) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  updateItemModifiers: (cartItemId: string, modifiers: any[]) => Promise<void>
  updateItemNotes: (cartItemId: string, notes: string) => Promise<void>
  duplicateItem: (cartItemId: string) => Promise<void>
  holdOrder: (holdName: string) => Promise<void>
  resumeOrder: (orderId: string) => Promise<void>
  completeOrder: (payments?: any[], discountTotal?: number, printPaid?: boolean) => Promise<{ success: boolean; orderId?: string }>
  clearCart: () => void
  resetAfterPlace: () => Promise<void>
  
  // Legacy accessors
  getSubtotal: () => number
  getTax: () => number
  getServiceCharge: () => number
  getGrandTotal: () => number
  getNetTotal: () => number
  getRoundOff: () => number

  // Setters
  setMenuContext: (context: 'Fast Food' | 'Restaurant' | 'Deals') => void
  setGridDensity: (density: 'small' | 'medium' | 'large') => void
  setOrderType: (type: 'Dine In' | 'Takeaway' | 'Delivery' | 'Drive Through') => Promise<void>
  setCustomer: (customer: any | null) => void
  setTableNumber: (table: string | null) => void
  setWaiterId: (waiter: string | null, waiterName?: string | null) => void
  setWaiterName: (name: string | null) => void
  setRiderId: (rider: string | null, riderName?: string | null) => void
  setRiderName: (name: string | null) => void
  setGuestCount: (count: number) => void
  setDeliveryCharges: (amount: number) => void
  toggleTax: () => void
  clearEditMode: () => void
  switchOrder: (orderId: string) => void
}

export const usePosStore = create<POSState>()(
  persist(
    (set, get) => ({
  menuContext: 'Fast Food',
  gridDensity: (localStorage.getItem('pos:gridDensity') as 'small' | 'medium' | 'large') || 'medium',
  
  activeOrder: null,
  isLoadingOrder: false,
  financeConfig: null,
  checkoutIdempotencyKey: null,
  paymentIdempotencyKeys: {},
  
  cart: [],
  setCart: (cart) => set({ cart }),
  
  editingOrderId: null,
  customer: null,
  deliveryCharges: 0,
  isVipOrder: false,
  toggleVipOrder: async () => {
    const nextState = !get().isVipOrder;
    const current = get().customer;
    set({
      isVipOrder: nextState,
      customer: current ? { ...current, is_vip: nextState } : current
    });
    try {
      const state = get();
      if (state.editingOrderId && state.activeOrder?.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, { is_vip: nextState });
        if ((res as any).success) set({ activeOrder: (res as any).data });
      } else if (state.activeOrder) {
        const res = await cartService.setMeta({ is_vip: nextState });
        if ((res as any).success) set({ activeOrder: (res as any).data });
      }
    } catch (e) {
      console.error('Failed to persist VIP:', e);
    }
  },
  tableNumber: null,
  waiterId: null,
  waiterName: null,
  riderId: null,
  riderName: null,
  guestCount: 1,
  isTaxEnabled: true,
  previewOrderNumber: null,
  orderType: 'Dine In',
  openOrders: {},
  activeOrderId: Date.now().toString(),
  startTime: new Date(),

  fetchDraftOrder: async () => {
    if (get().editingOrderId) return; // Do not fetch draft if we are in an active edit session
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.getDraftOrder()
      if ((res as any).success) {
        if (get().editingOrderId) return; // Prevent race condition if an edit started while fetching
        
        let config = get().financeConfig
        if (!config) {
          try {
            const confRes: any = await configApi.getAllConfig()
            const confData = confRes?.data?.data || confRes?.data || confRes
            if (confData?.business?.finance) {
              config = confData.business.finance
              set({ financeConfig: config })
            }
          } catch (e) {
            console.warn('Failed to load finance config', e)
          }
        }
        
        let previewOrderNumber = get().previewOrderNumber
        if (!(res.data as any)?.order_number) {
          try {
            const next = await apiClient.get('/orders/next-number') as any
            previewOrderNumber = next?.data?.order_number || next?.order_number || previewOrderNumber
          } catch { /* keep previous preview */ }
        }
        set({ 
          activeOrder: res.data, 
          previewOrderNumber,
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  refreshPreviewOrderNumber: async () => {
    if (get().editingOrderId) return
    const active = get().activeOrder as any
    if (active?.order_number) return
    try {
      const next = await apiClient.get('/orders/next-number') as any
      const n = next?.data?.order_number || next?.order_number
      if (!n) return
      if (n !== get().previewOrderNumber) {
        set({ previewOrderNumber: n })
      }
    } catch { /* local peek is best-effort; never block the till */ }
  },

  loadOrderForEdit: async (order) => {
    // Silently clear the backend cart WITHOUT triggering fetchDraftOrder
    // This prevents the race condition where fetchDraftOrder overwrites the edit cart
    try { await apiClient.delete('/cart') } catch {}
    
    // Fetch fresh order data from backend to get properly hydrated items
    let backendOrder: any = null
    try {
      const res = await apiClient.get(`/orders/${order.id}`) as any
      if (res?.success && res?.data) {
        backendOrder = res.data
      }
    } catch {}
    
    // Use backend items if available, otherwise fall back to the passed-in order items
    const sourceItems = backendOrder?.items?.length > 0 ? backendOrder.items : order.items
    
    const mappedItems = [...sourceItems].map((i: any) => {
      const price = i.price ?? i.final_unit_price ?? i.unit_price ?? 0;
      const quantity = i.quantity || 1;
      return {
      ...i,
      cartItemId: i.cartItemId || i._cart_item_id || i.id || newId(),
      name: i.name && i.name.includes('(') ? i.name : (() => {
        const vName = i.variant_name || i.variant?.variant_name_snapshot || i.variants?.[0]?.variant_name_snapshot
        const base = i.product_name_snapshot || i.product_name || i.name || 'Item'
        return vName ? `${base} (${vName})` : base
      })(),
      price,
      quantity,
      subtotal: i.subtotal ?? (price * quantity),
      product_name: i.product_name || i.product_name_snapshot || i.name || 'Item',
      product_id: i.product_id || i.id,
      selectedModifiers: i.selectedModifiers || i.modifiers || [],
      combo_components: i.combo_components || i.comboComponents || [],
      notes: i.notes || '',
      category: i.category || i.category_name || 'Unknown',
      code: i.code || i.product_code || '',
    }})
    
    // Build the activeOrder shape from backend data or passed-in order
    const serviceCharge = Number(backendOrder?.service_charge ?? order?.serviceCharge ?? order?.service_charge ?? 0)
    const activeOrder = backendOrder ? {
      id: backendOrder.id,
      order_number: backendOrder.order_number,
      status: backendOrder.lifecycle_state,
      order_type: backendOrder.order_type,
      subtotal: backendOrder.subtotal ?? 0,
      tax_total: backendOrder.tax_total ?? 0,
      discount_total: backendOrder.discount_total ?? 0,
      grand_total: backendOrder.grand_total ?? 0,
      service_charge: serviceCharge,
      items: backendOrder.items || [],
      totals: {
        subtotal: backendOrder.subtotal ?? 0,
        tax_total: backendOrder.tax_total ?? 0,
        discount_total: backendOrder.discount_total ?? 0,
        service_charge: serviceCharge,
      }
    } : { ...order, service_charge: serviceCharge } as any
    
    set({
      editingOrderId: order.id,
      activeOrder,
      cart: mappedItems,
      checkoutIdempotencyKey: null,
      paymentIdempotencyKeys: {},
      orderType: order?.orderType || order?.order_type || (backendOrder?.order_type === 'DINE_IN' ? 'Dine In' : backendOrder?.order_type === 'TAKEAWAY' ? 'Takeaway' : backendOrder?.order_type === 'DELIVERY' ? 'Delivery' : get().orderType),
      tableNumber: order?.tableNumber || order?.table_id || backendOrder?.table_number || backendOrder?.table_id || null,
      waiterId: order?.waiterId || order?.waiter_id || backendOrder?.waiter_id || null,
      waiterName: order?.waiterName || order?.waiter_name || backendOrder?.waiter_name_snapshot || backendOrder?.waiter_name || null,
      riderId: order?.riderId || order?.rider_id || backendOrder?.rider_id || null,
      riderName: order?.riderName || order?.rider_name || backendOrder?.rider_name_snapshot || backendOrder?.rider_name || null,
      isVipOrder: !!(order?.isVip || backendOrder?.is_vip || backendOrder?.metadata?.is_vip === 'true' || backendOrder?.metadata?.is_vip === true || backendOrder?.customer?.is_vip),
      customer: (() => {
        const name = order?.customerName || backendOrder?.metadata?.customer_name || (backendOrder?.customer ? [backendOrder.customer.first_name, backendOrder.customer.last_name].filter(Boolean).join(' ') : null)
        const phone = order?.customerPhone || order?.customer_phone || backendOrder?.metadata?.customer_phone || backendOrder?.customer?.phone || null
        const address = order?.customerAddress || backendOrder?.metadata?.customer_address || backendOrder?.customer?.address || null
        const id = order?.customerId || order?.customer_id || backendOrder?.customer_id || backendOrder?.customer?.id || null
        const vip = !!(order?.isVip || backendOrder?.customer?.is_vip || backendOrder?.metadata?.is_vip === 'true')
        if (!name && !phone && !id) return null
        return { id, name: name || 'Guest', phone, address, is_vip: vip, notes: order?.notes || backendOrder?.metadata?.customer_notes || null }
      })(),
      deliveryCharges: Number(order.deliveryCharges || order.deliveryCharge || order.delivery_charges || order.metadata?.delivery_charges || backendOrder?.delivery_fee || 0)
    })
  },

  addToCart: async (product, quantity = 1, selectedModifiers = [], notes = "") => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.post(`/orders/${state.editingOrderId}/items`, {
          product_id: product.id,
          variant_id: product.variant_id || null,
          variant_name: product.variant_snapshot || product.variant_name || null,
          quantity,
          modifiers: selectedModifiers,
          comboComponents: product.combo_components,
          notes
        })
      } else {
        res = await cartService.addItem({
          product_id: product.id,
          variant_id: product.variant_id || null,
          variant_name: product.variant_snapshot || product.variant_name || null,
          quantity,
          modifiers: selectedModifiers,
          comboComponents: product.combo_components,
          notes
        })
      }
      
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  removeFromCart: async (cartItemId, reason?: string) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.delete(`/orders/${state.editingOrderId}/items/${cartItemId}`, { data: { reason } })
      } else {
        res = await cartService.removeItem(cartItemId)
      }
      
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateQuantity: async (cartItemId, quantity) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      let res: any;
      if (state.editingOrderId) {
        res = await apiClient.put(`/orders/${state.editingOrderId}/items/${cartItemId}`, { quantity })
      } else {
        res = await cartService.updateItemQuantity(cartItemId, quantity)
      }
      
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateItemModifiers: async (cartItemId, modifiers) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      const current = state.cart.find(i => i.cartItemId === cartItemId || i.id === cartItemId)
      const res = state.editingOrderId
        ? await apiClient.put(`/orders/${state.editingOrderId}/items/${cartItemId}`, { quantity: current?.quantity || 1, modifiers })
        : await cartService.updateItemDetails(cartItemId, { modifiers })
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  updateItemNotes: async (cartItemId, notes) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      const current = state.cart.find(i => i.cartItemId === cartItemId || i.id === cartItemId)
      const res = state.editingOrderId
        ? await apiClient.put(`/orders/${state.editingOrderId}/items/${cartItemId}`, { quantity: current?.quantity || 1, notes })
        : await cartService.updateItemDetails(cartItemId, { notes })
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  duplicateItem: async (cartItemId) => {
    set({ isLoadingOrder: true })
    try {
      const state = get()
      const current = state.cart.find(i => i.cartItemId === cartItemId || i.id === cartItemId)
      let res: any
      if (state.editingOrderId && current) {
        res = await apiClient.post(`/orders/${state.editingOrderId}/items`, {
          product_id: current.product_id,
          quantity: current.quantity,
          modifiers: current.selectedModifiers || current.modifiers || [],
          notes: current.notes
        })
      } else {
        res = await cartService.duplicateItem(cartItemId)
      }
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          cart: mapCartItems(res.data?.items)
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  holdOrder: async (holdName) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.holdOrder(holdName)
      if ((res as any).success) {
        set({ activeOrder: null, cart: [], checkoutIdempotencyKey: null, paymentIdempotencyKeys: {} })
        await get().fetchDraftOrder()
      }
      return res
    } catch (e) {
      console.error(e)
      throw e
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  resumeOrder: async (orderId) => {
    set({ isLoadingOrder: true })
    try {
      const res = await cartService.resumeOrder(orderId)
      if ((res as any).success) {
        set({ 
          activeOrder: res.data, 
          checkoutIdempotencyKey: null,
          paymentIdempotencyKeys: {},
          cart: mapCartItems(res.data?.items)
        })
      }
      return res
    } catch (e) {
      console.error(e)
      throw e
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  completeOrder: async (payments: any[] = [], discountTotal: number = 0, printPaid: boolean = false): Promise<{ success: boolean; orderId?: string }> => {
    const state = get()
    if (!state.activeOrder) {
      await get().fetchDraftOrder()
    }
    if (!get().activeOrder) return { success: false }
    
    set({ isLoadingOrder: true })
    try {
      let order = get().activeOrder as any
      
      let checkoutKey = get().checkoutIdempotencyKey;
      if (!checkoutKey) {
        checkoutKey = newId();
        set({ checkoutIdempotencyKey: checkoutKey });
      }

      if (!order.order_number) {
        const checkoutPayload = {
          order_type: state.orderType === 'Delivery' ? 'DELIVERY' : state.orderType === 'Takeaway' ? 'TAKEAWAY' : state.orderType === 'Drive Through' ? 'DRIVE_THROUGH' : 'DINE_IN',
          customer_id: (!state.customer?.is_temp ? state.customer?.id : null) || order.customer_id || null,
          customer_name: state.customer?.name || null,
          customer_phone: state.customer?.phone || null,
          customer_address: state.customer?.address || null,
          is_vip: state.isVipOrder || !!state.customer?.is_vip || !!state.customer?.isVip || false,
          table_id: state.orderType === 'Dine In' ? (state.tableNumber || order.table_id || null) : null,
          waiter_id: state.waiterId || order.waiter_id || null,
          waiter_name_snapshot: state.waiterName || null,
          rider_id: state.riderId || order.rider_id || null,
          rider_name_snapshot: state.riderName || null,
          notes: order.notes || order.customer_notes || null,
          branch_id: order.branch_id || 'DEFAULT_BRANCH',
          business_date: order.business_date,
          delivery_charges: state.orderType === 'Delivery' ? state.deliveryCharges : 0,
          service_charge: state.getServiceCharge(),
          is_tax_enabled: false,
          discount_total: discountTotal
        }

        let checkoutResult: any = null
        try {
          checkoutResult = await cartService.checkout(checkoutPayload, checkoutKey)
        } catch (firstErr) {
          checkoutResult = await cartService.checkout(checkoutPayload, checkoutKey).catch(() => null)
          if (!checkoutResult) throw firstErr
        }

        if (!(checkoutResult as any).success) {
          console.error('Checkout failed:', checkoutResult)
          return { success: false }
        }

        order = (checkoutResult as any).data
        set({ activeOrder: order, cart: mapCartItems(order?.items) })
      } else if (order?.id) {
        try {
          await apiClient.put(`/orders/${order.id}/meta`, {
            is_vip: state.isVipOrder || !!state.customer?.is_vip || !!state.customer?.isVip || false,
            customer_id: (!state.customer?.is_temp ? state.customer?.id : null) || order.customer_id || null,
            customer_name: state.customer?.name || null,
            customer_phone: state.customer?.phone || null,
            customer_address: state.customer?.address || null,
            waiter_id: state.waiterId || order.waiter_id || null,
            waiter_name_snapshot: state.waiterName || null,
            rider_id: state.riderId || order.rider_id || null,
            rider_name_snapshot: state.riderName || null,
            table_id: state.orderType === 'Dine In' ? (state.tableNumber || order.table_id || null) : null,
            service_charge: state.getServiceCharge(),
            receipt_paid_stamp: printPaid,
          })
        } catch (e) {
          console.warn('Could not persist VIP / staff meta on numbered order', e)
        }
      }

      if (order?.id) {
        try {
          await cartService.applyDiscount(order.id, discountTotal || 0, printPaid)
        } catch (e) {
          console.warn('Could not apply discount before payment', e)
        }
      }

      const paymentKeys = get().paymentIdempotencyKeys;
      const updatedPaymentKeys = { ...paymentKeys };
      let remainingDue = Number(
        (order as any).due_total
        ?? (order as any)?.totals?.due_total
        ?? (order as any).grand_total
        ?? get().getNetTotal()
        ?? 0
      );

      for (let i = 0; i < payments.length; i++) {
        if (remainingDue <= 0.005) break;
        const p = payments[i];
        const method = String(p.method || p.paymentMethod || 'CASH').toUpperCase().replace(/ /g, '_')
        if (method === 'LATER' || method === 'UNPAID') continue;
        let paymentKey = updatedPaymentKeys[i];
        if (!paymentKey) {
          paymentKey = newId();
          updatedPaymentKeys[i] = paymentKey;
        }

        await cartService.addPayment(order.id, {
          payment_method: method,
          amount: p.amount,
          amount_received: p.received ?? p.amount,
          transaction_reference: p.transaction_reference || p.reference || null,
          approval_code: p.approval_code || null,
          notes: p.notes || null,
          discount_total: discountTotal,
          print_paid: printPaid
        }, paymentKey)
        remainingDue -= Number(p.amount) || 0
      }
      
      set({ paymentIdempotencyKeys: updatedPaymentKeys });

      await get().resetAfterPlace()
      useOrderStore.getState().syncOrdersFromBackend()
      return { success: true, orderId: order.id }
    } catch (e) {
      console.error(e)
      return { success: false }
    } finally {
      set({ isLoadingOrder: false })
    }
  },

  resetAfterPlace: async () => {
    const orderType = get().orderType
    set({
      activeOrder: null,
      cart: [],
      editingOrderId: null,
      customer: null,
      tableNumber: null,
      waiterId: null,
      waiterName: null,
      riderId: null,
      riderName: null,
      deliveryCharges: 0,
      isVipOrder: false,
      checkoutIdempotencyKey: null,
      paymentIdempotencyKeys: {},
      orderType
    })
    await get().fetchDraftOrder()
  },

  clearCart: () => {
    const orderType = get().orderType
    set({ activeOrder: null, cart: [], editingOrderId: null, customer: null, tableNumber: null, waiterId: null, waiterName: null, riderId: null, riderName: null, deliveryCharges: 0, isVipOrder: false, checkoutIdempotencyKey: null, paymentIdempotencyKeys: {}, orderType })
    void cartService.clearCart().catch(() => {})
    void get().fetchDraftOrder()
  },

  getSubtotal: () => {
    const cart = get().cart || []
    if (cart.length > 0) {
      return cart.reduce((sum, item: any) => {
        const line = Number(item.subtotal)
        if (Number.isFinite(line) && line > 0) return sum + line
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1)
      }, 0)
    }
    return Number(get().activeOrder?.totals?.subtotal ?? get().activeOrder?.subtotal ?? 0) || 0
  },
  getTax: () => {
    return 0;
  },
  getServiceCharge: () => {
    return 0;
  },
  getGrandTotal: () => {
    const sub = get().getSubtotal();
    const tax = get().getTax();
    const service = get().getServiceCharge();
    const discount = Number(get().activeOrder?.totals?.discount_total ?? get().activeOrder?.discount_total ?? 0) || 0;
    const isInclusive = get().activeOrder?.items?.[0]?.is_tax_inclusive === true;
    
    if (isInclusive) {
      return Math.max(0, sub + service - discount);
    }
    return Math.max(0, sub + tax + service - discount);
  },
  getNetTotal: () => {
    const base = get().getGrandTotal();
    const orderType = get().orderType;
    if (orderType === 'Delivery') {
      return base + (get().deliveryCharges || 0);
    }
    return base;
  },
  getRoundOff: () => 0,

  setMenuContext: (context) => set({ menuContext: context }),
  
  setGridDensity: (density) => {
    localStorage.setItem('pos:gridDensity', density)
    set({ gridDensity: density })
  },
  
  setOrderType: async (orderType) => {
    const clearingTable = orderType !== 'Dine In'
    set({ orderType, ...(clearingTable ? { tableNumber: null } : {}) })
    try {
      const typeStr = orderType === 'Dine In' ? 'DINE_IN' : orderType === 'Takeaway' ? 'TAKEAWAY' : orderType === 'Drive Through' ? 'DRIVE_THROUGH' : 'DELIVERY';
      const state = get();
      const meta: any = { order_type: typeStr }
      if (clearingTable) meta.table_id = null
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        // If editing a placed order, we must call the meta update endpoint (which we will create)
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, meta);
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      } else {
        const res = await cartService.setMeta(meta);
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync order type:', e);
    }
  },
  
  setCustomer: async (customer) => {
    const vip = !!(customer?.is_vip || customer?.isVip)
    set({ customer, isVipOrder: customer ? vip : false })
    try {
      const state = get();
      const meta = {
        customer_id: customer?.id || null,
        is_vip: customer ? vip : false,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        customer_address: customer?.address || null
      };
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, meta);
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      } else {
        const res = await cartService.setMeta(meta);
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync customer:', e);
    }
  },
  setTableNumber: async (table) => {
    set({ tableNumber: table })
    try {
      const state = get();
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, { table_id: table });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      } else {
        const res = await cartService.setMeta({ table_id: table });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync table number:', e);
    }
  },
  setWaiterId: async (waiter, newWaiterName) => {
    const nameToUse = newWaiterName !== undefined ? newWaiterName : get().waiterName;
    set({ waiterId: waiter, waiterName: nameToUse })
    try {
      const state = get();
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, { waiter_id: waiter, waiter_name_snapshot: nameToUse });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      } else {
        const res = await cartService.setMeta({ waiter_id: waiter, waiter_name_snapshot: nameToUse });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync waiter ID:', e);
    }
  },
  setWaiterName: (name) => set({ waiterName: name }),
  setRiderId: async (rider, newRiderName) => {
    const nameToUse = newRiderName !== undefined ? newRiderName : get().riderName;
    set({ riderId: rider, riderName: nameToUse })
    try {
      const state = get();
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, { rider_id: rider, rider_name_snapshot: nameToUse });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      } else {
        const res = await cartService.setMeta({ rider_id: rider, rider_name_snapshot: nameToUse });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync rider ID:', e);
    }
  },
  setRiderName: (name) => set({ riderName: name }),
  setGuestCount: (count) => set({ guestCount: count }),
  setDeliveryCharges: async (deliveryCharges) => {
    set({ deliveryCharges })
    try {
      const state = get();
      if (state.editingOrderId && state.activeOrder && state.activeOrder.order_number) {
        const res = await apiClient.put(`/orders/${state.editingOrderId}/meta`, { delivery_charges: deliveryCharges });
        if ((res as any).success) {
          set({ activeOrder: (res as any).data });
        }
      }
    } catch (e) {
      console.error('Failed to sync delivery charges:', e);
    }
  },
  toggleTax: () => set((state) => ({ isTaxEnabled: !state.isTaxEnabled })),
  clearEditMode: async () => {
    await get().resetAfterPlace()
  },
  switchOrder: (orderId) => {
    const existing = useOrderStore.getState().orders.find((o: any) => o.id === orderId)
    if (existing) {
      void get().loadOrderForEdit(existing)
    }
  }
    }),
    {
      name: 'pos-storage',
      partialize: (state) => ({
        cart: state.cart,
        menuContext: state.menuContext,
        gridDensity: state.gridDensity,
        customer: state.customer,
        isVipOrder: state.isVipOrder,
        deliveryCharges: state.deliveryCharges,
        tableNumber: state.tableNumber,
        waiterId: state.waiterId,
        waiterName: state.waiterName,
        riderId: state.riderId,
        riderName: state.riderName,
        guestCount: state.guestCount,
        isTaxEnabled: state.isTaxEnabled,
        orderType: state.orderType,
        openOrders: state.openOrders,
        activeOrderId: state.activeOrderId,
      }),
    }
  )
)
