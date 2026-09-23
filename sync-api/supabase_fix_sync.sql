-- Dubai Food POS — run once in Supabase SQL editor (production project).
-- Safe to re-run. Then redeploy sync-api so the settings upsert fix is live.

-- 1) Payments: local SYSTEM_SHIFT used to be a non-UUID string. Keep these nullable
--    so a leftover bad id is stored as NULL instead of rejecting the whole payment.
ALTER TABLE public.order_payments ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE public.order_payments ALTER COLUMN cashier_user_id DROP NOT NULL;

-- 2) Settings: local PK is `key`. Push now upserts on `key` and sends payload_version.
ALTER TABLE public.application_settings
  ADD COLUMN IF NOT EXISTS payload_version integer DEFAULT 1;
UPDATE public.application_settings SET category = 'GENERAL' WHERE category IS NULL;
ALTER TABLE public.application_settings ALTER COLUMN category SET DEFAULT 'GENERAL';

-- 3) Floor tables: unique business number (id will be UUID after local migration).
CREATE UNIQUE INDEX IF NOT EXISTS dining_tables_table_number_key
  ON public.dining_tables (table_number);

-- 4) Idempotency table must accept setting keys like 'device_id', not only UUIDs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'processed_sync_events'
      AND column_name = 'entity_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE public.processed_sync_events
      ALTER COLUMN entity_id TYPE text USING entity_id::text;
  END IF;
END $$;

-- 5) Orders.branch_id is the string DEFAULT_BRANCH locally. Cloud must not be uuid.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'branch_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE public.orders
      ALTER COLUMN branch_id TYPE text USING branch_id::text;
    ALTER TABLE public.orders ALTER COLUMN branch_id SET DEFAULT 'DEFAULT_BRANCH';
  END IF;
END $$;

-- 6) Confirm shape after the alters
SELECT table_name, column_name, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'order_payments' AND column_name IN ('shift_id', 'cashier_user_id'))
    OR (table_name = 'application_settings' AND column_name IN ('key', 'payload_version', 'category'))
    OR (table_name = 'processed_sync_events' AND column_name = 'entity_id')
    OR (table_name = 'orders' AND column_name = 'branch_id')
  )
ORDER BY table_name, column_name;

-- 7) Product variants so size/price options copy between tills.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_code TEXT,
  sku TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  preparation_time INTEGER,
  kitchen_printer_id UUID,
  lifecycle_state TEXT DEFAULT 'ACTIVE',
  version INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  payload_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
