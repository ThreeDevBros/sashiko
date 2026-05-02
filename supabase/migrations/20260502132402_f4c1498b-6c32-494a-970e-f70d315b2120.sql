-- Add email column to profiles to mirror auth.users.email
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update handle_new_user to capture all data from OAuth providers (Google/Apple)
-- and email/password signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text;
  v_phone text;
  v_avatar text;
BEGIN
  -- Resolve full name from common provider fields
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(
      TRIM(BOTH ' ' FROM
        COALESCE(NEW.raw_user_meta_data->>'given_name', '') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'family_name', '')
      ),
      ''
    ),
    ''
  );

  -- Phone (only present for our own email/password signup form)
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  -- Avatar URL (Google: 'picture' or 'avatar_url'; Apple does not provide one)
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', '')
  );

  INSERT INTO public.profiles (id, full_name, phone, email, avatar_url)
  VALUES (NEW.id, v_full_name, v_phone, NEW.email, v_avatar);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Backfill email and avatar for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

UPDATE public.profiles p
SET avatar_url = COALESCE(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
FROM auth.users u
WHERE p.id = u.id
  AND (p.avatar_url IS NULL OR p.avatar_url = '')
  AND (
    u.raw_user_meta_data->>'avatar_url' IS NOT NULL
    OR u.raw_user_meta_data->>'picture' IS NOT NULL
  );

-- Backfill full_name for existing profiles where missing
UPDATE public.profiles p
SET full_name = COALESCE(
  NULLIF(u.raw_user_meta_data->>'full_name', ''),
  NULLIF(u.raw_user_meta_data->>'name', ''),
  NULLIF(
    TRIM(BOTH ' ' FROM
      COALESCE(u.raw_user_meta_data->>'given_name', '') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'family_name', '')
    ),
    ''
  )
)
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = '');