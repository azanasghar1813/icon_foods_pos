import { orderTimelineRepository } from '../repositories/orderTimelineRepository.js';
import crypto from 'crypto';

class OrderTimelineService {
  recordEvent(orderId, userId, eventType, { from_state = null, to_state = null, description, metadata = {} }, options = {}) {
    try {
      const entryId = crypto.randomUUID();
      orderTimelineRepository.createEntry({
        id: entryId,
        order_id: orderId,
        user_id: userId || 'SYSTEM',
        event_type: eventType,
        from_state,
        to_state,
        description,
        metadata
      });
      return entryId;
    } catch (error) {
      console.error(`[OrderTimelineService] Failed to record timeline event for order ${orderId}:`, error.message);
      if (options.strict) {
        throw error;
      }
      return null;
    }
  }

  getOrderTimeline(orderId) {
    return orderTimelineRepository.findByOrderId(orderId);
  }
}

export const orderTimelineService = new OrderTimelineService();
