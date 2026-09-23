import { apiClient } from './client';

export interface TableCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface Table {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  status: string;
  created_at?: string;
}

export const tableApi = {
  // Categories
  getCategories: (): Promise<TableCategory[]> => apiClient.get('/tables/categories'),
  createCategory: (data: { name: string }): Promise<TableCategory> => apiClient.post('/tables/categories', data),
  updateCategory: (id: string, data: { name: string }): Promise<TableCategory> => apiClient.put(`/tables/categories/${id}`, data),
  deleteCategory: (id: string): Promise<void> => apiClient.delete(`/tables/categories/${id}`),

  // Tables
  getTables: (): Promise<Table[]> => apiClient.get('/tables'),
  createTable: (data: { name: string; category_id: string; status?: string }): Promise<Table> => apiClient.post('/tables', data),
  updateTable: (id: string, data: { name?: string; category_id?: string; status?: string }): Promise<Table> => apiClient.put(`/tables/${id}`, data),
  deleteTable: (id: string): Promise<void> => apiClient.delete(`/tables/${id}`),
};
