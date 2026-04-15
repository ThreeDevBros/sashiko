
ALTER TABLE public.orders ADD COLUMN payment_method text;

UPDATE public.orders SET payment_method = CASE
  WHEN stripe_payment_intent_id IS NOT NULL THEN 'card'
  ELSE 'cash'
END;
