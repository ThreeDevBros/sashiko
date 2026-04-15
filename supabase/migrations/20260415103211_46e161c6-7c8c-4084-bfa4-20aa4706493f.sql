-- Remove the overly permissive order_items insert policy
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Remove the dangerous anon update policy on push_device_tokens
DROP POLICY IF EXISTS "Anon can update device tokens" ON public.push_device_tokens;