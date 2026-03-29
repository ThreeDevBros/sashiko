
-- Create branch_hours table for per-day opening and delivery hours
CREATE TABLE public.branch_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
  is_closed boolean NOT NULL DEFAULT false,
  is_24h boolean NOT NULL DEFAULT false,
  open_time time WITHOUT TIME ZONE,
  close_time time WITHOUT TIME ZONE,
  delivery_open_time time WITHOUT TIME ZONE,
  delivery_close_time time WITHOUT TIME ZONE,
  delivery_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(branch_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.branch_hours ENABLE ROW LEVEL SECURITY;

-- Everyone can view branch hours
CREATE POLICY "Branch hours viewable by everyone"
  ON public.branch_hours FOR SELECT
  USING (true);

-- Admins can manage branch hours
CREATE POLICY "Admins can manage branch hours"
  ON public.branch_hours FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add google_maps_place_id to branches for fetching reviews
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS google_maps_place_id text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS google_maps_review_count integer;
