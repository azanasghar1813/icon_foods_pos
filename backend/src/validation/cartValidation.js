import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ────────────────────────────────────────────────────────────────────────────

const modifierInputSchema = z.object({
  modifier_id: z.string().min(1),
  group_id: z.string().min(1).optional().nullable(),
  price_adjustment: z.number().optional(),
  quantity: z.number().int().min(1).optional().default(1)
});

const addonInputSchema = z.object({
  addon_id: z.string().min(1),
  unit_price: z.number().optional(),
  quantity: z.number().int().min(1).optional().default(1)
});

const comboComponentInputSchema = z.object({
  component_id: z.string().optional().nullable(),
  product_id: z.string().min(1),
  product_name_snapshot: z.string().optional().nullable(),
  variant_snapshot: z.string().optional().nullable(),
  price_adjustment: z.number().optional().default(0),
  quantity: z.number().int().min(1).optional().default(1),
  is_dummy: z.boolean().optional()
});

// ────────────────────────────────────────────────────────────────────────────
// Cart request schemas
// ────────────────────────────────────────────────────────────────────────────

export const addItemToCartSchema = z.object({
  product_id: z.string().min(1, { message: 'product_id is required' }),
  variant_id: z.string().min(1).optional().nullable(),
  variant_name: z.string().optional().nullable(),
  modifiers: z.array(modifierInputSchema).optional().default([]),
  addons: z.array(addonInputSchema).optional().default([]),
  comboComponents: z.array(comboComponentInputSchema).optional().default([]),
  quantity: z.number().int().min(1).default(1),
  notes: z.string().max(500).optional().nullable()
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, { message: 'Quantity must be 0 or greater (0 removes item)' })
});

export const setCartNotesSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
  kitchen_notes: z.string().max(1000).optional().nullable()
});

export const setCartMetaSchema = z.object({
  order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'DRIVE_THRU', 'DRIVE_THROUGH', 'ONLINE']).optional(),
  customer_id: z.string().min(1).optional().nullable(),
  table_id: z.string().optional().nullable(),
  waiter_id: z.string().optional().nullable(),
  waiter_name_snapshot: z.string().optional().nullable(),
  rider_id: z.string().optional().nullable(),
  rider_name_snapshot: z.string().optional().nullable(),
  is_vip: z.boolean().or(z.number()).optional(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable()
}).passthrough();

export const checkoutCartSchema = z.object({
  order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'DRIVE_THRU', 'DRIVE_THROUGH', 'ONLINE']).optional(),
  customer_id: z.string().min(1).optional().nullable(),
  table_id: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  branch_id: z.string().optional(),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  delivery_charges: z.number().nonnegative().optional(),
  service_charge: z.number().nonnegative().optional()
}).passthrough();
