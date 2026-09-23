import { apiClient } from '../api/client'

export const customerService = {
  getCustomers: () => {
    return apiClient.get('/customers')
  },
  getCustomerById: (id: string) => {
    return apiClient.get(`/customers/${id}`)
  },
  createCustomer: (data: any) => {
    return apiClient.post('/customers', data)
  },
  updateCustomer: (id: string, data: any) => {
    return apiClient.put(`/customers/${id}`, data)
  },
  deleteCustomer: (id: string) => {
    return apiClient.delete(`/customers/${id}`)
  },
  deleteAllCustomers: () => {
    return apiClient.delete('/customers')
  }
}
