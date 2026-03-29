ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS popular_section_title text NOT NULL DEFAULT 'Popular Items',
ADD COLUMN IF NOT EXISTS popular_section_description text NOT NULL DEFAULT 'Customer favorites',
ADD COLUMN IF NOT EXISTS popular_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];