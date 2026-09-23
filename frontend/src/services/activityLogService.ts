import { apiClient } from '../api/client'

export const activityLogService = {
  getLogs: (params: { limit?: number, offset?: number, userId?: string, entityType?: string, action?: string } = {}) => {
    return apiClient.get('/activity-logs', { params })
  }
}
