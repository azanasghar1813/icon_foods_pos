import React, { useState, useEffect, useRef, useMemo } from "react"

import { usePosStore } from "../store/posStore"
import type { CartItem } from "../store/posStore"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "../store/authStore"
import { useOrderStore } from "../store/orderStore"
import {
  Search, Plus, Minus, User,
  Loader2, Star,
  Utensils, Pizza, CupSoda, CakeSlice,
  Printer, Monitor, LayoutGrid,
  Tag, XOctagon, Receipt, FileText, XCircle,
  Hash, Phone, Edit, Edit2,
  Store, UtensilsCrossed, Truck, CircleDot,
  QrCode, Banknote, Clock, Building2, Percent, X, ShoppingCart,
} from "lucide-react"
import ReceiptPreview from "./ReceiptPreview"
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels"
import { menuService } from "../services/menuService"
import { cartService } from "../services/posServices/cartService"
import { authService } from "../services/authService"
import { apiClient } from "../api/client"
import { newId } from "../utils/uuid"
import { CustomerPanelModal } from "../components/CustomerPanelModal"
import { TableSelectorModal } from "../components/TableSelectorModal"
import { RiderSelectorModal } from "../components/RiderSelectorModal"
import { ActiveOrdersSidebar } from "../components/ActiveOrdersSidebar"
import { DealConfigurationModal } from "../components/DealConfigurationModal"
import type { PaymentMethod } from "../store/orderStore"
import { formatReceiptOrderNumber } from "../utils/receiptOrderNumber"
import { isTypingInField, shouldIgnoreShortcutWhileTyping } from "../utils/keyboard"

type Product = any
type Modifier = any

// Helper to map category names to generic icons
const getCategoryIcon = (name: string) => {
  const n = (name || '').toLowerCase()
  if (n === 'all') return <LayoutGrid className="w-5 h-5" />
  if (n.includes('burger')) return <Utensils className="w-5 h-5" />
  if (n.includes('pizza')) return <Pizza className="w-5 h-5" />
  if (n.includes('drink')) return <CupSoda className="w-5 h-5" />
  if (n.includes('dessert')) return <CakeSlice className="w-5 h-5" />
  if (n.includes('roll')) return <FileText className="w-5 h-5" />
  if (n.includes('pasta')) return <Utensils className="w-5 h-5" />
  if (n.includes('appetizer')) return <Utensils className="w-5 h-5" />
  if (n.includes('sandwich')) return <Utensils className="w-5 h-5" />
  if (n.includes('shawarma')) return <Utensils className="w-5 h-5" />
  if (n.includes('fav')) return <Star className="w-5 h-5" />
  return <Utensils className="w-5 h-5" />
}

// Generate dynamic background gradients for placeholder images based on category
const getCategoryGradient = (category: string) => {
  const n = (category || '').toLowerCase()
  if (n.includes('burger')) return 'bg-gradient-to-br from-orange-400 to-red-500'
  if (n.includes('pizza')) return 'bg-gradient-to-br from-red-500 to-rose-600'
  if (n.includes('drink')) return 'bg-gradient-to-br from-cyan-400 to-blue-500'
  if (n.includes('dessert')) return 'bg-gradient-to-br from-pink-400 to-purple-500'
  return 'bg-gradient-to-br from-gray-400 to-gray-600'
}

const getCategoryStyles = (category: string) => {
  const n = (category || '').toLowerCase()
  if (n.includes('burger') || n.includes('sandwich')) return 'bg-[var(--cat-burgers-bg)] text-[var(--cat-burgers-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('appetizer') || n.includes('fries') || n.includes('side')) return 'bg-[var(--cat-sides-bg)] text-[var(--cat-sides-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('drink') || n.includes('beverage')) return 'bg-[var(--cat-drinks-bg)] text-[var(--cat-drinks-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  if (n.includes('dessert') || n.includes('ice cream')) return 'bg-[var(--cat-desserts-bg)] text-[var(--cat-desserts-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
  return 'bg-[var(--cat-core-bg)] text-[var(--cat-core-text)] border-[length:var(--cat-border-width)] border-[var(--cat-border-color)]'
}

export default function POS() {
  const [activeCategory, setActiveCategory] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartTopRef = useRef<HTMLDivElement>(null)
  const orderNotesRef = useRef<HTMLInputElement>(null)
  const checkoutDiscountRef = useRef<HTMLInputElement>(null)
  const checkoutAmountRef = useRef<HTMLInputElement>(null)
  const deliveryChargesRef = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Layout & Panel State
  // const [leftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Modals state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState("")
  const [activeCartItem, setActiveCartItem] = useState<CartItem | null>(null)
  const [tempModifiers, setTempModifiers] = useState<Modifier[]>([])
  const [tempNotes, setTempNotes] = useState("")

  const [sizeModalOpen, setSizeModalOpen] = useState(false)
  const [activeProductForSize, setActiveProductForSize] = useState<Product | null>(null)
  const [sizeSelectedIndex, setSizeSelectedIndex] = useState(0)

  const [dealModalOpen, setDealModalOpen] = useState(false)
  const [activeDeal, setActiveDeal] = useState<Product | null>(null)
  
  // Responsive State
  const [isDesktop, setIsDesktop] = useState(window.matchMedia('(min-width: 768px)').matches)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    const mq = window.matchMedia('(min-width: 768px)')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [gridSelectedIndex, setGridSelectedIndex] = useState(0)
  const gridProductsRef = useRef<Product[]>([])

  // Cart Mode Navigation
  const [isCartMode, setIsCartMode] = useState(false)
  const [cartSelectedIndex, setCartSelectedIndex] = useState(0)

  // Ref for the product grid container (to read column count)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Restaurant Management Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [riderModalOpen, setRiderModalOpen] = useState(false)
  const [recentOrdersModalOpen, setRecentOrdersModalOpen] = useState(false)

  // Payment Selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [amountReceived, setAmountReceived] = useState<string>("")
  const [discountAmount, setDiscountAmount] = useState<string>("")
  const [isPaidPrint, setIsPaidPrint] = useState(false)
  const [isKdsAutoSend, setIsKdsAutoSend] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [printOrder, setPrintOrder] = useState<any>(null)
  const [kotPreview, setKotPreview] = useState<any>(null)

  // Checkout modal keyboard navigation
  // focusZone: 'methods' | 'discount' | 'amount' | 'quickcash' | 'discountpct' | 'confirm'
  const [checkoutFocusZone, setCheckoutFocusZone] = useState<'methods' | 'discount' | 'amount' | 'quickcash' | 'discountpct' | 'confirm'>('methods')
  const [checkoutMethodIndex, setCheckoutMethodIndex] = useState(0)
  const [checkoutQuickCashIndex, setCheckoutQuickCashIndex] = useState(-1)
  const [checkoutDiscountPctIndex, setCheckoutDiscountPctIndex] = useState(-1)

  // The 4 payment methods
  const CHECKOUT_METHODS: PaymentMethod[] = ['Later' as PaymentMethod, 'Cash', 'QR', 'Meezan']
  const DISCOUNT_PCTS = [3, 5, 10]
  const QUICK_CASH_AMTS = [500, 1000, 5000, 8000]

  const {
    cart, addToCart, removeFromCart, updateQuantity, duplicateItem,
    getSubtotal, getTax, getServiceCharge, getGrandTotal, clearCart, getNetTotal,
    updateItemModifiers, updateItemNotes, orderType, setOrderType,
    setCustomer, gridDensity, tableNumber, setTableNumber, customer,
    waiterId, setWaiterId, waiterName, setWaiterName,
    riderId, setRiderId, riderName, setRiderName,
    isTaxEnabled, toggleTax, menuContext, setMenuContext,
    editingOrderId, clearEditMode, completeOrder, resetAfterPlace,
    deliveryCharges, setDeliveryCharges,
    fetchDraftOrder, financeConfig, activeOrderId, activeOrder, isVipOrder,
    previewOrderNumber
  } = usePosStore()

  const { orderCounter } = useOrderStore()

  const { user } = useAuthStore()

  const placeCartOrder = async () => {
    const state = usePosStore.getState()
    const wasEditing = !!state.editingOrderId
    let currentOrderId = state.editingOrderId || ((state.activeOrder as any)?.order_number ? state.activeOrder?.id : null)

    if (!currentOrderId || !(state.activeOrder as any)?.order_number) {
      const checkoutKey = newId()
      const checkoutResult: any = await cartService.checkout({
        order_type: state.orderType === 'Delivery' ? 'DELIVERY' : state.orderType === 'Takeaway' ? 'TAKEAWAY' : state.orderType === 'Drive Through' ? 'DRIVE_THROUGH' : 'DINE_IN',
        customer_id: (!state.customer?.is_temp ? state.customer?.id : null) || null,
        customer_name: state.customer?.name || null,
        customer_phone: state.customer?.phone || null,
        customer_address: state.customer?.address || null,
        is_vip: state.isVipOrder || !!state.customer?.is_vip || !!state.customer?.isVip || false,
        table_id: state.orderType === 'Dine In' ? (state.tableNumber || null) : null,
        waiter_id: state.waiterId || null,
        waiter_name_snapshot: state.waiterName || null,
        rider_id: state.riderId || null,
        rider_name_snapshot: state.riderName || null,
        delivery_charges: state.orderType === 'Delivery' ? state.deliveryCharges : 0,
        service_charge: state.getServiceCharge(),
        is_tax_enabled: false,
      }, checkoutKey)
      if (!checkoutResult?.success) return { ok: false as const }
      const order = checkoutResult.data
      currentOrderId = order.id
      usePosStore.setState({
        activeOrder: { ...order, service_charge: state.getServiceCharge() },
        previewOrderNumber: order.order_number
      })
    }

    const latest = usePosStore.getState()
    try {
      await apiClient.put(`/orders/${currentOrderId}/meta`, {
        is_vip: !!(latest.isVipOrder || latest.customer?.is_vip || latest.customer?.isVip),
        customer_id: (!latest.customer?.is_temp ? latest.customer?.id : null) || null,
        customer_name: latest.customer?.name || null,
        customer_phone: latest.customer?.phone || null,
        customer_address: latest.customer?.address || null,
        receipt_paid_stamp: isPaidPrint,
      })
    } catch { /* persist is best-effort */ }

    return { ok: true as const, currentOrderId, wasEditing, latest }
  }

  const handleSendKot = async () => {
    try {
      const { usePrinterStore } = await import("../store/printerStore")
      const placed = await placeCartOrder()
      if (!placed.ok) {
        alert("KOT could not be sent. Checkout failed.")
        return
      }
      const { currentOrderId, wasEditing, latest } = placed
      if (!currentOrderId) {
        alert("KOT could not be sent. Checkout failed.")
        return
      }
      const preview = {
        orderNumber: formatReceiptOrderNumber((latest.activeOrder as any)?.order_number || latest.previewOrderNumber),
        orderType: latest.orderType,
        tableNumber: latest.tableNumber,
        cashierName: user?.name || 'Cashier',
        waiterName: latest.waiterName || null,
        riderName: latest.riderName || null,
        isVip: latest.isVipOrder || latest.customer?.is_vip || latest.customer?.isVip || false,
        notes: orderNotes || null,
        timestamp: new Date().toISOString(),
        items: latest.cart.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          selectedModifiers: item.selectedModifiers,
          notes: item.notes,
          combo_components: item.combo_components || item.comboComponents || []
        }))
      }
      try {
        await usePrinterStore.getState().printKitchen(currentOrderId, user?.id || user?.name || 'cashier')
      } catch (e) {
        console.warn("Thermal KOT print failed:", e)
      }
      
      // Always trigger native browser print preview for KOT
      setKotPreview(preview)
      
      useOrderStore.getState().syncOrdersFromBackend()
      if (!wasEditing) {
        await resetAfterPlace()
      }

    } catch (err) {
      console.error(err)
      alert("KOT could not be sent.")
    }
  }

  const handlePrintReceiptFromCart = async () => {
    try {
      const placed = await placeCartOrder()
      if (!placed.ok) {
        alert("Order could not be placed. Receipt was not printed.")
        return
      }
      const { currentOrderId, wasEditing, latest } = placed
      if (!currentOrderId) {
        alert("Order could not be placed. Receipt was not printed.")
        return
      }
      const liveCart = latest.cart || cart
      const currentStoredDiscount = Number((latest.activeOrder as any)?.totals?.discount_total || (latest.activeOrder as any)?.discount_total || 0);
      const appliedDiscount = Number(discountAmount) || currentStoredDiscount || 0;
      const receiptFromCart = {
        items: liveCart.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category,
          selectedModifiers: item.selectedModifiers,
          notes: item.notes,
          combo_components: item.combo_components || item.comboComponents || []
        })),
        subtotal: getSubtotal(),
        serviceCharge: getServiceCharge(),
        deliveryCharge: latest.orderType === 'Delivery' ? (latest.deliveryCharges || 0) : 0,
        discount: appliedDiscount,
        total: Math.max(0, getSubtotal() + getServiceCharge() + (latest.orderType === 'Delivery' ? (latest.deliveryCharges || 0) : 0) - appliedDiscount),
        notes: orderNotes || null
      }

      try {
        const { usePrinterStore } = await import("../store/printerStore")
        const ps = usePrinterStore.getState()
        // Always attempt thermal print if configured, but we won't block the native dialog
        await ps.printReceipt(currentOrderId, user?.id || user?.name || 'cashier', isPaidPrint)
      } catch (e) { console.warn("Thermal print failed", e) }

      try {
        const { fetchOrderDetail } = await import('../api/historyApi')
        const { mapHistoryDetailToOrder } = await import('../store/orderStore')
        const res = await fetchOrderDetail(currentOrderId)
        if (res.success && res.data) {
          const fullOrder = mapHistoryDetailToOrder(res.data, res.data)
          setPrintOrder({
            ...fullOrder,
            ...receiptFromCart,
            paymentStatus: isPaidPrint ? 'Paid' : (fullOrder.paymentStatus || 'Unpaid'),
            tableNumber: latest.orderType === 'Dine In' ? (fullOrder.tableNumber || latest.tableNumber || null) : null
          })
        } else {
          setPrintOrder({
            ...receiptFromCart,
            id: currentOrderId,
            orderNumber: formatReceiptOrderNumber((latest.activeOrder as any)?.order_number || latest.previewOrderNumber),
            orderType: latest.orderType,
            tableNumber: latest.orderType === 'Dine In' ? latest.tableNumber : null,
            customerName: latest.customer?.name || 'Guest',
            cashierName: user?.name || 'Cashier',
            timestamp: new Date().toISOString(),
            paymentStatus: isPaidPrint ? 'Paid' : 'Unpaid'
          } as any)
        }
      } catch {
        setPrintOrder({
          ...receiptFromCart,
          id: currentOrderId,
          orderNumber: formatReceiptOrderNumber((latest.activeOrder as any)?.order_number || latest.previewOrderNumber),
          orderType: latest.orderType,
          tableNumber: latest.orderType === 'Dine In' ? latest.tableNumber : null,
          customerName: latest.customer?.name || 'Guest',
          cashierName: user?.name || 'Cashier',
          timestamp: new Date().toISOString(),
          paymentStatus: isPaidPrint ? 'Paid' : 'Unpaid'
        } as any)
      }

      useOrderStore.getState().syncOrdersFromBackend()
      if (!wasEditing) await resetAfterPlace()
    } catch {
      alert("Order could not be placed. Check the cart and try again.")
    }
  }

  const handleProceedToPay = async () => {
    if (cart.length === 0) return
    if (orderType === 'Delivery' && (!customer || !customer.phone)) {
      setCustomerModalOpen(true)
      return
    }

    setIsProcessing(true)
    try {
      const totalToPay = getNetTotal()
      const existingDiscount = Number((activeOrder as any)?.totals?.discount_total ?? (activeOrder as any)?.discount_total ?? 0) || 0
      const discountVal = Number(discountAmount) || existingDiscount
      const method = isPaidPrint ? 'Cash' : 'Later'
      const shouldPay = method !== 'Later'
      
      const { success, orderId: generatedOrderId } = await completeOrder(
        shouldPay ? [{
          id: `pay-${Date.now()}`,
          method: method,
          amount: totalToPay,
          received: totalToPay,
          change: 0,
          timestamp: new Date().toISOString(),
          cashier: user?.name || 'Cashier',
          status: 'Completed'
        }] : [],
        discountVal,
        true
      )
      
      if (success) {
        setCheckoutModalOpen(false)
        setCartSelectedIndex(0)
        if (generatedOrderId) {
          try {
            const { usePrinterStore } = await import("../store/printerStore")
            const ps = usePrinterStore.getState()
            
            // Send to thermal printer in background if available
            await ps.printReceipt(generatedOrderId, user?.id || user?.name || 'cashier', isPaidPrint)
            
            if (isKdsAutoSend) {
              await ps.printKitchen(generatedOrderId, user?.id || user?.name || 'cashier')
            }
          } catch (e) {
            console.error("Print failed after checkout:", e)
          }

          // Always trigger native browser print preview
          try {
            const { fetchOrderDetail } = await import('../api/historyApi')
            const { mapHistoryDetailToOrder } = await import('../store/orderStore')
            const res = await fetchOrderDetail(generatedOrderId)
            if (res.success && res.data) {
              const fullOrder = mapHistoryDetailToOrder(res.data, res.data)
              setPrintOrder({
                ...fullOrder,
                paymentStatus: isPaidPrint ? 'Paid' : (fullOrder.paymentStatus || 'Unpaid')
              })
            }
          } catch (err) {
            console.error("Failed to load order for print preview:", err)
          }
        }
      } else {
        alert("Operation Failed: Checkout failed.")
      }
    } catch (err) {
      console.error(err)
      alert("Error checking out")
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-assign waiter if logged in user is a waiter
  useEffect(() => {
    if (user && (user.role === 'Waiter' || user.role === '4')) {
      if (!waiterId) {
        setWaiterId(user.id);
        setWaiterName(user.name || (user as any).first_name || 'Waiter');
      }
    }
  }, [user, waiterId, setWaiterId, setWaiterName])

  useEffect(() => {
    return () => {
      // Keep edit mode if the cashier is still on this ticket; only unlock on explicit cancel.
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodsRes, catsRes, dealsRes] = await Promise.all([
          menuService.getProducts(),
          menuService.getCategories(),
          menuService.getDeals().catch(() => ({ data: [] }))
        ])


        const flattenCategories = (cats: any[]): any[] => {
          let result: any[] = [];
          cats.forEach(cat => {
            result.push(cat);
            if (cat.sub_categories && cat.sub_categories.length > 0) {
              result = result.concat(flattenCategories(cat.sub_categories));
            }
          });
          return result;
        }

        const allFetchedCats = flattenCategories(catsRes.data || []);
        const activeCats = allFetchedCats.filter((c: any) => c.status === "Active" || c.lifecycle_state === "ACTIVE")

        const loadedProducts = (prodsRes.data || []).map((p: any) => {
          const primaryImage = p.images?.find((img: any) => img.is_primary === 1)?.image_path || p.images?.[0]?.image_path || null;
          let imagePath = p.image || primaryImage;
          if (imagePath && !imagePath.startsWith('http')) {
            let baseUrl = (import.meta.env.VITE_API_URL || '').replace('/api/v1', '');
            if (typeof window !== 'undefined') {
              if (window.location.port !== '5173') {
                baseUrl = `${window.location.protocol}//${window.location.host}`;
              } else {
                baseUrl = 'http://localhost:5000';
              }
            }
            imagePath = `${baseUrl}${imagePath}`;
          }

          let displayPrice = p.price || 0;
          const seenVar = new Set<string>();
          const variants = (p.variants || []).filter((v: any) => {
            const name = String(v.name || '').trim().toLowerCase();
            const id = String(v.id || '');
            const k = id || name;
            if (!k || seenVar.has(k) || (name && seenVar.has(`n:${name}`))) return false;
            if (id) seenVar.add(id);
            if (name) seenVar.add(`n:${name}`);
            return true;
          });
          if (variants.length > 0) {
            const minVariantPrice = Math.min(...variants.map((v: any) => v.price || 0));
            if (minVariantPrice > 0) {
              displayPrice = minVariantPrice;
            }
          }

          return {
            ...p,
            variants,
            code: p.code || p.product_code,
            category: activeCats.find((c: any) => c.id === p.category_id)?.name || 'Unknown',
            image: imagePath,
            displayPrice: displayPrice
          }
        })

        const loadedDeals = (dealsRes.data || []).map((deal: any) => ({
          ...deal,
          isDeal: true,
          category: 'Deals',
          id: deal.id,
          name: deal.name,
          price: deal.price,
          code: deal.code,
        }))

        setProducts([...loadedProducts, ...loadedDeals])

        const catsWithContext = activeCats.filter((c: any) => !(c.sub_categories && c.sub_categories.length > 0));

        const preferredOrder = [
          'Regular Pizza',
          'Premium Pizza',
          'Square Pizza',
          'Burgers',
          'Shawarma',
          'Pratha Rolls',
          'Special Rolls',
          'Pasta',
          'Appetizers',
          'Sandwich',
          'Extra Toppings',
          'Hot & Cold Drinks',
          'Special Drinks',
          'Chicken',
          'Mutton',
          'Beef',
          'Bar BQ',
          'Spicy Injected Broast',
          'Rices',
          'Starters',
          'Tandoor',
          'Chinese Gravy',
          'Noodles',
          'Soups',
          'Salads',
          'Ice Cream',
          'Bar-B-Q Platers'
        ];

        const sortedCats = catsWithContext.sort((a: any, b: any) => {
          const indexA = preferredOrder.indexOf(a.name);
          const indexB = preferredOrder.indexOf(b.name);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        setCategories([{ id: "all", name: "All" }, { id: "fav", name: "Favorites" }, ...sortedCats])

        // Fetch user's current draft order from backend
        await fetchDraftOrder()
      } catch (err) {
        console.error("Failed to load POS data:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()

    const handleSyncComplete = () => {
      console.log('[POS] Catalog sync complete, refetching POS data...')
      fetchData()
    }

    window.addEventListener('catalog-sync-complete', handleSyncComplete)
    return () => {
      window.removeEventListener('catalog-sync-complete', handleSyncComplete)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      void usePosStore.getState().refreshPreviewOrderNumber()
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setSearchSelectedIndex(0)
    }, 100)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Latest POS keyboard context. The window listener is registered once so
  // adding to the cart / moving the highlight cannot tear it down mid-keypress.
  const keyCtxRef = useRef<Record<string, any>>({})
  keyCtxRef.current = {
    cart, checkoutModalOpen, customizeModalOpen, sizeModalOpen,
    customerModalOpen, tableModalOpen, riderModalOpen, recentOrdersModalOpen,
    waiterId, waiterName, riderId, riderName, tableNumber, customer, isVipOrder, deliveryCharges,
    activeProductForSize, editingOrderId, sizeSelectedIndex, gridSelectedIndex,
    isCartMode, cartSelectedIndex, gridDensity, checkoutFocusZone, checkoutMethodIndex,
    checkoutQuickCashIndex, checkoutDiscountPctIndex, selectedPaymentMethod, discountAmount,
    storedDiscount: Number((activeOrder as any)?.totals?.discount_total ?? (activeOrder as any)?.discount_total ?? 0) || 0,
    orderType, categories, activeCategory, products, dealModalOpen, searchQuery,
    handleSendKot, handleProceedToPay, getNetTotal, addToCart, removeFromCart,
    updateQuantity, clearCart, duplicateItem, clearEditMode, setWaiterId, setRiderId,
    setTableNumber, setCustomer, setDeliveryCharges, toggleTax, setOrderType,
  }

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        cart, checkoutModalOpen, customizeModalOpen, sizeModalOpen,
        customerModalOpen, tableModalOpen, riderModalOpen, recentOrdersModalOpen,
        waiterId, waiterName, riderId, riderName, tableNumber, customer, isVipOrder, deliveryCharges,
        activeProductForSize, editingOrderId, sizeSelectedIndex, gridSelectedIndex,
        isCartMode, cartSelectedIndex, gridDensity, checkoutFocusZone, checkoutMethodIndex,
        checkoutQuickCashIndex, checkoutDiscountPctIndex, selectedPaymentMethod,
        orderType, categories: categoriesRaw, activeCategory, products: productsRaw, dealModalOpen, searchQuery,
        handleSendKot, handleProceedToPay, getNetTotal, storedDiscount, addToCart, removeFromCart,
        updateQuantity, clearCart, clearEditMode, setWaiterId, setRiderId,
        setTableNumber, setCustomer, setDeliveryCharges, toggleTax,
      } = keyCtxRef.current
      const categories: any[] = Array.isArray(categoriesRaw) ? categoriesRaw : []
      const products: Product[] = Array.isArray(productsRaw) ? productsRaw : []

      const isTyping = isTypingInField(e)
      const searchEl = searchInputRef.current
      const inSearch = !!(searchEl && (e.target === searchEl || document.activeElement === searchEl))
      const searchEmpty = !String(searchQuery || '').trim()
      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      const gridKeysFromEmptySearch = inSearch && searchEmpty && (isArrow || (e.key === 'Enter' && !e.ctrlKey))

      // Customer panel owns the keyboard — never steal type/paste/copy
      if (customerModalOpen) return

      // 1. Modal specific shortcuts that override everything
      if (dealModalOpen) return;

      if (sizeModalOpen && activeProductForSize) {
        if (e.key === "Escape") {
          setSizeModalOpen(false)
          searchInputRef.current?.blur()
          return
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSizeSelectedIndex(s => Math.min(s + 1, (activeProductForSize.variants?.length || 1) - 1))
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSizeSelectedIndex(s => Math.max(s - 1, 0))
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          const matchedSize = activeProductForSize.variants?.[sizeSelectedIndex]
          if (matchedSize) {
            addToCart({ ...activeProductForSize, variant_id: matchedSize.id, variant_snapshot: matchedSize.name, variant_name: matchedSize.name, name: `${activeProductForSize.name} (${matchedSize.name})`, price: matchedSize.price, code: matchedSize.code || activeProductForSize.code });
            setSizeModalOpen(false);
            setActiveProductForSize(null);
            setSearchQuery("");
            searchInputRef.current?.blur();
            setTimeout(() => cartTopRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
          return
        }
        const key = e.key.toLowerCase();
        const matchedSizeByLetter = activeProductForSize.variants?.find((s: any) => s.name.charAt(0).toLowerCase() === key);
        if (matchedSizeByLetter) {
          e.preventDefault();
          addToCart({ ...activeProductForSize, variant_id: matchedSizeByLetter.id, variant_snapshot: matchedSizeByLetter.name, variant_name: matchedSizeByLetter.name, name: `${activeProductForSize.name} (${matchedSizeByLetter.name})`, price: matchedSizeByLetter.price, code: matchedSizeByLetter.code || activeProductForSize.code });
          setSizeModalOpen(false);
          setActiveProductForSize(null);
          setSearchQuery("");
          searchInputRef.current?.blur();
          setTimeout(() => cartTopRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        return
      }

      if (customizeModalOpen) {
        if (e.key === "Escape") {
          setCustomizeModalOpen(false)
          searchInputRef.current?.blur()
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
          e.preventDefault()
          setCustomizeModalOpen(false)
          searchInputRef.current?.blur()
        }
        return
      }

      // ── Checkout Modal Arrow-Key Navigation ──
      if (checkoutModalOpen) {
        // Amount / discount fields must keep caret, digits, paste, backspace
        if (isTyping && e.key !== "Escape" && e.key !== "F6" && !((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
          return
        }
        if (e.key === "Escape" || e.key === "F6") {
          e.preventDefault()
          setCheckoutModalOpen(false)
          searchInputRef.current?.blur()
          return
        }
        if (e.key === "Enter" || (e.ctrlKey && e.key === 'Enter')) {
          e.preventDefault()
          // Ctrl+Enter always confirms immediately
          if (e.ctrlKey) {
            // Prevent immediate confirm if we just opened the modal with Ctrl+Enter
            if (Date.now() - ((window as any)._checkoutOpenedAt || 0) < 500) return
            document.getElementById('confirm-payment-btn')?.click()
            return
          }
          // Enter on methods zone: confirm/select the highlighted method
          if (checkoutFocusZone === 'methods') {
            const method = CHECKOUT_METHODS[checkoutMethodIndex]
            if (method) {
              setSelectedPaymentMethod(prev => prev === method ? null : method)
            }
            return
          }
          // Enter on discount-pct pill: apply that percentage
          if (checkoutFocusZone === 'discountpct' && checkoutDiscountPctIndex >= 0) {
            const pct = DISCOUNT_PCTS[checkoutDiscountPctIndex]
            const raw = getNetTotal() + (Number(storedDiscount) || 0)
            setDiscountAmount(Math.round(raw * pct / 100).toString())
            return
          }
          // Enter on quick-cash button: apply that amount
          if (checkoutFocusZone === 'quickcash' && checkoutQuickCashIndex >= 0) {
            const amt = QUICK_CASH_AMTS[checkoutQuickCashIndex]
            setAmountReceived(amt.toString())
            return
          }
          // Enter on amount zone: move to confirm button
          if (checkoutFocusZone === 'amount') {
            setCheckoutFocusZone('confirm')
            return
          }
          // Enter on confirm zone OR anywhere else: print
          document.getElementById('confirm-payment-btn')?.click()
          return
        }

        // Arrow navigation inside checkout modal
        const isCash = selectedPaymentMethod === 'Cash'

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          if (checkoutFocusZone === 'methods') {
            const dir = e.key === 'ArrowRight' ? 1 : -1
            setCheckoutMethodIndex(i => Math.max(0, Math.min(CHECKOUT_METHODS.length - 1, i + dir)))
            setSelectedPaymentMethod(CHECKOUT_METHODS[Math.max(0, Math.min(CHECKOUT_METHODS.length - 1, checkoutMethodIndex + dir))])
          } else if (checkoutFocusZone === 'quickcash') {
            // 4 quick cash buttons: 500, 1000, 8000, Exact
            const dir = e.key === 'ArrowRight' ? 1 : -1
            setCheckoutQuickCashIndex(i => Math.max(0, Math.min(3, i + dir)))
          } else if (checkoutFocusZone === 'discountpct') {
            const dir = e.key === 'ArrowRight' ? 1 : -1
            setCheckoutDiscountPctIndex(i => Math.max(0, Math.min(DISCOUNT_PCTS.length - 1, i + dir)))
          }
          return
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (checkoutFocusZone === 'methods') {
            setCheckoutFocusZone('discount')
            setCheckoutDiscountPctIndex(-1)
          } else if (checkoutFocusZone === 'discount') {
            setCheckoutFocusZone('discountpct')
            setCheckoutDiscountPctIndex(0)
          } else if (checkoutFocusZone === 'discountpct') {
            setCheckoutFocusZone('amount')
          } else if (checkoutFocusZone === 'amount') {
            setCheckoutFocusZone('quickcash')
            setCheckoutQuickCashIndex(0)
          } else if (checkoutFocusZone === 'quickcash') {
            setCheckoutFocusZone('confirm')
            setCheckoutQuickCashIndex(-1)
          }
          return
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (checkoutFocusZone === 'confirm') {
            setCheckoutFocusZone('quickcash')
            setCheckoutQuickCashIndex(QUICK_CASH_AMTS.length - 1)
          } else if (checkoutFocusZone === 'quickcash') {
            setCheckoutFocusZone('amount')
            setCheckoutQuickCashIndex(-1)
          } else if (checkoutFocusZone === 'amount') {
            setCheckoutFocusZone('discountpct')
            setCheckoutDiscountPctIndex(0)
          } else if (checkoutFocusZone === 'discountpct') {
            setCheckoutFocusZone('discount')
            setCheckoutDiscountPctIndex(-1)
          } else if (checkoutFocusZone === 'discount') {
            setCheckoutFocusZone('methods')
          }
          return
        }

        return
      }

      // 2. Global Shortcuts — never steal keys while the cashier is typing.
      // Empty product search is an exception: arrows/Enter still drive the grid.
      if (shouldIgnoreShortcutWhileTyping(e) && !gridKeysFromEmptySearch) return

      // CTRL + ArrowUp/ArrowDown: Cycle Categories
      if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const currentContext = usePosStore.getState().menuContext
        const visibleCats = categories.filter(c => {
          if (!(c.menuContext === 'all' || !c.menuContext || c.menuContext === currentContext)) return false
          if (c.name === 'All') return true
          return products.some((p: any) => {
            if (p.lifecycle_state === 'HIDDEN' && !p.isDeal) return false
            if (c.name === 'Favorites') return !!(p.isFavorite || p.isPopular)
            return (p.category || categories.find((cat: any) => cat.id === p.category_id)?.name) === c.name
          })
        })
        const currentIdx = visibleCats.findIndex(c => c.name === activeCategory)
        
        let nextIdx = 0
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < visibleCats.length - 1 ? currentIdx + 1 : 0
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : visibleCats.length - 1
        }
        
        const nextCat = visibleCats[nextIdx]
        if (nextCat) {
          setActiveCategory(nextCat.name)
          setGridSelectedIndex(0)
        }
        return
      }

      // CTRL + TAB: Cycle Order Type (Also Alt + O as fallback since browsers intercept Ctrl+Tab)
      if ((e.ctrlKey && e.key === 'Tab' && !e.shiftKey) || (e.altKey && e.key.toLowerCase() === 'o')) {
        e.preventDefault()
        const types: ('Dine In' | 'Takeaway' | 'Delivery')[] = ['Dine In', 'Takeaway', 'Delivery']
        const currentType = usePosStore.getState().orderType
        const nextIndex = (types.indexOf(currentType as any) + 1) % types.length
        usePosStore.getState().setOrderType(types[nextIndex])
      }

      // CTRL + SHIFT + TAB: Switch Menu Context (Fast Food / Restaurant / Deals)
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        const contexts: ('Fast Food' | 'Restaurant' | 'Deals')[] = ['Fast Food', 'Restaurant', 'Deals']
        const currentContext = usePosStore.getState().menuContext
        const nextIndex = (contexts.indexOf(currentContext as any) + 1) % contexts.length
        usePosStore.getState().setMenuContext(contexts[nextIndex])
        setActiveCategory("All")
        setGridSelectedIndex(0)
        return
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (cart.length > 0) void handleSendKot()
        return
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        if (usePosStore.getState().orderType !== 'Delivery') {
          void usePosStore.getState().setOrderType('Delivery')
        }
        setTimeout(() => deliveryChargesRef.current?.focus(), 50)
        return
      }

      // CTRL + C: Toggle Customer Panel (if not copying text)
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (!window.getSelection()?.toString()) {
          e.preventDefault()
          setCustomerModalOpen(prev => !prev)
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setRecentOrdersModalOpen(prev => !prev)
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setIsPaidPrint(prev => !prev)
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        usePosStore.getState().toggleVipOrder()
        return
      }



      if (e.ctrlKey && e.key.toLowerCase() === 'z' && editingOrderId) {
        e.preventDefault()
        if (confirm("Cancel editing and discard changes?")) {
          clearEditMode()
        }
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (cart.length > 0) {
          setActiveCartItem(cart[0])
          setTempNotes(cart[0].notes || "")
          setTempModifiers(cart[0].selectedModifiers)
          setCustomizeModalOpen(true)
        }
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault()
            if (usePosStore.getState().orderType === 'Dine In') {
              setTableModalOpen(prev => !prev)
            }
            break
          case 'n':
            if (!e.shiftKey) { // we already handled shift+n
              e.preventDefault()
              orderNotesRef.current?.focus()
            }
            break
          case 's':
            e.preventDefault()
            toggleTax()
            break
        }
      }

      // Function keys & Escape
      if (dealModalOpen && e.key !== 'Escape') return;

      switch (e.key) {
        case "F1":
          // Switch to Fast Food section
          e.preventDefault()
          usePosStore.getState().setMenuContext('Fast Food')
          setActiveCategory("All")
          setGridSelectedIndex(0)
          setIsCartMode(false)
          break
        case "F2":
          // Switch to Restaurant section
          e.preventDefault()
          usePosStore.getState().setMenuContext('Restaurant')
          setActiveCategory("All")
          setGridSelectedIndex(0)
          setIsCartMode(false)
          break
        case "F3":
          // Switch to Deals section
          e.preventDefault()
          usePosStore.getState().setMenuContext('Deals')
          setActiveCategory("All")
          setGridSelectedIndex(0)
          setIsCartMode(false)
          break
        case "F4":
          //recent orders
          e.preventDefault()
          setRecentOrdersModalOpen(prev => !prev)
          break
        case "F5":
          // Focus search
          e.preventDefault()
          searchInputRef.current?.focus()
          break
        case "F6":
          e.preventDefault()
          handleProceedToPay()
          break
        case "F7":
          e.preventDefault()
          usePosStore.getState().setOrderType('Dine In')
          break
        case "F8":
          e.preventDefault()
          usePosStore.getState().setOrderType('Takeaway')
          break
        case "F9":
          e.preventDefault()
          usePosStore.getState().setOrderType('Delivery')
          break
        case "Escape":
          if (customerModalOpen) {
            setCustomerModalOpen(false)
          } else if (tableModalOpen) {
            setTableModalOpen(false)
          } else if (riderModalOpen) {
            setRiderModalOpen(false)
          } else if (recentOrdersModalOpen) {
            setRecentOrdersModalOpen(false)
          } else if (waiterId || waiterName || riderId || riderName || tableNumber || customer || isVipOrder || deliveryCharges) {
            e.preventDefault()
            setWaiterId(null, null)
            setRiderId(null, null)
            setTableNumber(null)
            setCustomer(null)
            setDeliveryCharges(0)
            usePosStore.setState({ isVipOrder: false })
          } else if (isCartMode) {
            setIsCartMode(false)
          } else {
            e.preventDefault()
            clearCart()
          }
          break
      }

      // 3. Shortcuts that should ONLY run if NOT typing
      if (isTyping && !gridKeysFromEmptySearch) return

      if (dealModalOpen) return

      // Tab key: toggle Cart Mode
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (!checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
          e.preventDefault()
          const nextCartMode = !isCartMode
          setIsCartMode(nextCartMode)
          if (nextCartMode && cart.length > 0) {
            setCartSelectedIndex(0)
          }
          return
        }
      }

      // Autofocus search on any single character key press (only in menu mode)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !isCartMode) {
        if (!checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
          searchInputRef.current?.focus()
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (!checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
          if (orderType === 'Delivery') {
            setRiderModalOpen(true)
          }
        }
        return
      }

      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length > 0 && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
          e.preventDefault()
          handleProceedToPay()
        }
      }

      if (e.key === 'Delete') {
        if (cart.length > 0) {
          e.preventDefault()
          clearCart()
        }
      }

      // ── CART MODE Navigation ──
      if (isCartMode && cart.length > 0 && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setCartSelectedIndex(s => Math.max(s - 1, 0))
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setCartSelectedIndex(s => Math.min(s + 1, cart.length - 1))
          return
        }
        if (e.key === 'ArrowRight') {
          // Increase quantity of selected cart item
          e.preventDefault()
          const selectedCartItem = cart[cartSelectedIndex]
          if (selectedCartItem) {
            updateQuantity(selectedCartItem.cartItemId, selectedCartItem.quantity + 1)
          }
          return
        }
        if (e.key === 'ArrowLeft') {
          // Decrease quantity of selected cart item
          e.preventDefault()
          if (e.repeat) return
          if (usePosStore.getState().isLoadingOrder) return
          const selectedCartItem = cart[cartSelectedIndex]
          if (selectedCartItem) {
            if (selectedCartItem.quantity > 1) {
              updateQuantity(selectedCartItem.cartItemId, selectedCartItem.quantity - 1)
            } else {
              removeFromCart(selectedCartItem.cartItemId)
              setCartSelectedIndex(s => Math.max(s - 1, 0))
            }
          }
          return
        }
        if (e.key === 'Backspace') {
          // Remove selected cart item
          e.preventDefault()
          if (e.repeat) return
          if (usePosStore.getState().isLoadingOrder) return
          const selectedCartItem = cart[cartSelectedIndex]
          if (selectedCartItem) {
            removeFromCart(selectedCartItem.cartItemId)
            setCartSelectedIndex(s => Math.max(s - 1, 0))
          }
          return
        }
        return // Consume all other keys in cart mode
      }

      // ── MENU MODE: Backspace removes top cart item ──
      if (!isCartMode) {
        if (e.key === 'Backspace' || e.key === '-' || e.key === 'Subtract') {
          if (e.repeat) return
          if (usePosStore.getState().isLoadingOrder) return
          if (cart.length > 0 && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen) {
            e.preventDefault()
            const topItem = cart[0]
            if (topItem.quantity > 1) {
              updateQuantity(topItem.cartItemId, topItem.quantity - 1)
            } else {
              removeFromCart(topItem.cartItemId)
            }
          }
        }
      }

      // ── MENU MODE: 4-directional Grid Navigation ──
      if (!isCartMode && !isTyping && !checkoutModalOpen && !customizeModalOpen && !sizeModalOpen && !customerModalOpen && !tableModalOpen && !recentOrdersModalOpen) {
        // Helper: get number of columns in the grid
        const getGridColumns = (): number => {
          const firstGrid = document.querySelector('.grid.gap-4')
          if (firstGrid) {
            const style = window.getComputedStyle(firstGrid)
            const cols = style.getPropertyValue('grid-template-columns')
            if (cols && cols !== 'none') {
              return cols.trim().split(/\s+/).length
            }
          }
          // Fallback based on gridDensity
          if (gridDensity === 'small') return 4
          if (gridDensity === 'medium') return 3
          return 2
        }

        if (e.key === "ArrowDown") {
          e.preventDefault()
          const cols = getGridColumns()
          const total = gridProductsRef.current.length
          if (total <= 0) return
          setGridSelectedIndex(s => Math.max(0, Math.min(s + cols, total - 1)))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          const cols = getGridColumns()
          const total = gridProductsRef.current.length
          if (total <= 0) return
          setGridSelectedIndex(s => Math.max(0, Math.min(s - cols, total - 1)))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          const total = gridProductsRef.current.length
          if (total <= 0) return
          setGridSelectedIndex(s => Math.min(s + 1, total - 1))
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          const total = gridProductsRef.current.length
          if (total <= 0) return
          setGridSelectedIndex(s => Math.max(s - 1, 0))
        } else if (e.key === "Enter" && !e.ctrlKey) {
          e.preventDefault()
          searchInputRef.current?.blur()
          const selectedProduct = gridProductsRef.current[gridSelectedIndex]
          if (selectedProduct) {
            if (selectedProduct.isDeal && selectedProduct.components && selectedProduct.components.length > 0) {
              const availableProducts = products.filter(p => !p.isDeal);
              let needsConfiguration = false;
              const autoComboComponents: any[] = [];
              for (const comp of selectedProduct.components) {
                let allowedProducts = availableProducts;
                if (comp.component_type === 'FIXED_PRODUCT') {
                  const p = availableProducts.find(prod => prod.id === comp.product_id);
                  allowedProducts = p ? [p] : [];
                } else {
                  if (comp.target_category_id) {
                    allowedProducts = allowedProducts.filter(p => p.category_id === comp.target_category_id);
                  }
                  if (comp.allowed_product_ids) {
                    const ids = comp.allowed_product_ids.split(',');
                    allowedProducts = allowedProducts.filter(p => ids.includes(p.id));
                  }
                  if (allowedProducts.length === 0 && comp.name) {
                    const compName = comp.name.toLowerCase();
                    if (compName.includes('pizza')) {
                      allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('pizza'));
                    } else if (compName.includes('burger')) {
                      allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('burger'));
                    } else if (compName.includes('drink') || compName.includes('beverage')) {
                      allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('drink') || p.category?.toLowerCase().includes('beverage'));
                    }
                  }
                }
                const isPizza = comp.name?.toLowerCase().includes('pizza');
                if (isPizza && (allowedProducts.length > 1 || (allowedProducts.length === 1 && allowedProducts[0].variants?.length > 0 && !comp.target_variant_name))) {
                  needsConfiguration = true;
                  break;
                } else {
                  const compFallbackName = comp.name || products.find(p => p.id === comp.product_id)?.name || categories.find(cat => cat.id === comp.target_category_id)?.name || (comp.allowed_product_ids ? 'Choice of Item' : 'Item');
                  const p = allowedProducts.length === 1 ? allowedProducts[0] : {
                    id: 'dummy-' + comp.id,
                    name: compFallbackName,
                    product_name_snapshot: compFallbackName,
                    variant_snapshot: comp.target_variant_name || '',
                    is_dummy: true,
                    price: 0
                  };
                  autoComboComponents.push({
                    component_id: comp.id,
                    product_id: p.id,
                    product_name_snapshot: p.name || p.product_name_snapshot || compFallbackName,
                    variant_snapshot: comp.target_variant_name || p.variant_snapshot || null,
                    price_adjustment: comp.price_adjustment || 0,
                    quantity: comp.quantity || 1
                  });
                }
              }
              if (!needsConfiguration) {
                addToCart({ ...selectedProduct, combo_components: autoComboComponents });
                setTimeout(() => cartTopRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              } else {
                setActiveDeal(selectedProduct)
                setDealModalOpen(true)
              }
            } else if (selectedProduct.variants && selectedProduct.variants.length > 0) {
              setActiveProductForSize(selectedProduct)
              setSizeSelectedIndex(0)
              setSizeModalOpen(true)
              searchInputRef.current?.blur()
            } else {
              addToCart(selectedProduct)
              setTimeout(() => cartTopRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Keep cartSelectedIndex in bounds if cart shrinks
  useEffect(() => {
    if (cartSelectedIndex >= cart.length && cart.length > 0) {
      setCartSelectedIndex(cart.length - 1)
    }
    if (cart.length === 0) {
      setIsCartMode(false)
      setCartSelectedIndex(0)
    }
  }, [cart.length, cartSelectedIndex])

  // Auto-scroll to selected cart item in cart mode
  useEffect(() => {
    if (isCartMode) {
      const el = document.getElementById(`cart-item-${cartSelectedIndex}`)
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [cartSelectedIndex, isCartMode])

  // Auto-focus the discount or amount input when keyboard nav lands on them
  useEffect(() => {
    if (!checkoutModalOpen) return
    if (checkoutFocusZone === 'discount') {
      setTimeout(() => checkoutDiscountRef.current?.focus(), 30)
    } else if (checkoutFocusZone === 'amount') {
      setTimeout(() => checkoutAmountRef.current?.focus(), 30)
    }
  }, [checkoutFocusZone, checkoutModalOpen])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])



  // Keep the selected category visible in the left list
  useEffect(() => {
    const el = document.getElementById(`pos-cat-${activeCategory.replace(/\s+/g, '-')}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeCategory])

  const visibleCategories = categories;

  const productCategoryName = (p: Product) => p.category || categories.find(c => c.id === p.category_id)?.name

  const productInMenuContext = (p: Product) => {
    return true
  }

  const sidebarCategories = visibleCategories.filter((c: any) => {
    if (c.name === 'All') return true
    return products.some((p: any) => {
      if (!productInMenuContext(p)) return false
      if (c.name === 'Favorites') return !!(p.isFavorite || p.isPopular)
      return productCategoryName(p) === c.name
    })
  })

  // Grid Category Filtering
  const gridFilteredProducts = products.filter((p: any) => {
    if (p.lifecycle_state === 'HIDDEN' && !p.isDeal) return false
    
    const q = searchQuery.toLowerCase()
    const matchSearch = p.name?.toLowerCase().includes(q) || 
                        p.code?.toLowerCase().includes(q) || 
                        p.barcode?.toLowerCase().includes(q) || 
                        p.category?.toLowerCase().includes(q)

    if (q) return matchSearch

    if (activeCategory === "All") return true
    if (activeCategory === "Favorites") return !!(p.isFavorite || p.isPopular)

    return (p.category || categories.find((cat: any) => cat.id === p.category_id)?.name) === activeCategory
  }).sort((a, b) => {
    // 1. Sort by Category Render Order
    const catA = productCategoryName(a);
    const catB = productCategoryName(b);
    
    const idxA = visibleCategories.findIndex(c => c.name === catA);
    const idxB = visibleCategories.findIndex(c => c.name === catB);

    if (idxA !== idxB) {
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    }

    // 2. Sort by display_order for products, deals by code number
    if (a.isDeal && b.isDeal) {
      const aNum = parseInt((a.code || '').replace('D', '')) || 0;
      const bNum = parseInt((b.code || '').replace('D', '')) || 0;
      return aNum - bNum;
    }

    const codeA = parseInt(a.code || '') || parseInt(a.product_code || '') || 999999;
    const codeB = parseInt(b.code || '') || parseInt(b.product_code || '') || 999999;

    if (codeA !== 999999 && codeB !== 999999 && codeA !== codeB) {
      return codeA - codeB;
    }

    const orderA = a.display_order || 9999;
    const orderB = b.display_order || 9999;
    if (orderA !== orderB) return orderA - orderB;

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  })

  useEffect(() => {
    gridProductsRef.current = gridFilteredProducts
    if (gridSelectedIndex >= gridFilteredProducts.length) {
      setGridSelectedIndex(Math.max(0, gridFilteredProducts.length - 1))
    }
  }, [gridFilteredProducts, gridSelectedIndex])

  useEffect(() => {
    const element = document.getElementById(`grid-item-${gridSelectedIndex}`)
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [gridSelectedIndex])

  // Global Search Filtering & Sorting
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return []
    const q = debouncedSearchQuery.toLowerCase().trim()
    const matches = products.filter(p => {
      if (p.lifecycle_state === 'HIDDEN' && !p.isDeal) return false;
      const pName = p.name.toLowerCase().replace(/\s+/g, '')
      const pCode = (p.code || '').toLowerCase()
      const pCategory = (p.category || '').toLowerCase().replace(/\s+/g, '')
      const searchStr = q.replace(/\s+/g, '')
      
      const matchesCategory = pCategory.includes(searchStr) || 
                              (p.isDeal && 'deals'.includes(searchStr));

      return pName.includes(searchStr) || pCode.includes(searchStr) || matchesCategory
    })

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase().replace(/\s+/g, '')
      const bName = b.name.toLowerCase().replace(/\s+/g, '')
      const aCode = (a.code || '').toLowerCase()
      const bCode = (b.code || '').toLowerCase()
      const searchStr = q.replace(/\s+/g, '')

      // 1. Exact Code
      if (aCode === searchStr && bCode !== searchStr) return -1
      if (bCode === searchStr && aCode !== searchStr) return 1

      // 2. Exact Name
      if (aName === searchStr && bName !== searchStr) return -1
      if (bName === searchStr && aName !== searchStr) return 1

      // 3. Starts With
      const aStarts = aName.startsWith(searchStr) || aCode.startsWith(searchStr)
      const bStarts = bName.startsWith(searchStr) || bCode.startsWith(searchStr)
      if (aStarts && !bStarts) return -1
      if (bStarts && !aStarts) return 1

      // 5. Popularity
      if (a.isPopular && !b.isPopular) return -1
      if (b.isPopular && !a.isPopular) return 1

      // 6. Alphabetical
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [products, debouncedSearchQuery])

  useEffect(() => {
    if (isSearchFocused && searchResults.length > 0) {
      const activeEl = document.getElementById(`search-item-${searchSelectedIndex}`)
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isSearchFocused, searchResults, searchSelectedIndex])

  const scrollToTop = () => {
    setTimeout(() => {
      cartTopRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const handleProductClick = (product: Product, selectedVariantName?: string) => {
    // Handle Deals
    if (product.isDeal && product.components && product.components.length > 0) {
      const availableProducts = products.filter(p => !p.isDeal);
      let needsConfiguration = false;
      const autoComboComponents: any[] = [];

      for (const comp of product.components) {
        let allowedProducts = availableProducts;
        if (comp.component_type === 'FIXED_PRODUCT') {
          const p = availableProducts.find(prod => prod.id === comp.product_id);
          allowedProducts = p ? [p] : [];
        } else {
          if (comp.target_category_id) {
            allowedProducts = allowedProducts.filter(p => p.category_id === comp.target_category_id);
          }
          if (comp.allowed_product_ids) {
            const ids = comp.allowed_product_ids.split(',');
            allowedProducts = allowedProducts.filter(p => ids.includes(p.id));
          }

          // Fallback heuristic if seeding mismatched categories
          if (allowedProducts.length === 0 && comp.name) {
            const compName = comp.name.toLowerCase();
            if (compName.includes('pizza')) {
              allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('pizza'));
            } else if (compName.includes('burger')) {
              allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('burger'));
            } else if (compName.includes('drink') || compName.includes('beverage')) {
              allowedProducts = availableProducts.filter(p => p.category?.toLowerCase().includes('drink') || p.category?.toLowerCase().includes('beverage'));
            }
          }
        }

        const isPizza = comp.name?.toLowerCase().includes('pizza');

        if (isPizza && (allowedProducts.length > 1 || (allowedProducts.length === 1 && allowedProducts[0].variants?.length > 0 && !comp.target_variant_name))) {
          needsConfiguration = true;
          break;
        } else {
          const compFallbackName = comp.name || products.find(p => p.id === comp.product_id)?.name || categories.find(cat => cat.id === comp.target_category_id)?.name || (comp.allowed_product_ids ? 'Choice of Item' : 'Item');
          const p = allowedProducts.length === 1 ? allowedProducts[0] : {
            id: 'dummy-' + comp.id,
            name: compFallbackName,
            product_name_snapshot: compFallbackName,
            variant_snapshot: comp.target_variant_name || '',
            is_dummy: true,
            price: 0
          };
          autoComboComponents.push({
            component_id: comp.id,
            product_id: p.id,
            product_name_snapshot: p.name || p.product_name_snapshot || compFallbackName,
            variant_snapshot: comp.target_variant_name || p.variant_snapshot || null,
            price_adjustment: comp.price_adjustment || 0,
            quantity: comp.quantity || 1
          });
        }
      }

      if (!needsConfiguration) {
        addToCart({ ...product, combo_components: autoComboComponents });
        setSearchQuery("");
        searchInputRef.current?.blur();
        scrollToTop();
        return;
      }

      setActiveDeal(product);
      setDealModalOpen(true);
      setSearchQuery("") // Clear search
      searchInputRef.current?.blur() // Remove focus so modal can capture events
      return;
    }

    // Check if a specific variant was clicked directly
    if (selectedVariantName) {
      const variant = product.variants?.find((v: any) => v.name === selectedVariantName);
      if (variant) {
        addToCart({
          ...product,
          variant_id: variant.id,
          name: `${product.name} (${variant.name})`,
          price: variant.price,
          code: variant.code || product.code,
          variant_snapshot: variant.name,
          variant_name: variant.name
        });
        setSearchQuery("");
        searchInputRef.current?.blur();
        scrollToTop();
        return;
      }
    }

    // Check if variant selection is needed
    if (product.variants && product.variants.length > 0) {
      setActiveProductForSize(product)
      setSizeModalOpen(true)
      setSizeSelectedIndex(0)
      searchInputRef.current?.blur()
      return
    }

    addToCart(product)
    setSearchQuery("")
    searchInputRef.current?.blur()
    scrollToTop()
  }

  // Fast Order Entry
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery || searchResults.length === 0) return
    handleProductClick(searchResults[searchSelectedIndex] || searchResults[0])
  }

  const saveCustomize = () => {
    if (activeCartItem) {
      updateItemModifiers(activeCartItem.cartItemId, tempModifiers)
      updateItemNotes(activeCartItem.cartItemId, tempNotes)
    }
    setCustomizeModalOpen(false)
    searchInputRef.current?.blur()
  }

  const toggleTempModifier = (mod: Modifier) => {
    const exists = tempModifiers.find(m => m.name === mod.name)
    if (exists) {
      setTempModifiers(tempModifiers.filter(m => m.name !== mod.name))
    } else {
      setTempModifiers([...tempModifiers, mod])
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    )
  }

  const renderProductGrid = () => (
    <>
          {/* Center Header: Search & Filters */}
          <div className="p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:flex-1 max-w-md" onFocus={() => setIsSearchFocused(true)} onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsSearchFocused(false)
              }
            }}>
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  const dropdownOpen = !!searchQuery.trim() && searchResults.length > 0
                  if (e.key === "Escape") {
                    if (searchQuery) {
                      e.preventDefault(); e.stopPropagation(); setSearchQuery("");
                    }
                  } else if (dropdownOpen && e.key === "ArrowDown") {
                    e.preventDefault(); setSearchSelectedIndex(s => Math.min(s + 1, Math.max(0, searchResults.length - 1)));
                  } else if (dropdownOpen && e.key === "ArrowUp") {
                    e.preventDefault(); setSearchSelectedIndex(s => Math.max(s - 1, 0));
                  } else if (dropdownOpen && (e.key === "Enter" || e.key === "Tab")) {
                    if (sizeModalOpen) return; // let global listener handle size selection
                    e.preventDefault(); e.stopPropagation();
                    if (searchResults[searchSelectedIndex]) {
                      handleProductClick(searchResults[searchSelectedIndex])
                    }
                  } else if (e.key === "Backspace" && e.ctrlKey) {
                    setSearchQuery("")
                  }
                }}
                placeholder="Search Product Name, Product Code, Barcode..."
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-card border border-border focus:border-orange-500 focus:bg-background outline-none text-base font-bold transition-all placeholder:text-muted-foreground shadow-sm"
              />

              {/* Global Search Dropdown */}
              <AnimatePresence>
                {isSearchFocused && debouncedSearchQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden z-50 max-h-[60vh] flex flex-col"
                  >
                    {searchResults.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-muted-foreground">
                        <Search className="w-12 h-12 opacity-20 mb-3" />
                        <p className="font-bold">No matching products found</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto custom-scrollbar p-2">
                        {searchResults.map((product, index) => {
                          const isSelected = index === searchSelectedIndex
                          return (
                            <button
                              type="button"
                              id={`search-item-${index}`}
                              key={product.id}
                              onMouseEnter={() => setSearchSelectedIndex(index)}
                              onClick={() => handleProductClick(product)}
                              className={`w-full flex items-center gap-4 p-3 rounded-xl text-left transition-colors ${isSelected ? 'bg-secondary border-orange-500/50' : 'bg-transparent border-transparent'} border`}
                            >
                              <div className={`w-12 h-12 rounded-lg shrink-0 overflow-hidden relative ${!product.image ? getCategoryGradient(product.category) : ''}`}>
                                {product.image ? (
                                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/50">
                                    {getCategoryIcon(product.category)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground border border-border shrink-0">{product.code}</span>
                                  <h4 className="font-bold text-sm truncate">{product.name}</h4>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span className="font-bold text-orange-500">Rs {(product.displayPrice !== undefined ? product.displayPrice : product.price).toLocaleString()}</span>
                                  <span>•</span>
                                  <span className="truncate">{product.category}</span>
                                  {(product.isPopular || product.isFavorite) && <span>•</span>}
                                  {product.isPopular && <span className="bg-red-500/10 text-red-500 px-1 rounded font-bold text-[10px] uppercase">Popular</span>}
                                  {product.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                </div>
                              </div>
                              {product.stockStatus && (
                                <div className="shrink-0 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                                  {product.stockStatus}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar-mobile custom-scrollbar pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setRecentOrdersModalOpen(true)}
                className="shrink-0 flex items-center gap-2 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-500/20 dark:text-orange-400 px-3 py-2 rounded-xl text-xs font-bold border border-orange-200 dark:border-orange-500/30 transition-colors shadow-sm"
              >
                <Receipt className="w-4 h-4" />
                Active Orders
              </button>
            </div>
          </div>

          {/* Category list + Product Grid */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            <nav
              aria-label="Menu categories"
              className="shrink-0 flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar hide-scrollbar-mobile border-b md:border-b-0 md:border-r border-border bg-card md:w-[176px]"
            >
              <p className="hidden md:block px-2 pt-1 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categories</p>
              {sidebarCategories.map((cat: any) => {
                const isActive = activeCategory === cat.name
                const count = products.filter((p: any) => {
                  if (!productInMenuContext(p)) return false
                  if (cat.name === 'All') return true
                  if (cat.name === 'Favorites') return !!(p.isFavorite || p.isPopular)
                  return productCategoryName(p) === cat.name
                }).length
                return (
                  <button
                    type="button"
                    key={cat.id}
                    id={`pos-cat-${cat.name.replace(/\s+/g, '-')}`}
                    onClick={() => {
                      setActiveCategory(cat.name)
                      setGridSelectedIndex(0)
                      setIsCartMode(false)
                    }}
                    title={cat.name}
                    className={`shrink-0 md:w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'text-foreground hover:bg-secondary bg-secondary/50 md:bg-transparent'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {getCategoryIcon(cat.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-black leading-tight line-clamp-2 whitespace-nowrap md:whitespace-normal">{cat.name}</span>
                      <span className={`hidden md:block text-[10px] font-bold ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>
            <div className="flex-1 p-4 pt-3 overflow-y-auto custom-scrollbar" ref={gridContainerRef}>
            {activeCategory !== "All" && activeCategory !== "Favorites" && (
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-black text-foreground">{activeCategory}</h3>
                <span className="text-xs font-bold text-muted-foreground">{gridFilteredProducts.length} {gridFilteredProducts.length === 1 ? 'item' : 'items'}</span>
              </div>
            )}
            <div className="space-y-8">
            {visibleCategories.map(cat => {
              const catProducts = gridFilteredProducts.filter(p => productCategoryName(p) === cat.name);
              
              if (catProducts.length === 0) return null;

              const showSectionHeader = activeCategory === "All" || activeCategory === "Favorites";

              return (
                <div key={cat.id} className="mb-2">
                  {showSectionHeader && (
                  <h3 
                    id={`category-${cat.name.replace(/\s+/g, '-')}`}
                    className="w-full text-base sm:text-xl font-black mb-4 flex items-center gap-3 p-2 sm:p-3 pl-4 rounded-xl relative overflow-hidden shadow-sm"
                  >
                    <div className="absolute inset-0 bg-orange-600 border border-orange-700 rounded-xl pointer-events-none"></div>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-800 rounded-l-xl pointer-events-none"></div>
                    <span className="relative z-10 flex items-center gap-3 text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
                        {getCategoryIcon(cat.name)}
                      </div>
                      {cat.name}
                    </span>
                  </h3>
                  )}
                  <div className={`grid gap-4 ${gridDensity === 'small' ? 'grid-cols-4 md:grid-cols-5 xl:grid-cols-6' :
                    gridDensity === 'medium' ? 'grid-cols-3 md:grid-cols-4 xl:grid-cols-5' :
                      'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                    }`}>
                    {catProducts.map((product) => {
                      const index = gridFilteredProducts.indexOf(product);
                      const isSelected = index === gridSelectedIndex;
                      return (
                        <motion.div
                          id={`grid-item-${index}`}
                          whileHover={{ y: -4 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          key={product.id}
                          onMouseEnter={() => setGridSelectedIndex(index)}
                          onClick={() => handleProductClick(product)}
                          className={`rounded-[1.25rem] shadow-sm overflow-hidden flex flex-col text-left hover:opacity-90 transition-all group relative cursor-pointer ${getCategoryStyles(product.category || categories.find(c => c.id === product.category_id)?.name)} ${isSelected ? 'ring-4 ring-orange-500 dark:ring-primary shadow-[0_8px_30px_rgba(249,115,22,0.3)] scale-[1.02]' : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)]'}`}
                        >
                          {gridDensity !== 'small' && (
                            <div className={`${gridDensity === 'large' ? 'h-32' : 'h-24'} w-full relative overflow-hidden shrink-0 ${!product.image ? getCategoryGradient(product.category || categories.find(c => c.id === product.category_id)?.name) : ''}`}>
                              {product.isDeal ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-white/90 bg-black/10 mix-blend-overlay">
                                  <div className="w-full text-[10px] overflow-hidden text-center space-y-0.5">
                                    {product.components?.slice(0, gridDensity === 'large' ? 5 : 4).map((c: any, i: number) => {
                                      const productName = c.name || products.find(p => p.id === c.product_id)?.name || categories.find(cat => cat.id === c.target_category_id)?.name || (c.allowed_product_ids ? 'Choice of Item' : 'Item');
                                      const variant = c.target_variant_name ? ` (${c.target_variant_name})` : ""
                                      return <p key={i} className="truncate">{c.quantity}x {productName}{variant}</p>;
                                    })}
                                    {product.components?.length > (gridDensity === 'large' ? 5 : 4) && <p>...</p>}
                                  </div>
                                </div>
                              ) : product.image ? (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/50 mix-blend-overlay">
                                  {getCategoryIcon(product.category)}
                                </div>
                              )}
                              {/* Subtle Code Badge */}
                              <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest text-foreground shadow-sm">
                                {product.code}
                              </div>
                            </div>
                          )}
                          <div className="p-4 flex flex-col flex-1 relative">
                            {gridDensity === 'small' && (
                              <div className="absolute top-3 right-3 text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                {product.code}
                              </div>
                            )}
                            <h4 className={`font-bold line-clamp-3 leading-tight flex-1 text-foreground ${gridDensity === 'small' ? 'pr-8' : 'pr-0'} ${gridDensity === 'large' ? 'text-base' : 'text-[13px]'}`}>
                              {product.name}
                            </h4>
                            {!(product.variants && product.variants.length > 0) && (
                              <p className={`text-orange-500 dark:text-primary font-black mt-2 ${gridDensity === 'large' ? 'text-2xl' : 'text-lg'}`}>
                                Rs {product.displayPrice !== undefined ? product.displayPrice.toLocaleString() : product.price.toLocaleString()}
                              </p>
                            )}
                            
                            {/* Variant Chips */}
                            {product.variants && product.variants.length > 0 && (
                              <div className="mt-3 grid grid-cols-2 gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {product.variants.map((v: any, vi: number) => (
                                  <button
                                    key={v.id || `${product.id}-var-${vi}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProductClick(product, v.name);
                                    }}
                                    className="text-[10px] sm:text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-colors border border-orange-500/30 rounded-md px-1 py-1.5 flex flex-col items-center justify-center truncate"
                                  >
                                    <span className="truncate w-full">{v.name}</span>
                                    <span className="text-[9px] opacity-80">Rs {v.price.toLocaleString()}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {gridFilteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-full min-h-[50vh]">
                <Search className="w-16 h-16 opacity-20 mb-4" />
                <h2 className="text-2xl font-bold">No products found</h2>
              </div>
            )}
            </div>
            </div>
          </div>
    </>
  );

  const renderCartPanel = () => (
    <>
          {rightCollapsed ? (
            <div className="flex-1 flex flex-col items-center justify-start p-2 gap-4 pt-4 border-l border-border">
              <button onClick={() => setRightCollapsed(false)} className="p-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-400">
                <Receipt className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden" data-pos-cart>
              {/* Cart Mode Indicator */}
              {isCartMode && (
                <div className="px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Cart Mode</span>
                  </div>
                  <span className="text-[9px] text-orange-400 font-bold">↑↓ Select · ← Minus · → Plus · Backspace Remove · Tab Exit</span>
                </div>
              )}
              {/* Header: Order Info */}
              <div className="p-3 border-b border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-black tracking-wider text-foreground text-sm mb-1 mt-1">{formatReceiptOrderNumber(activeOrder?.order_number || previewOrderNumber)}</h2>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <button
                      onClick={() => usePosStore.getState().toggleVipOrder()}
                      className={`px-3 py-1 rounded-full font-black text-[11px] uppercase tracking-widest shadow-sm border flex items-center gap-1.5 transition-colors ${
                        (isVipOrder || customer?.is_vip || customer?.isVip)
                          ? "bg-gradient-to-r from-amber-200 to-yellow-500 text-yellow-950 border-yellow-400/50"
                          : "bg-secondary/60 text-muted-foreground border-transparent hover:border-border"
                      }`}
                    >
                      <Star className={`w-3 h-3 ${ (isVipOrder || customer?.is_vip || customer?.isVip) ? 'fill-yellow-950' : '' }`} />
                      VIP {(isVipOrder || customer?.is_vip || customer?.isVip) ? 'ON' : 'OFF'}
                    </button>
                  </div>


                </div>

                <div className="flex w-full rounded-lg border border-blue-500 overflow-hidden shadow-sm">
                    {(['Dine In', 'Takeaway', 'Delivery'] as const).map((type, index) => (
                      <button 
                        key={type} 
                        onClick={() => setOrderType(type)} 
                        className={`flex-1 py-1.5 flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                          orderType === type 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white text-blue-500 hover:bg-blue-50 dark:bg-card dark:text-blue-500 dark:hover:bg-blue-500/10'
                        } ${index < 2 ? 'border-r border-blue-500' : ''}`}
                      >
                        {type === 'Dine In' ? <Store className="w-4 h-4" /> : type === 'Takeaway' ? <UtensilsCrossed className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                        {type}
                      </button>
                    ))}
                </div>
              </div>

              {/* Edit Mode Badge */}
              {editingOrderId && (
                <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2">
                    <Edit className="w-4 h-4 text-orange-500" />
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Editing Order</span>
                  </div>
                  <button onClick={clearEditMode} className="text-[10px] font-bold bg-orange-500/20 text-orange-600 px-2 py-1 rounded hover:bg-orange-500 hover:text-white transition-colors">
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* Customer & Table Management */}
              <div className="p-2 border-b border-border bg-card grid gap-2 grid-cols-2">
                <div className="relative">
                  <button onClick={() => setCustomerModalOpen(true)} className="flex items-center gap-2 p-2 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/80 shadow-md transition-all text-left w-full h-full">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      {(customer?.is_vip || customer?.isVip || isVipOrder) ? <Star className="w-4 h-4 text-orange-500 fill-orange-500" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="overflow-hidden pr-4 flex-1">
                      <p className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-1">Customer {(isVipOrder || customer?.is_vip || customer?.isVip) && <span className="text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded ml-1">VIP</span>}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground truncate">{customer?.name || customer?.first_name || "Select"}</p>
                    </div>
                  </button>
                  {customer && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCustomer(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Clear Customer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => setTableModalOpen(true)} className="flex flex-col items-start justify-center p-2 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/80 shadow-md transition-all w-full h-full">
                    <p className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Table</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">{tableNumber || "Select"}</p>
                  </button>
                  {tableNumber && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setTableNumber(null); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Clear Table"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <PanelGroup orientation="vertical" className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Panel: Cart Items */}
                <Panel defaultSize={50} minSize={30} className="flex flex-col relative overflow-hidden">
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 h-full">
                    <div ref={cartTopRef} />
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[200px]">
                        <CircleDot className="w-12 h-12 opacity-20 mb-4 text-orange-500" />
                        <p className="font-bold text-sm">Order is empty</p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {cart.map((item, index) => {
                          const isCartItemSelected = isCartMode && index === cartSelectedIndex
                          return (
                            <motion.div
                              layout
                              id={`cart-item-${index}`}
                              key={item.cartItemId || `cart-item-${index}`}
                              className={`border rounded-xl p-3 flex gap-3 relative group transition-all duration-100 ${isCartItemSelected
                                ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.25)] scale-[1.01]'
                                : item.editState === 'removed' ? 'bg-red-500/5 border-red-500/40 opacity-80' :
                                  item.editState === 'new' ? 'bg-card border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' :
                                    item.editState === 'modified' ? 'bg-card border-red-500/60' : 'bg-card border-border'
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-black text-sm truncate ${item.editState === 'removed' || item.editState === 'modified' ? 'text-red-600' : 'text-foreground'} ${item.editState === 'removed' ? 'line-through' : ''}`}>
                                    {item.name || "Unknown Item"}
                                  </p>
                                  {item.editState === 'new' && <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                  {item.editState === 'modified' && <span className="text-[10px] bg-red-500/15 text-red-600 px-1.5 py-0.5 rounded font-black">EDITED</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className={`flex items-center border border-border rounded-lg bg-secondary ${item.editState === 'removed' ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <button onClick={() => {
                                      if (item.quantity > 1) {
                                        updateQuantity(item.cartItemId, item.quantity - 1)
                                      } else {
                                        removeFromCart(item.cartItemId)
                                      }
                                    }} className="p-1 hover:bg-background rounded">
                                      <Minus className="w-4 h-4 text-foreground" />
                                    </button>
                                    <span className={`w-8 text-center font-bold text-sm ${item.editState === 'removed' ? 'line-through' : ''}`}>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="p-1 hover:bg-secondary rounded">
                                      <Plus className="w-4 h-4 text-foreground" />
                                    </button>
                                  </div>
                                </div>
                                {item.removalReason && (
                                  <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
                                    <XOctagon className="w-3 h-3" /> {item.removalReason}
                                  </p>
                                )}
                                {/* Combo components visualizer */}
                                {item.combo_components && item.combo_components.length > 0 && (
                                  <div className="mt-2 text-[11px] text-muted-foreground border-t border-border pt-2">
                                    <ul className="space-y-0.5">
                                      {item.combo_components.map((comp: any, cidx: number) => (
                                        <li key={cidx} className="flex gap-1">
                                          <span className="text-orange-500 font-bold">•</span>
                                          <span>
                                            {comp.quantity > 1 ? `${comp.quantity}x ` : ''}{comp.product_name_snapshot} {comp.variant_snapshot && `(${comp.variant_snapshot})`}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className={`font-black ${item.editState === 'removed' || item.editState === 'modified' ? 'text-red-600' : 'text-foreground'} ${item.editState === 'removed' ? 'line-through' : ''}`}>
                                  Rs {(item.subtotal || 0).toLocaleString()}
                                </p>
                                {item.editState !== 'removed' && (
                                  <button
                                    onClick={() => {
                                      removeFromCart(item.cartItemId)
                                    }}
                                    className="text-red-500 hover:text-red-600 mt-2 ml-auto block group"
                                  >
                                    <XOctagon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </Panel>

                <PanelResizeHandle className="h-1 bg-border/50 hover:bg-orange-500/50 transition-colors cursor-row-resize z-50 flex items-center justify-center group relative">
                  <div className="absolute inset-x-0 h-4 -top-1.5 flex items-center justify-center cursor-row-resize">
                    <div className="w-12 h-1 bg-border/80 group-hover:bg-orange-500 rounded-full transition-colors" />
                  </div>
                </PanelResizeHandle>

                {/* Bottom Panel: Subtotal & Actions */}
                <Panel defaultSize={50} minSize={25} className="flex flex-col bg-card z-10">
                  <div className="p-3 flex flex-col h-full overflow-y-auto custom-scrollbar">
                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Subtotal</span>
                        <span>Rs {getSubtotal().toLocaleString()}</span>
                      </div>

                      {(() => {
                        const storedDiscount = Number((activeOrder as any)?.totals?.discount_total ?? (activeOrder as any)?.discount_total ?? 0) || 0;
                        const localDiscount = Number(discountAmount) || 0;
                        const baseNetTotal = getNetTotal() + storedDiscount;
                        const displayTotal = Math.max(0, baseNetTotal - localDiscount);
                        return (
                          <>
                            <div className="flex justify-between items-center text-xs font-black text-emerald-600 border-l-2 border-emerald-500 pl-2 p-1 -mx-1">
                              <span>Discount</span>
                              <div className="flex items-center gap-1">
                                <span>Rs</span>
                                <input
                                  type="number"
                                  value={discountAmount}
                                  onChange={(e) => setDiscountAmount(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleProceedToPay();
                                    }
                                  }}
                                  className="w-16 h-6 px-1 text-right bg-secondary border border-border rounded text-xs font-black outline-none focus:border-emerald-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {orderType === 'Delivery' && (
                              <div className="flex justify-between items-center text-xs font-black text-foreground border-l-2 border-blue-500 pl-2 p-1 -mx-1">
                                <span>Delivery Charges</span>
                                <div className="flex items-center gap-1">
                                  <span>Rs</span>
                                  <input
                                    type="number"
                                    ref={deliveryChargesRef}
                                    value={deliveryCharges || ''}
                                    onChange={(e) => setDeliveryCharges(parseFloat(e.target.value) || 0)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleProceedToPay();
                                      }
                                    }}
                                    className="w-16 h-6 px-1 text-right bg-secondary border border-border rounded text-xs font-black outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-foreground pt-1.5 border-t border-border">
                              <span>Total</span>
                              <span>Rs {displayTotal.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 gap-2 mb-2">
                      <button
                        onClick={handleProceedToPay}
                        disabled={cart.length === 0}
                        className="w-full py-3 bg-[var(--checkout-bg)] hover:bg-[var(--checkout-hover)] text-[var(--checkout-text)] font-black text-lg rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        PROCEED TO PAY <span className="bg-white/30 text-white text-[11px] px-2 py-1 rounded-md ml-1 font-bold">CTRL+ENTER</span>
                      </button>
                    </div>

                    <div className="relative mb-3 mt-1">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Edit2 className="w-4 h-4" />
                      </div>
                      <input
                        ref={orderNotesRef}
                        type="text"
                        placeholder="Add Order Notes (Ctrl+N)"
                        value={orderNotes}
                        onChange={(e) => {
                          const value = e.target.value
                          setOrderNotes(value)
                          void cartService.setNotes({ notes: value })
                        }}
                        className="w-full pl-10 pr-4 h-10 bg-secondary/60 hover:bg-secondary border border-border/50 rounded-xl text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#fcb47c]/50 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pb-1 flex-1">
                      <button
                        onClick={handleSendKot}
                        disabled={cart.length === 0}
                        className="p-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-400 font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                      >
                        <Printer className="w-4 h-4 stroke-[2]" />
                        <span className="text-[9px] uppercase">KOT</span>
                      </button>
                      <button
                        onClick={handlePrintReceiptFromCart}
                        disabled={cart.length === 0}
                        className="p-1 bg-white hover:bg-orange-50 text-[#ff7b00] border border-[#ff7b00]/30 hover:border-[#ff7b00]/60 font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors shadow-sm"
                      >
                        <Printer className="w-4 h-4 stroke-[2]" />
                        <span className="text-[9px] uppercase">Print</span>
                      </button>
                      <button
                        onClick={() => {
                          clearCart();
                          setCustomer(null);
                          setOrderNotes("");
                        }}
                        disabled={cart.length === 0}
                        className="p-1 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-black rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 transition-colors border border-transparent hover:border-border dark:bg-[#21242B] dark:text-[#9BA2AE]"
                      >
                        <XCircle className="w-4 h-4 stroke-[1.5]" />
                        <span className="text-[9px] uppercase">Clear</span>
                      </button>
                    </div>
                  </div>
                </Panel>
              </PanelGroup>
            </div>
          )}
    </>
  );

  return (
    <div className="flex flex-col h-full font-sans overflow-hidden text-foreground selection:bg-orange-500/30">

      {/* Main Content Area */}
      {isDesktop ? (
        <PanelGroup id="pos-main-layout" orientation="horizontal" className="flex-1 overflow-hidden bg-background">
          <Panel defaultSize="70%" minSize="40%" className="flex flex-col bg-background relative">
            {renderProductGrid()}
          </Panel>
          <PanelResizeHandle className="w-1 bg-border/50 hover:bg-orange-500/50 transition-colors cursor-col-resize z-50" />
          <Panel defaultSize="30%" minSize="25%" maxSize="45%" className="flex flex-col z-10 shadow-xl border-l border-border bg-card">
            {renderCartPanel()}
          </Panel>
        </PanelGroup>
      ) : (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
          <div className="flex-1 flex flex-col relative overflow-hidden pb-[80px]">
            {renderProductGrid()}
          </div>
          
          <AnimatePresence>
            {mobileCartOpen && (
              <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }} 
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="absolute inset-0 z-50 flex flex-col bg-card"
              >
                <div className="p-2 border-b border-border flex justify-between items-center bg-secondary">
                  <h2 className="font-black text-lg">Your Cart</h2>
                  <button onClick={() => setMobileCartOpen(false)} className="p-2 bg-card rounded-lg hover:bg-border transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                {renderCartPanel()}
              </motion.div>
            )}
          </AnimatePresence>

          {!mobileCartOpen && (
            <button 
              onClick={() => setMobileCartOpen(true)}
              className="absolute bottom-4 right-4 left-4 p-4 bg-orange-500 text-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(249,115,22,0.8)] font-black text-lg flex justify-between items-center z-40"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 bg-white text-orange-600 w-5 h-5 flex items-center justify-center rounded-full text-xs font-black shadow-sm">{cart.length}</span>
                </div>
                <span>View Cart</span>
              </div>
              <span>Rs {getNetTotal().toLocaleString()}</span>
            </button>
          )}
        </div>
      )}

      {/* Customize Modal */}
      <AnimatePresence>
        {customizeModalOpen && activeCartItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCustomizeModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-card border border-border shadow-2xl rounded-[2rem] flex flex-col overflow-hidden max-h-[85vh]">
              <div className="p-6 border-b border-border bg-secondary/30">
                <h2 className="text-2xl font-black tracking-tight text-foreground">{activeCartItem.name}</h2>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                {activeCartItem.modifiers && activeCartItem.modifiers.length > 0 ? (
                  <div>
                    <h3 className="font-bold uppercase text-xs tracking-widest text-muted-foreground mb-4">Add-ons & Modifiers</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {activeCartItem.modifiers.map(mod => {
                        const isSelected = tempModifiers.some(m => m.name === mod.name)
                        return (
                          <button key={mod.id || `mod-${mod.name}`} onClick={() => toggleTempModifier(mod)} className={`flex justify-between p-6 rounded-2xl border-[3px] font-black text-lg transition-all ${isSelected ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]' : 'border-border bg-secondary text-foreground hover:border-muted-foreground'}`}>
                            <span>{mod.name}</span><span>+Rs {mod.price.toLocaleString()}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground font-bold">
                    No modifiers available for this item.
                  </div>
                )}

                {/* Notes section */}
                <div>
                  <h3 className="font-bold uppercase text-xs tracking-widest text-muted-foreground mb-4">Special Instructions</h3>
                  <textarea
                    value={tempNotes}
                    onChange={(e) => setTempNotes(e.target.value)}
                    placeholder="E.g. No onions, extra spicy..."
                    className="w-full h-24 p-4 rounded-2xl bg-secondary border border-border focus:border-orange-500 outline-none text-sm transition-colors text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-3 bg-card">
                <button onClick={saveCustomize} className="flex-1 py-4 bg-orange-500 text-white font-black text-lg rounded-2xl hover:bg-orange-400 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Size Modifier Modal */}
      <AnimatePresence>
        {sizeModalOpen && activeProductForSize && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSizeModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-[2rem] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-border bg-secondary/30 text-center">
                <h2 className="text-2xl font-black tracking-tight text-foreground">{activeProductForSize.name}</h2>
                <p className="text-muted-foreground font-bold mt-1">Select Size</p>
              </div>
              <div className="p-6 grid gap-3">
                {activeProductForSize.variants?.map((size: any, index: number) => {
                  const shortcut = size.name.charAt(0).toUpperCase();
                  const isSelected = index === sizeSelectedIndex;
                  return (
                    <button
                      key={size.id || `size-${size.name}-${index}`}
                      onMouseEnter={() => setSizeSelectedIndex(index)}
                      onClick={() => {
                        addToCart({ ...activeProductForSize, variant_id: size.id, variant_snapshot: size.name, variant_name: size.name, name: `${activeProductForSize.name} (${size.name})`, price: size.price, code: size.code || activeProductForSize.code });
                        setSizeModalOpen(false);
                        setActiveProductForSize(null);
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-md scale-[1.02]' : 'border-border bg-secondary text-foreground hover:border-orange-500 hover:text-orange-500'} font-bold`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${isSelected ? 'bg-orange-500 text-white' : 'bg-background'}`}>{shortcut}</span>
                        <span className="text-lg">{size.name}</span>
                      </div>
                      <span className="text-lg">Rs {size.price.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>
              <div className="p-4 text-center text-muted-foreground text-xs font-bold bg-secondary/20">
                Press S, M, L to quick-select
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deal Configuration Modal */}
      <DealConfigurationModal
        isOpen={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        deal={activeDeal}
        availableProducts={products.filter(p => !p.isDeal)}
        onConfirm={(configuredDeal) => {
          setDealModalOpen(false);
          addToCart(configuredDeal);
        }}
      />

      {/* Checkout Modal */}
      <AnimatePresence>
        {checkoutModalOpen && (() => {
          const discountVal = Number(discountAmount) || 0
          const storedDiscount = Number((activeOrder as any)?.totals?.discount_total ?? (activeOrder as any)?.discount_total ?? 0) || 0
          const baseTotal = getNetTotal() + storedDiscount
          const totalToPay = Math.max(0, baseTotal - discountVal)
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setCheckoutModalOpen(false)}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 border-b border-border bg-secondary/30 text-center">
                  <h2 className="text-xl font-black mb-0.5 text-foreground">Complete Payment</h2>
                </div>

                <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">

                  {/* Total display */}
                  <div className="text-center">
                    <p className="text-3xl font-black text-orange-500 tracking-tighter">
                      Rs {totalToPay.toLocaleString()}
                    </p>
                    {discountVal > 0 && (
                      <p className="text-xs text-muted-foreground font-bold mt-0.5">
                        <span className="line-through">Rs {baseTotal.toLocaleString()}</span>
                        <span className="ml-2 text-emerald-500">-Rs {discountVal.toLocaleString()} off</span>
                      </p>
                    )}
                  </div>

                  {/* Payment Methods — 4 options */}
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${checkoutFocusZone === 'methods' ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>Payment Method {checkoutFocusZone === 'methods' && '← →'}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {CHECKOUT_METHODS.map((method, idx) => {
                        const isSelected = selectedPaymentMethod === method
                        const isFocused = checkoutFocusZone === 'methods' && checkoutMethodIndex === idx
                        const icons: Record<string, React.ReactNode> = {
                          'Later': <Clock className="w-5 h-5" />,
                          'Cash': <Banknote className="w-5 h-5" />,
                          'QR': <QrCode className="w-5 h-5" />,
                          'Meezan': <Building2 className="w-5 h-5" />,
                        }
                        return (
                          <button
                            key={method}
                            onClick={() => {
                              setSelectedPaymentMethod(method)
                              setCheckoutMethodIndex(idx)
                              setCheckoutFocusZone('methods')
                            }}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-xs transition-all ${isSelected
                              ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                              : isFocused
                                ? 'bg-orange-500/10 border-orange-400 text-orange-400'
                                : 'bg-secondary text-muted-foreground border-border hover:border-orange-500/40'
                              }`}
                          >
                            {icons[method] ?? <Banknote className="w-5 h-5" />}
                            <span>{method}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Discount Row */}
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${checkoutFocusZone === 'discount' || checkoutFocusZone === 'discountpct' ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>Discount {(checkoutFocusZone === 'discount' || checkoutFocusZone === 'discountpct') && '↑ ↓'}</p>
                    <div className={`bg-secondary/50 rounded-xl border-2 p-3 space-y-2 transition-all ${checkoutFocusZone === 'discount' || checkoutFocusZone === 'discountpct'
                      ? 'border-orange-500/60'
                      : 'border-border'
                      }`}>
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          ref={checkoutDiscountRef}
                          id="checkout-discount-input"
                          type="number"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          onFocus={() => setCheckoutFocusZone('discount')}
                          min={0}
                          max={baseTotal}
                          placeholder="Enter discount amount (Rs)"
                          className={`flex-1 h-9 px-3 rounded-lg bg-background border font-black text-sm outline-none transition-all ${checkoutFocusZone === 'discount' ? 'border-orange-500' : 'border-border'
                            }`}
                        />
                      </div>
                      {/* Discount % Quick Pills */}
                      <div className="flex gap-2">
                        {DISCOUNT_PCTS.map((pct, idx) => {
                          const isFocused = checkoutFocusZone === 'discountpct' && checkoutDiscountPctIndex === idx
                          const appliedAmt = Math.round(baseTotal * pct / 100)
                          return (
                            <button
                              key={pct}
                              onClick={() => {
                                setDiscountAmount(appliedAmt.toString())
                                setCheckoutFocusZone('discountpct')
                                setCheckoutDiscountPctIndex(idx)
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${isFocused
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-background border-border text-muted-foreground hover:border-orange-400 hover:text-orange-400'
                                }`}
                            >
                              {pct}%
                              <span className="block text-[9px] opacity-70">Rs {appliedAmt}</span>
                            </button>
                          )
                        })}
                        {discountVal > 0 && (
                          <button
                            onClick={() => setDiscountAmount('')}
                            className="px-3 py-1.5 rounded-lg text-xs font-black border-2 border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount Received — always shown */}
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${checkoutFocusZone === 'amount' || checkoutFocusZone === 'quickcash' ? 'text-orange-500' : 'text-muted-foreground'
                      }`}>Amount Received {(checkoutFocusZone === 'amount' || checkoutFocusZone === 'quickcash') && '↑ ↓'}</p>
                    <div className={`bg-secondary/50 rounded-xl border-2 p-3 space-y-2 transition-all ${checkoutFocusZone === 'amount' || checkoutFocusZone === 'quickcash'
                      ? 'border-orange-500/60'
                      : 'border-border'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground text-sm">Rs</span>
                        <input
                          ref={checkoutAmountRef}
                          id="checkout-amount-input"
                          type="number"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                          onFocus={() => setCheckoutFocusZone('amount')}
                          placeholder={totalToPay.toString()}
                          className={`flex-1 h-9 px-3 rounded-lg bg-background border font-black text-sm outline-none transition-all text-right ${checkoutFocusZone === 'amount' ? 'border-orange-500' : 'border-border'
                            }`}
                        />
                      </div>

                      {/* Change / Remaining */}
                      {Number(amountReceived) >= totalToPay && Number(amountReceived) > 0 && (
                        <div className="flex items-center justify-between text-emerald-500 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                          <span className="font-bold text-xs">Change Due:</span>
                          <span className="font-black">Rs {(Number(amountReceived) - totalToPay).toLocaleString()}</span>
                        </div>
                      )}
                      {Number(amountReceived) > 0 && Number(amountReceived) < totalToPay && (
                        <div className="flex items-center justify-between text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                          <span className="font-bold text-xs">Remaining:</span>
                          <span className="font-black">Rs {(totalToPay - Number(amountReceived)).toLocaleString()}</span>
                        </div>
                      )}

                      {/* Quick Cash Buttons */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {QUICK_CASH_AMTS.map((amt, idx) => {
                          const isFocused = checkoutFocusZone === 'quickcash' && checkoutQuickCashIndex === idx
                          return (
                            <button
                              key={amt}
                              onClick={() => {
                                setAmountReceived(amt.toString())
                                setCheckoutFocusZone('quickcash')
                                setCheckoutQuickCashIndex(idx)
                              }}
                              className={`py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${isFocused
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-background border-border hover:border-orange-400 hover:text-orange-400'
                                }`}
                            >
                              {amt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Button */}
                <div className="p-4 bg-secondary/30 border-t border-border flex gap-3">
                  <button
                    id="confirm-payment-btn"
                    disabled={isProcessing}
                    onClick={async () => {
                      setIsProcessing(true)
                      const amt = amountReceived ? Number(amountReceived) : totalToPay
                      const method: PaymentMethod = selectedPaymentMethod
                        ? selectedPaymentMethod
                        : (isPaidPrint ? 'Cash' : 'Later' as PaymentMethod)

                      const fullOrderData = {
                        id: activeOrderId,
                        orderNumber: formatReceiptOrderNumber(activeOrder?.order_number || previewOrderNumber),
                        orderType,
                        tableNumber: orderType === 'Dine In' ? (tableNumber || null) : null,
                        customerName: customer?.name || 'Guest',
                        customerPhone: customer?.phone || null,
                        customerAddress: customer?.address || null,
                        notes: orderNotes || null,
                        waiterName,
                        riderName,
                        status: 'Completed',
                        kitchenStatus: 'Completed',
                        paymentStatus: isPaidPrint ? 'Paid' : 'Unpaid',
                        total: totalToPay,
                        subtotal: getSubtotal(),
                        serviceCharge: getServiceCharge(),
                        deliveryCharge: orderType === 'Delivery' ? (deliveryCharges || 0) : 0,
                        discount: discountVal,
                        timestamp: new Date().toISOString(),
                        items: cart.map(item => ({
                          id: item.id,
                          name: item.name,
                          price: item.price,
                          quantity: item.quantity,
                          category: item.category,
                          selectedModifiers: item.selectedModifiers,
                          notes: item.notes,
                          combo_components: item.combo_components || (item as any).comboComponents || []
                        })),
                        cashierName: user?.name || 'Cashier',
                        isVip: isVipOrder || customer?.is_vip || customer?.isVip,
                        paymentMethod: method
                      }

                      const shouldPay = String(method) !== 'Later'
                      const { success, orderId: generatedOrderId } = await completeOrder(
                        shouldPay ? [{
                          id: `pay-${Date.now()}`,
                          method: method,
                          amount: totalToPay,
                          received: amt,
                          change: Math.max(0, amt - totalToPay),
                          timestamp: new Date().toISOString(),
                          cashier: user?.name || 'Cashier',
                          status: 'Completed'
                        }] : [],
                        discountVal,
                        isPaidPrint
                      )

                      if (!success) {
                        setIsProcessing(false)
                        alert("Could not complete this order. The cart is still here — please try again.")
                        return
                      }
                      
                      const finalOrderId = generatedOrderId || activeOrderId

                      let thermalPrintQueued = false
                      try {
                        const { usePrinterStore } = await import("../store/printerStore")
                        const ps = usePrinterStore.getState()
                        const hasThermal = ps.printers.some(
                          (p) => p.driver_type && p.driver_type !== 'VIRTUAL' && (p.current_status === 'ONLINE' || p.current_status === 'OFFLINE')
                        )
                        if (finalOrderId) {
                          if (hasThermal) {
                            const result = await ps.printReceipt(finalOrderId, user?.id || user?.name || 'cashier', isPaidPrint)
                            if (result?.job_id) {
                              thermalPrintQueued = true
                            }
                          }
                          if (isKdsAutoSend) {
                            await ps.printKitchen(finalOrderId, user?.id || user?.name || 'cashier')
                          }
                          if (thermalPrintQueued) {
                            alert(isKdsAutoSend
                              ? "Order completed. Customer receipt printed, then kitchen ticket."
                              : "Order completed. Customer receipt printed.")
                          }
                        }
                      } catch { /* fallback */ }

                      if (!thermalPrintQueued && finalOrderId) {
                        try {
                          const { fetchOrderDetail } = await import('../api/historyApi')
                          const { mapHistoryDetailToOrder } = await import('../store/orderStore')
                          const res = await fetchOrderDetail(finalOrderId)
                          if (res.success && res.data) {
                            const fullOrder = mapHistoryDetailToOrder(res.data, res.data)
                            setPrintOrder({
                              ...fullOrder,
                              paymentStatus: isPaidPrint ? 'Paid' : 'Unpaid',
                              discount: discountVal || fullOrder.discount || 0,
                              total: totalToPay || fullOrder.total,
                              serviceCharge: Number(fullOrder.serviceCharge) || Number(fullOrderData.serviceCharge) || 0,
                              tableNumber: orderType === 'Dine In' ? (fullOrder.tableNumber || fullOrderData.tableNumber || null) : null
                            })
                          } else {
                            setPrintOrder({ ...fullOrderData, id: finalOrderId })
                          }
                        } catch (e) {
                          setPrintOrder({ ...fullOrderData, id: finalOrderId })
                        }
                      } else if (!thermalPrintQueued) {
                        setPrintOrder(fullOrderData)
                      }

                      setCheckoutModalOpen(false)
                      setOrderNotes('')
                      setSelectedPaymentMethod(null)
                      setAmountReceived('')
                      setDiscountAmount('')
                      setIsPaidPrint(false)
                      setCheckoutFocusZone('methods')
                      setCheckoutMethodIndex(0)
                      setIsProcessing(false)
                    }}
                    className={`w-full py-3 font-black rounded-xl text-base active:scale-95 transition-all flex items-center justify-center gap-2 relative ${checkoutFocusZone === 'confirm'
                      ? 'bg-orange-400 text-white ring-4 ring-orange-300 shadow-lg shadow-orange-500/40'
                      : 'bg-orange-500 text-white hover:bg-orange-400 shadow-md shadow-orange-500/20'
                      }`}
                  >
                    <span className="w-5 h-5" />{/* spacer to balance right badge */}
                    <Printer className="w-5 h-5" />
                    <span className="font-black">Print</span>
                    <span className="flex items-center gap-1 text-white/60 text-[10px] font-bold ml-auto">
                      <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-black">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-black">↵</kbd>
                    </span>
                  </button>
                </div>
              </motion.div>
              {/* ReceiptPreview Popup */}
              {printOrder && <ReceiptPreview order={printOrder} autoPrint={true} onClose={() => setPrintOrder(null)} />}
            </div>
          )
        })()}
      </AnimatePresence>



      {/* Portals / Global Modals for POS */}
      <CustomerPanelModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSuccess={() => {
          if (orderType === 'Delivery' && cart.length > 0) {
            handleProceedToPay()
          }
        }}
      />
      <TableSelectorModal
        isOpen={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
      />



      <RiderSelectorModal
        isOpen={riderModalOpen}
        onClose={() => setRiderModalOpen(false)}
      />

      <ActiveOrdersSidebar
        isOpen={recentOrdersModalOpen}
        onClose={() => setRecentOrdersModalOpen(false)}
      />

      {/* ReceiptPreview Popup */}
      {printOrder && <ReceiptPreview order={printOrder} autoPrint={true} onClose={() => setPrintOrder(null)} />}
      {kotPreview && <ReceiptPreview order={kotPreview} autoPrint={true} isKot={true} onClose={() => setKotPreview(null)} />}    </div>
  )
}
