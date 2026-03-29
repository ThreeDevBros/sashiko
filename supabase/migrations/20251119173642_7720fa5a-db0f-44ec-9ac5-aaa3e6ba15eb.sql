-- Remove the insecure guest orders policy that allows anyone to view all guest orders
DROP POLICY IF EXISTS "Guests can view their orders by email" ON public.orders;

-- Remove the insecure guest reservations policies
DROP POLICY IF EXISTS "Users can view their own reservations" ON public.table_reservations;
DROP POLICY IF EXISTS "Users can update their own pending reservations" ON public.table_reservations;

-- Add secure policy for authenticated users to view their own orders
CREATE POLICY "Users can view their own orders only" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

-- Re-create the reservations policies without the guest email vulnerability
CREATE POLICY "Users can view their own reservations only" 
ON public.table_reservations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending reservations only" 
ON public.table_reservations 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending');

-- Note: Guest order/reservation access will now be handled through secure edge functions