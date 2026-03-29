-- Fix order_items RLS policy - remove public access and restrict to owners/admins

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

-- Create policy for users to view their own order items
CREATE POLICY "Users can view their own order items" 
ON public.order_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = order_items.order_id 
  AND orders.user_id = auth.uid()
));

-- Create policy for admins/staff to view all order items
CREATE POLICY "Admins and staff can view all order items" 
ON public.order_items 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'branch_manager')
);