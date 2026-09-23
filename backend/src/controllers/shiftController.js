import { shiftService } from '../services/shiftService.js';

export const shiftController = {
  getActiveShift: (req, res) => {
    try {
      const userId = req.user.userId;
      const shift = shiftService.getActiveShift(userId);
      res.json(shift);
    } catch (err) {
      console.error('Error fetching active shift:', err);
      res.status(500).json({ error: 'Failed to fetch active shift' });
    }
  },

  startShift: (req, res) => {
    try {
      const userId = req.user.userId;
      const { openingFloat, terminalId } = req.body;

      if (openingFloat === undefined || openingFloat === null) {
        return res.status(400).json({ error: 'openingFloat is required' });
      }

      const shift = shiftService.startShift(userId, openingFloat, terminalId);
      res.status(201).json(shift);
    } catch (err) {
      console.error('Error starting shift:', err);
      if (err.message.includes('open shift')) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to start shift' });
    }
  },

  closeShift: (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId, countedCash, discrepancyNotes } = req.body;

      if (!sessionId || countedCash === undefined) {
        return res.status(400).json({ error: 'sessionId and countedCash are required' });
      }

      const history = shiftService.closeShift(sessionId, userId, countedCash, discrepancyNotes);
      res.json({ message: 'Shift closed successfully', history });
    } catch (err) {
      console.error('Error closing shift:', err);
      res.status(500).json({ error: 'Failed to close shift' });
    }
  },

  addCashDrop: (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId, amount, reason, destination } = req.body;

      if (!sessionId || !amount) {
        return res.status(400).json({ error: 'sessionId and amount are required' });
      }

      const dropId = shiftService.addCashDrop(sessionId, userId, amount, reason, destination);
      res.status(201).json({ dropId });
    } catch (err) {
      console.error('Error adding cash drop:', err);
      res.status(500).json({ error: 'Failed to log cash drop' });
    }
  },

  addPaidOut: (req, res) => {
    try {
      const userId = req.user.userId;
      const { sessionId, amount, purpose, approvedBy } = req.body;

      if (!sessionId || !amount || !purpose) {
        return res.status(400).json({ error: 'sessionId, amount, and purpose are required' });
      }

      const poId = shiftService.addPaidOut(sessionId, userId, amount, purpose, approvedBy);
      res.status(201).json({ poId });
    } catch (err) {
      console.error('Error adding paid out:', err);
      res.status(500).json({ error: 'Failed to log paid out' });
    }
  },

  getShiftHistory: (req, res) => {
    try {
      const history = shiftService.getShiftHistory();
      res.json(history);
    } catch (err) {
      console.error('Error fetching shift history:', err);
      res.status(500).json({ error: 'Failed to fetch shift history' });
    }
  }
};
