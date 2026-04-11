ALTER TABLE public.orders
ADD COLUMN last_push_status text,
ADD COLUMN last_push_message text;