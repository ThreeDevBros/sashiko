-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default tenant settings if none exist
INSERT INTO public.tenant_settings (
  tenant_name,
  hero_title,
  hero_subtitle,
  cta_button_text,
  currency,
  primary_color,
  secondary_color,
  accent_color
)
SELECT
  'Restaurant',
  'Welcome to Our Restaurant',
  'Discover amazing food delivered to your door',
  'Order Now',
  'USD',
  '220 40 60',
  '240 60 80',
  '200 80 60'
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_settings LIMIT 1);

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Enable RLS on tenant_settings and make it readable by everyone
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant settings are viewable by everyone" ON public.tenant_settings;
CREATE POLICY "Tenant settings are viewable by everyone"
  ON public.tenant_settings FOR SELECT
  USING (true);