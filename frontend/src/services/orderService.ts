import { apiClient } from '../api/client'

export const orderService = {
  // Get active (unpaid/uncompleted) orders
  getActiveOrders: async (): Promise<any[]> => {
    const res = await apiClient.get('/orders', { params: { activeOnly: true } })
    return res.data || []
  },

  // Get historical orders (completed/cancelled)
  getOrderHistory: async (limit = 50, offset = 0): Promise<any[]> => {
    const res = await apiClient.get('/orders', { params: { limit, offset } })
    return res.data || []
  },

  // Get a specific order by ID
  getOrderById: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/orders/${id}`)
    return res.data
  },

  // Update order status
  updateOrderStatus: async (id: string, status: string) => {
    return apiClient.put(`/orders/${id}/status`, { status })
  }
}
