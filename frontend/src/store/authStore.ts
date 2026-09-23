import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  name: string
  role: string
  permissions: string[]
}

interface AuthState {
  user: User | null
  token: string | null
  cashierSessionId: string | null
  isAuthenticated: boolean
  
  setSession: (user: User, token: string, cashierSessionId?: string | null) => void
  setCashierSessionId: (cashierSessionId: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      cashierSessionId: null,
      isAuthenticated: false,

      setSession: (user, token, cashierSessionId = null) => set({
        user,
        token,
        cashierSessionId,
        isAuthenticated: true
      }),

      setCashierSessionId: (cashierSessionId) => set({ cashierSessionId }),

      logout: () => {
        set({
          user: null,
          token: null,
          cashierSessionId: null,
          isAuthenticated: false
        })
      }
    }),
    {
      name: 'auth-storage',
    }
  )
)

export const hasPermission = (code: string) => {
  return true;
}
