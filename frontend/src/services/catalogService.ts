import { apiClient } from '../api/client'

export const catalogService = {
  getProducts: async (): Promise<any[]> => {
    const res = await apiClient.get('/catalog/products/search')
    return res.data || []
  },
  
  createProduct: async (productData: any) => {
    return apiClient.post('/catalog/products', productData)
  },

  updateProduct: async (id: string, productData: any) => {
    return apiClient.put(`/catalog/products/${id}`, productData)
  },

  deleteProduct: async (id: string) => {
    return apiClient.delete(`/catalog/products/${id}`)
  },

  getCategories: async (): Promise<any[]> => {
    const res = await apiClient.get('/catalog/categories')
    return res.data || []
  },

  createCategory: async (categoryData: any) => {
    return apiClient.post('/catalog/categories', categoryData)
  },

  updateCategory: async (id: string, categoryData: any) => {
    return apiClient.put(`/catalog/categories/${id}`, categoryData)
  },

  deleteCategory: async (id: string) => {
    return apiClient.delete(`/catalog/categories/${id}`)
  }
}
