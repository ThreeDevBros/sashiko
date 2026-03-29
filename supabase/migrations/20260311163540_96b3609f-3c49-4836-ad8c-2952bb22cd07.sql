ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS login_tagline text DEFAULT 'Authentic Asian Cuisine',
  ADD COLUMN IF NOT EXISTS login_tagline_bold boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_tagline_italic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_tagline_underline boolean DEFAULT false;