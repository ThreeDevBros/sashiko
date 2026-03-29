
-- Add delivery fee formula columns to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS delivery_base_fee numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS delivery_fee_per_km numeric NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_delivery_fee numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_delivery_fee numeric NOT NULL DEFAULT 0;
