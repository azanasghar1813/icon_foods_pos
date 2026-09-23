import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'
import {
  Download, Calendar, Search, RefreshCw, Printer,
  ChevronRight
} from "lucide-react"
import { useOrderStore } from "../store/orderStore"
import { formatCurrency } from "../utils/currency"
import { motion, AnimatePresence } from "framer-motion"
import { fetchDetailedSales, fetchReportSummary, fetchRecentItems, type DetailedSaleRow } from "../api/reportApi"
import { apiClient } from "../api/client"
import { DateUtils } from "../utils/dateUtils"

export const mapCategory = (cat: string | null | undefined) => {
  const lower = (cat || '').toLowerCase().trim()
  if (lower === 'fast food' || lower.includes('fast food')) return "Fast Food"
  if (lower === 'restaurant' || lower.includes('restaurant')) return "Restaurant"
  if (lower === 'deals' || lower.includes('deal') || lower.includes('combo')) return "Deals"
  if (lower === 'soda bar' || lower.includes('soda bar') || lower === 'special drinks' || lower.includes('special drink')) return "Soda Bar"
  if (lower === 'drinks' || lower === 'cold drinks' || lower.includes('cold drink')) return "Drinks"
  if (lower === 'fries' || lower === 'potato chips' || lower === 'shani fries') return "Fries Corner"
  return "Other"
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e']

export default function Reports() {
  const { orders, syncOrdersFromBackend } = useOrderStore()

  // State Management
  const [activeTab, setActiveTab] = useState<string>("Dashboard Summary")
  const [timeRange, setTimeRange] = useState<string>("Today")
  const [customDateFrom, setCustomDateFrom] = useState<string>("")
  const [customDateTo, setCustomDateTo] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null)
  const [filterCashier, setFilterCashier] = useState("All")
  const [filterPayment, setFilterPayment] = useState("All")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cashiers, setCashiers] = useState<{id: string, name: string}[]>([])

  // Detailed Sales State
  const [detailedSales, setDetailedSales] = useState<DetailedSaleRow[]>([])
  const [reportSummary, setReportSummary] = useState<any>(null)
  const [recentItems, setRecentItems] = useState<any[]>([])
  const [loadingDetailedSales, setLoadingDetailedSales] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Product Sales State
  const [productSortBy, setProductSortBy] = useState<"qty" | "rev">("qty")
  const [productCategoryFilter, setProductCategoryFilter] = useState("All")
  const [productCurrentPage, setProductCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Orders Report State
  const [orderChartTimeView, setOrderChartTimeView] = useState<"Hour" | "Day" | "Week" | "Month">("Hour")

  const searchRef = useRef<HTMLInputElement>(null)

  // Reset page when filters change
  useEffect(() => {
    setProductCurrentPage(1)
  }, [productCategoryFilter, searchQuery, productSortBy])

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT"

      // F2 Focus Search
      if (e.key === "F2") {
        e.preventDefault()
        searchRef.current?.focus()
      }

      // Ctrl + E: Export
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault()
        handleExportData()
      }

      // Ctrl + P: Print Report
      if (e.ctrlKey && e.key === "p" && !isInput) {
        e.preventDefault()
        window.print()
      }

      // Ctrl + R: Refresh
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault()
        handleRefresh()
      }

      // Esc: Reset filters
      if (e.key === "Escape" && !isInput) {
        e.preventDefault()
        setSearchQuery("")
        setFilterCashier("All")
        setFilterPayment("All")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const { startDate, endDate } = DateUtils.resolveReportRange({ timeRange, customDateFrom, customDateTo })
      await syncOrdersFromBackend({ date_from: startDate, date_to: endDate }, { fetchAll: true })
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const { startDate, endDate } = DateUtils.resolveReportRange({ timeRange, customDateFrom, customDateTo })
    syncOrdersFromBackend({ date_from: startDate, date_to: endDate }, { fetchAll: true })
  }, [syncOrdersFromBackend, timeRange, customDateFrom, customDateTo])

  // Fetch Detailed Sales & Summary when active tab or filters change
  useEffect(() => {
    // We fetch these for all tabs now because other tabs (Dashboard, Products, etc.) depend on them!
    setLoadingDetailedSales(true)
    
    let activeDateFilter = timeRange;
    if (timeRange === 'Custom Range') {
      activeDateFilter = 'Custom Date';
    }

    const filters = {
      dateFilter: activeDateFilter,
      cashier: filterCashier,
      paymentMethod: filterPayment,
      startDate: customDateFrom || undefined,
      endDate: customDateTo || undefined
    };

    if ((timeRange === 'Custom Date' || timeRange === 'Custom Range') && (!customDateFrom || !customDateTo)) {
      setLoadingDetailedSales(false)
      return;
    }

    Promise.all([
      fetchDetailedSales(filters),
      fetchReportSummary(filters),
      fetchRecentItems(filters)
    ]).then(([details, summary, recent]) => {
      setDetailedSales(details)
      setReportSummary(summary)
      setRecentItems(recent)
      setLoadingDetailedSales(false)
    }).catch(err => {
      console.error("Failed to fetch reports", err)
      setLoadingDetailedSales(false)
    })

    // Fetch cashiers list
    apiClient.get('/users').then((res: any) => {
      setCashiers(res.data || [])
    }).catch(() => {})
  }, [timeRange, filterCashier, filterPayment, customDateFrom, customDateTo])

  const groupedSales = useMemo(() => {
    const tree: Record<string, any> = {};
    detailedSales.forEach(row => {
      let mCat = row.main_category || 'Uncategorized';
      let sCat = row.sub_category || 'Uncategorized';
      
      if (!tree[mCat]) tree[mCat] = { name: mCat, type: 'main', children: {}, qty: 0, gross: 0, discount: 0, tax: 0, refunds: 0, net: 0 };
      if (!tree[mCat].children[sCat]) tree[mCat].children[sCat] = { name: sCat, type: 'sub', children: [], qty: 0, gross: 0, discount: 0, tax: 0, refunds: 0, net: 0 };
      
      let main = tree[mCat];
      let sub = main.children[sCat];
      
      main.qty += row.qty; main.gross += row.gross; main.discount += row.discount; main.tax += row.tax; main.refunds += row.refunds; main.net += row.net;
      sub.qty += row.qty; sub.gross += row.gross; sub.discount += row.discount; sub.tax += row.tax; sub.refunds += row.refunds; sub.net += row.net;
      
      sub.children.push({ name: row.product_name, id: row.product_id, type: 'product', qty: row.qty, gross: row.gross, discount: row.discount, tax: row.tax, refunds: row.refunds, net: row.net });
    });
    return Object.values(tree);
  }, [detailedSales]);

  const toggleExpand = (id: string) => setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));

  const reportOrders = useMemo(() => {
    const { startDate, endDate } = DateUtils.resolveReportRange({ timeRange, customDateFrom, customDateTo })
    return orders.filter(o => {
      const bd = o.businessDate || DateUtils.getBusinessDate(o.timestamp)
      return bd >= startDate && bd <= endDate
    })
  }, [orders, timeRange, customDateFrom, customDateTo])

  const saleOrders = useMemo(() => {
    return reportOrders.filter(o => {
      const status = String(o.status || '')
      if (status === 'Cancelled' || status === 'Refunded' || status === 'Draft' || status === 'Held') return false
      if (status === 'Completed') return true
      return status === 'Active' && String(o.paymentStatus || '') === 'Paid'
    })
  }, [reportOrders])

  const handleExportData = () => {
    // Build CSV content based on active tab
    let csvContent = ''
    const timestamp = new Date().toISOString().split('T')[0]
    let filename = `Report_${activeTab.replace(/ /g, '_')}_${timestamp}`

    if (activeTab === 'Dashboard Summary' || activeTab === 'Orders Report') {
      const headers = ['Order #', 'Date', 'Customer', 'Type', 'Subtotal', 'Tax', 'Service Charge', 'Delivery', 'Discount', 'Total', 'Payment Method', 'Payment Status', 'Order Status']
      const exportOrders = activeTab === 'Dashboard Summary' ? saleOrders : reportOrders
      const rows = exportOrders.map(o => [
        o.orderNumber,
        `"${new Date(o.timestamp).toLocaleString()}"`,
        `"${o.customerName || 'Guest'}"`,
        `"${o.orderType}"`,
        o.subtotal.toFixed(2),
        o.tax.toFixed(2),
        (o.serviceCharge || 0).toFixed(2),
        (o.deliveryCharge || 0).toFixed(2),
        o.discount.toFixed(2),
        o.total.toFixed(2),
        `"${o.payments?.[0]?.method || 'Cash'}"`,
        `"${o.paymentStatus}"`,
        `"${o.status}"`
      ])
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (activeTab === 'Detailed Sales') {
      const headers = ['Main Category', 'Sub Category', 'Product', 'Qty Sold', 'Gross Sales', 'Discounts', 'Tax', 'Refunds', 'Net Sales']
      const rows = detailedSales.map(r => [
        `"${r.main_category}"`, `"${r.sub_category}"`, `"${r.product_name}"`, r.qty, r.gross.toFixed(2), r.discount.toFixed(2), r.tax.toFixed(2), r.refunds.toFixed(2), r.net.toFixed(2)
      ])
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (activeTab === 'Product Sales') {
      const headers = ['Product', 'Category', 'Qty Sold', 'Revenue', 'Share %']
      const rows = productSalesData.map(p => [
        `"${p.name}"`, `"${p.cat}"`, p.sold, p.rev.toFixed(2), p.share
      ])
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (activeTab === 'Category Sales') {
      const headers = ['Category', 'Qty Sold', 'Revenue', 'Share %']
      const rows = categorySalesData.map(c => [
        `"${c.cat}"`, c.sold, c.rev.toFixed(2), c.share
      ])
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    } else if (activeTab === 'Deal Sales') {
      const headers = ['Deal Name', 'Times Redeemed', 'Revenue', 'Discount Cost', 'Net Contribution']
      const rows = dealSalesData.map(d => [
        `"${d.name}"`, d.sold, d.rev.toFixed(2), d.discountCost?.toFixed(2) || '0', d.netContribution?.toFixed(2) || '0'
      ])
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    }

    if (!csvContent) {
      alert('No data to export for this report tab.')
      return
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const doc = new jsPDF()
        const timestamp = new Date().toLocaleString()
        doc.setFontSize(18)
        doc.text(`${activeTab} Report`, 14, 22)
        doc.setFontSize(11)
        doc.setTextColor(100)
        doc.text(`Generated: ${timestamp}`, 14, 30)

        if (activeTab === 'Dashboard Summary' || activeTab === 'Orders Report') {
          doc.setFontSize(14)
          doc.setTextColor(0)
          doc.text('Summary', 14, 42)

          autoTable(doc, {
            startY: 46,
            head: [['Metric', 'Value']],
            body: [
              ['Total Orders', reportStats.totalOrdersCount],
              ['Gross Sales (ticket total)', `Rs. ${formatCurrency(reportStats.grossSales)}`],
              ['Net Sales (food after discount)', `Rs. ${formatCurrency(reportStats.netSales)}`],
              ['Tax (0%)', `Rs. ${formatCurrency(0)}`],
              ['Service Charges (dine-in 7%)', `Rs. ${formatCurrency(reportStats.totalService)}`],
              ['Delivery Charges', `Rs. ${formatCurrency(reportStats.totalDelivery)}`],
              ['Average ticket', `Rs. ${formatCurrency(reportStats.avgBill)}`],
              ['Refunds / cancelled', `Rs. ${formatCurrency(reportStats.refundsAmount || 0)}`],
              ['Cash Sales', `Rs. ${formatCurrency(reportStats.cashSales || 0)}`],
              ['Card/Digital Sales', `Rs. ${formatCurrency(reportStats.cardSales || 0)}`],
              ['Restaurant Sales', `Rs. ${formatCurrency(reportStats.restaurantSales || 0)}`],
              ['Fast Food Sales', `Rs. ${formatCurrency(reportStats.fastFoodSales || 0)}`],
              ['Deals Sales', `Rs. ${formatCurrency(reportStats.dealsSales || 0)}`],
              ['Drink Corner', `Rs. ${formatCurrency(reportStats.specialDrinksSales || 0)}`],
              ['Drinks Sales', `Rs. ${formatCurrency(reportStats.drinksSales || 0)}`],
              ['Fries Corner', `Rs. ${formatCurrency(reportStats.chipsSales || 0)}`]
            ],
            theme: 'grid',
          })

          doc.text('Order Details', 14, (doc as any).lastAutoTable.finalY + 10)

          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 14,
            head: [["Order #", "Date", "Cashier", "Order Type", "Customer", "Subtotal", "Discount", "Tax", "Total", "Pay Method", "Status", "Items"]],
            body: (activeTab === 'Dashboard Summary' ? saleOrders : reportOrders).map(o => [
              o.orderNumber,
              new Date(o.timestamp).toLocaleString(),
              o.cashierName || 'Staff',
              o.orderType,
              o.customerName || 'Guest',
              `Rs. ${formatCurrency(o.subtotal || 0)}`,
              `Rs. ${formatCurrency(o.discount || 0)}`,
              `Rs. ${formatCurrency(o.tax || 0)}`,
              `Rs. ${formatCurrency(o.total || 0)}`,
              o.payments?.[0]?.method || 'Cash',
              o.status,
              (o.items || []).map(i => `${i.quantity}x ${i.name}`).join('\n')
            ]),
            theme: 'grid',
            styles: { fontSize: 7 },
            columnStyles: {
              11: { cellWidth: 50 }
            }
          })
        } else if (activeTab === 'Detailed Sales') {
          autoTable(doc, {
            startY: 38,
            head: [['Category', 'Product', 'Qty', 'Gross', 'Net']],
            body: detailedSales.map(r => [`${r.main_category} > ${r.sub_category}`, r.product_name, r.qty, `Rs. ${formatCurrency(r.gross)}`, `Rs. ${formatCurrency(r.net)}`]),
            theme: 'striped'
          })
        } else if (activeTab === 'Product Sales') {
          autoTable(doc, {
            startY: 38,
            head: [['Product', 'Category', 'Qty', 'Revenue', 'Share']],
            body: productSalesData.map(p => [p.name, p.cat, p.sold, `Rs. ${formatCurrency(p.rev)}`, `${p.share}%`]),
            theme: 'striped'
          })
        } else if (activeTab === 'Category Sales') {
          autoTable(doc, {
            startY: 38,
            head: [['Category', 'Qty', 'Revenue', 'Share']],
            body: categorySalesData.map(c => [c.cat, c.sold, `Rs. ${formatCurrency(c.rev)}`, `${c.share}%`]),
            theme: 'striped'
          })
        }

        doc.save(`Report_${activeTab.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
      })
    })
  }

  const generatePrintTableHtml = () => {
    let html = ''
    const timestamp = new Date().toLocaleString()

    if (activeTab === 'Dashboard Summary' || activeTab === 'Orders Report') {
      html = `
        <h2>Summary</h2>
        <table>
          <tr><td>Total Orders</td><td>${reportStats.totalOrdersCount}</td></tr>
          <tr><td>Gross Sales (ticket total)</td><td>Rs. ${formatCurrency(reportStats.grossSales)}</td></tr>
          <tr><td>Net Sales (food after discount)</td><td>Rs. ${formatCurrency(reportStats.netSales)}</td></tr>
          <tr><td>Tax (0%)</td><td>Rs. ${formatCurrency(0)}</td></tr>
          <tr><td>Service Charges (dine-in 7%)</td><td>Rs. ${formatCurrency(reportStats.totalService)}</td></tr>
          <tr><td>Delivery Charges</td><td>Rs. ${formatCurrency(reportStats.totalDelivery)}</td></tr>
          <tr><td>Average ticket</td><td>Rs. ${formatCurrency(reportStats.avgBill)}</td></tr>
          <tr><td>Refunds / cancelled</td><td>Rs. ${formatCurrency(reportStats.refundsAmount || 0)}</td></tr>
          <tr><td>Cash Sales</td><td>Rs. ${formatCurrency(reportStats.cashSales || 0)}</td></tr>
          <tr><td>Card/Digital Sales</td><td>Rs. ${formatCurrency(reportStats.cardSales || 0)}</td></tr>
          <tr><td>Restaurant Sales</td><td>Rs. ${formatCurrency(reportStats.restaurantSales || 0)}</td></tr>
          <tr><td>Fast Food Sales</td><td>Rs. ${formatCurrency(reportStats.fastFoodSales || 0)}</td></tr>
          <tr><td>Drink Corner</td><td>Rs. ${formatCurrency(reportStats.specialDrinksSales || 0)}</td></tr>
          <tr><td>Fries Corner</td><td>Rs. ${formatCurrency(reportStats.chipsSales || 0)}</td></tr>
        </table>
        <h2>Order Details</h2>
        <table>
          <thead><tr><th>Order #</th><th>Date</th><th>Type</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            ${(activeTab === 'Dashboard Summary' ? saleOrders : reportOrders).map(o => `<tr><td>${o.orderNumber}</td><td>${new Date(o.timestamp).toLocaleString()}</td><td>${o.orderType}</td><td>Rs. ${formatCurrency(o.total)}</td><td>${o.payments?.[0]?.method || 'Cash'}</td><td>${o.status}</td></tr>`).join('')}
          </tbody>
        </table>`
    } else if (activeTab === 'Product Sales') {
      html = `
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Revenue</th><th>Share</th></tr></thead>
          <tbody>${productSalesData.map(p => `<tr><td>${p.name}</td><td>${p.cat}</td><td>${p.sold}</td><td>Rs. ${formatCurrency(p.rev)}</td><td>${p.share}%</td></tr>`).join('')}</tbody>
        </table>`
    } else if (activeTab === 'Category Sales') {
      html = `
        <table>
          <thead><tr><th>Category</th><th>Qty</th><th>Revenue</th><th>Share</th></tr></thead>
          <tbody>${categorySalesData.map(c => `<tr><td>${c.cat}</td><td>${c.sold}</td><td>Rs. ${formatCurrency(c.rev)}</td><td>${c.share}%</td></tr>`).join('')}</tbody>
        </table>`
    }
    return html
  }

  // Dynamic calculations based on live orders store
  const timeLabel = timeRange === 'Today' ? "Today's" : 
                    timeRange === 'Yesterday' ? "Yesterday's" : 
                    timeRange === 'This Month' || timeRange === 'Monthly' ? "Monthly" : 
                    timeRange === 'All Time' ? "All Time" : 
                    "Period's"

  const reportStats = useMemo(() => {
    if (!reportSummary) {
      return {
        totalOrdersCount: 0, grossSales: 0, netSales: 0, totalTax: 0, totalService: 0,
        totalDiscount: 0, totalDelivery: 0, paidCount: 0, unpaidCount: 0, refundsCount: 0, refundsAmount: 0, cashSales: 0,
        cardSales: 0, digitalSales: 0, unpaidSales: 0, avgBill: 0, netEstimatedProfit: 0,
        restaurantSales: 0, fastFoodSales: 0, dealsSales: 0, drinksSales: 0, chipsSales: 0,
        specialDrinksSales: 0, otherSales: 0, totalCatSales: 0, openBillsCount: 0, openBillsTotal: 0
      }
    }

    const restaurantSales = reportSummary.restaurantSales || 0
    const fastFoodSales = reportSummary.fastFoodSales || 0
    const dealsSales = reportSummary.dealsSales || 0
    const drinksSales = reportSummary.drinksSales || 0
    const chipsSales = reportSummary.chipsSales || 0
    const specialDrinksSales = reportSummary.specialDrinksSales || 0
    const otherSales = reportSummary.otherSales || 0
    const totalService = reportSummary.serviceCharges || 0
    const totalDelivery = reportSummary.deliveryCharges || 0
    const grossSales = reportSummary.grossSales || 0
    const netSales = reportSummary.netSales || 0
    const cashSales = reportSummary.cashSales ?? 0
    const digitalSales = reportSummary.digitalSales ?? 0
    const unpaidSales = reportSummary.unpaidSales ?? Math.max(0, grossSales - cashSales - digitalSales)
    const totalCatSales = reportSummary.totalCatSales
      ?? (restaurantSales + fastFoodSales + dealsSales + drinksSales + chipsSales + specialDrinksSales + otherSales)

    return {
      totalOrdersCount: reportSummary.ordersCount || 0,
      grossSales,
      netSales,
      totalTax: reportSummary.tax || 0,
      totalService,
      totalDiscount: reportSummary.discounts || 0,
      totalDelivery,
      paidCount: reportSummary.paidCount || 0,
      unpaidCount: reportSummary.unpaidCount || 0,
      refundsCount: reportSummary.refundCount || 0,
      refundsAmount: reportSummary.refunds || 0,
      cashSales,
      cardSales: digitalSales,
      digitalSales,
      unpaidSales,
      avgBill: reportSummary.averageOrderValue || 0,
      netEstimatedProfit: netSales,
      restaurantSales,
      fastFoodSales,
      dealsSales,
      drinksSales,
      chipsSales,
      specialDrinksSales,
      otherSales,
      totalCatSales,
      openBillsCount: reportSummary.openBillsCount || 0,
      openBillsTotal: reportSummary.openBillsTotal || 0
    }
  }, [reportSummary])


  // Product Sales Real Data
  const productSalesData = useMemo(() => {
    if (!detailedSales.length) return []

    const itemMap = new Map<string, { id: string, name: string, cat: string, sold: number, rev: number, is_deal: boolean }>()

    const addItem = (id: string, name: string, cat: string, qty: number, net: number, is_deal: boolean) => {
      const existing = itemMap.get(id)
      if (existing) {
        existing.sold += qty
        existing.rev += net
        existing.is_deal = existing.is_deal || is_deal
      } else {
        itemMap.set(id, { id, name, cat: cat || 'Uncategorized', sold: qty, rev: net, is_deal })
      }
    }

    detailedSales.forEach(row => {
      const is_deal = (row.main_category || '') === 'Deals'
      addItem(row.product_id, row.product_name, row.main_category, row.qty, row.net, !!is_deal)
    })

    let data = Array.from(itemMap.values())

    // Category mapping function is moved to top of file

    if (productCategoryFilter !== "All") {
      data = data.filter(d => mapCategory(d.cat) === productCategoryFilter || d.cat === productCategoryFilter)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(d => (d.name || '').toLowerCase().includes(q) || (d.cat || '').toLowerCase().includes(q))
    }

    data.sort((a, b) => productSortBy === "qty" ? b.sold - a.sold : b.rev - a.rev)
    const totalRev = data.reduce((sum, item) => sum + item.rev, 0)
    return data.map(d => ({ ...d, share: totalRev ? Math.round((d.rev / totalRev) * 100) : 0 }))
  }, [detailedSales, productSortBy, searchQuery, productCategoryFilter])

  void filterPayment
  void currentTime

  // Category Sales Data
  const categorySalesData = useMemo(() => {
    const map = new Map<string, { cat: string, sold: number, rev: number }>()
    productSalesData.forEach(p => {
      const mainCat = mapCategory(p.cat)
      // p.cat is the database category name (e.g., 'Cold Drinks', 'Burgers')
      // If the main mapped category is different from the db category, show it as Main -> Sub
      // Otherwise just show the Main category.
      const safePCat = p.cat || ''
      const cName = (mainCat.toLowerCase() !== safePCat.toLowerCase()) ? `${mainCat} - ${safePCat}` : mainCat
      
      const existing = map.get(cName)
      if (existing) {
        existing.sold += p.sold
        existing.rev += p.rev
      } else {
        map.set(cName, { cat: cName, sold: p.sold, rev: p.rev })
      }
    })
    let data = Array.from(map.values())
    data = data.filter(c => c.cat !== 'Uncategorized')
    data.sort((a, b) => b.rev - a.rev)
    const totalRev = data.reduce((s, d) => s + d.rev, 0)
    return data.map(d => ({ ...d, share: totalRev ? Math.round((d.rev / totalRev) * 100) : 0 }))
  }, [productSalesData])

  const visibleProductSales = useMemo(() => productSalesData.filter(p => !p.is_deal), [productSalesData])

  // Deal Sales Data
  const dealSalesData = useMemo(() => {
      return productSalesData
        .filter(p => p.is_deal)
        .map(d => {
        const discountCost = 0
        return { ...d, discountCost, netContribution: d.rev - discountCost }
      })
  }, [productSalesData])

  // Orders Report Specific Data
  const orderReportStats = useMemo(() => {
    let completed = 0, preparing = 0, ready = 0, cancelled = 0, edited = 0
    reportOrders.forEach(o => {
      if (o.status === 'Completed') completed++
      if (o.kitchenStatus === 'Preparing') preparing++
      if (o.kitchenStatus === 'Ready') ready++
      if (o.status === 'Cancelled') cancelled++
      if (o.timeline && o.timeline.some(t => t.event === 'Order Edited')) edited++
    })
    return {
      total: reportOrders.length,
      completed, preparing, ready, cancelled, edited
    }
  }, [reportOrders])

  const orderVolumeChartData = useMemo(() => {
    const map = new Map<string, number>()
    reportOrders.forEach(o => {
      const date = new Date(o.timestamp)
      let key = ""
      if (orderChartTimeView === 'Hour') {
        key = `${date.getHours().toString().padStart(2, '0')}:00`
      } else if (orderChartTimeView === 'Day') {
        key = date.toLocaleDateString(undefined, { weekday: 'short' })
      } else if (orderChartTimeView === 'Week') {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
        const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
        key = `Week ${week}`
      } else {
        key = date.toLocaleDateString(undefined, { month: 'short' })
      }
      map.set(key, (map.get(key) || 0) + 1)
    })

    let data = Array.from(map.entries()).map(([time, count]) => ({ time, count }))
    if (orderChartTimeView === 'Hour') {
      data.sort((a, b) => parseInt(a.time) - parseInt(b.time))
    }
    return data.length > 0 ? data : [{ time: 'No Data', count: 0 }]
  }, [reportOrders, orderChartTimeView])

  // Order Types Data
  const orderTypeData = useMemo(() => {
    let dineIn = 0, takeaway = 0, delivery = 0
    reportOrders.forEach(o => {
      if (o.orderType === 'Dine In') dineIn++
      else if (o.orderType === 'Takeaway') takeaway++
      else if (o.orderType === 'Delivery') delivery++
    })
    return [
      { name: 'Dine In', value: dineIn, color: '#f97316' },
      { name: 'Takeaway', value: takeaway, color: '#3b82f6' },
      { name: 'Delivery', value: delivery, color: '#10b981' }
    ]
  }, [reportOrders])

  const detailedTotals = useMemo(() => {
    let totalQty = 0, totalGross = 0, totalDiscount = 0, totalTax = 0, totalRefunds = 0, totalNet = 0;
    let discountCount = 0, refundCount = 0;
    const categories = new Set();
    const products = new Set();
    detailedSales.forEach(row => {
      totalQty += row.qty;
      totalGross += row.gross;
      totalDiscount += row.discount;
      totalTax += row.tax || 0;
      totalRefunds += row.refunds;
      totalNet += row.net;
      if (row.discount > 0) discountCount++;
      if (row.refunds > 0) refundCount++;
      if (row.main_category && row.main_category !== 'Uncategorized') categories.add(row.main_category);
      if (row.product_name) products.add(row.product_name);
    });
    return {
      totalQty, totalGross, totalDiscount, totalTax, totalRefunds, totalNet,
      discountCount, refundCount, totalCategories: categories.size, totalProducts: products.size
    };
  }, [detailedSales]);

  // Sidebar navigation links
  const sidebarLinks = [
    "Dashboard Summary", "Detailed Sales", "Orders Report",
    "Product Sales", "Category Sales", "Deal Sales"
  ]

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-foreground pb-12">

      {/* ====================================================
          HEADER
          ==================================================== */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-6 bg-card border border-border rounded-3xl gap-4 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Business Intelligence Center
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Reports</span>
          </h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">
            Business day 6AM–6AM · {DateUtils.getBusinessDayLabel()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            className={`p-2.5 bg-secondary hover:bg-border rounded-xl text-muted-foreground hover:text-foreground border border-border relative transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh analytics data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border rounded-xl text-xs font-black text-foreground hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" /> Print PDF Report
          </button>
        </div>
      </div>

      {/* ====================================================
          TOP FILTER BAR
          ==================================================== */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-card border border-border rounded-3xl shadow-sm items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Time:</span>
            <div className="flex items-center gap-1 shrink-0 bg-secondary/50 p-1 rounded-lg border border-border/50">
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="h-8 rounded-lg bg-transparent text-primary text-[11px] font-black px-2 focus:outline-none cursor-pointer">
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="All Time">All Time</option>
                <option value="Custom Date">Custom Date</option>
                <option value="Custom Range">Custom Range</option>
              </select>
              {timeRange === 'Custom Date' && (
                  <input type="date" value={customDateFrom} onChange={(e) => { setCustomDateFrom(e.target.value); setCustomDateTo(e.target.value); }} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
              )}
              {timeRange === 'Custom Range' && (
                <div className="flex gap-1 ml-1 items-center">
                  <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                  <span className="text-[10px] text-primary font-black">-</span>
                  <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="h-8 rounded-md bg-white border border-primary/30 text-[10px] font-bold px-1 focus:outline-none w-[100px]" />
                </div>
              )}
            </div>
          </div>

          <div className="h-6 w-px bg-border hidden md:block"></div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">Cashier:</span>
            <select
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              className="h-8 rounded-lg bg-secondary border border-border text-[10px] font-bold px-3 focus:outline-none cursor-pointer"
            >
              <option value="All">All Cashiers</option>
              {cashiers.map((c: any) => {
                const displayName = (c.first_name || c.last_name) ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : c.username || c.name;
                return <option key={c.id} value={c.id}>{displayName}</option>
              })}
            </select>
          </div>

          <div className="h-6 w-px bg-border hidden md:block"></div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider text-primary">Report View:</span>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-black px-3 focus:outline-none cursor-pointer"
            >
              {sidebarLinks.map(link => <option key={link} value={link}>{link}</option>)}
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="w-3.5 h-3.5" /></span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report data... (F2)"
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-secondary border border-border outline-none text-[10px] font-bold focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ====================================================
          REPORT LAYOUT (FULL WIDTH MAIN PANEL)
          ==================================================== */}
      <div className="flex flex-col gap-6">

        {/* Main Analytics Panel */}
        <div className="w-full space-y-6">

          {/* Active Tab View: Detailed Sales */}
          {activeTab === "Detailed Sales" && (
            <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
              <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-6">Detailed Sales Report</h3>
              {loadingDetailedSales ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : detailedSales.length === 0 ? (
                 <div className="p-12 text-center text-muted-foreground bg-secondary/50 rounded-2xl flex flex-col items-center justify-center min-h-[200px]">
                   <Calendar className="w-8 h-8 mb-4 opacity-20" />
                   <h4 className="text-base font-black text-foreground uppercase tracking-wide">No sales data</h4>
                 </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                        <th className="py-3 px-4">Category / Product</th>
                        <th className="py-3 px-4 text-right">Qty</th>
                        <th className="py-3 px-4 text-right">Gross</th>
                        <th className="py-3 px-4 text-right">Discounts</th>
                        <th className="py-3 px-4 text-right">Tax</th>
                        <th className="py-3 px-4 text-right">Refunds</th>
                        <th className="py-3 px-4 text-right">Net Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border bg-primary/10 text-primary font-black uppercase tracking-wider text-[11px] shadow-sm">
                        <td className="py-4 px-4">
                          <div>Total Summary</div>
                          <div className="text-[9px] font-bold opacity-70 normal-case">{detailedTotals.totalCategories} Categories, {detailedTotals.totalProducts} Products</div>
                        </td>
                        <td className="py-4 px-4 text-right text-sm">{detailedTotals.totalQty}</td>
                        <td className="py-4 px-4 text-right text-sm">Rs. {formatCurrency(detailedTotals.totalGross)}</td>
                        <td className="py-4 px-4 text-right text-amber-500">
                          <div className="text-sm">- Rs. {formatCurrency(detailedTotals.totalDiscount)}</div>
                          <div className="text-[9px] font-bold opacity-70 normal-case">{detailedTotals.discountCount} applied</div>
                        </td>
                        <td className="py-4 px-4 text-right text-sm">Rs. {formatCurrency(detailedTotals.totalTax)}</td>
                        <td className="py-4 px-4 text-right text-rose-500">
                          <div className="text-sm">- Rs. {formatCurrency(detailedTotals.totalRefunds)}</div>
                          <div className="text-[9px] font-bold opacity-70 normal-case">{detailedTotals.refundCount} applied</div>
                        </td>
                        <td className="py-4 px-4 text-right text-sm text-emerald-500">Rs. {formatCurrency(detailedTotals.totalNet)}</td>
                      </tr>
                      {groupedSales.map((main: any) => (
                        <React.Fragment key={main.name}>
                          <tr 
                            className="border-b border-border hover:bg-secondary/20 transition-colors text-sm font-black text-foreground cursor-pointer bg-secondary/5"
                            onClick={() => toggleExpand(`main_${main.name}`)}
                          >
                            <td className="py-3 px-4 flex items-center gap-2">
                              <ChevronRight className={`w-4 h-4 transition-transform ${expandedCategories[`main_${main.name}`] ? 'rotate-90' : ''}`} />
                              {main.name}
                            </td>
                            <td className="py-3 px-4 text-right">{main.qty}</td>
                            <td className="py-3 px-4 text-right">Rs. {formatCurrency(main.gross)}</td>
                            <td className="py-3 px-4 text-right text-rose-500">{main.discount > 0 ? `-Rs. ${formatCurrency(main.discount)}` : '-'}</td>
                            <td className="py-3 px-4 text-right">Rs. {formatCurrency(main.tax)}</td>
                            <td className="py-3 px-4 text-right text-rose-500">{main.refunds > 0 ? `-Rs. ${formatCurrency(main.refunds)}` : '-'}</td>
                            <td className="py-3 px-4 text-right text-emerald-500">Rs. {formatCurrency(main.net)}</td>
                          </tr>
                          
                          {expandedCategories[`main_${main.name}`] && Object.values(main.children).map((sub: any) => (
                            <React.Fragment key={`${main.name}_${sub.name}`}>
                              <tr 
                                className="border-b border-border border-l-2 border-l-primary/30 hover:bg-secondary/30 transition-colors text-sm font-bold text-foreground cursor-pointer"
                                onClick={() => toggleExpand(`sub_${main.name}_${sub.name}`)}
                              >
                                <td className="py-3 px-4 pl-10 flex items-center gap-2">
                                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedCategories[`sub_${main.name}_${sub.name}`] ? 'rotate-90' : ''}`} />
                                  {sub.name}
                                </td>
                                <td className="py-3 px-4 text-right text-muted-foreground">{sub.qty}</td>
                                <td className="py-3 px-4 text-right text-muted-foreground">Rs. {formatCurrency(sub.gross)}</td>
                                <td className="py-3 px-4 text-right text-rose-500/80">{sub.discount > 0 ? `-Rs. ${formatCurrency(sub.discount)}` : '-'}</td>
                                <td className="py-3 px-4 text-right text-muted-foreground">Rs. {formatCurrency(sub.tax)}</td>
                                <td className="py-3 px-4 text-right text-rose-500/80">{sub.refunds > 0 ? `-Rs. ${formatCurrency(sub.refunds)}` : '-'}</td>
                                <td className="py-3 px-4 text-right text-emerald-500/80">Rs. {formatCurrency(sub.net)}</td>
                              </tr>
                              
                              {expandedCategories[`sub_${main.name}_${sub.name}`] && sub.children.map((prod: any) => (
                                <tr key={`${main.name}_${sub.name}_${prod.id}`} className="border-b border-border border-l-2 border-l-primary hover:bg-secondary/50 transition-colors text-xs font-semibold text-muted-foreground">
                                  <td className="py-2 px-4 pl-16 flex flex-col">
                                    <span className="text-foreground">{prod.name}</span>
                                    <span className="text-[10px] opacity-70">ID: {prod.id.split('-')[0]}...</span>
                                  </td>
                                  <td className="py-2 px-4 text-right">{prod.qty}</td>
                                  <td className="py-2 px-4 text-right">Rs. {formatCurrency(prod.gross)}</td>
                                  <td className="py-2 px-4 text-right text-rose-500/60">{prod.discount > 0 ? `-Rs. ${formatCurrency(prod.discount)}` : '-'}</td>
                                  <td className="py-2 px-4 text-right">Rs. {formatCurrency(prod.tax)}</td>
                                  <td className="py-2 px-4 text-right text-rose-500/60">{prod.refunds > 0 ? `-Rs. ${formatCurrency(prod.refunds)}` : '-'}</td>
                                  <td className="py-2 px-4 text-right text-emerald-500/60">Rs. {formatCurrency(prod.net)}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Active Tab View: Dashboard Summary */}
          {activeTab === "Dashboard Summary" && (
            <>
              {/* Dynamic summary totals cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Gross Sales */}
                <div className="p-5 bg-card border border-border rounded-[2rem] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{timeLabel} Gross Sales</span>
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-3">Rs. {formatCurrency(reportStats.grossSales)}</h3>
                  </div>
                  <span className="text-[9px] font-bold mt-3 px-2 py-0.5 rounded border w-fit text-emerald-500 bg-emerald-500/10 border-emerald-500/25">Food + service + delivery</span>
                </div>

                {/* Net Sales */}
                <div className="p-5 bg-card border border-border rounded-[2rem] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{timeLabel} Net Sales</span>
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-3">Rs. {formatCurrency(reportStats.netSales)}</h3>
                  </div>
                  <span className="text-[9px] font-bold mt-3 px-2 py-0.5 rounded border w-fit text-blue-500 bg-blue-500/10 border-blue-500/25">Food only — category cards add to this</span>
                </div>

                {/* Service Charges */}
                <div className="p-5 bg-card border border-border rounded-[2rem] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{timeLabel} Service Charges</span>
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-3">Rs. {formatCurrency(reportStats.totalService)}</h3>
                  </div>
                  <span className="text-[9px] font-bold mt-3 px-2 py-0.5 rounded border w-fit text-amber-500 bg-amber-500/10 border-amber-500/25">Dine-in services</span>
                </div>

                {/* Delivery Charges */}
                <div className="p-5 bg-card border border-border rounded-[2rem] shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide leading-none">{timeLabel} Delivery Charges</span>
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-3">Rs. {formatCurrency(reportStats.totalDelivery)}</h3>
                  </div>
                  <span className="text-[9px] font-bold mt-3 px-2 py-0.5 rounded border w-fit text-indigo-500 bg-indigo-500/10 border-indigo-500/25">Delivery fees</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-card border border-border rounded-[1.5rem] shadow-sm">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide">Sale orders</span>
                  <h3 className="text-xl font-black mt-2">{reportStats.totalOrdersCount}</h3>
                </div>
                <div className="p-4 bg-card border border-border rounded-[1.5rem] shadow-sm">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide">Discounts</span>
                  <h3 className="text-xl font-black mt-2 text-amber-500">Rs. {formatCurrency(reportStats.totalDiscount)}</h3>
                </div>
                <div className="p-4 bg-card border border-border rounded-[1.5rem] shadow-sm">
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wide">Refunds / cancelled</span>
                  <h3 className="text-xl font-black mt-2 text-red-500">Rs. {formatCurrency(reportStats.refundsAmount || 0)}</h3>
                  <span className="text-[9px] font-bold text-muted-foreground">{reportStats.refundsCount || 0} tickets</span>
                </div>
              </div>

                {/* Item Velocity Leaderboard */}
                <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Item Velocity Leaderboard</h3>
                    {timeRange === 'Today' && (
                      <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    {(() => {
                      const topItems = [...productSalesData].sort((a, b) => b.sold - a.sold).slice(0, 7)
                      const maxSold = topItems.length > 0 ? topItems[0].sold : 1

                      return (
                        <div className="relative w-full h-[320px]">
                          {topItems.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-bold">
                              No items sold yet.
                            </div>
                          ) : (
                            topItems.map((item, idx) => {
                              const barColor = COLORS[idx % COLORS.length]
                              const widthPercent = Math.max((item.sold / maxSold) * 100, 2)

                              return (
                                <motion.div
                                  key={item.name}
                                  layout
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0, y: idx * 44 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                  className="absolute left-0 right-0 flex items-center h-10 w-full"
                                >
                                  <div className="w-6 flex-shrink-0 text-center font-black text-muted-foreground text-xs">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 ml-2 relative h-full flex items-center">
                                    <motion.div
                                      className="absolute left-0 h-full rounded-r-xl rounded-l-md opacity-20"
                                      style={{ backgroundColor: barColor }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${widthPercent}%` }}
                                      transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    />
                                    <motion.div
                                      className="absolute left-0 h-full border-l-4 rounded-l-md"
                                      style={{ borderColor: barColor, backgroundColor: "transparent" }}
                                    />
                                    <div className="relative z-10 flex justify-between w-full px-3 items-center">
                                      <span className="text-sm font-black text-foreground truncate max-w-[200px]">{item.name}</span>
                                      <span className="text-xs font-bold whitespace-nowrap ml-4" style={{ color: barColor }}>
                                        {item.sold} <span className="opacity-75">sold</span>
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Sales Split */}
                  <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Sales Split</h3>
                    <div className="space-y-3 my-auto">
                      {/* By Order Type */}
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-4">By Channel</p>
                      <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-orange-500 font-bold uppercase">Fast Food </span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.fastFoodSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-orange-500 bg-orange-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.fastFoodSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-blue-500 font-bold uppercase">Restaurant</span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.restaurantSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-500 bg-blue-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.restaurantSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-purple-500 font-bold uppercase">Deals Sale</span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.dealsSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-purple-500 bg-purple-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.dealsSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      <div className="p-3 bg-teal-500/10 border border-teal-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-teal-500 font-bold uppercase">Drinks Sale</span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.drinksSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-teal-500 bg-teal-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.drinksSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-cyan-500 font-bold uppercase">Soda Bar</span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.specialDrinksSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-cyan-500 bg-cyan-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.specialDrinksSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-yellow-500 font-bold uppercase">Shani Fries</span>
                          <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.chipsSales || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-yellow-500 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
                          {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.chipsSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                        </span>
                      </div>
                      {(reportStats.otherSales || 0) > 0 && (
                        <div className="p-3 bg-zinc-500/10 border border-zinc-500/25 rounded-2xl flex justify-between items-center">
                          <div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Other</span>
                            <p className="text-lg font-black text-foreground mt-0.5">Rs. {formatCurrency(reportStats.otherSales || 0)}</p>
                          </div>
                          <span className="text-sm font-bold text-zinc-500 bg-zinc-500/20 px-3 py-1.5 rounded-lg">
                            {(reportStats.totalCatSales || 0) > 0 ? Math.round(((reportStats.otherSales || 0) / (reportStats.totalCatSales || 1)) * 100) : 0}%
                          </span>
                        </div>
                      )}
                      <div className="p-3 bg-secondary/60 border border-border rounded-2xl text-[10px] font-bold text-muted-foreground space-y-1">
                        <div className="flex justify-between"><span>Cards total (food)</span><span className="text-foreground">Rs. {formatCurrency(reportStats.totalCatSales || 0)}</span></div>
                        <div className="flex justify-between"><span>+ Service</span><span>Rs. {formatCurrency(reportStats.totalService || 0)}</span></div>
                        <div className="flex justify-between"><span>+ Delivery</span><span>Rs. {formatCurrency(reportStats.totalDelivery || 0)}</span></div>
                        <div className="flex justify-between text-foreground"><span>= Gross sale</span><span>Rs. {formatCurrency(reportStats.grossSales || 0)}</span></div>
                        {(reportStats.openBillsCount || 0) > 0 && (
                          <div className="flex justify-between text-amber-600 pt-1 border-t border-border">
                            <span>Open bills (not in sale)</span>
                            <span>{reportStats.openBillsCount} · Rs. {formatCurrency(reportStats.openBillsTotal || 0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top Selling Items Pie Chart */}
                  <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col justify-center">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Top Selling Items</h3>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productSalesData.slice(0, 5)}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="sold"
                            nameKey="name"
                          >
                            {productSalesData.slice(0, 5).map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => `${value} items sold`}
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }}
                          />
                          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'hsl(var(--foreground))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Recently Sold Items List */}
                <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Recently Sold Items</h3>
                    {timeRange === 'Today' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </div>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">Live</span>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Item Name</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Amount (Rs)</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {(() => {
                          if (recentItems.length === 0) {
                            return <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No recent items.</td></tr>
                          }

                          return recentItems.map((item, idx) => {
                            const timeStr = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                              <tr key={idx} className="hover:bg-secondary/20 transition-colors group">
                                <td className="p-4 text-sm font-black text-foreground flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs shrink-0">
                                    {item.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="truncate max-w-[150px] md:max-w-[200px]" title={item.name}>{item.name}</span>
                                </td>
                                <td className="p-4 text-xs font-bold text-muted-foreground">
                                  <span className="bg-secondary px-2 py-1 rounded-full text-[10px] uppercase tracking-wider">{item.cat}</span>
                                </td>
                                <td className="p-4 text-sm font-black text-foreground text-right">
                                  <span className="bg-primary/5 text-primary px-2 py-1 rounded-md">x{item.qty}</span>
                                </td>
                                <td className="p-4 text-sm font-black text-emerald-600 text-right group-hover:scale-105 transition-transform">{formatCurrency(item.price)}</td>
                                <td className="p-4 text-xs font-bold text-muted-foreground text-right">{timeStr}</td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
          )}

          {/* Active Tab View: Sales & Tax Report */}
          {activeTab === "Sales Report" && (
              <div className="p-6 bg-card border border-border rounded-[2.5rem] shadow-sm space-y-6">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Sales & Tax breakdown</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">{timeLabel} Gross Sales:</span>
                      <span className="text-foreground">Rs. {formatCurrency(reportStats.grossSales)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Net Sales (food after discount):</span>
                      <span className="text-foreground">Rs. {formatCurrency(reportStats.netSales)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Tax (0%):</span>
                      <span className="text-foreground">Rs. {formatCurrency(0)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Discounts Given:</span>
                      <span className="text-red-500">Rs. {formatCurrency(reportStats.totalDiscount)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-secondary/40 border border-border rounded-xl font-bold text-xs">
                      <span className="text-muted-foreground">Cancelled / Refunded:</span>
                      <span className="text-red-500">Rs. {formatCurrency(reportStats.refundsAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl font-bold text-xs">
                      <span className="text-emerald-500">Food net (same as Net Sales):</span>
                      <span className="text-emerald-500">Rs. {formatCurrency(reportStats.netSales)}</span>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Active Tab View: Product Sales */}
          {activeTab === "Product Sales" && (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-4 rounded-3xl shadow-sm mb-6">
                  <div className="flex flex-wrap gap-2">
                    {["All", "Fast Food", "Restaurant", "Deals", "Drinks"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setProductCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${productCategoryFilter === cat ? 'bg-primary text-white shadow-sm' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 bg-secondary p-1 rounded-xl">
                    <button
                      onClick={() => setProductSortBy("qty")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productSortBy === "qty" ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
                    >
                      Sort by Qty
                    </button>
                    <button
                      onClick={() => setProductSortBy("rev")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${productSortBy === "rev" ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
                    >
                      Sort by Revenue
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Product Name</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty Sold</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                          <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue share (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {visibleProductSales.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No products match this filter.</td>
                          </tr>
                        ) : (
                          visibleProductSales.slice((productCurrentPage - 1) * itemsPerPage, productCurrentPage * itemsPerPage).map((item, idx) => (
                            <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                              <td className="p-4 text-sm font-black text-foreground">{item.name}</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground">{item.cat}</td>
                              <td className="p-4 text-sm font-black text-foreground text-right">{item.sold}</td>
                              <td className="p-4 text-sm font-black text-primary text-right">Rs. {formatCurrency(item.rev)}</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs font-bold w-8 text-right">{item.share}%</span>
                                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${item.share}%` }}></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {visibleProductSales.length > 0 && (
                    <div className="p-4 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 bg-secondary/10 rounded-b-[2.5rem]">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-muted-foreground">
                          Showing {(productCurrentPage - 1) * itemsPerPage + 1}–{Math.min(productCurrentPage * itemsPerPage, visibleProductSales.length)} of {visibleProductSales.length} products
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">Per page:</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value))
                              setProductCurrentPage(1)
                            }}
                            className="bg-card border border-border rounded-lg text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={productCurrentPage === 1}
                          onClick={() => setProductCurrentPage(p => Math.max(1, p - 1))}
                          className="px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground disabled:opacity-40 hover:bg-secondary transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          disabled={productCurrentPage === Math.ceil(visibleProductSales.length / itemsPerPage)}
                          onClick={() => setProductCurrentPage(p => Math.min(Math.ceil(visibleProductSales.length / itemsPerPage), p + 1))}
                          className="px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground disabled:opacity-40 hover:bg-secondary transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
          )}

          {/* 1. Orders Report */}
          {activeTab === "Orders Report" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: "Total Orders", val: orderReportStats.total, color: "text-blue-500" },
                  { label: "Completed", val: orderReportStats.completed, color: "text-emerald-500" },
                  { label: "Preparing", val: orderReportStats.preparing, color: "text-orange-500" },
                  { label: "Ready", val: orderReportStats.ready, color: "text-amber-500" },
                  { label: "Cancelled", val: orderReportStats.cancelled, color: "text-red-500" },
                  { label: "Edited", val: orderReportStats.edited, color: "text-indigo-500" },
                ].map((stat, i) => (
                  <div key={i} className="p-4 bg-card border border-border rounded-3xl shadow-sm flex flex-col justify-center text-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                    <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-2 p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Order Volume Analytics</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">View by:</span>
                      <select
                        value={orderChartTimeView}
                        onChange={(e) => setOrderChartTimeView(e.target.value as "Hour" | "Day" | "Week" | "Month")}
                        className="bg-secondary border border-border rounded-lg text-xs font-bold px-3 py-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value="Hour">Hour</option>
                        <option value="Day">Day</option>
                        <option value="Week">Week</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={orderVolumeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="count" name="Orders" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="col-span-1 p-6 bg-card border border-border rounded-[2.5rem] shadow-sm flex flex-col">
                  <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-4">Order Type Distribution</h3>
                  <div className="flex-1 flex items-center justify-center min-h-[250px] w-full">
                    {orderTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderTypeData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={70} />
                          <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', fontWeight: 'bold' }} />
                          <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                            {orderTypeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted-foreground font-bold text-sm">No order types data available.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Category Sales */}
          {activeTab === "Category Sales" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Category Sales</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Qty Sold</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {categorySalesData.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-sm font-black text-foreground">{cat.cat}</td>
                        <td className="p-4 text-sm font-black text-foreground text-right">{cat.sold}</td>
                        <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(cat.rev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Deal Sales */}
          {activeTab === "Deal Sales" && (
            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-black uppercase tracking-wider text-foreground">Active Deals & Combos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider">Deal Name</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Times Redeemed</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Revenue (Rs)</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Discount Cost</th>
                      <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-wider text-right">Net Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dealSalesData.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">No deals sold in this period.</td></tr>
                    ) : dealSalesData.map((deal, idx) => {
                      const isExpanded = expandedDeal === deal.name;
                      const components = detailedSales.filter(r => r.parent_deal_name === deal.name && r.is_component === 1);
                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            className={`hover:bg-secondary/20 transition-colors ${components.length > 0 ? 'cursor-pointer' : ''}`}
                            onClick={() => components.length > 0 && setExpandedDeal(isExpanded ? null : deal.name)}
                          >
                            <td className="p-4 text-sm font-black text-foreground flex items-center gap-2">
                              {components.length > 0 ? (
                                <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              ) : (
                                <div className="w-4 h-4" />
                              )}
                              {deal.name}
                            </td>
                            <td className="p-4 text-sm font-black text-foreground text-right">{deal.sold}</td>
                            <td className="p-4 text-sm font-black text-primary text-right">{formatCurrency(deal.rev)}</td>
                            <td className="p-4 text-sm font-black text-red-500 text-right">- Rs. {formatCurrency(deal.discountCost)}</td>
                            <td className="p-4 text-sm font-black text-emerald-500 text-right">Rs. {formatCurrency(deal.netContribution)}</td>
                          </tr>
                          {isExpanded && components.length > 0 && components.map((comp, cidx) => (
                            <tr key={`comp-${idx}-${cidx}`} className="bg-secondary/5">
                              <td className="p-4 pl-12 text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                                {comp.product_name}
                              </td>
                              <td className="p-4 text-xs font-bold text-muted-foreground text-right">{comp.qty}</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground text-right">-</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground text-right">-</td>
                              <td className="p-4 text-xs font-bold text-muted-foreground text-right">-</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
