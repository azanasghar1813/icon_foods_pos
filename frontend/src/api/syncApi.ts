import { apiClient } from './client';

export interface SyncStatus {
  pending: number;
  failed: number;
  synced: number;
  isRunning: boolean;
  currentPhase: 'IDLE' | 'PUSHING' | 'PULLING' | 'ERROR';
  logs: { timestamp: string, message: string, level: string }[];
  nextRunDelay: number;
  deviceId?: string;
}

export interface ActiveDevice {
  id: string;
  name: string;
  ip: string;
  role: string;
  lastSeen: number;
  status: string;
}

export interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  status: string;
  error_details?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  permanent_failure: number;
}

export const syncApi = {
  getStatus: () => apiClient.get('/sync/status') as Promise<SyncStatus>,
  
  triggerSync: () => apiClient.post('/sync/trigger', {}, { timeout: 60000 }) as Promise<{ message: string, pushed?: number, pulled?: number }>,
  
  getActiveDevices: () => apiClient.get('/sync/devices') as Promise<ActiveDevice[]>,

  getQueue: (status: string, limit?: number) => {
    const url = limit ? `/sync/queue?status=${status}&limit=${limit}` : `/sync/queue?status=${status}`;
    return apiClient.get(url) as Promise<SyncQueueItem[]>;
  },

  retryEvent: (id: string) => apiClient.post(`/sync/retry/${id}`) as Promise<{ message: string }>,
  
  retryAll: () => apiClient.post(`/sync/retry-all`) as Promise<{ message: string }>,
  
  clearQueue: () => apiClient.delete(`/sync/clear-queue`) as Promise<{ message: string }>,

  reassignIdentity: () => apiClient.post(`/sync/reassign-identity`) as Promise<{ message: string, newDeviceId: string }>,

  resolveConflict: (id: string, resolution: 'keep_local' | 'keep_cloud') =>
    apiClient.post(`/sync/resolve/${id}`, { resolution }) as Promise<{ message: string }>
};
