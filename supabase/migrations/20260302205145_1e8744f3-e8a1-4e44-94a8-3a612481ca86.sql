
-- Add order auto-progression settings to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS auto_prepare_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_prepare_percent integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS auto_ready_enabled boolean DEFAULT true;

-- auto_prepare_percent: percentage of estimated prep time elapsed before moving confirmed → preparing
-- auto_prepare_enabled: toggle for confirmed → preparing auto-transition
-- auto_ready_enabled: toggle for preparing → ready auto-transition when estimated time is reached
