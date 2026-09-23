import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  DollarSign, ShoppingBag, TrendingUp, CheckCircle,
  Flame, Bell, ChevronRight, Search, ShoppingCart, Layers, FileText,
  RefreshCw, AlertTriangle, Check, Ban
} from "lucide-react"
import { useOrderStore } from "../store/orderStore"
import { usePosStore } from "../store/posStore"
import { useAuthStore } from "../store/authStore"
import { useTableStore } from "../store/tableStore"
import { dashboardService } from "../services/dashboardService"
import type { DashboardSummary, DashboardOperations, RevenueAnalytics, PopularProduct, ActivityFeedItem } from "../services/dashboardService"
import { toast } from "../store/toastStore"
import { useNavigate } from "react-router-dom"
import { DateUtils } from "../utils/dateUtils"

// Status color definitions
const orderStatusColors: Record<string, string> = {
  Active: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-red-500/10 text-red-400 border-red-500/20"
}

const displayOrderStatus = (status: string) => {
  if (status === "Completed") return "Completed"
  if (status === "Cancelled" || status === "Refunded") return "Cancelled"
  return "Active"
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
  Unpaid: "bg-red-500/10 text-red-400 border-red-500/20",
  "Partial Paid": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Paid: "bg-green-500/10 text-green-400 border-green-500/20",
  Refunded: "bg-purple-500/10 text-purple-400 border-purple-500/20"
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { orders, syncOrdersFromBackend } = useOrderStore()
  const { loadOrderForEdit, clearCart, openOrders, tableNumber, cart, waiterName: currentWaiterName } = usePosStore()
  const { categories, tables: backendTables, fetchData: fetchTableData } = useTableStore()
  const { user } = useAuthStore()

  // Backend state
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [operations, setOperations] = useState<DashboardOperations | null>(null)
  const [revenue, setRevenue] = useState<RevenueAnalytics[]>([])
  const [popular, setPopular] = useState<PopularProduct[]>([])
  const [activities, setActivities] = useState<ActivityFeedItem[]>([])
  const [isLoading, setIsLoading] = useState({
    summary: true,
    operations: true,
    revenue: true,
    popular: true,
    activity: true
  })

  // Interface states
  const [searchQuery, setSearchQuery] = useState("")

  // Hardware/System Simulation states
  const [drawerOpen, setDrawerOpen] = useState(false)

  const enhancedTables = useMemo(() => {
    return backendTables.map(t => {
      let status = t.status || 'Available'
      let waiterName = ""

      // Find in backend orders
      const backendOrder = orders.find(o => o.tableNumber === t.name && o.status !== "Completed" && o.status !== "Cancelled")
      if (backendOrder) {
        status = 'Occupied'
        waiterName = backendOrder.waiterName || ""
      }

      // Find in POS openOrders
      const orderForTable = Object.values(openOrders).find(o => o.tableNumber === t.name)
      if (orderForTable && orderForTable.cart.length > 0) {
        status = 'Occupied'
        waiterName = orderForTable.waiterName || ""
      }

      // Check current active POS cart
      if (tableNumber === t.name && cart.length > 0) {
        status = 'Occupied'
        waiterName = currentWaiterName || ""
      }

      return { ...t, status, waiterName }
    })
  }, [backendTables, orders, openOrders, tableNumber, cart.length, currentWaiterName])

  // Notifications (Now using backend activity feed)
  const liveStats = useMemo(() => {
    const currentBusinessDate = DateUtils.getBusinessDate()
    let todaySales = 0
    let todayOrders = 0
    let cancelledOrders = 0
    let completedOrders = 0
    let notCompletedOrders = 0
    let completedSales = 0

    orders.forEach(o => {
      const isToday = o.businessDate === currentBusinessDate
      if (!isToday) return
      const shown = displayOrderStatus(o.status)
      const isPaid = String(o.paymentStatus || '') === 'Paid'
      if (shown === 'Cancelled') {
        cancelledOrders++
        return
      }
      const isSale = shown === 'Completed' || (shown === 'Active' && isPaid)
      if (isSale) {
        todayOrders++
        todaySales += o.total || 0
      }
      if (shown === 'Completed') {
        completedOrders++
        completedSales += o.total || 0
      } else if (shown === 'Active' && !isPaid) {
        notCompletedOrders++
      }
    })
    return { todaySales, todayOrders, cancelledOrders, completedOrders, notCompletedOrders, completedSales }
  }, [orders])

  const handleManualSync = () => {
    fetchDashboardData()
  }

  const fetchDashboardData = async () => {
    setIsLoading({ summary: true, operations: true, revenue: true, popular: true, activity: true })

    // Fetch Summary
    dashboardService.getSummary().then(res => {
      setSummary(res.data)
      setIsLoading(prev => ({ ...prev, summary: false }))
    }).catch(() => {
      setIsLoading(prev => ({ ...prev, summary: false }))
      toast.error("Dashboard Error", "Failed to load sales summary")
    })

    // Fetch Operations
    dashboardService.getOperations().then(res => {
      setOperations(res.data)
      setIsLoading(prev => ({ ...prev, operations: false }))
    }).catch(() => setIsLoading(prev => ({ ...prev, operations: false })))

    // Fetch Revenue (Permission check on backend, but we also check locally before fetching)
    if (user?.permissions?.includes('VIEW_REPORTS') || user?.role === '1') {
      dashboardService.getRevenueAnalytics().then(res => {
        setRevenue(res.data)
        setIsLoading(prev => ({ ...prev, revenue: false }))
      }).catch(() => setIsLoading(prev => ({ ...prev, revenue: false })))
    } else {
      setIsLoading(prev => ({ ...prev, revenue: false }))
    }

    // Fetch Popular
    dashboardService.getPopularProducts().then(res => {
      setPopular(res.data)
      setIsLoading(prev => ({ ...prev, popular: false }))
    }).catch(() => setIsLoading(prev => ({ ...prev, popular: false })))

    // Fetch Activity
    dashboardService.getActivityFeed().then(res => {
      setActivities(res.data)
      setIsLoading(prev => ({ ...prev, activity: false }))
    }).catch(() => setIsLoading(prev => ({ ...prev, activity: false })))
  }

  // Auto refresh
  useEffect(() => {
    fetchDashboardData()
    fetchTableData()
    syncOrdersFromBackend()
    // Poll every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardData()
      syncOrdersFromBackend()
    }, 60000)
    return () => clearInterval(interval)
  }, [])











  // Filter orders based on query and ensure they are today's orders
  const filteredOrders = useMemo(() => {
    const currentBusinessDate = DateUtils.getBusinessDate()
    const result = orders.filter(o => {
      const isToday = o.businessDate === currentBusinessDate
      if (!isToday) return false
      if (o.status === 'Completed') return false
      
      const q = searchQuery.toLowerCase()
      return o.orderNumber.includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.cashierName || '').toLowerCase().includes(q)
    })
    
    // Sort descending by timestamp so newest appear first
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [orders, searchQuery])


  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground">


      {/* ==================================================
          OPERATIONS KPI CARDS BLOCK
          ================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Today's Sales", value: `Rs. ${(summary?.todaySales ?? liveStats.todaySales ?? 0).toLocaleString()}`, desc: "Completed bills + paid kitchen tickets (6AM–6AM). Open unpaid bills are not included.", trend: "Live data", color: "text-emerald-500", icon: DollarSign },
          { title: "Today's Orders", value: summary?.ordersCount ?? liveStats.todayOrders ?? 0, desc: "Sale tickets today — completed, or active and already paid", trend: "Live data", color: "text-blue-500", icon: ShoppingBag },
          { title: "Cancelled Orders", value: summary?.cancelled ?? liveStats.cancelledOrders ?? 0, desc: "Cancelled bills this business day", trend: "Live data", color: "text-red-500", icon: Ban },
          { title: "Completed Sale", value: `Rs. ${(summary?.completedSales ?? liveStats.completedSales ?? 0).toLocaleString()}`, desc: "Sales of completed orders only", trend: "Live data", color: "text-emerald-500", icon: DollarSign },
          { title: "Completed Orders", value: summary?.completed ?? liveStats.completedOrders ?? 0, desc: "Orders marked completed today", trend: "Live data", color: "text-emerald-500", icon: Check },
          { title: "Not Completed", value: summary?.notCompleted ?? liveStats.notCompletedOrders ?? 0, desc: "Still open or in progress", trend: "Live data", color: "text-amber-500", icon: AlertTriangle }
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`p-5 bg-card/60 backdrop-blur-md rounded-[2rem] border ${card.title === "Cancelled Orders" ? 'border-red-500/40 shadow-sm shadow-red-500/10' : card.title === "Not Completed" ? 'border-amber-500/40 shadow-sm shadow-amber-500/10' : card.title === "Completed Sale" || card.title === "Completed Orders" ? 'border-emerald-500/30' : 'border-border/50'} flex flex-col justify-between hover:shadow-md transition-all group`}
          >
            <div>
              <div className="flex justify-between items-start pb-3">
                <span className={`text-[10px] uppercase font-black tracking-widest ${card.title === "Cancelled Orders" ? 'text-red-500' : card.title === "Not Completed" ? 'text-amber-500' : 'text-muted-foreground'}`}>{card.title}</span>
                <div className={`p-2 bg-secondary rounded-xl border border-border group-hover:border-primary/50 group-hover:text-primary transition-colors ${card.color}`}>
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <h3 className={`text-2xl font-black tracking-tight ${card.title === "Cancelled Orders" ? 'text-red-500' : card.title === "Not Completed" ? 'text-amber-500' : 'text-foreground'}`}>{card.value}</h3>
            </div>
            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground font-semibold leading-tight">{card.desc}</p>
              <p className={`text-[9px] font-bold mt-1 flex items-center gap-1 ${card.title === "Cancelled Orders" ? 'text-red-400' : card.title === "Not Completed" ? 'text-amber-500' : 'text-emerald-500'}`}>
                {card.title !== "Cancelled Orders" && card.title !== "Not Completed" && <TrendingUp className="w-3 h-3" />}
                {card.trend}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ==================================================
          LIVE ORDER FLOW WIDGET
          ================================================== */}
      <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
        <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Live Order Flow</h3>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-sky-500">Preparing</p>
                <p className="text-[10px] text-muted-foreground font-bold">Active in kitchens</p>
              </div>
            </div>
            <span className="text-2xl font-black text-sky-500">{operations?.preparing || 0}</span>
          </div>

          <ChevronRight className="hidden md:block w-6 h-6 text-muted-foreground shrink-0" />

          <div className="flex-1 w-full bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-orange-500">Ready</p>
                <p className="text-[10px] text-muted-foreground font-bold">Waiting for servers</p>
              </div>
            </div>
            <span className="text-2xl font-black text-orange-500">{operations?.ready || 0}</span>
          </div>

          <ChevronRight className="hidden md:block w-6 h-6 text-muted-foreground shrink-0" />

          <div className="flex-1 w-full bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-purple-500">Served</p>
                <p className="text-[10px] text-muted-foreground font-bold">Delivered to guests</p>
              </div>
            </div>
            <span className="text-2xl font-black text-purple-500">{summary?.served || 0}</span>
          </div>
        </div>
      </div>

      {/* ==================================================
          MAIN OPERATIONS CONTENT GRID (Recent Orders & Quick Actions)
          ================================================== */}
      <div className="grid grid-cols-12 gap-6">

        {/* Left Column (col-span-8) */}
        <div className="col-span-12 xl:col-span-8 flex flex-col">

          {/* Section: Recent Orders */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 mb-4 gap-2">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Today's Recent Orders</h3>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">Showing up to 30 recent orders. Orders with red outline are overdue (&gt;25 mins).</p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-4 h-4" /></span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search orders, customers..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/80 border border-border focus:border-orange-500 outline-none text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrders.slice(0, 30).map(order => {
                const elapsedMin = Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000)
                const isOverdue = elapsedMin > 25 && order.kitchenStatus !== 'Served' && order.kitchenStatus !== 'Cancelled'

                return (
                  <div
                    key={order.id}
                    className={`p-4 rounded-2xl border bg-card transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-secondary/20 group ${isOverdue ? 'border-red-500/40 shadow-lg shadow-red-500/5 animate-pulse' : 'border-border'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground">Order {order.orderNumber}</span>
                        <span className="text-[10px] bg-secondary border border-border text-muted-foreground px-1.5 py-0.5 rounded font-black">{order.orderType}</span>
                        {isOverdue && (
                          <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider animate-bounce">OVERDUE</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        Table: {order.tableNumber || "N/A"} • Customer: {order.customerName || "Guest"} • Cashier: {order.cashierName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${orderStatusColors[displayOrderStatus(order.status)]}`}>
                        {displayOrderStatus(order.status)}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${kitchenStatusColors[order.kitchenStatus] || kitchenStatusColors.Waiting}`}>
                        Kit: {order.kitchenStatus}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide border leading-none ${paymentStatusColors[order.paymentStatus] || paymentStatusColors.Unpaid}`}>
                        Pay: {order.paymentStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                      <div className="text-right">
                        <p className="font-black text-primary">Rs. {order.total.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">{elapsedMin} mins ago</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            clearCart()
                            loadOrderForEdit(order)
                            navigate("/pos")
                          }}
                          className="px-3 py-1.5 bg-secondary hover:bg-orange-500 hover:text-white rounded-lg border border-border text-[10px] font-black uppercase transition-all"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-bold">No orders found matching search query.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          {/* Section: Alert Center */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Activity Feed</h3>
              {activities.length > 0 && (
                <button
                  onClick={() => setActivities([])}
                  className="text-[10px] text-primary hover:underline font-black"
                >
                  Clear All
                </button>
              )}
            </div>
            {activities.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {activities.slice(0, 50).map(activity => (
                  <div
                    key={activity.id}
                    className={`p-3 rounded-2xl border transition-colors flex gap-2 items-start ${activity.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                      activity.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-500'
                      }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold leading-normal">{activity.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] font-semibold opacity-75">{activity.time} | {activity.user}</span>
                        <button
                          onClick={() => setActivities(prev => prev.filter(a => a.id !== activity.id))}
                          className="text-[9px] font-black uppercase tracking-wider hover:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-border rounded-2xl">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-muted-foreground">All systems operational.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          SECOND ROW (Floor Status)
          ================================================== */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6">
          {/* Section: Floor / Table Status */}
          <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
            <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Floor / Table Status</h3>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">Live table status based on active orders.</p>
              </div>
              <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {categories.map(c => {
                const zoneTables = enhancedTables.filter(t => t.category_id === c.id);
                if (zoneTables.length === 0) return null;
                return (
                  <div key={c.id}>
                    <h4 className="font-black text-xs uppercase text-foreground mb-3 text-center">{c.name}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {zoneTables.map((t) => (
                        <div
                          key={t.id}
                          className={`p-3 rounded-xl border text-xs font-black text-center transition-all ${t.status === "Occupied"
                            ? 'bg-red-500/10 text-red-500 border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            }`}
                        >
                          {t.name}
                          {t.status === "Occupied" && t.waiterName && (
                            <div className="text-[9px] font-bold mt-1 opacity-80 truncate">{t.waiterName}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

            </div>
          </div>
        </div>

      </div>

      {/* ==================================================
          Section: Hourly Sales Chart
          ================================================== */}
      {(user?.permissions?.includes('VIEW_REPORTS') || user?.role === '1') && (
        <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
          <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Hourly Sales Trend</h3>
              <p className="text-xs text-muted-foreground font-bold mt-0.5">Tracked over the active 24-hr business day</p>
            </div>
          </div>
          <div className="h-[300px] w-full mt-4">
            {isLoading.revenue ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-muted-foreground font-bold text-sm">Loading analytics...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="hour"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `Rs ${val / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    formatter={(val) => [`Rs. ${Number(val).toLocaleString()}`, "Sales"]}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Drawer Simulation Modal */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-card border border-border shadow-2xl rounded-3xl p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-foreground">Cash Drawer Opened</h2>
              <p className="text-xs text-muted-foreground font-semibold mt-2">
                Manager override key applied. Cashier Ali is authorized to process transactions. Logged in audit history.
              </p>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full mt-6 py-3 bg-secondary hover:bg-border rounded-xl font-bold text-xs uppercase transition-colors"
              >
                Close Indicator
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
