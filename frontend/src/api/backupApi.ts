import { apiClient } from './client';

export interface BackupRecord {
  id: string;
  filename: string;
  size: string;
  status: string;
  date: string;
  type: string;
  createdBy?: string;
}

export const backupApi = {
  getBackups: () => apiClient.get('/backup') as Promise<BackupRecord[]>,
  
  createBackup: () => apiClient.post('/backup/create') as Promise<{ message: string; backup: BackupRecord }>,
  
  deleteBackup: (id: string) => apiClient.delete(`/backup/${id}`) as Promise<{ message: string }>,
  
  restoreBackup: (file: File) => {
    const formData = new FormData();
    formData.append('backup', file);
    return apiClient.post('/backup/restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  restoreLocalBackup: (id: string) => apiClient.post(`/backup/restore-local/${id}`) as Promise<{ message: string }>
};
