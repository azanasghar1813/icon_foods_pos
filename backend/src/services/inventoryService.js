import { inventoryRepository } from '../repositories/inventoryRepository.js';
import { dbEngine } from '../database/sqlite.js';

export const inventoryService = {
  createItem: (data, userId = null) => {
    return dbEngine.transaction(() => {
      const item = inventoryRepository.createItem(data);
      if (item.quantity !== 0) {
        inventoryRepository.logAction(item.id, userId, 'ADD', item.quantity, item.quantity, null, 'Initial stock');
      }
      return item;
    });
  },

  updateItem: (id, data) => {
    const existing = inventoryRepository.findById(id);
    if (!existing) throw new Error('Inventory item not found');
    return inventoryRepository.updateItem(id, data);
  },

  adjustStock: (id, quantityChanged, action, userId = null, referenceId = null, notes = null) => {
    return dbEngine.transaction(() => {
      const existing = inventoryRepository.findById(id);
      if (!existing) throw new Error('Inventory item not found');
      
      const newQuantity = existing.quantity + quantityChanged;
      const lastRestock = action === 'ADD' ? new Date().toISOString() : null;
      
      const item = inventoryRepository.adjustQuantity(id, quantityChanged, newQuantity, lastRestock);
      inventoryRepository.logAction(id, userId, action, quantityChanged, newQuantity, referenceId, notes);
      
      return item;
    });
  },

  deleteItem: (id) => {
    const existing = inventoryRepository.findById(id);
    if (!existing) throw new Error('Inventory item not found');
    return inventoryRepository.deleteItem(id);
  },

  getItemById: (id) => {
    const item = inventoryRepository.findById(id);
    if (!item) throw new Error('Inventory item not found');
    return item;
  },

  getAllItems: () => {
    return inventoryRepository.findAll();
  },

  getLogs: (itemId = null, limit = 100) => {
    return inventoryRepository.getLogs(itemId, limit);
  }
};
