import { dashboardService } from '../services/dashboardService.js';

export const dashboardController = {
  getSummary: (req, res) => {
    try {
      const data = dashboardService.getSummary();
      return res.status(200).json({ data });
    } catch (error) {
      console.error('[Dashboard Error]', error);
      return res.status(500).json({ error: 'Failed to retrieve dashboard summary', details: error.message });
    }
  },

  getOperations: (req, res) => {
    try {
      const data = dashboardService.getOperations();
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve dashboard operations' });
    }
  },

  getRevenue: (req, res) => {
    try {
      const data = dashboardService.getRevenueAnalytics();
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve revenue analytics' });
    }
  },

  getPopular: (req, res) => {
    try {
      const data = dashboardService.getPopularProducts();
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve popular products' });
    }
  },

  getActivity: (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const data = dashboardService.getActivityFeed(limit);
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve activity feed' });
    }
  }
};
