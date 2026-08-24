-- 1. Push tokens must belong to the caller (or be anonymous device-only rows)
DROP POLICY IF EXISTS "Anyone can insert device tokens" ON public.push_device_tokens;

CREATE POLICY "Users can register their own device tokens"
ON public.push_device_tokens
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2. Revoke direct API execution of internal SECURITY DEFINER routines
REVOKE EXECUTE ON FUNCTION public.deduct_cashback(uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_table_availability(uuid, text, date, time without time zone, time without time zone, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;

-- Trigger-only routines should never be callable from the Data API
REVOKE EXECUTE ON FUNCTION public.assign_display_order_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_on_delivery() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;