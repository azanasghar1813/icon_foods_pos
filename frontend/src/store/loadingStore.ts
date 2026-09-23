import { create } from 'zustand'

interface LoadingState {
  globalLoading: boolean
  syncLoading: boolean
  activeRequests: number
  
  // Actions
  startLoading: () => void
  stopLoading: () => void
  
  startSync: () => void
  stopSync: () => void
}

export const useLoadingStore = create<LoadingState>((set) => ({
  globalLoading: false,
  syncLoading: false,
  activeRequests: 0,
  
  startLoading: () => set((state) => {
    const nextActive = state.activeRequests + 1
    return {
      activeRequests: nextActive,
      globalLoading: nextActive > 0
    }
  }),
  
  stopLoading: () => set((state) => {
    const nextActive = Math.max(0, state.activeRequests - 1)
    return {
      activeRequests: nextActive,
      globalLoading: nextActive > 0
    }
  }),
  
  startSync: () => set({ syncLoading: true }),
  stopSync: () => set({ syncLoading: false })
}))
