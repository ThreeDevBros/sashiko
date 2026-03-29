-- Drop RLS policies first
DROP POLICY IF EXISTS "Admins can delete API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can insert API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can update API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can view API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Service role can read API keys" ON public.api_keys;

-- Drop functions that reference the api_key_type enum or api_keys table
DROP FUNCTION IF EXISTS public.get_api_key(api_key_type);
DROP FUNCTION IF EXISTS public.get_api_key_internal(api_key_type);
DROP FUNCTION IF EXISTS public.insert_api_key(api_key_type, text, text);
DROP FUNCTION IF EXISTS public.update_api_key(api_key_type, text);

-- Drop the table
DROP TABLE IF EXISTS public.api_keys;

-- Drop the enum type
DROP TYPE IF EXISTS public.api_key_type;