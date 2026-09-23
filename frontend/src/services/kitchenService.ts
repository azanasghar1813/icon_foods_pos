import { apiClient } from '../api/client'


export const kitchenService = {
  getQueue: async (filters: any = {}): Promise<{ success: boolean; data: any[] }> => {
    const params = new URLSearchParams()
    if (filters.monitorMode) params.append('monitorMode', 'true')
    return apiClient.get(`/kitchen/queue?${params.toString()}`)
  },

  // Get ticket by order ID
  getTicket: async (orderId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.get(`/kitchen/tickets/${orderId}`)
  },

  // Item status updates
  acceptItem: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/accept`, {})
  },

  startPreparingItem: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/start`, {})
  },

  markItemReady: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/ready`, {})
  },

  markItemServed: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/served`, {})
  },

  completeItem: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/complete`, {})
  },

  cancelItem: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/cancel`, {})
  },

  returnItemToPreparing: async (itemId: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.post(`/kitchen/items/${itemId}/return-to-preparing`, {})
  },

  // Meta updates
  addOrderNote: async (orderId: string, note: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.patch(`/kitchen/orders/${orderId}/note`, { note })
  },

  addItemNote: async (itemId: string, note: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.patch(`/kitchen/items/${itemId}/note`, { note })
  },

  setPriority: async (orderId: string, priority: string): Promise<{ success: boolean; data: any }> => {
    return apiClient.patch(`/kitchen/orders/${orderId}/priority`, { priority })
  },

  clearFailed: async (orderIds: string[]): Promise<{ success: boolean; data: any }> => {
    return apiClient.post('/kitchen/clear-failed', { orderIds })
  }
}
