REVOKE EXECUTE ON FUNCTION public.check_table_availability(uuid, text, date, time without time zone, time without time zone, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_cashback(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC;