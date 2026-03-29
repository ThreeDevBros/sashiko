ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS google_maps_rating numeric;