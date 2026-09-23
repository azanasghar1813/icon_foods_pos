import { create } from 'zustand'
import { apiClient } from '../api/client'

export type PrinterType = 'Receipt' | 'Fast Food' | 'Restaurant'
export type PrintJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface PrintJob {
  id: string
  job_type: string
  printer_id: string | null
  status: PrintJobStatus
  order_id: string | null
  order_number: string | null
  cashier_user_id: string | null
  retries: number
  max_retries: number
  last_error: string | null
  priority: number
  created_at: string
  processing_at: string | null
  completed_at: string | null
}

export interface Printer {
  id: string
  name: string
  type: PrinterType
  status: 'Online' | 'Offline' | 'Printing' | 'Busy' | 'Error' | 'Paper Out' | 'Disconnected'
  current_status: 'ONLINE' | 'OFFLINE' | 'PRINTING' | 'BUSY' | 'ERROR' | 'PAPER_OUT' | 'DISCONNECTED'
  status_updated_at: string | null
  last_error: string | null
  connectionType: string
  paper_width: number
  cash_drawer_enabled: boolean
  station_type: string | null
  driver_type: string
}

interface PrintQueueStats {
  status: string
  count: number
}

interface PrinterState {
  printers:   Printer[]
  printQueue: PrintJob[]
  queueStats: PrintQueueStats[]
  isLoading:  boolean
  lastRefreshed: string | null

  settings: {
    receiptWidth:      '58mm' | '80mm'
    copies:            number
    autoPrintReceipt:  boolean
    autoPrintKitchen:  boolean
    receiptFooter:     string
    cutPaper:          boolean
  }

  // API-backed actions
  fetchPrinters:   () => Promise<void>
  fetchQueue:      (filters?: Record<string, any>) => Promise<void>
  fetchQueueStats: () => Promise<void>
  enqueuePrintJob: (job: { type: string; printerType: PrinterType; content: string }) => void
  printReceipt:    (orderId: string, cashierUserId: string, printPaid?: boolean) => Promise<{ job_id: string } | null>
  reprintJob:      (jobId: string, cashierUserId: string, reason?: string) => Promise<any>
  printKitchen:    (orderId: string, cashierUserId: string) => Promise<any>
  openCashDrawer:  (cashierUserId: string) => Promise<any>
  testPrinter:     (printerId: string) => Promise<any>
  updatePrinterStatus: (printerId: string, status: Printer['status']) => void
  cancelJob:       (jobId: string) => Promise<void>
  clearQueue:      () => Promise<void>
  updateSettings:  (settings: Partial<PrinterState['settings']>) => void
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  printers:      [],
  printQueue:    [],
  queueStats:    [],
  isLoading:     false,
  lastRefreshed: null,

  settings: {
    receiptWidth:     '80mm',
    copies:           1,
    autoPrintReceipt: true,
    autoPrintKitchen: true,
    receiptFooter:    'Thank you for your visit!',
    cutPaper:         true,
  },

  fetchPrinters: async () => {
    set({ isLoading: true })
    try {
      const result = await apiClient.get('/print/printers')
      set({
        printers: (result.data || []).map((printer: any) => ({
          ...printer,
          status: printer.status || 'Offline'
        })),
        isLoading: false,
        lastRefreshed: new Date().toISOString()
      })
    } catch (error) {
      console.error('[PrinterStore] fetchPrinters failed:', error)
      set({ isLoading: false })
    }
  },

  fetchQueue: async (filters = {}) => {
    try {
      const qs = new URLSearchParams(
        Object.entries(filters).filter(([_, v]) => v !== undefined) as [string, string][]
      ).toString()
      const result = await apiClient.get(`/print/queue${qs ? '?' + qs : ''}`)
      set({ printQueue: result.data?.jobs || [] })
    } catch (error) {
      console.error('[PrinterStore] fetchQueue failed:', error)
    }
  },

  fetchQueueStats: async () => {
    try {
      const result = await apiClient.get('/print/queue/stats')
      set({ queueStats: result.data || [] })
    } catch { /* non-critical */ }
  },

  enqueuePrintJob: (job) => {
    const newJob: PrintJob = {
      id: `job-${Date.now()}`,
      job_type: job.type,
      printer_id: null,
      status: 'PENDING',
      order_id: null,
      order_number: null,
      cashier_user_id: null,
      retries: 0,
      max_retries: 3,
      last_error: null,
      priority: 0,
      created_at: new Date().toISOString(),
      processing_at: null,
      completed_at: null
    }
    set(state => ({ printQueue: [newJob, ...state.printQueue] }))
  },

  printReceipt: async (orderId, cashierUserId, printPaid) => {
    try {
      const result = await apiClient.post(`/print/receipt/${orderId}`, { cashier_user_id: cashierUserId, print_paid: !!printPaid })
      if (result) {
        // Refresh queue after enqueue
        setTimeout(() => get().fetchQueue(), 300)
        return result.data
      }
      return null
    } catch (error: any) {
      console.error('[PrinterStore] printReceipt failed:', error.message)
      return null
    }
  },

  reprintJob: async (jobId, cashierUserId, reason) => {
    try {
      const result = await apiClient.post(`/print/reprint/${jobId}`, { cashier_user_id: cashierUserId, reason })
      setTimeout(() => get().fetchQueue(), 300)
      return result.data
    } catch (error: any) {
      console.error('[PrinterStore] reprintJob failed:', error.message)
      return null
    }
  },

  printKitchen: async (orderId, cashierUserId) => {
    try {
      const result = await apiClient.post(`/print/kitchen/${orderId}`, { cashier_user_id: cashierUserId })
      return result.data
    } catch (error: any) {
      console.error('[PrinterStore] printKitchen failed:', error.message)
      return null
    }
  },

  openCashDrawer: async (cashierUserId) => {
    try {
      const result = await apiClient.post('/print/cash-drawer', { cashier_user_id: cashierUserId })
      return result.data
    } catch (error: any) {
      console.error('[PrinterStore] openCashDrawer failed:', error.message)
      return null
    }
  },

  testPrinter: async (printerId) => {
    try {
      const result = await apiClient.post(`/print/printers/${printerId}/test`)
      // Refresh printer status after test
      setTimeout(() => get().fetchPrinters(), 500)
      return result.data
    } catch (error: any) {
      console.error('[PrinterStore] testPrinter failed:', error.message)
      return null
    }
  },

  updatePrinterStatus: (printerId, status) => {
    set(state => ({
      printers: state.printers.map(printer => printer.id === printerId ? { ...printer, status } : printer)
    }))
  },

  cancelJob: async (jobId) => {
    try {
      await apiClient.delete(`/print/queue/${jobId}`)
      set(state => ({
        printQueue: state.printQueue.filter(j => j.id !== jobId)
      }))
    } catch (error: any) {
      console.error('[PrinterStore] cancelJob failed:', error.message)
    }
  },

  clearQueue: async () => {
    try {
      await apiClient.post('/print/queue/clear')
      set({ printQueue: [] })
    } catch (error: any) {
      console.error('[PrinterStore] clearQueue failed:', error.message)
      throw error
    }
  },

  updateSettings: (newSettings) => {
    set(state => ({
      settings: { ...state.settings, ...newSettings }
    }))
  },
}))
