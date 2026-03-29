
ALTER TABLE public.menu_items 
  ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_included_in_price boolean NOT NULL DEFAULT false;
