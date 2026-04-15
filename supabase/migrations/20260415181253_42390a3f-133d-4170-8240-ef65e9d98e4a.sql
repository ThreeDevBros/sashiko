
ALTER TABLE public.orders ADD COLUMN stripe_payment_intent_id text;
CREATE UNIQUE INDEX idx_orders_stripe_payment_intent_id ON public.orders (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
