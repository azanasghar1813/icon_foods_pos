import { apiClient } from './client'

export interface BusinessProfile {
  restaurant_name?: string
  phone_number?: string
  whatsapp_number?: string
  email?: string
  website?: string
  address?: string
  maps_location?: string
  registration_no?: string
  trn?: string
  business_day_start?: string
  business_day_end?: string
}

export interface FinanceConfig {
  service_charge_rate?: string
  delivery_charge_rate?: string
  tax_inclusive?: string
  round_off?: string
}

export interface OrderConfig {
  order_number_reset_daily?: string
}

export interface Printer {
  id: string;
  name: string;
  type: string;
  driver_type: 'ESCPOS_LAN' | 'ESCPOS_BT' | 'ESCPOS_USB' | 'VIRTUAL';
  connection_string?: string | null;
  ipAddress?: string | null; // legacy
  port?: number | null;      // legacy
  paperWidth: number;
  isActive: boolean;
}

export interface SyncConfig {
  device_role?: string;
  hub_ip?: string;
  hub_port?: number;
  hub_timeout_ms?: number;
  lease_block_size?: number;
  lease_low_water_mark?: number;
  lease_refill_batch?: number;
  device_secret?: string;
}

export const configApi = {
  // Fetch all config (Business profile, Finance, Printers, etc.)
  getAllConfig: async () => {
    return apiClient.get('/config')
  },

  // Update business profile
  updateBusinessProfile: async (data: BusinessProfile) => {
    return apiClient.put('/config/business/profile', data)
  },

  // Update finance config
  updateFinanceConfig: async (data: FinanceConfig) => {
    return apiClient.put('/config/business/finance', data)
  },

  // Printer Management
  getPrinters: async () => {
    return apiClient.get('/config/printers')
  },

  createPrinter: async (data: Omit<Printer, 'id'>) => {
    return apiClient.post('/config/printers', data)
  },

  updatePrinter: async (id: string, data: Omit<Printer, 'id'>) => {
    return apiClient.put(`/config/printers/${id}`, data)
  },

  deletePrinter: async (id: string) => {
    return apiClient.delete(`/config/printers/${id}`)
  },

  discoverPrinters: async () => {
    return apiClient.get('/config/printers/discover')
  },

  // Update order config
  updateOrderConfig: async (data: OrderConfig) => {
    return apiClient.put('/config/business/order', data)
  },

  // Update sync config
  updateSyncConfig: async (data: SyncConfig) => {
    return apiClient.put('/config/application/SYNC', data)
  }
}
