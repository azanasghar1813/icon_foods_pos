import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  restaurantName: string
  phoneNumber: string
  address: string
  trn: string
  
  taxRate: number
  serviceChargeRate: number
  deliveryChargeRate: number
  currencySymbol: string
  receiptFooter: string
  
  updateSettings: (settings: Partial<SettingsState>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      restaurantName: "Icon Food",
      phoneNumber: "03299792223 , 03159792247",
      address: "Jhang road sabzi mandi, Near shell pump Chaniot",
      trn: "100234567890",
      
      taxRate: 0,
      serviceChargeRate: 0,
      deliveryChargeRate: 50,
      currencySymbol: "Rs",
      receiptFooter: "Thank you for dining with us! Please come again.",
      
      updateSettings: (settings) => set((state) => ({ ...state, ...settings }))
    }),
    {
      name: 'settings-storage',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        const next = { ...persistedState, taxRate: 0, currencySymbol: "Rs" }
        if (!version || version < 4) {
          next.address = "Jhang road sabzi mandi, Near shell pump Chaniot"
          next.phoneNumber = "03299792223 , 03159792247"
          next.currencySymbol = "Rs"
        }
        return next
      },
    }
  )
)
