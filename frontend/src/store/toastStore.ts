import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  message?: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    const duration = toast.duration !== undefined ? toast.duration : (toast.type === 'error' ? 5000 : 3000)
    
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration }]
    }))

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      }, duration)
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    })),

  clearAll: () => set({ toasts: [] })
}))

// Helper object for easy access anywhere in the app (outside React components)
export const toast = {
  success: (title: string, message?: any, duration?: number) => {
    const msg = typeof message === 'string' ? message : undefined
    useToastStore.getState().addToast({ title, message: msg, type: 'success', duration })
  },
  error: (title: string, message?: any, duration?: number) => {
    const msg = typeof message === 'string' ? message : undefined
    useToastStore.getState().addToast({ title, message: msg, type: 'error', duration })
  },
  warning: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ title, message, type: 'warning', duration })
  },
  info: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().addToast({ title, message, type: 'info', duration })
  },
  loading: (title: string) => {
    useToastStore.getState().addToast({ title, type: 'info', duration: 4000 })
    return title
  }
}
