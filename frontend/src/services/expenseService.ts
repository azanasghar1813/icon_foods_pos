import { apiClient } from '../api/client'

export const expenseService = {
  getExpenses: () => {
    return apiClient.get('/expenses')
  },
  getExpenseById: (id: string) => {
    return apiClient.get(`/expenses/${id}`)
  },
  createExpense: (data: any) => {
    return apiClient.post('/expenses', data)
  },
  updateExpense: (id: string, data: any) => {
    return apiClient.put(`/expenses/${id}`, data)
  },
  deleteExpense: (id: string) => {
    return apiClient.delete(`/expenses/${id}`)
  }
}
