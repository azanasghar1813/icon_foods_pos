import React, { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, Search, Clock, Hash, User,
  Receipt, Edit,
  AlertCircle, ChevronRight,
  CheckCircle2, PlusCircle, CreditCard,
  Utensils, Printer, Phone, Loader2, Ban, MapPin
} from "lucide-react"
import { useOrderStore, mapHistoryDetailToOrder } from "../store/orderStore"
import type { Order, OrderStatus, KitchenStatus, PaymentStatus } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { fetchOrderDetail } from "../api/historyApi"
import { apiClient } from "../api/client"
import ReceiptPreview from "../pages/ReceiptPreview"
import { formatReceiptOrderNumber } from "../utils/receiptOrderNumber"

interface ActiveOrdersSidebarProps {
  isOpen: boolean
  onClose: () => void
}

const orderStatusColors: Record<string, string> = {
  Draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Held: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  Refunded: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Preparing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-450 border-red-500/20",
  Paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Refunded: "bg-purple-500/10 text-purple-450 border-purple-500/20"
}

export const ActiveOrdersSidebar: React.FC<ActiveOrdersSidebarProps> = ({ isOpen, onClose }) => {
  const { orders, syncOrdersFromBackend, updateOrder } = useOrderStore()
  const { loadOrderForEdit, clearCart, editingOrderId } = usePosStore()
  const { user } = useAuthStore()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<string>("All")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)
  const [kotStatus, setKotStatus] = useState<Record<string, 'loading' | 'success' | 'error' | undefined>>({})
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [kotPreview, setKotPreview] = useState<Order | null>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  // Use a ref to keep latest activeOrders/selectedIndex in the keydown handler
  const activeOrdersRef = useRef<Order[]>([])
  const selectedIndexRef = useRef(0)
  const selectedActionIndexRef = useRef(0)

  // Keep selectedIndex/selectedActionIndex refs in sync (activeOrders ref synced after useMemo below)
  useEffect(() => { selectedIndexRef.current = selectedIndex }, [selectedIndex])
  useEffect(() => { selectedActionIndexRef.current = selectedActionIndex }, [selectedActionIndex])

  useEffect(() => {
    if (isOpen) {
      syncOrdersFromBackend()
    }
  }, [isOpen])

  const activeOrders = useMemo(() => {
    let result = orders.filter(o => o.status === 'Held' || o.status === 'Active')
    
    // Sort newest first (recently placed on top)
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    if (filter !== "All") {
      result = result.filter(o => o.orderType === filter)
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o => 
        o.orderNumber?.toString().toLowerCase().includes(q) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.tableNumber && o.tableNumber.toString().toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
        (o.customerAddress && o.customerAddress.toLowerCase().includes(q)) ||
        (o.orderType && o.orderType.toLowerCase().includes(q)) ||
        (o.status && o.status.toLowerCase().includes(q)) ||
        (o.paymentStatus && o.paymentStatus.toLowerCase().includes(q)) ||
        (o.kitchenStatus && o.kitchenStatus.toLowerCase().includes(q)) ||
        (o.total && o.total.toString().includes(q))
      )
    }
    return result
  }, [orders, searchQuery, filter])
  // Keep activeOrdersRef in sync
  useEffect(() => { activeOrdersRef.current = activeOrders }, [activeOrders])

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
    setSelectedActionIndex(0)
  }, [searchQuery, filter])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || !!t?.isContentEditable
      if (typing && e.key !== 'Escape') return

      const orders = activeOrdersRef.current
      const curIdx = selectedIndexRef.current
      const curAction = selectedActionIndexRef.current

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(s => Math.min(s + 1, orders.length - 1))
        setSelectedActionIndex(0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(s => Math.max(s - 1, 0))
        setSelectedActionIndex(0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        const order = orders[curIdx]
        if (!order) return
        // Cycle: 0(Edit) -> 1(MarkComplete if Unpaid, else 2) -> 2(Print) -> 0
        if (curAction === 0) {
          if (order.paymentStatus === 'Unpaid') setSelectedActionIndex(1)
          else setSelectedActionIndex(2)
        } else if (curAction === 1) {
          setSelectedActionIndex(2)
        } else {
          setSelectedActionIndex(0)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        const order = orders[curIdx]
        if (!order) return
        if (curAction === 2) {
          if (order.paymentStatus === 'Unpaid') setSelectedActionIndex(1)
          else setSelectedActionIndex(0)
        } else if (curAction === 1) {
          setSelectedActionIndex(0)
        } else {
          setSelectedActionIndex(2)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const order = orders[curIdx]
        if (!order) return
        if (curAction === 1 && order.paymentStatus === 'Unpaid') {
          handleMarkComplete(null, order)
        } else if (curAction === 2) {
          handlePrint(null, order)
        } else {
          handleEdit(order)
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    // Use capture phase so we get events before other handlers but DON'T prevent shortcuts from App
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen])

  const handleEdit = async (order: Order) => {
    try {
      await loadOrderForEdit(order)
      onClose()
    } catch(e: any) {
      console.error(e)
      alert(e?.message || 'Could not load this order for edit.')
    }
  }

  const handleSendKot = async (e: React.MouseEvent | null, order: Order) => {
    if (e) e.stopPropagation()
    setKotStatus(prev => ({ ...prev, [order.id]: 'loading' }))
    try {
      const { usePrinterStore } = await import('../store/printerStore')
      const result = await usePrinterStore.getState().printKitchen(order.id, user?.id || user?.name || 'cashier')
      syncOrdersFromBackend()
      if (result) {
        setPrintOrder(null)
        setKotPreview(order)
        setKotStatus(prev => ({ ...prev, [order.id]: 'success' }))
      } else {
        setKotStatus(prev => ({ ...prev, [order.id]: 'error' }))
      }
      setTimeout(() => {
        setKotStatus(prev => ({ ...prev, [order.id]: undefined }))
      }, 2000)
    } catch (e) {
      console.error(e)
      setKotStatus(prev => ({ ...prev, [order.id]: 'error' }))
      setTimeout(() => {
        setKotStatus(prev => ({ ...prev, [order.id]: undefined }))
      }, 3000)
    }
  }

  const handleCancel = async (e: React.MouseEvent | null, order: Order) => {
    if (e) e.stopPropagation()
    if (order.status === 'Cancelled') return
    try {
      await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'CANCELLED' })
      useOrderStore.getState().updateOrder(order.id, { status: 'Cancelled', kitchenStatus: 'Cancelled' })
      await syncOrdersFromBackend()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.message || err?.message || 'Could not cancel this order.')
    }
  }

  const handleMarkComplete = async (e: React.MouseEvent | null, order: Order) => {
    if (e) e.stopPropagation()
    const confirmMsg = `Mark order ${formatReceiptOrderNumber(order.orderNumber)} as COMPLETED?\nTotal: PKR ${order.total.toLocaleString()}`
    if (!window.confirm(confirmMsg)) return

    try {
      await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED', reason: 'Marked complete from active orders' })
      useOrderStore.getState().updateOrder(order.id, { status: 'Completed', kitchenStatus: 'Served' })
      await syncOrdersFromBackend()
    } catch (e: any) {
      console.error(e)
      alert(e?.response?.data?.message || e?.message || 'Could not complete this order.')
    }
  }

  const handlePrint = async (e: React.MouseEvent | null, order: Order) => {
    if (e) e.stopPropagation()
    try {
      const { fetchOrderDetail } = await import('../api/historyApi')
      const { mapHistoryDetailToOrder } = await import('../store/orderStore')
      const res = await fetchOrderDetail(order.id)
      if (res.success && res.data) {
        setPrintOrder(mapHistoryDetailToOrder(res.data, res.data))
        return
      }
    } catch { /* fallback */ }
    setPrintOrder(order)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[620px] bg-card border-l border-border/50 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Active Orders
                </h2>
                <p className="text-sm text-muted-foreground">Manage ongoing orders</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-border/50 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by order #, customer, table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSelectedIndex(s => Math.min(s + 1, activeOrders.length - 1))
                      setSelectedActionIndex(0)
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSelectedIndex(s => Math.max(s - 1, 0))
                      setSelectedActionIndex(0)
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      const order = activeOrders[selectedIndex]
                      if (order && order.paymentStatus === 'Unpaid') {
                        setSelectedActionIndex(1)
                      }
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      setSelectedActionIndex(0)
                    } else if (e.key === 'Enter') {
                      e.preventDefault()
                      const order = activeOrders[selectedIndex]
                      if (order) {
                        if (selectedActionIndex === 1 && order.paymentStatus === 'Unpaid') {
                          handleMarkComplete(null, order)
                        } else {
                          handleEdit(order)
                        }
                      }
                    }
                  }}
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['All', 'Dine In', 'Takeaway', 'Delivery'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      filter === f 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                  <Utensils className="w-12 h-12 opacity-20" />
                  <p>No active orders found</p>
                </div>
              ) : (
                activeOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    ref={el => { itemRefs.current[index] = el }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleEdit(order)}
                    className={`bg-secondary/30 border cursor-pointer ${selectedIndex === index ? 'border-orange-500 ring-1 ring-orange-500' : 'border-border/50 hover:border-orange-500/30'} rounded-xl p-4 transition-all group`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-primary">{formatReceiptOrderNumber(order.orderNumber)}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-secondary text-foreground">
                            {order.orderType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1 text-blue-400 font-medium">
                            {order.orderType === 'Delivery' ? (
                              <span className="flex items-center gap-2">
                                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {order.customerPhone || 'N/A'}</span>
                                {order.riderName && <span className="flex items-center gap-1 opacity-80 border-l pl-2 border-border/50"><User className="w-3.5 h-3.5" /> {order.riderName}</span>}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Table {order.tableNumber || 'N/A'}</span>
                                {order.waiterName && <span className="flex items-center gap-1 opacity-80 border-l pl-2 border-border/50"><User className="w-3.5 h-3.5" /> {order.waiterName}</span>}
                              </span>
                            )}
                          </span>
                        </div>
                        {order.customerAddress && (
                          <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                            <span className="line-clamp-2">{order.customerAddress}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          PKR {order.total.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md border ${kitchenStatusColors[order.kitchenStatus] || kitchenStatusColors.Pending}`}>
                        Kitchen: {order.kitchenStatus || 'Pending'}
                      </span>
                      <span className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md border ${order.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {order.status === 'Completed' ? 'Completed' : 'Not Completed'}
                      </span>
                      {order.isEdited && (
                        <span className={`text-[9px] px-1.5 py-1 rounded border uppercase font-bold flex items-center gap-0.5 ${order.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                          <Edit className="w-2.5 h-2.5" /> Edited
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-border/50">
                      <button 
                        onClick={() => handleEdit(order)}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-bold leading-tight transition-colors ${
                          selectedIndex === index && selectedActionIndex === 0
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50 shadow-lg shadow-primary/20'
                            : 'bg-secondary hover:bg-secondary/80 text-foreground'
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit / Load
                      </button>
                      
                      {order.status !== 'Completed' && (
                        <button 
                          onClick={(e) => handleMarkComplete(e, order)}
                          className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 border py-2 px-1 rounded-lg text-[11px] font-bold leading-tight transition-colors ${
                            selectedIndex === index && selectedActionIndex === 1
                              ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/50 border-emerald-500 shadow-lg shadow-emerald-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Complete
                        </button>
                      )}

                      <button 
                        onClick={(e) => handleSendKot(e, order)}
                        disabled={kotStatus[order.id] === 'loading'}
                        className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 border py-2 px-1 rounded-lg text-[11px] font-bold leading-tight transition-colors ${
                          kotStatus[order.id] === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                          : kotStatus[order.id] === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border-orange-500/20'
                        } disabled:opacity-70`}
                      >
                        {kotStatus[order.id] === 'loading' ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : kotStatus[order.id] === 'success' ? (
                           <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : kotStatus[order.id] === 'error' ? (
                           <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                           <Printer className="w-3.5 h-3.5" />
                        )}
                        {kotStatus[order.id] === 'loading' ? 'Printing...' : kotStatus[order.id] === 'success' ? 'Printed!' : kotStatus[order.id] === 'error' ? 'Failed' : 'Print KT'}
                      </button>

                      <button 
                        onClick={(e) => handlePrint(e, order)}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-bold leading-tight transition-colors ${
                          selectedIndex === index && selectedActionIndex === 2
                            ? 'bg-blue-500 text-white ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20'
                            : 'bg-secondary hover:bg-secondary/80 text-foreground'
                        }`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Bill
                      </button>

                      <button
                        onClick={(e) => handleCancel(e, order)}
                        className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[11px] font-bold leading-tight bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
      
      {/* Print Previews */}
      {printOrder && <ReceiptPreview order={printOrder} autoPrint={true} onClose={() => setPrintOrder(null)} />}
      {kotPreview && <ReceiptPreview order={kotPreview} autoPrint={true} isKot={true} onClose={() => setKotPreview(null)} />}
    </AnimatePresence>
  )
}
