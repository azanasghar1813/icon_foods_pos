import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: 'light' | 'colorful'
  setTheme: (theme: 'light' | 'colorful') => void
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      isSidebarOpen: true, // Defaulting to ON as requested
      setTheme: (theme) => {
        set({ theme })
        // Update DOM
        if (theme === 'colorful') {
          document.documentElement.classList.add('colorful-theme')
        } else {
          document.documentElement.classList.remove('colorful-theme')
        }
      },
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    }),
    {
      name: 'ui-storage',
      onRehydrateStorage: () => (state) => {
        // Run on initial load
        if (state?.theme === 'colorful') {
          document.documentElement.classList.add('colorful-theme')
        } else {
          document.documentElement.classList.remove('colorful-theme')
        }
      }
    }
  )
)
