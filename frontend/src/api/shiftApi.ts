import { apiClient } from './client';

export interface ShiftData {
  id: string;
  userId: string;
  openedAt: string;
  openingFloat: number;
  terminalId: string;
  expectedCash: number;
  metrics: {
    cashSales: number;
    onlineSales: number;
    refunds: number;
    discounts: number;
    totalOrders: number;
    totalCashDrops: number;
    totalPaidOuts: number;
  };
  cashDrops: {
    id: string;
    time: string;
    amount: number;
    reason: string;
    destination: string;
    printed: boolean;
  }[];
  paidOuts: {
    id: string;
    time: string;
    purpose: string;
    amount: number;
    approvedBy: string;
  }[];
  transactions: {
    time: string;
    orderNo: string;
    customer: string;
    paymentMethod: string;
    amount: number;
    cashier: string;
    status: string;
  }[];
  shiftActivities: {
    id: string;
    time: string;
    type: string;
    description: string;
    severity: "info" | "warning" | "error" | "success";
  }[];
}

export interface ShiftHistoryRecord {
  id: string;
  date: string;
  cashier: string;
  till: string;
  openingFloat: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  shiftTime: string;
  status: "Balanced" | "Discrepancy";
}

export const shiftApi = {
  getActiveShift: async () => {
    return apiClient.get<ShiftData>('/shifts/active');
  },
  
  startShift: async (openingFloat: number, terminalId: string = 'Main Till #1') => {
    return apiClient.post<ShiftData>('/shifts/start', { openingFloat, terminalId });
  },
  
  closeShift: async (sessionId: string, countedCash: number, discrepancyNotes: string = '') => {
    return apiClient.post<{ message: string; history: ShiftHistoryRecord[] }>('/shifts/close', { sessionId, countedCash, discrepancyNotes });
  },
  
  addCashDrop: async (sessionId: string, amount: number, reason: string, destination: string) => {
    return apiClient.post<{ dropId: string }>('/shifts/cash-drop', { sessionId, amount, reason, destination });
  },
  
  addPaidOut: async (sessionId: string, amount: number, purpose: string, approvedBy: string) => {
    return apiClient.post<{ poId: string }>('/shifts/paid-out', { sessionId, amount, purpose, approvedBy });
  },
  
  getShiftHistory: async () => {
    return apiClient.get<ShiftHistoryRecord[]>('/shifts/history');
  }
};
