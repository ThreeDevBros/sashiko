
-- Add scheduled_alert_minutes to tenant_settings
-- This controls how many minutes before branch opening the staff gets notified about scheduled orders
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS scheduled_alert_minutes integer NOT NULL DEFAULT 30;
