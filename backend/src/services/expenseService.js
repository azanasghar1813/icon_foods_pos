import { expenseRepository } from '../repositories/expenseRepository.js';

export const expenseService = {
  createExpense: (data) => {
    if (!data.category || data.amount === undefined) {
      throw new Error('Category and amount are required');
    }
    return expenseRepository.create(data);
  },

  updateExpense: (id, data) => {
    const existing = expenseRepository.findById(id);
    if (!existing) throw new Error('Expense not found');
    if (!data.category || data.amount === undefined) {
      throw new Error('Category and amount are required');
    }
    return expenseRepository.update(id, data);
  },

  deleteExpense: (id) => {
    const existing = expenseRepository.findById(id);
    if (!existing) throw new Error('Expense not found');
    return expenseRepository.delete(id);
  },

  getExpenseById: (id) => {
    const expense = expenseRepository.findById(id);
    if (!expense) throw new Error('Expense not found');
    return expense;
  },

  getAllExpenses: () => {
    return expenseRepository.findAll();
  }
};
