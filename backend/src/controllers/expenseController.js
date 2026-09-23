import { expenseService } from '../services/expenseService.js';
import { activityLogService } from '../services/activityLogService.js';
import { z } from 'zod';
import { zodIssueList } from '../utils/zodErrors.js';

const expenseSchema = z.object({
  category: z.string().min(1),
  amount: z.number().min(0),
  description: z.string().optional().nullable(),
  expense_date: z.string().optional().nullable()
});

export const expenseController = {
  getAll: (req, res) => {
    try {
      const expenses = expenseService.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    try {
      const expense = expenseService.getExpenseById(req.params.id);
      res.json(expense);
    } catch (error) {
      if (error.message === 'Expense not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  },

  create: (req, res) => {
    try {
      const data = expenseSchema.parse(req.body);
      const expense = expenseService.createExpense({
        ...data,
        recorded_by: req.user?.id
      });
      
      activityLogService.logActivity(req.user?.id, 'CREATE_EXPENSE', 'EXPENSE', expense.id, { category: expense.category, amount: expense.amount });
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodIssueList(error) });
      res.status(400).json({ error: error.message });
    }
  },

  update: (req, res) => {
    try {
      const data = expenseSchema.parse(req.body);
      const expense = expenseService.updateExpense(req.params.id, data);
      
      activityLogService.logActivity(req.user?.id, 'UPDATE_EXPENSE', 'EXPENSE', expense.id, { category: expense.category, amount: expense.amount });
      
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodIssueList(error) });
      if (error.message === 'Expense not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  },

  delete: (req, res) => {
    try {
      expenseService.deleteExpense(req.params.id);
      
      activityLogService.logActivity(req.user?.id, 'DELETE_EXPENSE', 'EXPENSE', req.params.id);
      
      res.status(204).send();
    } catch (error) {
      if (error.message === 'Expense not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
};
