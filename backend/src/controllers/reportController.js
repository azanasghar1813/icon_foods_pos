import { reportService } from '../services/reportService.js';

export const reportController = {
  getSummary: async (req, res) => {
    try {
      const filters = req.query;
      const data = await reportService.getSummary(filters);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error in getSummary:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch summary data' });
    }
  },

  getDetailedSales: async (req, res) => {
    try {
      const filters = req.query;
      const data = await reportService.getDetailedSales(filters);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error in getDetailedSales:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch detailed sales data' });
    }
  },

  getRecentItems: async (req, res) => {
    try {
      const filters = req.query;
      const data = await reportService.getRecentItems(filters);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error in getRecentItems:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch recent items data' });
    }
  },

  getTrends: async (req, res) => {
    try {
      const filters = req.query;
      const data = await reportService.getTrends(filters);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error in getTrends:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch trend data' });
    }
  },
  
  getProductDetails: async (req, res) => {
    try {
      const { id } = req.params;
      const filters = req.query;
      const data = await reportService.getProductDetails(id, filters);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error in getProductDetails:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch product detail data' });
    }
  }
};
