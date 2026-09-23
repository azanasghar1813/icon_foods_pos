import { activityLogService } from '../services/activityLogService.js';

export const activityLogController = {
  getLogs: (req, res) => {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        userId: req.query.userId,
        entityType: req.query.entityType,
        action: req.query.action
      };
      
      const logs = activityLogService.getLogs(options);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
