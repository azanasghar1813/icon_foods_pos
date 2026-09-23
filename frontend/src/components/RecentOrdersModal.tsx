import React, { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  X, Search, Clock, Hash, User,
  Receipt, Eye,
  History, Edit, Star,
  AlertCircle, Calendar, ChevronRight,
  Lock, Unlock, ShieldAlert, CheckCircle2,
  PlusCircle, MinusCircle, Pencil
} from "lucide-react"
import { useOrderStore } from "../store/orderStore"
import type { Order } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"

interface RecentOrdersModalProps {
  isOpen: boolean
  onClose: () => void
}

const orderStatusColors: Record<string, string> = {
  Draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const kitchenStatusColors: Record<string, string> = {
  Waiting: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Accepted: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Preparing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Ready: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Served: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const paymentStatusColors: Record<string, string> = {
  Unpaid: "bg-red-500/10 text-red-450 border-red-500/20",
  "Partial Paid": "bg-yellow-500/10 text-yellow-450 border-yellow-500/20",
  Paid: "bg-green-500/10 text-green-400 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-450 border-purple-500/20"
}

export const RecentOrdersModal: React.FC<RecentOrdersModalProps> = ({ isOpen, onClose }) => {
  const { orders, lockOrder, unlockOrder, syncOrdersFromBackend } = useOrderStore()
  const { loadOrderForEdit, editingOrderId } = usePosStore()
  const { user } = useAuthStore()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'audit'>('details')
  const [filter, setFilter] = useState<string>("All")
  const [overrideModalOrder, setOverrideModalOrder] = useState<Order | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch orders when modal opens
  useEffect(() => {
    if (isOpen) {
      syncOrdersFromBackend()
    }
  }, [isOpen])

  // Sync selectedOrder when orders store updates (e.g. after locking)
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id)
      if (updated) setSelectedOrder(updated)
    }
  }, [orders])

  const handleClose = () => {
    // Unlock any order locked by this session when closing without editing
    if (selectedOrder?.isLocked && selectedOrder?.lockedBy === (user?.name || 'Cashier')) {
      if (selectedOrder.id !== editingOrderId) {
        unlockOrder(selectedOrder.id)
      }
    }
    onClose()
  }

  const filteredOrders = useMemo(() => {
    let result = [...orders]
    result.sort((a, b) => {
      const p = { Confirmed: 1, Draft: 2, Completed: 3 }
      const pA = p[a.status as keyof typeof p] || 99
      const pB = p[b.status as keyof typeof p] || 99
      if (pA !== pB) return pA - pB
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    if (filter !== "All") {
      if (['Draft', 'Confirmed', 'Completed', 'Cancelled'].includes(filter)) {
        result = result.filter(o => o.status === filter)
      } else if (['Waiting', 'Accepted', 'Preparing', 'Ready', 'Served'].includes(filter)) {
        result = result.filter(o => o.kitchenStatus === filter)
      } else if (['Unpaid', 'Partial Paid', 'Paid', 'Refunded'].includes(filter)) {
        result = result.filter(o => o.paymentStatus === filter)
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.toLowerCase().includes(q) ||
        o.tableNumber?.toLowerCase().includes(q) ||
        o.cashierName.toLowerCase().includes(q) ||
        o.items.some(item => item.name.toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q))
      )
    }
    return result
  }, [orders, searchQuery, filter])

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overrideModalOrder) { setOverrideModalOrder(null); return }
        handleClose()
      }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchInputRef.current?.focus() }
      if (e.ctrlKey && e.key.toLowerCase() === 'e' && selectedOrder) {
        e.preventDefault()
        e.stopPropagation()
        handleEditOrder(selectedOrder)
      }
      
      // Arrow Key Navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (filteredOrders.length === 0) return
        if (!selectedOrder) {
          setSelectedOrder(filteredOrders[0])
          return
        }
        const idx = filteredOrders.findIndex(o => o.id === selectedOrder.id)
        if (e.key === 'ArrowUp' && idx > 0) {
          setSelectedOrder(filteredOrders[idx - 1])
        } else if (e.key === 'ArrowDown' && idx >= 0 && idx < filteredOrders.length - 1) {
          setSelectedOrder(filteredOrders[idx + 1])
        }
      }
      
      if (e.key === 'Enter' && selectedOrder) {
        e.preventDefault()
        e.stopPropagation()
        handleEditOrder(selectedOrder)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedOrder, onClose, overrideModalOrder, filteredOrders])

  const handleEditOrder = async (order: Order) => {
    if (order.id === editingOrderId) { onClose(); return }
    try {
      await loadOrderForEdit(order)
      onClose()
    } catch (e: any) {
      alert(e?.message || 'Could not load this order for edit.')
    }
  }

  const handleManagerOverride = async () => {
    if (!overrideModalOrder) return
    const cashierName = user?.name || 'Cashier'
    unlockOrder(overrideModalOrder.id, true)
    lockOrder(overrideModalOrder.id, cashierName)
    await loadOrderForEdit(overrideModalOrder)
    setOverrideModalOrder(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <motion.div 
        initial={{ opacity: 0, x: 100 }} 
        animate={{ opacity: 1, x: 0 }} 
        exit={{ opacity: 0, x: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full sm:w-[95%] md:w-[85%] lg:w-[75%] h-full bg-background sm:rounded-3xl border border-border shadow-2xl flex overflow-hidden"
      >
        {/* Left Side: Order List */}
        <div className="w-1/2 md:w-[45%] flex flex-col border-r border-border bg-card">
          <div className="p-4 border-b border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-foreground">Recent Orders</h2>
                <p className="text-sm font-bold text-muted-foreground">Manage active & past orders</p>
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl hover:bg-secondary transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search orders, tables, items, phones (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-bold text-sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              {['All', 'Confirmed', 'Draft', 'Preparing', 'Ready', 'Paid', 'Unpaid'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                    filter === f 
                      ? 'bg-orange-500 text-white border-orange-500' 
                      : 'bg-secondary text-muted-foreground border-border hover:border-orange-500/50'
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Receipt className="w-12 h-12 opacity-20 mb-3" />
                <p className="font-bold">No orders found</p>
              </div>
            ) : filteredOrders.map(order => {
              const isActive = selectedOrder?.id === order.id
              const editCount = order.auditLog?.length || 0
              return (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all ${
                    isActive ? 'bg-orange-500/5 border-orange-500' : 'bg-card border-border hover:border-orange-500/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-lg font-black text-foreground">{order.orderNumber}</span>
                      {order.isLocked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 uppercase font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> {order.lockedBy === (user?.name || 'Cashier') ? 'You' : order.lockedBy}
                        </span>
                      )}
                      {editCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase font-bold flex items-center gap-0.5">
                          <Edit className="w-2.5 h-2.5" /> {editCount}x edited
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none scale-[0.9] origin-right ${orderStatusColors[order.status] || orderStatusColors.Draft}`}>
                        {order.status}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none scale-[0.9] origin-right ${kitchenStatusColors[order.kitchenStatus] || kitchenStatusColors.Waiting}`}>
                        Kit: {order.kitchenStatus}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none scale-[0.9] origin-right ${paymentStatusColors[order.paymentStatus] || paymentStatusColors.Unpaid}`}>
                        Pay: {order.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground mb-3">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="flex items-center gap-1"><User className="w-3 h-3" /> {order.customerName}</div>
                    {order.tableNumber && <div className="flex items-center gap-1"><Hash className="w-3 h-3" /> {order.tableNumber}</div>}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border border-dashed">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-secondary px-2 py-1 rounded text-foreground">{order.orderType}</span>
                      {order.isVip && <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />}
                    </div>
                    <span className="font-black text-foreground">Rs {order.total.toLocaleString()}</span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Right Side: Order Detail Pane */}
        <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
          {!selectedOrder ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Eye className="w-16 h-16 opacity-20 mb-4" />
              <p className="font-bold text-lg">Select an order</p>
              <p className="text-sm opacity-60 mt-1">View details, timeline, and edit history.</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="p-6 border-b border-border bg-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-3xl font-black text-foreground flex items-center gap-2">
                        {selectedOrder.orderNumber}
                        {selectedOrder.isEdited && <span className={`text-[10px] px-2 py-0.5 rounded uppercase border font-bold tracking-widest leading-none ${selectedOrder.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Edited</span>}
                      </h2>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wide border ${orderStatusColors[selectedOrder.status] || orderStatusColors.Draft}`}>
                        Order: {selectedOrder.status}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wide border ${kitchenStatusColors[selectedOrder.kitchenStatus] || kitchenStatusColors.Waiting}`}>
                        Kitchen: {selectedOrder.kitchenStatus}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wide border ${paymentStatusColors[selectedOrder.paymentStatus] || paymentStatusColors.Unpaid}`}>
                        Payment: {selectedOrder.paymentStatus}
                      </span>
                      {selectedOrder.isLocked && (
                        <span className="text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20">
                          <Lock className="w-3.5 h-3.5" /> Locked by {selectedOrder.lockedBy}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {new Date(selectedOrder.timestamp).toLocaleString()}
                    </p>
                    {selectedOrder.lastEdited && (
                      <p className="text-xs font-bold text-blue-500 mt-1 flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Last edited: {new Date(selectedOrder.lastEdited).toLocaleString()}
                        {selectedOrder.editedBy ? ` by ${selectedOrder.editedBy}` : ''}
                      </p>
                    )}
                  </div>
                  <div>
                    {selectedOrder.isLocked && selectedOrder.lockedBy !== (user?.name || 'Cashier') ? (
                      <button 
                        onClick={() => setOverrideModalOrder(selectedOrder)}
                        className="px-4 py-2 bg-red-600/90 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg"
                      >
                        <ShieldAlert className="w-4 h-4" /> Manager Override
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleEditOrder(selectedOrder)} 
                        className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg"
                      >
                        <Edit className="w-4 h-4" /> Edit Order <span className="opacity-60 text-xs font-normal">(Ctrl+E)</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 p-4 rounded-2xl bg-secondary/50 border border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Customer</p>
                    <p className="font-bold text-sm flex items-center gap-1">
                      {selectedOrder.isVip && <Star className="w-3 h-3 text-orange-500 fill-orange-500" />}
                      {selectedOrder.customerName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Type & Table</p>
                    <p className="font-bold text-sm">{selectedOrder.orderType} {selectedOrder.tableNumber ? `• ${selectedOrder.tableNumber}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Cashier</p>
                    <p className="font-bold text-sm">{selectedOrder.cashierName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Payment</p>
                    <p className={`font-bold text-sm ${selectedOrder.paymentStatus === 'Paid' ? 'text-emerald-500' : 'text-orange-500'}`}>{selectedOrder.paymentStatus}</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 px-6 border-b border-border bg-card shrink-0">
                <button onClick={() => setActiveTab('details')} className={`py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'details' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Items & Totals</button>
                <button onClick={() => setActiveTab('timeline')} className={`py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'timeline' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Clock className="w-4 h-4" /> Timeline</button>
                <button onClick={() => setActiveTab('audit')} className={`py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'audit' ? 'border-orange-500 text-orange-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <History className="w-4 h-4" /> Audit Log
                  {selectedOrder.auditLog?.length > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 rounded-full ml-1">{selectedOrder.auditLog.length}</span>}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-background">
                
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={`${item.cartItemId}-${idx}`} className={`flex justify-between items-start p-4 rounded-xl border bg-card transition-all ${
                          item.editState === 'removed' ? 'border-red-500/30 opacity-60' :
                          item.editState === 'new' ? 'border-green-500/40 bg-green-500/5' :
                          item.editState === 'modified' ? 'border-orange-500/40 bg-orange-500/5' :
                          'border-border'
                        }`}>
                          <div>
                            <p className={`font-black text-sm flex items-center gap-2 ${item.editState === 'removed' ? 'line-through text-muted-foreground' : ''}`}>
                              {item.editState === 'new' && <PlusCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                              {item.editState === 'removed' && <MinusCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              {item.editState === 'modified' && <Pencil className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                              {item.quantity}x {item.name}
                            </p>
                            {item.selectedModifiers?.length > 0 && (
                              <p className="text-xs text-muted-foreground font-bold mt-1 pl-4 border-l-2 border-border">
                                {item.selectedModifiers.map(m => `+ ${m.name}`).join(", ")}
                              </p>
                            )}
                            {item.notes && <p className="text-xs text-orange-500 font-bold mt-1">Note: {item.notes}</p>}
                            {item.removalReason && <p className="text-xs text-red-500 font-bold mt-1 flex items-center gap-1"><MinusCircle className="w-3 h-3" /> {item.removalReason}</p>}
                          </div>
                          <p className={`font-black text-sm ${item.editState === 'removed' ? 'line-through text-muted-foreground' : ''}`}>
                            Rs {((item.price + (item.selectedModifiers || []).reduce((sum,m)=>sum+m.price,0)) * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-2xl bg-secondary/30 space-y-2">
                      <div className="flex justify-between text-sm font-bold text-muted-foreground">
                        <span>Subtotal</span><span>Rs {selectedOrder.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-muted-foreground">
                        <span>{selectedOrder.orderType === 'Delivery' ? 'Delivery Charges' : 'Service Charges'}</span><span>Rs {selectedOrder.tax.toLocaleString()}</span>
                      </div>
                      {selectedOrder.serviceCharge > 0 && (
                        <div className="flex justify-between text-sm font-bold text-muted-foreground">
                          <span>Service Charge</span><span>Rs {selectedOrder.serviceCharge.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-sm font-bold text-emerald-500">
                          <span>Discount</span><span>- Rs {selectedOrder.discount.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedOrder.roundOffAdjustment !== undefined && selectedOrder.roundOffAdjustment !== 0 && (
                        <div className="flex justify-between text-sm font-bold text-muted-foreground">
                          <span>Round Off</span><span>Rs {selectedOrder.roundOffAdjustment.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-black text-foreground pt-3 border-t border-border">
                        <span>Total</span><span>Rs {selectedOrder.total.toLocaleString()}</span>
                      </div>
                    </div>

                    {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                      <div className="p-4 rounded-2xl bg-secondary/30 space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Payments Received
                        </h4>
                        {selectedOrder.payments.map((p, i) => (
                          <div key={i} className="flex justify-between text-sm font-bold text-foreground">
                            <span className="flex items-center gap-2">
                              {p.method}
                              {p.change && p.change > 0 && <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">Change: {p.change}</span>}
                            </span>
                            <span>Rs {p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="p-6">
                    {!selectedOrder.timeline || selectedOrder.timeline.length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        <Clock className="w-12 h-12 opacity-20 mx-auto mb-4" />
                        <p className="font-bold">No timeline events</p>
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:w-0.5 before:bg-border">
                        {selectedOrder.timeline.map((event, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[35px] bg-background p-1">
                              <div className="w-4 h-4 rounded-full bg-orange-500 border-4 border-background" />
                            </div>
                            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start">
                                <p className="font-bold text-sm text-foreground">{event.event}</p>
                                <span className="text-xs font-bold text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs font-bold text-muted-foreground mt-1">by {event.cashier}</p>
                              {event.remarks && <p className="text-xs mt-2 text-foreground font-bold p-2 bg-secondary rounded-lg">{event.remarks}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Audit Log Tab */}
                {activeTab === 'audit' && (
                  <div className="p-6">
                    {!selectedOrder.auditLog || selectedOrder.auditLog.length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        <History className="w-12 h-12 opacity-20 mx-auto mb-4" />
                        <p className="font-bold">No modifications yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedOrder.auditLog.map(log => (
                          <div key={log.id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wide border ${
                                  log.actionType === 'Added Item' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                  log.actionType === 'Removed Item' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                  log.actionType === 'Changed Quantity' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                  'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                }`}>{log.actionType}</span>
                                <span className="text-xs font-bold text-muted-foreground">{new Date(log.when).toLocaleTimeString()}</span>
                              </div>
                              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> {log.who}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <div className="flex-1 bg-secondary p-2 rounded-lg border border-border border-dashed">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Before</p>
                                <p className="text-xs font-bold line-through opacity-70">{log.oldValue}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 bg-orange-500/5 p-2 rounded-lg border border-orange-500/20">
                                <p className="text-[10px] text-orange-500 uppercase font-bold mb-1">After</p>
                                <p className="text-xs font-bold text-orange-500">{log.newValue}</p>
                              </div>
                            </div>
                            {log.reason && (
                              <p className="text-xs font-bold text-foreground mt-3 p-2 bg-secondary/50 rounded-lg border border-border flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                {log.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Manager Override Confirmation Modal */}
      <AnimatePresence>
        {overrideModalOrder && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-border bg-red-500/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-black text-foreground">Order Locked</h3>
                  <p className="text-sm font-bold text-muted-foreground">Requires manager authorization</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm font-bold text-foreground">
                  Order <span className="text-orange-500 font-black">#{overrideModalOrder.orderNumber}</span> is currently being edited by{" "}
                  <span className="text-red-500 font-black">{overrideModalOrder.lockedBy}</span>.
                </p>
                <div className="p-3 bg-secondary rounded-xl border border-border">
                  <p className="text-xs font-bold text-muted-foreground">
                    Proceeding with <strong className="text-foreground">Manager Override</strong> will forcibly unlock this order. This action is recorded in the audit log.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setOverrideModalOrder(null)}
                    className="flex-1 py-3 rounded-xl font-bold bg-secondary text-foreground hover:bg-background transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleManagerOverride}
                    className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4 h-4" /> Override & Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
