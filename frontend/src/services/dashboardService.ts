import { apiClient } from '../api/client'

export interface DashboardSummary {
  todaySales: number
  ordersCount: number
  preparing: number
  ready: number
  served: number
  paid: number
  unpaid: number
  cancelled: number
  completed: number
  notCompleted: number
  completedSales: number
  aov: number
  customers: number
  fastFood: number
  restaurant: number
  deals: number
  cashInDrawer: number
}

export interface DashboardOperations {
  activeCashiers: number
  kitchenQueue: number
  preparing: number
  ready: number
  unpaidOrders: number
}

export interface RevenueAnalytics {
  hour: string
  sales: number
}

export interface PopularProduct {
  id: string
  name: string
  sales: number
}

export interface ActivityFeedItem {
  id: string
  title: string
  type: string
  user: string
  time: string
}

export const dashboardService = {
  getSummary: async (): Promise<{ data: DashboardSummary }> => {
    return apiClient.get('/dashboard/summary')
  },
  
  getOperations: async (): Promise<{ data: DashboardOperations }> => {
    return apiClient.get('/dashboard/operations')
  },
  
  getRevenueAnalytics: async (): Promise<{ data: RevenueAnalytics[] }> => {
    return apiClient.get('/dashboard/revenue')
  },
  
  getPopularProducts: async (): Promise<{ data: PopularProduct[] }> => {
    return apiClient.get('/dashboard/popular')
  },
  
  getActivityFeed: async (limit: number = 10): Promise<{ data: ActivityFeedItem[] }> => {
    return apiClient.get(`/dashboard/activity?limit=${limit}`)
  }
}
