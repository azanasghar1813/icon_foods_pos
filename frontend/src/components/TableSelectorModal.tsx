import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Clock, X, User, UtensilsCrossed } from "lucide-react"
import { usePosStore } from "../store/posStore"
import { useTableStore } from "../store/tableStore"
type Table = any;
type TableStatus = any;

interface TableSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TableSelectorModal({ isOpen, onClose }: TableSelectorModalProps) {
  const { categories, tables: backendTables, fetchData } = useTableStore()
  
  useEffect(() => {
    fetchData()
  }, [fetchData])

  const ALL_TABLES = backendTables.map(t => ({
    id: t.id,
    label: t.name,
    zone: t.category_name || '',
    zoneId: t.category_id,
    status: t.status
  }))

  const { openOrders, switchOrder, setTableNumber, activeOrderId } = usePosStore()
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setSelectedIndex(0)
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Enhance tables with live data from openOrders
  const enhancedTables = ALL_TABLES.map(t => {
    const orderForTable = Object.values(openOrders).find(o => o.tableNumber === t.label)
    // If there's an open order mapped to this table, infer its status
    let status = t.status
    let amount = 0
    let elapsed = 0
    let customerName = ""
    let waiterName = ""
    let kitchenStatus = "Not Sent"

    if (orderForTable && orderForTable.cart.length > 0) {
      status = 'Occupied'
      if (orderForTable.orderStatus === 'Ready') status = 'Ready'
      if (orderForTable.orderStatus === 'Preparing') status = 'Preparing'

      const sub = orderForTable.cart.reduce((total: number, item: any) => total + ((item.price * item.quantity) - item.discount), 0)
      amount = sub
      elapsed = Math.floor((new Date().getTime() - new Date(orderForTable.startTime).getTime()) / 60000)
      if (orderForTable.customer) customerName = orderForTable.customer.name
      if (orderForTable.waiterName) waiterName = orderForTable.waiterName
      kitchenStatus = orderForTable.kitchenStatus === 'Pending' ? 'Not Sent' : (orderForTable.kitchenStatus || 'Not Sent')
    }

    // if this is the currently active order (not yet pushed to openOrders, or currently active)
    const store = usePosStore.getState()
    if (store.tableNumber === t.label && store.cart.length > 0) {
      status = 'Occupied'
      amount = store.getSubtotal()
      elapsed = Math.floor((new Date().getTime() - new Date(store.startTime).getTime()) / 60000)
      if (store.customer) customerName = store.customer.name
      if (store.waiterName) waiterName = store.waiterName
      kitchenStatus = 'Not Sent'
    }

    return { ...t, status, amount, elapsed, customerName, waiterName, kitchenStatus }
  })

  const filteredTables = enhancedTables.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()))

  // Auto-select table when typing an exact match
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const exactMatch = enhancedTables.find(t => t.label.toLowerCase() === searchQuery.toLowerCase())
      if (exactMatch) {
        handleSelect(exactMatch)
      }
    }
    setSelectedIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Exit if backspace pressed and search is empty
      if (e.key === 'Backspace' && searchQuery === '') {
        e.preventDefault()
        onClose()
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        searchInputRef.current?.blur()

        if (e.key === 'ArrowRight') {
          setSelectedIndex(prev => Math.min(prev + 1, filteredTables.length - 1))
        } else if (e.key === 'ArrowLeft') {
          setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'ArrowDown') {
          setSelectedIndex(prev => Math.min(prev + 6, filteredTables.length - 1))
        } else if (e.key === 'ArrowUp') {
          setSelectedIndex(prev => Math.max(prev - 6, 0))
        }
        return
      }

      if (e.key === 'Enter') {
        if (filteredTables[selectedIndex]) {
          e.preventDefault()
          handleSelect(filteredTables[selectedIndex])
        }
        return
      }

      // Auto focus search input on typing
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredTables, selectedIndex, searchQuery, onClose])

  const handleSelect = (table: Table) => {
    setTableNumber(table.label || table.id)
    onClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-white text-zinc-900 border-zinc-200 hover:border-orange-500'
      case 'Occupied': return 'bg-orange-100 text-orange-900 border-orange-200 shadow-sm'
      case 'Preparing': return 'bg-yellow-500 text-white border-transparent'
      case 'Ready': return 'bg-green-500 text-white border-transparent'
      default: return 'bg-white text-zinc-900 border-zinc-200'
    }
  }

  const selectedTableId = filteredTables[selectedIndex]?.id

  const handleClearTables = async (zoneId?: string) => {
    const targets = zoneId
      ? ALL_TABLES.filter(t => t.zoneId === zoneId)
      : ALL_TABLES
    try {
      await Promise.all(targets.map(t =>
        useTableStore.getState().updateTable(t.id, { status: 'Available' } as any).catch(() => {})
      ))
      await fetchData()
    } catch (e) {
      console.error('Failed to clear tables', e)
    }
  }

  const TableGrid = ({ title, tables, zoneId }: { title: string, tables: any[], zoneId: string }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">{title}</h3>
        <button
          onClick={() => handleClearTables(zoneId)}
          className="text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors border border-red-500/20 shadow-sm"
        >
          Clear {title.split(' ')[0]}
        </button>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {tables.map(t => (
          <button
            key={t.id}
            onClick={() => handleSelect(t)}
            className={`relative flex flex-col p-3 rounded-xl border-2 transition-all h-28 overflow-hidden ${getStatusColor(t.status)} ${selectedTableId === t.id
                ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-background scale-105 shadow-xl z-10'
                : (activeOrderId === t.label ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-background' : '')
              }`}
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col items-start gap-0.5 truncate pr-2">
                <div className="flex items-center gap-3">
                  <span className="font-black text-xl leading-none">{t.label}</span>
                  {t.status !== 'Available' && t.waiterName && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-orange-600 bg-orange-500/10 border border-orange-500/40 shadow-sm truncate max-w-[90px]">
                      {t.waiterName}
                    </span>
                  )}
                </div>
              </div>
              {t.status !== 'Available' && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse shrink-0 mt-0.5" />}
            </div>

            {t.status !== 'Available' ? (
              <div className="w-full flex flex-col gap-1 mt-auto">
                <div className="flex items-center gap-1.5 text-xs">
                  <User className="w-3.5 h-3.5 text-orange-500/70 shrink-0" />
                  <span className="font-bold opacity-90 truncate">{t.customerName || 'Guest'}</span>
                </div>
                
                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-orange-500/15">
                  <div className="flex items-center gap-1 text-[10px] font-bold opacity-80 min-w-0">
                    <UtensilsCrossed className="w-3 h-3 shrink-0" />
                    <span className="truncate">{t.kitchenStatus}</span>
                  </div>
                  <span className="text-xs font-black shrink-0 ml-2">PKR {t.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
            ) : (
              <div className="w-full text-left mt-auto opacity-50 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Available</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-background w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh] border border-border"
        >
          <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-foreground">Table Management</h2>
              <p className="text-xs text-muted-foreground font-bold">Select a table or type to jump instantly</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type table (e.g. G5)..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold uppercase"
                />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* Quick Actions & Status Legend */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">Status:</span>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-zinc-200 border border-zinc-300"></div><span className="text-xs font-bold">Available</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-200 border border-orange-300"></div><span className="text-xs font-bold text-orange-600">Occupied</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-xs font-bold text-yellow-500">Preparing</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-xs font-bold text-green-500">Ready</span></div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleClearTables()} className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-orange-500 hover:text-white rounded-lg transition-colors border border-border hover:border-orange-500 shadow-sm">Clear All</button>
              </div>
            </div>

            {categories.map(c => {
              const zoneTables = filteredTables.filter(t => t.zoneId === c.id);
              if (zoneTables.length === 0) return null;
              return <TableGrid key={c.id} title={c.name} zoneId={c.id} tables={zoneTables} />
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
