
CREATE TABLE public.social_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  custom_name text,
  url text NOT NULL DEFAULT '',
  logo_url text,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage social media links"
  ON public.social_media_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Social media links are viewable by everyone"
  ON public.social_media_links FOR SELECT
  USING (true);
