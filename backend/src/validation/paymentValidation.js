import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Supported payment method codes
// ─────────────────────────────────────────────────────────────────────────────
const PAYMENT_METHOD_CODES = z.enum([
  'CASH', 'CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'OTHER'
]);

// ─────────────────────────────────────────────────────────────────────────────
// Process Cash Payment
// ─────────────────────────────────────────────────────────────────────────────
export const processCashPaymentSchema = z.object({
  payment_method:    z.literal('CASH'),
  amount_received:   z.number({ required_error: 'amount_received is required for cash payment' })
                      .positive('Amount received must be greater than zero'),
  notes:             z.string().max(500).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Process Non-Cash Payment (Card, JazzCash, EasyPaisa, Bank Transfer, Other)
// ─────────────────────────────────────────────────────────────────────────────
export const processNonCashPaymentSchema = z.object({
  payment_method:        PAYMENT_METHOD_CODES.exclude(['CASH'] as const),
  amount:                z.number().positive('Payment amount must be greater than zero'),
  transaction_reference: z.string().min(1).max(200).optional().nullable(),
  approval_code:         z.string().max(100).optional().nullable(),
  notes:                 z.string().max(500).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Universal Process Payment (accepts both cash and non-cash from one endpoint)
// ─────────────────────────────────────────────────────────────────────────────
export const processPaymentSchema = z.discriminatedUnion('payment_method', [
  // Cash branch
  z.object({
    payment_method:        z.literal('CASH'),
    amount_received:       z.number().positive(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
  // Card branch
  z.object({
    payment_method:        z.literal('CARD'),
    amount:                z.number().positive().optional(),
    transaction_reference: z.string().max(200).optional().nullable(),
    approval_code:         z.string().max(100).optional().nullable(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
  // JazzCash branch
  z.object({
    payment_method:        z.literal('JAZZCASH'),
    amount:                z.number().positive().optional(),
    transaction_reference: z.string().max(200).optional().nullable(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
  // EasyPaisa branch
  z.object({
    payment_method:        z.literal('EASYPAISA'),
    amount:                z.number().positive().optional(),
    transaction_reference: z.string().max(200).optional().nullable(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
  // Bank Transfer branch
  z.object({
    payment_method:        z.literal('BANK_TRANSFER'),
    amount:                z.number().positive().optional(),
    transaction_reference: z.string().max(200).optional().nullable(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
  // Other branch
  z.object({
    payment_method:        z.literal('OTHER'),
    amount:                z.number().positive().optional(),
    transaction_reference: z.string().max(200).optional().nullable(),
    notes:                 z.string().max(500).optional().nullable(),
  }),
]);
