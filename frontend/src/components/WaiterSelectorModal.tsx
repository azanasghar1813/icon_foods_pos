import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, User } from "lucide-react"
import { usePosStore } from "../store/posStore"
import { employeeService } from "../services/employeeService"

interface WaiterSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WaiterSelectorModal({ isOpen, onClose }: WaiterSelectorModalProps) {
  const { setWaiterId, setWaiterName, waiterId } = usePosStore()
  const [waiters, setWaiters] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("")
      setSelectedIndex(0)
      fetchWaiters()
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const fetchWaiters = async () => {
    try {
      setIsLoading(true)
      const res = await employeeService.getEmployees()
      const data = res.data || res || []
      // Filter by role Name "Waiter" or role_id mapping if applicable. 
      const waitersList = data.filter((u: any) => {
        const role = String(u.role || u.role_name || u.role?.name || '').toLowerCase()
        return role === 'waiter'
      })
      setWaiters(waitersList)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredWaiters = waiters.filter(w => {
    const name = w.name || w.first_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  })

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Backspace' && searchQuery === '') {
        e.preventDefault()
        onClose()
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        if (e.key === 'ArrowRight') setSelectedIndex(prev => Math.min(prev + 1, filteredWaiters.length - 1))
        if (e.key === 'ArrowLeft') setSelectedIndex(prev => Math.max(prev - 1, 0))
        if (e.key === 'ArrowDown') setSelectedIndex(prev => Math.min(prev + 2, filteredWaiters.length - 1))
        if (e.key === 'ArrowUp') setSelectedIndex(prev => Math.max(prev - 2, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredWaiters[selectedIndex]) {
          handleSelect(filteredWaiters[selectedIndex])
        }
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredWaiters, selectedIndex, searchQuery, onClose])

  const handleSelect = (waiter: any) => {
    const waiterName = waiter.name || waiter.first_name || 'Unnamed';
    setWaiterId(waiter.id, waiterName)
    onClose()
  }

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
          className="bg-background w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[70vh] border border-border"
        >
          <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-black text-foreground">Select Waiter</h2>
              <p className="text-xs text-muted-foreground font-bold">Assign a waiter to this order</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search waiter..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold"
                />
              </div>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground font-bold text-sm">Loading waiters...</span>
              </div>
            ) : filteredWaiters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                <User className="w-12 h-12 mb-2" />
                <p className="font-bold">No waiters found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredWaiters.map((w, idx) => (
                  <button
                    key={w.id}
                    onClick={() => handleSelect(w)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      idx === selectedIndex ? 'bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/50' : 'bg-card border-border hover:border-orange-500/50 hover:bg-secondary/50'
                    } ${waiterId === w.id ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/10' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-black">
                      {((w.name || w.first_name) || 'W').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-foreground">{w.name || w.first_name || 'Unnamed'}</p>
                      <p className="text-[10px] text-muted-foreground font-bold">ID: {w.id.substring(0,8)}</p>
                    </div>

                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
