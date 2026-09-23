import { z } from 'zod';

const nullableId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || v === '') return null;
    return v;
  })
  .pipe(z.string().uuid().nullable());

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  parent_id: nullableId.optional(),
  display_order: z.coerce.number().int().min(0).optional().default(0),
  lifecycle_state: z.string().optional().default('ACTIVE'),
  visibility: z.string().optional().default('VISIBLE'),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
  color_code: z.union([z.string(), z.null()]).optional(),
  icon_name: z.union([z.string(), z.null()]).optional(),
  kitchen_printer_id: nullableId.optional(),
}).passthrough();

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  parent_id: nullableId.optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  lifecycle_state: z.string().optional(),
  visibility: z.string().optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
  color_code: z.union([z.string(), z.null()]).optional(),
  icon_name: z.union([z.string(), z.null()]).optional(),
  kitchen_printer_id: nullableId.optional(),
}).passthrough();
