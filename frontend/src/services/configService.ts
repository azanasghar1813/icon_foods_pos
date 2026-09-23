import { apiClient } from '../api/client'

export const configService = {
  /**
   * Get general business settings (Name, Address, Tax settings).
   */
  getGeneralSettings: async () => {
    return apiClient.get('/config')
  },

  /**
   * Get restaurant table configuration.
   */
  getTables: async () => {
    return apiClient.get('/config/tables')
  },

  /**
   * Get receipt templates and printing settings.
   */
  getReceiptSettings: async () => {
    return apiClient.get('/config/receipt')
  }
}
