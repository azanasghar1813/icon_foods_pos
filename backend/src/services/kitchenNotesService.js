import { orderMetadataRepository } from '../repositories/orderMetadataRepository.js';
import { orderItemRepository } from '../repositories/orderItemRepository.js';

class KitchenNotesService {
  updateOrderKitchenNotes(orderId, notes) {
    orderMetadataRepository.setMeta(orderId, 'kitchen_notes', notes || null);
    return notes || null;
  }

  updateOrderPriority(orderId, priority) {
    orderMetadataRepository.setMeta(orderId, 'priority', priority || 'NORMAL');
    return priority || 'NORMAL';
  }

  updateItemNotes(itemId, notes) {
    orderItemRepository.updateItem(itemId, { notes: notes || null });
    return notes || null;
  }
}

export const kitchenNotesService = new KitchenNotesService();
