
ALTER TABLE public.branch_popular_items
  ADD COLUMN section_title text NOT NULL DEFAULT 'Popular Items',
  ADD COLUMN section_description text NOT NULL DEFAULT 'Customer favorites';
