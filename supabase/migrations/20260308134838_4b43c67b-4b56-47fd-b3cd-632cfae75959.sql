
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS banner_style text NOT NULL DEFAULT 'single',
ADD COLUMN IF NOT EXISTS banner_data jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS slideshow_interval_seconds integer NOT NULL DEFAULT 7;
