-- Allow staff to view and update orders
CREATE POLICY "Staff can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Staff can update order status"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Allow staff to view and update reservations
CREATE POLICY "Staff can view all reservations"
ON public.table_reservations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Staff can update reservations"
ON public.table_reservations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'staff'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);