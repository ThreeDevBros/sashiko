ALTER TABLE public.tenant_settings 
ADD COLUMN schedule_min_days integer NOT NULL DEFAULT 0,
ADD COLUMN schedule_max_days integer NOT NULL DEFAULT 7;