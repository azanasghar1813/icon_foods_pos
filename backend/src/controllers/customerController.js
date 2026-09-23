import { customerService } from '../services/customerService.js';
import { activityLogService } from '../services/activityLogService.js';
import { z } from 'zod';
import { zodIssueList } from '../utils/zodErrors.js';

const customerSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  loyalty_points: z.number().int().min(0).optional().default(0),
  is_vip: z.boolean().or(z.number()).optional().default(0),
  notes: z.string().optional().nullable()
});

export const customerController = {
  getAll: (req, res) => {
    try {
      const customers = customerService.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    try {
      const customer = customerService.getCustomerById(req.params.id);
      res.json(customer);
    } catch (error) {
      if (error.message === 'Customer not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  create: (req, res) => {
    try {
      const data = customerSchema.parse(req.body);
      const customer = customerService.createCustomer(data);
      
      activityLogService.logActivity(req.user.id, 'CREATE_CUSTOMER', 'CUSTOMER', customer.id, { name: customer.first_name });
      
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: zodIssueList(error) });
      }
      res.status(400).json({ error: error.message });
    }
  },

  update: (req, res) => {
    try {
      const data = customerSchema.parse(req.body);
      const customer = customerService.updateCustomer(req.params.id, data);
      
      activityLogService.logActivity(req.user.id, 'UPDATE_CUSTOMER', 'CUSTOMER', customer.id, { name: customer.first_name });
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: zodIssueList(error) });
      }
      if (error.message === 'Customer not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  },

  delete: (req, res) => {
    try {
      customerService.deleteCustomer(req.params.id);
      
      activityLogService.logActivity(req.user.id, 'DELETE_CUSTOMER', 'CUSTOMER', req.params.id);
      
      res.status(204).send();
    } catch (error) {
      if (error.message === 'Customer not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  },

  deleteAll: (req, res) => {
    try {
      customerService.deleteAllCustomers();
      activityLogService.logActivity(req.user.id, 'DELETE_ALL_CUSTOMERS', 'CUSTOMER', 'all');
      res.status(200).json({ success: true, message: 'All customers deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
