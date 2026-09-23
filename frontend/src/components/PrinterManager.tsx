import React, { useEffect } from 'react'
import { Printer, RefreshCw, XCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrinterStore } from '../store/printerStore'

interface PrinterManagerProps {
  isOpen: boolean
  onClose: () => void
}

const formatJobTime = (timeStr?: string | null) => {
  if (!timeStr) return '—'
  let t = String(timeStr).trim()
  if (!t.endsWith('Z') && !t.includes('+')) t = t.replace(' ', 'T') + 'Z'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return String(timeStr)
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export const PrinterManager: React.FC<PrinterManagerProps> = ({ isOpen, onClose }) => {
  const { printers, printQueue, reprintJob, cancelJob, clearQueue, fetchPrinters, fetchQueue } = usePrinterStore()

  useEffect(() => {
    if (isOpen) {
      fetchPrinters()
      fetchQueue()
    }
  }, [isOpen, fetchPrinters, fetchQueue])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="relative w-full max-w-4xl bg-card border border-border shadow-2xl rounded-[2rem] flex flex-col overflow-hidden max-h-[85vh]"
      >
        <div className="p-6 border-b border-border bg-secondary/30 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Printer className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">Printer Manager</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors">
            <XCircle className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Printers List */}
          <div className="w-1/3 border-r border-border p-4 overflow-y-auto custom-scrollbar bg-secondary/10">
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">Configured Printers</h3>
            <div className="space-y-3">
              {printers.map(printer => (
                <div key={printer.id} className="p-4 bg-card border border-border rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-foreground">{printer.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      printer.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500' :
                      printer.status === 'Offline' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {printer.status}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="bg-secondary px-2 py-1 rounded-md">{printer.type}</span>
                    <span className="bg-secondary px-2 py-1 rounded-md">{printer.connectionType}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print Queue */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Print Queue</h3>
              {printQueue.length > 0 && (
                <button
                  onClick={async () => {
                    if (!window.confirm('Clear the entire print queue? Pending, failed, and completed jobs will be removed.')) return
                    try {
                      await clearQueue()
                      fetchQueue()
                    } catch {
                      alert('Could not clear the print queue.')
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white text-[10px] uppercase font-black rounded-lg border border-red-500/20 transition-colors"
                >
                  Clear Queue
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              <AnimatePresence>
                {printQueue.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">Queue is empty</p>
                  </div>
                ) : (
                  printQueue.map(job => (
                    <motion.div 
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-secondary/30 border border-border rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {job.job_type}{job.order_number ? ` · #${job.order_number}` : ' Job'} <span className="text-muted-foreground font-normal text-sm">for {job.printer_id || 'unassigned'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatJobTime(job.created_at)} • ID: {job.id.slice(-6)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 ${
                          job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                          job.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-500' :
                          job.status === 'FAILED' ? 'bg-red-500/10 text-red-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {job.status === 'PROCESSING' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {job.status === 'FAILED' && <AlertCircle className="w-3 h-3" />}
                          {job.status}
                        </span>

                        {job.status === 'FAILED' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => reprintJob(job.id, 'system', 'Retry from printer manager')}
                              className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90"
                            >
                              Retry
                            </button>
                            <button 
                              onClick={() => cancelJob(job.id)}
                              className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-lg hover:bg-destructive/20"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
