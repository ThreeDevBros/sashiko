ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_delivery_lat double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_delivery_lng double precision;