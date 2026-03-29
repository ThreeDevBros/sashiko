CREATE POLICY "Staff can view user addresses for orders"
ON public.user_addresses
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'branch_manager'::app_role)
);