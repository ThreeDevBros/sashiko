INSERT INTO public.profiles (id, full_name, phone, email, avatar_url)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    NULLIF(TRIM(BOTH ' ' FROM COALESCE(u.raw_user_meta_data->>'given_name','') || ' ' || COALESCE(u.raw_user_meta_data->>'family_name','')), ''),
    ''
  ),
  NULLIF(u.raw_user_meta_data->>'phone', ''),
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'avatar_url',''), NULLIF(u.raw_user_meta_data->>'picture',''))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;