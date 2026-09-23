import { inventoryService } from '../services/inventoryService.js';
import { activityLogService } from '../services/activityLogService.js';
import { z } from 'zod';
import { zodIssueList } from '../utils/zodErrors.js';

const itemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  quantity: z.number().optional().default(0),
  min_stock_level: z.number().optional().default(0),
  unit: z.string().optional().default('pcs'),
  unit_cost: z.number().min(0).optional().default(0),
  last_restock_date: z.string().optional().nullable()
});

const adjustSchema = z.object({
  quantity_changed: z.number(),
  action: z.enum(['ADD', 'REMOVE', 'ADJUST', 'SALE']),
  reference_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const inventoryController = {
  getAll: (req, res) => {
    try {
      const items = inventoryService.getAllItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    try {
      const item = inventoryService.getItemById(req.params.id);
      res.json(item);
    } catch (error) {
      if (error.message === 'Inventory item not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  },

  getLogs: (req, res) => {
    try {
      const logs = inventoryService.getLogs(req.query.itemId, parseInt(req.query.limit) || 100);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  create: (req, res) => {
    try {
      const data = itemSchema.parse(req.body);
      const item = inventoryService.createItem(data, req.user?.id);
      
      activityLogService.logActivity(req.user?.id, 'CREATE_INVENTORY_ITEM', 'INVENTORY', item.id, { name: item.name });
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodIssueList(error) });
      res.status(400).json({ error: error.message });
    }
  },

  update: (req, res) => {
    try {
      const data = itemSchema.parse(req.body);
      const item = inventoryService.updateItem(req.params.id, data);
      
      activityLogService.logActivity(req.user?.id, 'UPDATE_INVENTORY_ITEM', 'INVENTORY', item.id, { name: item.name });
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodIssueList(error) });
      if (error.message === 'Inventory item not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  },

  adjustStock: (req, res) => {
    try {
      const data = adjustSchema.parse(req.body);
      const item = inventoryService.adjustStock(
        req.params.id, 
        data.quantity_changed, 
        data.action, 
        req.user?.id, 
        data.reference_id, 
        data.notes
      );
      
      activityLogService.logActivity(req.user?.id, 'ADJUST_INVENTORY', 'INVENTORY', item.id, { name: item.name, action: data.action, change: data.quantity_changed });
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodIssueList(error) });
      if (error.message === 'Inventory item not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  },

  delete: (req, res) => {
    try {
      inventoryService.deleteItem(req.params.id);
      
      activityLogService.logActivity(req.user?.id, 'DELETE_INVENTORY_ITEM', 'INVENTORY', req.params.id);
      
      res.status(204).send();
    } catch (error) {
      if (error.message === 'Inventory item not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
};
