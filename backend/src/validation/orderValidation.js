import { z } from 'zod';
import { OrderLifecycleState, OrderType } from '../constants/orderStates.js';

export const createOrderSchema = z.object({
  order_type: z.nativeEnum(OrderType).optional().default(OrderType.DINE_IN),
  customer_id: z.string().uuid().optional().nullable(),
  table_id: z.string().optional().nullable(),
  branch_id: z.string().optional().default('DEFAULT_BRANCH'),
  notes: z.string().optional().nullable()
}).passthrough();

export const addItemSchema = z.object({
  product_id: z.string().uuid({ message: 'Product ID must be a valid UUID' }),
  variant_id: z.string().uuid().optional().nullable(),
  variant_name: z.string().optional().nullable(),
  modifiers: z.array(z.object({
    modifier_id: z.string().uuid(),
    group_id: z.string().uuid().optional().nullable(),
    price_adjustment: z.number().optional(),
    quantity: z.number().int().min(1).optional().default(1)
  })).optional().default([]),
  addons: z.array(z.object({
    addon_id: z.string().uuid(),
    unit_price: z.number().optional(),
    quantity: z.number().int().min(1).optional().default(1)
  })).optional().default([]),
  comboComponents: z.array(z.object({
    component_id: z.string().optional().nullable(),
    product_id: z.string().min(1),
    product_name_snapshot: z.string().optional().nullable(),
    variant_snapshot: z.string().optional().nullable(),
    price_adjustment: z.number().optional().default(0),
    quantity: z.number().int().min(1).optional().default(1),
    is_dummy: z.boolean().optional()
  })).optional().default([]),
  quantity: z.number().int().min(1).default(1),
  notes: z.string().optional().nullable()
});

export const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0)
});

export const holdOrderSchema = z.object({
  holdName: z.string().min(1, 'Hold name is required')
});

export const transitionStateSchema = z.object({
  targetState: z.nativeEnum(OrderLifecycleState),
  reason: z.string().optional().nullable(),
  kitchenState: z.string().optional().nullable(),
  paymentState: z.string().optional().nullable()
});
