import { useState, useEffect, useRef } from "react"
import { Search, X, User } from "lucide-react"
import { usePosStore } from "../store/posStore"
import { apiClient } from "../api/client"
import { motion, AnimatePresence } from "framer-motion"

interface RiderSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RiderSelectorModal({ isOpen, onClose }: RiderSelectorModalProps) {
  const { setRiderId, setRiderName, riderId } = usePosStore()
  const [riders, setRiders] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchRiders()
      setSearchQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const fetchRiders = async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/users') as any
      const data = res.data?.data || res.data || []
      // Filter by role Name "Rider" or role_id mapping if applicable. 
      const ridersList = data.filter((u: any) => (u.role === 'Rider' || u.role_name === 'Rider' || u.role?.name === 'Rider'))
      setRiders(ridersList)
    } catch (e) {
      console.error("Failed to load riders", e)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredRiders = riders.filter(r => {
    if (!searchQuery) return true
    const name = (r.name || r.first_name || '').toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      
      if (filteredRiders.length > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, filteredRiders.length - 1))
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 3, filteredRiders.length - 1))
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 3, 0))
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (filteredRiders[selectedIndex]) {
            handleSelect(filteredRiders[selectedIndex])
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredRiders, selectedIndex, searchQuery, onClose])

  const handleSelect = (rider: any) => {
    const riderName = rider.name || rider.first_name || 'Unnamed';
    setRiderId(rider.id, riderName)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/20 text-orange-500 rounded-2xl flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Select Rider</h2>
                <p className="text-xs text-muted-foreground font-bold">Assign a rider to this order</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search rider..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSelectedIndex(0)
                }}
                className="w-full h-12 pl-12 pr-4 bg-secondary border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold"
              />
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <span className="text-muted-foreground font-bold text-sm">Loading riders...</span>
              </div>
            ) : filteredRiders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold">No riders found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredRiders.map((r, idx) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                      idx === selectedIndex ? 'bg-secondary border-primary ring-2 ring-primary/20' : 'bg-card border-border hover:border-primary/50 hover:bg-secondary/50'
                    } ${riderId === r.id ? 'ring-2 ring-orange-500 border-orange-500 bg-orange-500/10' : ''}`}
                  >
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-3">
                      <span className="text-lg font-black text-foreground">
                        {(r.name || r.first_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-black text-sm text-center line-clamp-1">{r.name || r.first_name || 'Unnamed'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
