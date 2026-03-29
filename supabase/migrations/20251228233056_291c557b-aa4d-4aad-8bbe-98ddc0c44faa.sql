CREATE OR REPLACE FUNCTION public.get_api_key(p_key_type api_key_type)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_value text;
BEGIN
  -- Allow public access to browser-safe keys only
  -- (Google Maps JS keys should be restricted by HTTP referrer in Google Cloud Console)
  IF p_key_type IN ('STRIPE_PUBLISHABLE_KEY', 'MAPBOX_PUBLIC_TOKEN', 'GOOGLE_MAPS_API_KEY') THEN
    SELECT key_value INTO v_value
    FROM public.api_keys
    WHERE key_type = p_key_type;

    RETURN v_value;
  END IF;

  -- Require admin role for all other keys (secret keys)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT key_value INTO v_value
  FROM public.api_keys
  WHERE key_type = p_key_type;

  RETURN v_value;
END;
$function$;