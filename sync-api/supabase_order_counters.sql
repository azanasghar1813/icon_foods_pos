-- Shared ticket counter for all POS tills. Run once on Supabase.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.order_counters (
  branch_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, business_date)
);

CREATE OR REPLACE FUNCTION public.allocate_order_number(
  p_branch TEXT,
  p_date TEXT,
  p_min INTEGER DEFAULT 0
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO public.order_counters (branch_id, business_date, last_sequence, updated_at)
  VALUES (p_branch, p_date, GREATEST(COALESCE(p_min, 0), 0) + 1, NOW())
  ON CONFLICT (branch_id, business_date)
  DO UPDATE SET
    last_sequence = GREATEST(public.order_counters.last_sequence, COALESCE(p_min, 0)) + 1,
    updated_at = NOW()
  RETURNING last_sequence INTO v_next;
  RETURN v_next;
END;
$$;
