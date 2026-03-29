ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS estimated_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;