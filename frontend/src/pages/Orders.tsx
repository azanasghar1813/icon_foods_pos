import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../store/toastStore"
import { authService } from "../services/authService"

import { motion, AnimatePresence } from "framer-motion"
import jsPDF from "jspdf"
import ReceiptPreview from "./ReceiptPreview"
import { useOrderStore, type Order, mapHistoryDetailToOrder, itemVariantName } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { fetchOrderDetail } from "../api/historyApi"
import { apiClient } from "../api/client"
import {
  Search, Clock, Pencil, History, Printer,
  X, AlertTriangle, FileText, Download, RotateCcw, Ban, Plus,
  RefreshCw, ChevronLeft, ChevronRight, Calendar, Trash2
} from "lucide-react"
import { deleteOrder } from "../api/historyApi"
import { DateUtils } from "../utils/dateUtils"
import { formatReceiptOrderNumber } from "../utils/receiptOrderNumber"

// Theme Colors

const historyBadgeColors: Record<string, string> = {
  Preparing: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/20"
}

const displayHistoryBadge = (status: string) => {
  if (status === "Completed") return "Completed"
  if (status === "Cancelled" || status === "Refunded") return "Cancelled"
  return "Preparing"
}

const formatRs = (n: number) => `Rs ${Number(n).toLocaleString()}`

const parseAuditChange = (actionType: string, oldVal: any, newVal: any) => {
  const safeParse = (str: any) => {
    if (str == null || str === '') return str
    if (typeof str === 'object') return str
    try { return JSON.parse(str) } catch { return str }
  }
  const parsedNew = safeParse(newVal)
  const parsedOld = safeParse(oldVal)
  const obj = (parsedNew && typeof parsedNew === 'object') ? parsedNew : {}
  const oldObj = (parsedOld && typeof parsedOld === 'object') ? parsedOld : {}
  const num = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const action = String(actionType || '').toUpperCase()
  const itemName = obj.item_name || obj.product || obj.product_name || obj.product_name_snapshot || oldObj.product_name || oldObj.item_name || 'item'
  const qty = num(obj.quantity) ?? num(oldObj.quantity)
  const unitPrice = num(obj.unit_price) ?? num(obj.final_unit_price) ?? num(obj.price) ?? num(oldObj.unit_price)
  const lineTotal = num(obj.line_total) ?? num(obj.subtotal) ?? (unitPrice != null && qty != null ? unitPrice * qty : null)
  const billBefore = num(obj.bill_before) ?? num(oldObj.bill_before)
  const billAfter = num(obj.bill_after) ?? num(obj.grand_total_after)

  if (action.includes('ADDED')) {
    const q = qty || 1
    return { tone: 'add' as const, sign: '+', label: `Added ${q}x ${itemName}`, amount: lineTotal ?? unitPrice, billBefore, billAfter }
  }
  if (action.includes('REMOVED') || action.includes('VOID')) {
    const q = qty || 1
    const amount = lineTotal ?? (unitPrice != null ? unitPrice * q : null)
    return { tone: 'remove' as const, sign: '-', label: `Removed ${q}x ${itemName}`, amount, billBefore, billAfter }
  }
  if (action.includes('QUANTITY')) {
    const oldQty = num(obj.old_quantity) ?? num(obj.old_qty)
    const newQty = num(obj.new_quantity) ?? num(obj.new_qty) ?? qty
    const down = oldQty != null && newQty != null && newQty < oldQty
    const deltaQty = oldQty != null && newQty != null ? newQty - oldQty : null
    const amount = num(obj.line_delta) != null
      ? Math.abs(num(obj.line_delta) as number)
      : (unitPrice != null && deltaQty != null ? Math.abs(unitPrice * deltaQty) : unitPrice)
    const qtyLabel = oldQty != null && newQty != null ? `${oldQty} → ${newQty}` : String(newQty ?? '')
    return { tone: down ? 'remove' as const : 'add' as const, sign: down ? '-' : '+', label: `Qty ${itemName} ${qtyLabel}`, amount, billBefore, billAfter }
  }
  if (action === 'ORDER_CREATED') {
    return { tone: 'neutral' as const, sign: '', label: 'Order created', amount: null, billBefore, billAfter }
  }
  if (parsedNew && typeof parsedNew === 'object') {
    const changes = Object.entries(parsedNew)
      .filter(([k]) => !['order_number', 'branch_id', 'bill_before', 'bill_after'].includes(k))
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(', ')
    return { tone: 'neutral' as const, sign: '', label: changes ? `Updated: ${changes}` : 'Updated order details.', amount: null, billBefore, billAfter }
  }
  return { tone: 'neutral' as const, sign: '', label: String(newVal || oldVal || '-'), amount: null, billBefore, billAfter }
}

export default function Orders() {
  const navigate = useNavigate()
  const { orders, lockOrder, unlockOrder, updateOrder, addTimelineEvent, addAuditLog, syncOrdersFromBackend } = useOrderStore()
  const { loadOrderForEdit, clearCart } = usePosStore()
  const { user } = useAuthStore()

  // State Management
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "history">("overview")

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDate, setFilterDate] = useState<string>("Today") // Today, Yesterday, Monthly, All Time, Custom Date
  const [customDateFrom, setCustomDateFrom] = useState<string>("")
  const [customDateTo, setCustomDateTo] = useState<string>("")
  const [filterType, setFilterType] = useState<string>("All")
  const [filterOrderState, setFilterOrderState] = useState<string>("All")
  const [filterPayment, setFilterPayment] = useState<string>("All")
  const [filterUser, setFilterUser] = useState<string>("All")
  const [sortBy, setSortBy] = useState<string>("Newest")

  const [allUsers, setAllUsers] = useState<any[]>([])
  useEffect(() => {
    // Users removed from POS
  }, [])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(25)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ mode: 'one' | 'bulk'; order?: Order } | null>(null)
  const [deletePin, setDeletePin] = useState('')

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(new Set(paginatedOrders.map(o => o.id)))
    } else {
      setSelectedOrderIds(new Set())
    }
  }

  const handleSelectOrder = (id: string) => {
    const newSet = new Set(selectedOrderIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedOrderIds(newSet)
  }

  const handleBulkMarkPaid = async () => {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`Mark ${selectedOrderIds.size} order(s) as paid?`)) return

    for (const id of selectedOrderIds) {
      const order = orders.find(o => o.id === id)
      if (order && order.paymentStatus !== 'Paid') {
        try {
          await apiClient.post(
            `/payments/order/${id}`,
            { amount_received: order.total, payment_method: 'CASH' },
            { headers: { 'Idempotency-Key': crypto.randomUUID() } }
          )
          updateOrder(id, { paymentStatus: 'Paid' })
        } catch (e) {
          toast.error('Bulk pay failed', 'One or more payments could not be recorded.')
        }
      }
    }
    refetchHistory()
    setSelectedOrderIds(new Set())
  }

  const handleBulkMarkComplete = async () => {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`Mark ${selectedOrderIds.size} order(s) as completed?`)) return

    for (const id of selectedOrderIds) {
      const order = orders.find(o => o.id === id)
      if (order && order.status !== 'Completed') {
        try {
          await apiClient.post(`/orders/${id}/transition`, { targetState: 'COMPLETED' })
          updateOrder(id, { status: 'Completed', kitchenStatus: 'Served' })
        } catch (e) {
          toast.error('Bulk complete failed', 'One or more orders could not be completed.')
        }
      }
    }
    refetchHistory()
    setSelectedOrderIds(new Set())
  }

  const handleBulkDelete = () => {
    if (selectedOrderIds.size === 0) return
    setDeletePin('')
    setDeleteDialog({ mode: 'bulk' })
  }

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterDate, customDateFrom, customDateTo, filterType, filterPayment, filterOrderState, filterUser, sortBy])

  const historyFilters = useMemo(() => {
    let preset = filterDate.toUpperCase().replace(/ /g, '_');
    if (preset === 'MONTHLY') preset = 'THIS_MONTH';
    const filters: Record<string, string> = {};
    if (preset === 'CUSTOM_DATE' || preset === 'CUSTOM_RANGE') {
      if (customDateFrom && customDateTo) {
        filters.date_preset = 'CUSTOM_DATE';
        filters.date_from = customDateFrom;
        filters.date_to = customDateTo;
      }
    } else {
      filters.date_preset = preset;
    }
    return filters;
  }, [filterDate, customDateFrom, customDateTo])

  const refetchHistory = () => syncOrdersFromBackend(historyFilters, { fetchAll: true })

  // Refetch orders when backend-driven filters (Date) change
  useEffect(() => {
    if ((filterDate === 'Custom Date' || filterDate === 'Custom Range') && (!customDateFrom || !customDateTo)) {
      return;
    }
    refetchHistory();
  }, [historyFilters])

  // Initial Data Fetch
  useEffect(() => {
    // Initial fetch handled by the dependency on filterDate ("Today")
  }, [])

  // Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || !!t?.isContentEditable
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); return }
      if (e.key === "Escape" && selectedOrder && !typing) { e.preventDefault(); setSelectedOrder(null) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedOrder])

  // Actions
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchHistory()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleHistoryBadgeChange = async (order: Order, badge: string) => {
    const current = displayHistoryBadge(order.status)
    if (badge === current) return
    const nextStatus = badge === 'Completed' ? 'Completed' : badge === 'Cancelled' ? 'Cancelled' : 'Active'
    const nextKitchen = badge === 'Completed' ? 'Completed' : badge === 'Cancelled' ? 'Cancelled' : 'Preparing'
    const targetState = badge === 'Completed' ? 'COMPLETED' : badge === 'Cancelled' ? 'CANCELLED' : 'ACTIVE'
    const kitchenState = badge === 'Completed' ? 'COMPLETED' : badge === 'Cancelled' ? 'CANCELLED' : 'PREPARING'
    updateOrder(order.id, { status: nextStatus, kitchenStatus: nextKitchen })
    if (selectedOrder?.id === order.id) {
      setSelectedOrder(prev => prev ? { ...prev, status: nextStatus, kitchenStatus: nextKitchen } : null)
    }
    try {
      if (badge === 'Completed' && current === 'Cancelled') {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'DRAFT' })
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'ACTIVE' })
      } else if (badge === 'Preparing' && current === 'Cancelled') {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'DRAFT' })
      }
      await apiClient.post(`/orders/${order.id}/transition`, { targetState, kitchenState })
      addTimelineEvent(order.id, { event: "Status Changed", remarks: `Changed to ${badge}`, cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: badge, reason: "Manual change from badge" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) {
        const refreshed = useOrderStore.getState().orders.find(o => o.id === order.id)
        setSelectedOrder(refreshed ? { ...refreshed } : {
          ...order,
          status: nextStatus,
          kitchenStatus: nextKitchen
        })
      }
    } catch (e: any) {
      console.error(e)
      await refetchHistory()
      toast.error("Order status", e?.response?.data?.message || e?.message || "Could not change order status")
    }
  }


  const exportToPDF = async () => {
    const doc = new jsPDF('landscape')
    doc.text("Enterprise Order History", 14, 15)

    const headers = [["Order #", "Date", "Cashier", "Order Type", "Customer", "Table", "Subtotal", "Discount", "Service Charge", "Total", "Pay Method", "Pay Status", "Status", "Items"]]
    const { default: autoTable } = await import('jspdf-autotable')
    const data = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      new Date(o.timestamp).toLocaleString(),
      o.cashierName || 'Staff',
      o.orderType,
      o.customerName || 'Guest',
      o.tableNumber || '-',
      o.subtotal.toString(),
      o.discount.toString(),
      (o.serviceCharge || 0).toString(),
      o.total.toString(),
      o.payments?.[0]?.method || 'Cash',
      o.paymentStatus,
      o.status,
      o.items.map(i => `${i.quantity}x ${i.name}`).join('\n')
    ])

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [249, 115, 22] }, // Orange-500
      columnStyles: {
        13: { cellWidth: 50 } // Give items column more space
      }
    })

    doc.save(`Order_History_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportToCSV = () => {
    const headers = ["Order Number", "Date", "Cashier", "Order Type", "Customer", "Table", "Subtotal", "Discount", "Service Charge", "Total", "Pay Method", "Pay Status", "Status", "Items"]
    const rows = filteredAndSortedOrders.map(o => [
      o.orderNumber,
      `"${new Date(o.timestamp).toLocaleString()}"`,
      `"${o.cashierName || 'Staff'}"`,
      `"${o.orderType}"`,
      `"${o.customerName || 'Guest'}"`,
      `"${o.tableNumber || '-'}"`,
      o.subtotal,
      o.discount,
      (o.serviceCharge || 0),
      o.total,
      `"${o.payments?.[0]?.method || 'Cash'}"`,
      `"${o.paymentStatus}"`,
      `"${o.status}"`,
      `"${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}"`
    ])

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Order_History_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openOrderDetail = async (order: Order) => {
    setActiveTab("overview")
    setSelectedOrder(order)
    try {
      const res = await fetchOrderDetail(order.id)
      if (res.success && res.data) {
        setSelectedOrder(mapHistoryDetailToOrder(res.data, res.data))
      }
    } catch {
      // Keep the list snapshot if the full receipt cannot be loaded.
    }
  }

  const handleEditClick = async (order: Order) => {
    try {
      await loadOrderForEdit(order)
      navigate("/pos")
    } catch (e: any) {
      toast.error(e.message || "Failed to edit order")
    }
  }

  const handlePrintReceipt = async (order: Order) => {
    updateOrder(order.id, { receiptReprints: (order.receiptReprints || 0) + 1 })
    addTimelineEvent(order.id, { event: "Receipt Printed", remarks: "Printed receipt", cashier: user?.name || "Ahmed" })

    // Open browser ReceiptPreview popup (window.print)
    try {
      const res = await fetchOrderDetail(order.id)
      if (res.success && res.data) {
        const fullOrder = mapHistoryDetailToOrder(res.data, res.data)
        setPrintOrder(fullOrder)
      } else {
        setPrintOrder(order)
      }
    } catch (e) {
      setPrintOrder(order)
    }
  }

  const handleDuplicate = (order: Order) => {
    alert(`Duplicating Order ${formatReceiptOrderNumber(order.orderNumber)} is scheduled for a future update.`)
  }

  const handleCancelOrder = async (order: Order) => {
    const isCancelled = order.status === 'Cancelled'
    try {
      if (isCancelled) {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'DRAFT' })
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'ACTIVE' })
        updateOrder(order.id, { status: "Active", kitchenStatus: "Pending" })
        addTimelineEvent(order.id, { event: "Order Recovered", remarks: "Recovered from cancelled", cashier: user?.name || "Ahmed" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
        return
      }
      await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'CANCELLED' })
      updateOrder(order.id, { status: "Cancelled", kitchenStatus: "Cancelled" })
      addTimelineEvent(order.id, { event: "Order Cancelled", remarks: "Cancelled from order history", cashier: user?.name || "Ahmed" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Cancelled", kitchenStatus: "Cancelled" } : null)
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || (isCancelled ? 'Could not recover this order.' : 'Could not cancel this order.'))
    }
  }

  const handleRefund = async (order: Order) => {
    const reason = prompt("Reason for refunding this order:")
    if (reason === null) return
    try {
      await apiClient.post(
        `/payments/order/${order.id}/refund`,
        { reason: reason || 'Full refund processed' },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      updateOrder(order.id, { paymentStatus: "Refunded", status: "Cancelled" })
      addTimelineEvent(order.id, { event: "Order Refunded", remarks: reason || "Full refund processed", cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Refund Processed", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Refunded", reason: reason || "Full Refund via OCC" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Refunded", status: "Cancelled" } : null)
    } catch (e: any) {
      toast.error('Refund failed', e?.response?.data?.message || e?.message || 'Could not refund this order.')
    }
  }

  const handleMarkPaid = async (order: Order) => {
    try {
      if (order.paymentStatus === 'Paid') {
        if (!confirm('This order is already paid. Refund it instead of marking unpaid?')) return
        await handleRefund(order)
        return
      }
      await apiClient.post(
        `/payments/order/${order.id}`,
        { amount_received: order.total, payment_method: 'CASH' },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      updateOrder(order.id, { paymentStatus: 'Paid' })
      addTimelineEvent(order.id, { event: "Marked Paid", remarks: "Payment recorded from Order History", cashier: user?.name || "Ahmed" })
      addAuditLog(order.id, { actionType: "Payment Received", who: user?.name || "Ahmed", oldValue: order.paymentStatus, newValue: "Paid", reason: "Action from History" })
      await refetchHistory()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, paymentStatus: "Paid" } : null)
    } catch (e: any) {
      toast.error('Payment failed', e?.response?.data?.message || e?.message || 'Could not record payment.')
    }
  }

  const handleMarkComplete = async (order: Order) => {
    try {
      if (order.status === 'Completed') {
        updateOrder(order.id, { status: 'Active', kitchenStatus: 'Pending' })
        addTimelineEvent(order.id, { event: "Marked Incomplete", remarks: "Marked incomplete from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: "Completed", newValue: "Active", reason: "Action from History" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Active", kitchenStatus: "Pending" } : null)
      } else {
        await apiClient.post(`/orders/${order.id}/transition`, { targetState: 'COMPLETED' })
        updateOrder(order.id, { status: 'Completed', kitchenStatus: 'Served' })
        addTimelineEvent(order.id, { event: "Marked Complete", remarks: "Marked complete from Order History", cashier: user?.name || "Ahmed" })
        addAuditLog(order.id, { actionType: "Status Changed", who: user?.name || "Ahmed", oldValue: order.status, newValue: "Completed", reason: "Action from History" })
        await refetchHistory()
        if (selectedOrder?.id === order.id) setSelectedOrder(prev => prev ? { ...prev, status: "Completed", kitchenStatus: "Served" } : null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteOrder = (order: Order) => {
    setDeletePin('')
    setDeleteDialog({ mode: 'one', order })
  }

  const confirmDeleteWithPin = async () => {
    if (!deleteDialog) return
    const pin = deletePin.trim()
    const pinOk = await authService.verifyManagerPin(pin)
    if (!pinOk) {
      alert('Unauthorized. Enter a manager PIN.')
      return
    }
    try {
      if (deleteDialog.mode === 'one' && deleteDialog.order) {
        const res: any = await deleteOrder(deleteDialog.order.id, pin)
        if (res?.success === false) {
          alert(res.message || 'Failed to delete order')
          return
        }
        if (selectedOrder?.id === deleteDialog.order.id) setSelectedOrder(null)
      } else {
        for (const id of selectedOrderIds) {
          try { await deleteOrder(id, pin) } catch { /* continue */ }
        }
        setSelectedOrderIds(new Set())
      }
      setDeleteDialog(null)
      setDeletePin('')
      await refetchHistory()
    } catch (e: any) {
      console.error(e)
      const msg = e?.response?.data?.message || e?.message || 'Error deleting order.'
      alert(msg === 'Network Error' ? 'Could not reach the till API to delete this order. Check the backend is running, then try again.' : msg)
    }
  }

  // Filter Logic
  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter(order => {
      const bd = order.businessDate || DateUtils.getBusinessDate(order.timestamp)
      const range = DateUtils.resolveReportRange({
        timeRange: filterDate === 'Monthly' ? 'This Month' : filterDate,
        customDateFrom,
        customDateTo
      })
      if (bd < range.startDate || bd > range.endDate) return false

      // Global Search Match
      const q = searchQuery.toLowerCase().trim()
      const searchMatches = !q ||
        order.id.toLowerCase().includes(q) ||
        order.orderNumber.toLowerCase().includes(q) ||
        parseInt(order.orderNumber, 10).toString().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.customerPhone || '').includes(q) ||
        (order.cashierName || '').toLowerCase().includes(q) ||
        (order.tableNumber || '').toLowerCase().includes(q) ||
        order.items.some(i => i.name.toLowerCase().includes(q) || (i.code || '').includes(q))

      // Exact Filters
      const matchType = filterType === "All" || order.orderType === filterType
      
      const matchOrderState = filterOrderState === "All" || displayHistoryBadge(order.status) === filterOrderState
      const matchPayment = filterPayment === "All" || order.paymentStatus === filterPayment
      const matchUserDrop = filterUser === "All" || order.cashierName === filterUser || order.waiterName === filterUser

      return searchMatches && matchType && matchOrderState && matchPayment && matchUserDrop
    })

    // Sort order
    result.sort((a, b) => {
      if (sortBy === "Newest") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Oldest") return new Date(a.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (sortBy === "Highest Amount") return b.total - a.total
      if (sortBy === "Lowest Amount") return a.total - b.total
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return result
  }, [orders, searchQuery, filterDate, customDateFrom, customDateTo, filterType, filterPayment, filterOrderState, filterUser, sortBy])

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage)
  const paginatedOrders = filteredAndSortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const historySaleTotals = useMemo(() => {
    const saleOrders = filteredAndSortedOrders.filter(o =>
      o.status === 'Completed'
    )
    const listed = filteredAndSortedOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const sale = saleOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    const food = saleOrders.reduce((s, o) => s + Math.max(0, (Number(o.subtotal) || 0) - (Number(o.discount) || 0)), 0)
    return { listed, sale, food, saleCount: saleOrders.length, listedCount: filteredAndSortedOrders.length }
  }, [filteredAndSortedOrders])

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto text-foreground text-[13px] leading-tight">

      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-3 bg-card border border-border rounded-2xl shadow-sm gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            Order History
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Enterprise Ops</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-0.5">
            Sale: {formatRs(historySaleTotals.sale)} from {historySaleTotals.saleCount} completed bills · Food net: {formatRs(historySaleTotals.food)}
          </p>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Business day 6AM–6AM · {DateUtils.getBusinessDayLabel()} · Sale matches Reports Gross for the same dates
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleRefresh} className={`p-3 bg-secondary hover:bg-border rounded-xl text-muted-foreground transition-colors ${isRefreshing ? 'animate-spin text-primary' : ''}`} title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>

          <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-black hover:bg-secondary/80 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>

          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-black hover:bg-secondary/80 transition-colors">
            <FileText className="w-4 h-4" /> CSV
          </button>

          <button onClick={() => { clearCart(); navigate("/pos") }} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/95 shadow-lg shadow-primary/20 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> Create New Order
          </button>
        </div>
      </div>

      {/* SEARCH & FILTERS PANEL */}
      <div className="bg-card border border-border rounded-2xl p-3 shadow-sm flex flex-col gap-2">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Items..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-[11px] font-bold transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 lg:pb-0 hide-scrollbar-mobile">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="Newest">Sort: Newest First</option>
              <option value="Oldest">Sort: Oldest First</option>
              <option value="Highest Amount">Sort: Highest Amount</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="All">Type: All</option>
              <option value="Dine In">Type: Dine In</option>
              <option value="Takeaway">Type: Takeaway</option>
              <option value="Delivery">Type: Delivery</option>
            </select>

            <select value={filterOrderState} onChange={(e) => setFilterOrderState(e.target.value)} className="h-10 rounded-xl bg-secondary border border-border text-[11px] font-bold px-3 focus:outline-none shrink-0 cursor-pointer hover:bg-secondary/80">
              <option value="All">Status: All</option>
              <option value="Preparing">Status: Preparing</option>
              <option value="Completed">Status: Completed</option>
              <option value="Cancelled">Status: Cancelled</option>
            </select>
            
            <div className="h-6 w-px bg-border mx-1 shrink-0"></div>

            <div className="flex items-center gap-1 shrink-0 bg-primary/5 p-1 rounded-xl border border-primary/20">
              <Calendar className="w-4 h-4 text-primary ml-2" />
              <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 rounded-lg bg-transparent text-primary text-[11px] font-black px-2 focus:outline-none cursor-pointer">
                <option value="Today">Date: Today</option>
                <option value="Yesterday">Date: Yesterday</option>
                <option value="Monthly">Date: Monthly</option>
                <option value="All Time">Date: All Time</option>
                <option value="Custom Date">Date: Custom Date</option>
                <option value="Custom Range">Date: Custom Range</option>
              </select>
              {filterDate === 'Custom Date' && (
                <div className="flex gap-1 ml-1 items-center">
                  <input type="date" value={customDateFrom} onChange={(e) => { setCustomDateFrom(e.target.value); setCustomDateTo(e.target.value); }} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                </div>
              )}
              {filterDate === 'Custom Range' && (
                <div className="flex gap-1 ml-1 items-center">
                  <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                  <span className="text-[10px] text-primary font-black">-</span>
                  <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                </div>
              )}
            </div>

            <button onClick={() => {
              setFilterDate("Today"); setCustomDateFrom(""); setCustomDateTo(""); setFilterType("All"); setFilterOrderState("All"); setFilterPayment("All"); setFilterUser("All"); setSortBy("Newest"); setSearchQuery("");
            }} className="h-10 px-3 rounded-xl bg-secondary border border-border text-[10px] font-black uppercase text-muted-foreground hover:bg-border transition-colors shrink-0" title="Reset Filters">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {selectedOrderIds.size > 0 && (
          <div className="bg-primary/10 border-b border-border p-3 flex justify-between items-center px-6">
            <span className="text-sm font-bold text-primary">{selectedOrderIds.size} orders selected</span>
            <div className="flex gap-2">
              <button onClick={handleBulkMarkPaid} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors">Mark Paid</button>
              <button onClick={handleBulkMarkComplete} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors">Mark Complete</button>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">Delete Selected</button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse min-w-[900px] text-[13px]">
            <thead className="sticky top-0 bg-secondary z-10 shadow-sm">
              <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                <th className="px-3 py-2 w-12 text-center">
                  <input type="checkbox" onChange={handleSelectAll} checked={paginatedOrders.length > 0 && selectedOrderIds.size === paginatedOrders.length} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                </th>
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2">Date & Time</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Table/Waiter</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className={`hover:bg-secondary/40 transition-colors group cursor-pointer ${selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''}`} onClick={() => { void openOrderDetail(order) }}>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectOrder(order.id)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  </td>
                  <td className="px-3 py-2 font-black">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-black">{formatReceiptOrderNumber(order.orderNumber)}</span>
                      {order.isEdited && <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase border font-bold tracking-widest leading-none ${order.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Edited</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                    <div>{new Date(order.timestamp).toLocaleDateString()}</div>
                    <div className="font-bold text-foreground">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-3 py-2 font-bold">
                    {order.customerName || "Guest"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-bold text-xs bg-secondary px-2 py-1 rounded-md border border-border inline-block mb-1">{order.orderType}</span>
                  </td>
                  <td className="px-3 py-2">
                    {order.orderType === 'Dine In' ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-bold text-muted-foreground">Table: {order.tableNumber || "—"}</div>
                        <div className="text-[10px] font-bold text-muted-foreground">Waiter: {order.waiterName || order.waiterId ? (order.waiterName || order.waiterId?.substring(0,6)) : "Unassigned"}</div>
                      </div>
                    ) : order.orderType === 'Delivery' ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-bold text-muted-foreground">Rider: {order.riderName || order.riderId ? (order.riderName || order.riderId?.substring(0,6)) : "Unassigned"}</div>
                        <div className="text-[10px] font-bold text-muted-foreground">Phone: {order.customerPhone || "—"}</div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-muted-foreground">—</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-bold text-xs">
                    {order.items.reduce((s, i) => s + i.quantity, 0)} Items
                  </td>
                  <td className="px-3 py-2 font-black text-primary">
                    Rs {order.total.toLocaleString()}
                    {order.paymentStatus === 'Paid' && (
                      <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                        {order.payments?.[0]?.method || "Cash"}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={displayHistoryBadge(order.status)}
                      onChange={(e) => handleHistoryBadgeChange(order, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className={`text-[10px] pl-2 pr-6 py-1 rounded-lg font-black uppercase border cursor-pointer outline-none ${historyBadgeColors[displayHistoryBadge(order.status)]}`}
                    >
                      {Object.keys(historyBadgeColors).map(status => (
                        <option key={status} value={status} className="bg-card text-foreground">{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="grid grid-cols-5 gap-1.5 w-[212px] ml-auto" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => { void openOrderDetail(order) }} className="w-8 h-8 border-2 border-foreground/40 rounded-lg bg-card text-foreground hover:text-primary hover:border-primary hover:bg-secondary transition-colors flex items-center justify-center" title="View Details"><FileText className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handlePrintReceipt(order)} className="w-8 h-8 border-2 border-foreground/40 rounded-lg bg-card text-foreground hover:text-primary hover:border-primary hover:bg-secondary transition-colors flex items-center justify-center" title="Print/Reprint Receipt"><Printer className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleEditClick(order)} className="w-8 h-8 border-2 border-foreground/40 rounded-lg bg-card text-foreground hover:text-amber-500 hover:border-amber-500 hover:bg-secondary transition-colors flex items-center justify-center" title="Edit Order"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelOrder(order) }} className={`w-8 h-8 border-2 rounded-lg bg-card transition-colors flex items-center justify-center ${order.status === 'Cancelled' ? 'border-emerald-600 text-emerald-600 hover:bg-emerald-500/10' : 'border-foreground/40 text-foreground hover:text-red-500 hover:border-red-500 hover:bg-secondary'}`} title={order.status === 'Cancelled' ? 'Recover Order' : 'Cancel Order'}>{order.status === 'Cancelled' ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteOrder(order) }} className="w-8 h-8 border-2 border-foreground/40 rounded-lg bg-card text-foreground hover:text-red-600 hover:border-red-500 hover:bg-secondary transition-colors flex items-center justify-center" title="Delete Order"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">No orders found matching the criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-secondary/30 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
          <div className="flex items-center gap-2">
            Show
            <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-card border border-border rounded-lg px-2 py-1 outline-none">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            entries
          </div>
          <div>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} of {filteredAndSortedOrders.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1.5 bg-card hover:bg-secondary border border-border rounded-lg disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3">Page {currentPage} of {totalPages || 1}</span>
            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-1.5 bg-card hover:bg-secondary border border-border rounded-lg disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* ENTERPRISE DRAWER: VIEW DETAILS */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="relative w-full max-w-4xl bg-card h-full shadow-2xl flex flex-col border-l border-border">

              {/* Drawer Header */}
              <div className="p-4 border-b border-border bg-secondary/30 flex items-start justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-black flex items-center gap-2">
                      {formatReceiptOrderNumber(selectedOrder.orderNumber)}
                      {selectedOrder.isEdited && <span className={`text-[10px] px-2 py-0.5 rounded uppercase border font-bold tracking-widest leading-none ${selectedOrder.isNegativeEdit ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Edited</span>}
                    </h2>
                    <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest border ${historyBadgeColors[displayHistoryBadge(selectedOrder.status)]}`}>{displayHistoryBadge(selectedOrder.status)}</span>
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">{new Date(selectedOrder.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePrintReceipt(selectedOrder)} className="px-4 py-2 bg-secondary border border-border rounded-xl text-xs font-black flex items-center gap-2 hover:bg-border transition-colors"><Printer className="w-4 h-4" /> Print</button>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 bg-secondary border border-border rounded-xl hover:bg-border transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex overflow-x-auto border-b border-border hide-scrollbar shrink-0 px-2">
                {[
                  { id: "overview", icon: FileText, label: "Receipt" },
                  { id: "timeline", icon: Clock, label: "Timeline" },
                  { id: "history", icon: History, label: "Edit History" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-4 border-b-2 text-sm font-black whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-auto p-6 bg-background custom-scrollbar">

                {activeTab === "overview" && (() => {
                  const lineTotal = (item: any) => {
                    const extras = [...(item.selectedModifiers || []), ...(item.addons || [])]
                    const extraSum = extras.reduce((s: number, m: any) => s + (Number(m.price || m.unit_price || m.addon_price) || 0), 0)
                    if (item.subtotal != null && Number(item.subtotal) > 0) return Number(item.subtotal)
                    return (Number(item.price) + extraSum) * Number(item.quantity || 1)
                  }
                  const foodNet = (selectedOrder.items || []).reduce((s, item) => s + lineTotal(item), 0)
                  const storedSub = Number(selectedOrder.subtotal || 0)
                  const subtotal = foodNet > 0 && Math.abs(foodNet - storedSub) > 0.5 ? foodNet : (storedSub || foodNet)
                  const discountAmt = Number(selectedOrder.discount || 0)
                  const serviceAmt = Number(selectedOrder.serviceCharge || 0)
                  const deliveryAmt = Number(selectedOrder.deliveryCharge || 0)
                  const reconstructed = Math.max(0, subtotal - discountAmt + serviceAmt + deliveryAmt)
                  const storedTotal = Number(selectedOrder.total || 0)
                  const ticketTotal = Math.abs(reconstructed - storedTotal) > 0.5 ? reconstructed : (storedTotal || reconstructed)
                  const paidAmt = (selectedOrder.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
                  const dueAmt = Math.max(0, ticketTotal - paidAmt)
                  const isDineIn = selectedOrder.orderType === 'Dine In'
                  const waiterLabel = selectedOrder.waiterName || (selectedOrder.waiterId ? selectedOrder.waiterId.substring(0, 8) : "")
                  const riderLabel = selectedOrder.riderName || (selectedOrder.riderId ? selectedOrder.riderId.substring(0, 8) : "")
                  const stamped = new Date(selectedOrder.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).replace(",", "")
                  return (
                    <div className="max-w-[420px] mx-auto">
                      <div className="bg-white text-black rounded-sm shadow-xl border border-black/20 p-5 font-sans">
                        <div className="text-[11px] space-y-0.5 mb-3">
                          <p className="text-[16px] font-black leading-tight">{formatReceiptOrderNumber(selectedOrder.orderNumber)}</p>
                          <p>
                            <span className="font-black">Customer:</span>{" "}
                            {selectedOrder.customerName || "Guest"}
                            {selectedOrder.customerPhone ? <> — <span className="font-black text-[13px]">{selectedOrder.customerPhone}</span></> : ""}
                          </p>
                          <p><span className="font-black">Address:</span> {selectedOrder.customerAddress || "—"}</p>
                          {selectedOrder.isVip && <p className="text-center font-black uppercase text-sm py-1">** VIP ORDER **</p>}
                          {isDineIn && (
                            <p><span className="font-black">Table No:</span> {selectedOrder.tableNumber || "Unassigned"}</p>
                          )}
                          {isDineIn && Number(selectedOrder.guestCount || 0) > 1 && (
                            <p><span className="font-black">Guests:</span> {selectedOrder.guestCount}</p>
                          )}
                          <p><span className="font-black">Order Type:</span> {selectedOrder.orderType}</p>
                          <p><span className="font-black">Cashier:</span> {selectedOrder.cashierName || "—"}</p>
                          {(isDineIn || waiterLabel) && (
                            <p><span className="font-black">Waiter:</span> {waiterLabel || "Unassigned"}</p>
                          )}
                          {(selectedOrder.orderType === "Delivery" || riderLabel) && (
                            <p><span className="font-black">Rider:</span> {riderLabel || "Unassigned"}</p>
                          )}
                          <p><span className="font-black">Order:</span> {displayHistoryBadge(selectedOrder.status)}</p>
                          <p><span className="font-black">Kitchen:</span> {selectedOrder.kitchenStatus}</p>
                          <p><span className="font-black">Payment:</span> {selectedOrder.paymentStatus === "Paid" ? "Paid" : "Unpaid"}</p>
                          <p className="font-black text-[13px] pt-1">{stamped}</p>
                          {selectedOrder.businessDate && (
                            <p className="text-[10px]">Business day {selectedOrder.businessDate} · 6AM–6AM</p>
                          )}
                        </div>

                        <table className="w-full text-[11px] font-bold border-2 border-black mb-3 border-collapse">
                          <thead>
                            <tr className="border-b-2 border-black">
                              <th className="text-center py-1 px-1 border-r-2 border-black w-[60%]">Item</th>
                              <th className="text-center py-1 px-1 border-r-2 border-black w-[15%]">Qty</th>
                              <th className="text-center py-1 px-1 w-[25%]">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedOrder.items || []).length === 0 ? (
                              <tr><td colSpan={3} className="text-center py-3">No items</td></tr>
                            ) : selectedOrder.items.map((item, idx) => (
                              <tr key={idx} className="border-b-2 border-black last:border-b-0">
                                <td className="text-center py-1 px-1 border-r-2 border-black uppercase">
                                  <div className="font-black">{item.name}</div>
                                  {itemVariantName(item) ? (
                                    <div className="text-[10px] font-normal normal-case">({itemVariantName(item)})</div>
                                  ) : null}
                                  {(item.selectedModifiers || []).map((m: any, i: number) => (
                                    <div key={`m-${i}`} className="text-[10px] font-normal normal-case">+ {m.name || m.modifier_name_snapshot}</div>
                                  ))}
                                  {((item as any).addons || []).map((a: any, i: number) => (
                                    <div key={`a-${i}`} className="text-[10px] font-normal normal-case">+ {a.name || a.addon_name_snapshot || a.product_name_snapshot}</div>
                                  ))}
                                  {(item.combo_components || []).map((c: any, i: number) => (
                                    <div key={`c-${i}`} className="text-[10px] font-normal normal-case">- {c.quantity > 1 ? `${c.quantity}x ` : ""}{c.product_name_snapshot || c.name}{c.variant_snapshot ? ` (${c.variant_snapshot})` : ""}</div>
                                  ))}
                                  {item.notes && <div className="text-[10px] font-black normal-case">Note: {item.notes}</div>}
                                </td>
                                <td className="text-center py-1 px-1 border-r-2 border-black font-black align-middle">{item.quantity}</td>
                                <td className="text-center py-1 px-1 font-black whitespace-nowrap align-middle">Rs {lineTotal(item).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {(selectedOrder.notes || selectedOrder.kitchenNotes) && (
                          <div className="border-t-2 border-dashed border-black pt-2 mb-3 text-[11px] font-bold space-y-1">
                            {selectedOrder.notes && <p>NOTE: {selectedOrder.notes}</p>}
                            {selectedOrder.kitchenNotes && <p>KITCHEN: {selectedOrder.kitchenNotes}</p>}
                          </div>
                        )}

                        <div className="text-[11px] font-bold space-y-0.5 mb-3">
                          <div className="flex justify-between"><span>Subtotal:</span><span>Rs {subtotal.toFixed(2)}</span></div>
                          {discountAmt > 0 && (
                            <div className="flex justify-between"><span>Discount:</span><span>- Rs {discountAmt.toFixed(2)}</span></div>
                          )}
                          {Number(selectedOrder.tax || 0) > 0 && (
                            <div className="flex justify-between"><span>Tax:</span><span>Rs {Number(selectedOrder.tax).toFixed(2)}</span></div>
                          )}
                          {serviceAmt > 0 && (
                            <div className="flex justify-between"><span>Service Charges:</span><span>Rs {serviceAmt.toFixed(2)}</span></div>
                          )}
                          {deliveryAmt > 0 && (
                            <div className="flex justify-between"><span>Delivery:</span><span>Rs {deliveryAmt.toFixed(2)}</span></div>
                          )}
                          <div className="flex justify-between text-[13px] font-black underline underline-offset-2 pt-1">
                            <span>Total Amount:</span><span>Rs {ticketTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-1"><span>Paid:</span><span>Rs {paidAmt.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>Due:</span><span>Rs {dueAmt.toFixed(2)}</span></div>
                        </div>

                        <div className="border-t-2 border-dashed border-black pt-2 text-[11px] font-bold">
                          <p className="font-black mb-1">Payments</p>
                          {(selectedOrder.payments || []).length === 0 ? (
                            <p>No payment recorded · {selectedOrder.paymentStatus}</p>
                          ) : selectedOrder.payments.map((pay, i) => (
                            <div key={i} className="flex justify-between gap-2">
                              <span>{pay.method}{pay.cashier ? ` · ${pay.cashier}` : ""}</span>
                              <span>Rs {Number(pay.amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <p className="text-center text-[11px] font-semibold mt-4">Thank you for your order!<br />Please visit again.</p>
                      </div>
                    </div>
                  )
                })()}

                {/* 5. Timeline Tab */}
                {activeTab === "timeline" && (
                  <div className="max-w-2xl mx-auto py-4">
                    <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-6 before:w-0.5 before:bg-border">
                      {selectedOrder.timeline.map((event, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[30px] bg-card border-2 border-primary w-4 h-4 rounded-full mt-1.5 z-10" />
                          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                            <p className="font-black text-foreground">{event.event}</p>
                            {event.remarks && <p className="text-sm text-muted-foreground font-bold mt-1">{event.remarks}</p>}
                            <div className="flex items-center gap-2 mt-3 text-xs font-bold text-muted-foreground">
                              <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                              <span>•</span>
                              <span>By {event.cashier}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Edit History & Audit Log */}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    {selectedOrder.auditLog && selectedOrder.auditLog.length > 0 ? (
                      selectedOrder.auditLog.map((log, idx) => {
                        const info = parseAuditChange(log.actionType, log.oldValue, log.newValue)
                        return (
                        <div key={idx} className="bg-card border border-border rounded-2xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className={`text-xs font-black px-2 py-1 rounded-md uppercase border ${
                                info.tone === 'add' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                info.tone === 'remove' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-secondary text-primary border-primary/20'
                              }`}>{log.actionType}</span>
                              <p className="text-sm font-bold mt-2">By {log.who} at {new Date(log.when).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className={`mt-3 p-3 rounded-xl border text-sm font-bold ${
                            info.tone === 'add' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                            info.tone === 'remove' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                            'bg-secondary/30 border-border/50 text-foreground'
                          }`}>
                            <div className="flex justify-between items-start gap-3">
                              <span>{info.sign ? `${info.sign} ` : ''}{info.label}</span>
                              {info.amount != null && (
                                <span className="whitespace-nowrap">{info.sign}{formatRs(info.amount)}</span>
                              )}
                            </div>
                            {info.billBefore != null && info.billAfter != null && (
                              <p className="text-xs mt-2 font-bold opacity-80">Bill {formatRs(info.billBefore)} → {formatRs(info.billAfter)}</p>
                            )}
                          </div>
                          {log.reason && <p className="text-xs font-bold text-muted-foreground mt-3 italic">Reason: {log.reason}</p>}
                        </div>
                        )
                      })
                    ) : (
                      <div className="text-center p-12 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold">No edits or audit logs found for this order.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-border bg-secondary/30 flex justify-end gap-3 shrink-0">
                <button onClick={() => handleDuplicate(selectedOrder)} className="px-5 py-2.5 bg-card hover:bg-secondary border border-border rounded-xl text-sm font-black transition-colors">Duplicate Order</button>
                <button onClick={() => handleEditClick(selectedOrder)} className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl text-sm font-black transition-colors">Edit Order</button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden">
        {printOrder && <ReceiptPreview order={printOrder} autoPrint={true} onClose={() => setPrintOrder(null)} />}
      </div>

      {deleteDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-black mb-1">Delete order</h3>
            <p className="text-sm font-bold text-muted-foreground mb-4">
              {deleteDialog.mode === 'one'
                ? `Enter owner PIN to delete ${formatReceiptOrderNumber(deleteDialog.order?.orderNumber)}.`
                : `Enter owner PIN to delete ${selectedOrderIds.size} selected order(s).`}
            </p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={deletePin}
              onChange={(e) => setDeletePin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteWithPin() }}
              className="w-full h-11 px-3 rounded-xl border border-border bg-secondary font-black tracking-widest mb-4 outline-none focus:border-primary"
              placeholder="PIN"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDeleteDialog(null); setDeletePin('') }} className="flex-1 h-11 rounded-xl border border-border font-black">Cancel</button>
              <button type="button" onClick={confirmDeleteWithPin} className="flex-1 h-11 rounded-xl bg-red-500 text-white font-black">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
