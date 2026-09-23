import { apiClient } from '../api/client'

export const employeeService = {
  getEmployees: () => {
    return apiClient.get('/users')
  },
  getEmployeeById: (id: string) => {
    return apiClient.get(`/users/${id}`)
  },
  createEmployee: (data: any) => {
    return apiClient.post('/users', data)
  },
  updateEmployee: (id: string, data: any) => {
    return apiClient.put(`/users/${id}`, data)
  },
  updateStatus: (id: string, isActive: boolean) => {
    return apiClient.patch(`/users/${id}/status`, { isActive })
  },
  resetPin: (id: string, newPin: string) => {
    return apiClient.post(`/users/${id}/reset-pin`, { newPin })
  },
  getRoles: () => {
    return apiClient.get('/roles')
  },
  createRole: (data: any) => {
    return apiClient.post('/roles', data)
  },
  updateRole: (id: string, data: any) => {
    return apiClient.put(`/roles/${id}`, data)
  },
  deleteRole: (id: string) => {
    return apiClient.delete(`/roles/${id}`)
  },
  getPermissions: () => {
    return apiClient.get('/permissions')
  }
}
