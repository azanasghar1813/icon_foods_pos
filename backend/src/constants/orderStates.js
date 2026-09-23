export const OrderLifecycleState = Object.freeze({
  DRAFT: 'DRAFT',
  HELD: 'HELD',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  ARCHIVED: 'ARCHIVED'
});

export const KitchenState = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const PaymentState = Object.freeze({
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
});

export const DeliveryState = Object.freeze({
  WAITING_RIDER: 'WAITING_RIDER',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED'
});

export const TableState = Object.freeze({
  FREE: 'FREE',
  OCCUPIED: 'OCCUPIED',
  ORDERING: 'ORDERING',
  DINING: 'DINING',
  AWAITING_BILL: 'AWAITING_BILL',
  CLEANING: 'CLEANING'
});

export const OrderType = Object.freeze({
  DINE_IN: 'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
  DELIVERY: 'DELIVERY',
  DRIVE_THRU: 'DRIVE_THRU',
  DRIVE_THROUGH: 'DRIVE_THROUGH',
  ONLINE: 'ONLINE'
});

export function normalizeOrderType(value) {
  const raw = String(value || 'DINE_IN').toUpperCase().replace(/[\s-]+/g, '_');
  if (raw === 'DRIVE_THRU' || raw === 'DRIVE_THROUGH') return OrderType.DRIVE_THROUGH;
  if (raw === 'TAKEAWAY' || raw === 'TAKE_AWAY') return OrderType.TAKEAWAY;
  if (raw === 'DELIVERY') return OrderType.DELIVERY;
  if (raw === 'ONLINE') return OrderType.ONLINE;
  if (raw === 'DINE_IN' || raw === 'DINEIN') return OrderType.DINE_IN;
  return OrderType.DINE_IN;
}

export const AllowedLifecycleTransitions = Object.freeze({
  [OrderLifecycleState.DRAFT]: [
    OrderLifecycleState.HELD,
    OrderLifecycleState.ACTIVE,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.HELD]: [
    OrderLifecycleState.DRAFT,
    OrderLifecycleState.ACTIVE,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.ACTIVE]: [
    OrderLifecycleState.DRAFT,
    OrderLifecycleState.HELD,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.CANCELLED,
    OrderLifecycleState.REFUNDED
  ],
  [OrderLifecycleState.COMPLETED]: [
    OrderLifecycleState.ACTIVE,
    OrderLifecycleState.REFUNDED,
    OrderLifecycleState.ARCHIVED,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.CANCELLED]: [
    OrderLifecycleState.ARCHIVED,
    OrderLifecycleState.DRAFT,
    OrderLifecycleState.ACTIVE,
    OrderLifecycleState.HELD
  ],
  [OrderLifecycleState.REFUNDED]: [
    OrderLifecycleState.ARCHIVED
  ],
  [OrderLifecycleState.ARCHIVED]: []
});

export const AllowedKitchenTransitions = Object.freeze({
  [KitchenState.PENDING]: [KitchenState.SENT, KitchenState.PREPARING, KitchenState.READY, KitchenState.SERVED, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.SENT]: [KitchenState.PREPARING, KitchenState.READY, KitchenState.SERVED, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.PREPARING]: [KitchenState.READY, KitchenState.SERVED, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.READY]: [KitchenState.PREPARING, KitchenState.SERVED, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.SERVED]: [KitchenState.PREPARING, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.COMPLETED]: [KitchenState.PREPARING, KitchenState.CANCELLED],
  [KitchenState.CANCELLED]: [KitchenState.PENDING, KitchenState.SENT, KitchenState.PREPARING, KitchenState.COMPLETED]
});

export const AllowedPaymentTransitions = Object.freeze({
  [PaymentState.UNPAID]: [PaymentState.PAID],
  [PaymentState.PAID]: [PaymentState.REFUNDED],
  [PaymentState.REFUNDED]: []
});

// States where modification of order items/cart is permitted
export const EditableLifecycleStates = [
  OrderLifecycleState.DRAFT,
  OrderLifecycleState.HELD,
  OrderLifecycleState.ACTIVE,
  OrderLifecycleState.COMPLETED
];
