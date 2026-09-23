import { create } from 'zustand';
import { tableApi } from '../api/tableApi';
import type { Table, TableCategory } from '../api/tableApi';

interface TableStore {
  tables: Table[];
  categories: TableCategory[];
  isLoading: boolean;
  error: string | null;

  fetchData: () => Promise<void>;
  
  createCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  createTable: (name: string, category_id: string, status?: string) => Promise<void>;
  updateTable: (id: string, data: Partial<Table>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
}

export const useTableStore = create<TableStore>((set, get) => ({
  tables: [],
  categories: [],
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [categories, tables] = await Promise.all([
        tableApi.getCategories(),
        tableApi.getTables()
      ]);
      set({ categories, tables, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch table data', isLoading: false });
    }
  },

  createCategory: async (name: string) => {
    try {
      const newCategory = await tableApi.createCategory({ name });
      set(state => ({ categories: [...state.categories, newCategory] }));
    } catch (error: any) {
      throw error;
    }
  },

  updateCategory: async (id: string, name: string) => {
    try {
      const updated = await tableApi.updateCategory(id, { name });
      set(state => ({
        categories: state.categories.map(c => c.id === id ? updated : c),
        tables: state.tables.map(t => t.category_id === id ? { ...t, category_name: updated.name } : t)
      }));
    } catch (error: any) {
      throw error;
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await tableApi.deleteCategory(id);
      set(state => ({
        categories: state.categories.filter(c => c.id !== id),
        tables: state.tables.filter(t => t.category_id !== id)
      }));
    } catch (error: any) {
      throw error;
    }
  },

  createTable: async (name: string, category_id: string, status?: string) => {
    try {
      const newTable = await tableApi.createTable({ name, category_id, status });
      set(state => ({ tables: [...state.tables, newTable] }));
    } catch (error: any) {
      throw error;
    }
  },

  updateTable: async (id: string, data: Partial<Table>) => {
    try {
      const updated = await tableApi.updateTable(id, data);
      set(state => ({ tables: state.tables.map(t => t.id === id ? updated : t) }));
    } catch (error: any) {
      throw error;
    }
  },

  deleteTable: async (id: string) => {
    try {
      await tableApi.deleteTable(id);
      set(state => ({ tables: state.tables.filter(t => t.id !== id) }));
    } catch (error: any) {
      throw error;
    }
  }
}));
