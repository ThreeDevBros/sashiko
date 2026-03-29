ALTER TABLE public.tenant_settings 
  ADD COLUMN IF NOT EXISTS terms_of_service text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_policy text DEFAULT NULL;