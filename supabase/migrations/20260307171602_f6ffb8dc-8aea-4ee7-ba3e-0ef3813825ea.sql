ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS show_social_on_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_social_on_profile boolean NOT NULL DEFAULT false;