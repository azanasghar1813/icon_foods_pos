import { OrderLifecycleState } from '../constants/orderStates.js';

class OrderCacheService {
  constructor() {
    this.cache = new Map(); // orderId -> order
    this.numberIndex = new Map(); // orderNumber -> orderId
  }

  isCacheable(order) {
    if (!order || !order.lifecycle_state) return false;
    // Only cache active, non-terminal orders
    const nonCacheable = [
      OrderLifecycleState.COMPLETED,
      OrderLifecycleState.CANCELLED,
      OrderLifecycleState.REFUNDED,
      OrderLifecycleState.ARCHIVED
    ];
    return !nonCacheable.includes(order.lifecycle_state);
  }

  upsertOrder(order) {
    if (!order || !order.id) return;

    if (this.isCacheable(order)) {
      this.cache.set(order.id, order);
      if (order.order_number) {
        this.numberIndex.set(order.order_number, order.id);
      }
    } else {
      this.invalidate(order.id);
    }
  }

  getOrder(orderId) {
    return this.cache.get(orderId) || null;
  }

  getOrderByNumber(orderNumber) {
    const id = this.numberIndex.get(orderNumber);
    if (!id) return null;
    return this.cache.get(id) || null;
  }

  getActiveOrders() {
    return Array.from(this.cache.values());
  }

  getHeldOrders() {
    return Array.from(this.cache.values()).filter(
      o => o.lifecycle_state === OrderLifecycleState.HELD
    );
  }

  getKitchenOrders() {
    return Array.from(this.cache.values()).filter(
      o => [OrderLifecycleState.ACTIVE].includes(o.lifecycle_state)
    );
  }

  invalidate(orderId) {
    const order = this.cache.get(orderId);
    if (order && order.order_number) {
      this.numberIndex.delete(order.order_number);
    }
    this.cache.delete(orderId);
  }

  clear() {
    this.cache.clear();
    this.numberIndex.clear();
  }
}

export const orderCacheService = new OrderCacheService();
