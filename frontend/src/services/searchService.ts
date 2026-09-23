import { apiClient } from '../api/client'

export const searchService = {
  /**
   * Global search across products, categories, customers, and orders.
   * Leverages the backend Search Engine with intelligent ranking.
   */
  query: async (searchTerm: string, limit: number = 10) => {
    return apiClient.get('/search/query', {
      params: { q: searchTerm, limit }
    })
  },

  /**
   * Get instant search suggestions based on popularity and recent usage.
   * Useful for empty-state search bars.
   */
  getSuggestions: async (limit: number = 5) => {
    return apiClient.get('/search/suggestions', {
      params: { limit }
    })
  }
}
