import { apiClient } from '../api/client'

export const inventoryService = {
  getInventory: () => {
    return apiClient.get('/inventory')
  },
  getInventoryItem: (id: string) => {
    return apiClient.get(`/inventory/${id}`)
  },
  getInventoryLogs: (itemId?: string) => {
    const params = itemId ? { itemId } : {}
    return apiClient.get('/inventory/logs', { params })
  },
  createItem: (data: any) => {
    return apiClient.post('/inventory', data)
  },
  updateItem: (id: string, data: any) => {
    return apiClient.put(`/inventory/${id}`, data)
  },
  adjustStock: (id: string, action: string, quantity_changed: number, notes?: string, reference_id?: string) => {
    return apiClient.post(`/inventory/${id}/adjust`, {
      action,
      quantity_changed,
      notes,
      reference_id
    })
  },
  deleteItem: (id: string) => {
    return apiClient.delete(`/inventory/${id}`)
  }
}
