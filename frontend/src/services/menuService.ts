import { apiClient } from '../api/client'

export const menuService = {
  // ==========================================
  // Categories
  // ==========================================
  getCategories: async () => {
    return apiClient.get('/catalog/categories')
  },
  
  createCategory: async (data: any) => {
    return apiClient.post('/catalog/categories', data)
  },
  
  updateCategory: async (id: string, data: any) => {
    return apiClient.put(`/catalog/categories/${id}`, data)
  },
  
  deleteCategory: async (id: string) => {
    return apiClient.delete(`/catalog/categories/${id}`)
  },

  // ==========================================
  // Products
  // ==========================================
  getProducts: async (params?: any) => {
    return apiClient.get('/catalog/products/search', { params })
  },
  
  getProductById: async (id: string) => {
    return apiClient.get(`/catalog/products/${id}`)
  },
  
  createProduct: async (data: any) => {
    return apiClient.post('/catalog/products', data)
  },
  
  updateProduct: async (id: string, data: any) => {
    return apiClient.put(`/catalog/products/${id}`, data)
  },
  
  deleteProduct: async (id: string) => {
    return apiClient.delete(`/catalog/products/${id}`)
  },
  
  uploadProductImage: async (id: string, file: File, isPrimary: boolean = true) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('is_primary', String(isPrimary))
    return apiClient.post(`/catalog/products/${id}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  deleteProductImage: async (productId: string, imageId: string) => {
    return apiClient.delete(`/catalog/products/${productId}/images/${imageId}`)
  },

  // ==========================================
  // Variants
  // ==========================================
  createVariant: async (productId: string, data: any) => {
    return apiClient.post(`/catalog/products/${productId}/variants`, data)
  },
  
  updateVariant: async (variantId: string, data: any) => {
    return apiClient.put(`/catalog/variants/${variantId}`, data)
  },
  
  deleteVariant: async (variantId: string) => {
    return apiClient.delete(`/catalog/variants/${variantId}`)
  },

  // ==========================================
  // Modifiers (Modifier Groups)
  // ==========================================
  getModifierGroups: async () => {
    return apiClient.get('/catalog/modifier-groups')
  },
  
  createModifierGroup: async (data: any) => {
    return apiClient.post('/catalog/modifier-groups', data)
  },
  
  updateModifierGroup: async (id: string, data: any) => {
    return apiClient.put(`/catalog/modifier-groups/${id}`, data)
  },
  
  deleteModifierGroup: async (id: string) => {
    return apiClient.delete(`/catalog/modifier-groups/${id}`)
  },

  // Link group to product
  linkGroupToProduct: async (productId: string, groupId: string, data: any) => {
    return apiClient.post(`/catalog/products/${productId}/modifier-groups/${groupId}`, data)
  },
  
  unlinkGroupFromProduct: async (productId: string, groupId: string) => {
    return apiClient.delete(`/catalog/products/${productId}/modifier-groups/${groupId}`)
  },

  // ==========================================
  // Deals
  // ==========================================
  getDeals: async () => {
    return apiClient.get('/catalog/deals')
  },
  
  createDeal: async (data: any) => {
    return apiClient.post('/catalog/deals', data)
  },
  
  updateDeal: async (id: string, data: any) => {
    return apiClient.put(`/catalog/deals/${id}`, data)
  },
  
  deleteDeal: async (id: string) => {
    return apiClient.delete(`/catalog/deals/${id}`)
  }
}
