
CREATE TABLE public.branch_popular_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  popular_item_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id)
);

ALTER TABLE public.branch_popular_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage branch popular items"
  ON public.branch_popular_items FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch popular items viewable by everyone"
  ON public.branch_popular_items FOR SELECT
  TO public
  USING (true);
