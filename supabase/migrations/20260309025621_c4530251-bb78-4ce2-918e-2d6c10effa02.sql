
-- First, delete duplicate rows keeping only the latest per order_id
DELETE FROM public.driver_locations a
USING public.driver_locations b
WHERE a.order_id = b.order_id
  AND a.updated_at < b.updated_at;

-- Now add unique constraint on order_id
ALTER TABLE public.driver_locations ADD CONSTRAINT driver_locations_order_id_unique UNIQUE (order_id);
