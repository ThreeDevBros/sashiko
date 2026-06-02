
-- 1. Restaurant images: restrict write operations to admins
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete restaurant images" ON storage.objects;

CREATE POLICY "Admins can upload restaurant images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'restaurant-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update restaurant images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'restaurant-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'restaurant-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete restaurant images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'restaurant-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Revoke EXECUTE on internal SECURITY DEFINER functions that should not be
--    callable directly by app users. Trigger functions and queue helpers run
--    via triggers/edge functions with the service role.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduct_cashback(uuid, numeric) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_on_delivery() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_display_order_number() FROM anon, authenticated, public;
